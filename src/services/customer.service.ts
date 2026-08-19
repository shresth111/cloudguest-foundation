import { api } from "@/services/api";
import { ORGS_STORAGE_KEY, ROLES_STORAGE_KEY } from "@/context/AuthContext";
import type { OrganizationMembership, RoleAssignment } from "@/types/auth";

/* ── Types ─────────────────────────────────────────────────── */

/** Minimal shape read from `/locations/{id}/routers` and `/guest-sessions`
 * (raw backend snake_case) -- listLocations() hits these directly to enrich
 * the location picker without pulling in router.service.ts/guest.service.ts's
 * full normalization + org-wide fan-out helpers. */
interface RawRouterStatus {
  status: string;
}
interface RawGuestSessionStatus {
  status: string;
  bytes_downloaded?: number;
  bytes_uploaded?: number;
}
interface RawLocationSummary {
  id: string;
  name: string;
  city: string;
  property_type: string | null;
}
interface RawGuestSession {
  id: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  ip_address?: string | null;
  device_id: string | null;
  // Real GuestSession.guest_id FK (see GuestSessionResponse in backend
  // app/domains/guest/schemas.py) -- the join key back to this guest's
  // ConnectedDevice row(s) for a real MAC and for the router-level
  // force-disconnect (see disconnectSession() below).
  guest_id?: string | null;
  bytes_downloaded?: number;
  user_agent?: string | null;
}

/** Minimal shape read from `/connected-devices` for the bulk guest_id ->
 * MAC lookup in getUsers() -- see that method's comment for why this is
 * one bulk fetch per page load rather than one request per row. */
interface RawConnectedDevice {
  id: string;
  mac_address: string;
  ip_address: string;
  guest_id: string | null;
  is_active: boolean;
  connected_at: string;
  last_seen_at: string;
}

export interface NavItem {
  id: string;
  label: string;
  module: string;
}

export interface CustomerLocationSummary {
  id: string;
  name: string;
  city: string;
  status: "online" | "offline" | "degraded";
  onlineUsers: number;
  routerHealth: number;
  bandwidth: string;
  isp: string;
  lastSync: string;
  organizationId: string;
  organizationName: string;
  routersTotal: number;
  routersOnline: number;
  sessionsActive: number;
  sessionsTotal: number;
  // Backend `Location.property_type` (see business-type-icons.ts) -- null
  // for locations created before this field existed.
  propertyType: string | null;
}

export interface CustomerDashboardData {
  health: { systemHealth: string; routersOnline: string; isp: string };
  // `slaUptime` is `null` when there's no active ISP link / bucket data
  // yet to compute a real figure from -- see getDashboard()'s own
  // comment. Never a fabricated placeholder number.
  kpis: {
    onlineUsers: number;
    activeSessions: number;
    routersOnline: number;
    totalRouters: number;
    todayGuests: number;
    avgSession: number;
    peakConcurrent: number;
    failedLogins: number;
    newToday: number;
    slaUptime: number | null;
  };
  usersTrend: { hour: string; users: number }[];
  recentUsers: {
    id: string;
    name: string;
    email: string;
    device: string;
    time: string;
    status: string;
  }[];
  recentAlerts: { type: "error" | "warning" | "success" | "info"; msg: string; time: string }[];
  deviceDistribution: { name: string; value: number }[];
  hourlySessions: { hour: string; sessions: number }[];
}

export interface CustomerUsersData {
  users: {
    id: string;
    name: string;
    email: string;
    phone: string;
    device: string;
    mac: string;
    ip: string;
    duration: string;
    connectedAt: string;
    disconnectedAt: string | null;
    download: string;
    status: "online" | "offline" | "idle";
    guestId: string | null;
    /** Display-only: how many raw GuestSession rows this one table row represents -- see groupFragmentedVisits()'s own docstring. 1 (or absent) for an ungrouped row. */ mergedSessionCount?: number;
  }[];
  total: number;
  page: number;
  pageSize: number;
}

type RawUserRow = CustomerUsersData["users"][number];

// A brief Wi-Fi reconnect (OS captive-portal re-probe, a phone locking/
// backgrounding and missing the router's keepalive, a captive-portal tab
// remounting) legitimately closes one GuestSession and opens another --
// see backend/app/domains/guest/service.py's `_reuse_or_create_session`
// docstring for why the backend itself still keeps these as separate,
// real accounting rows rather than resurrecting one. That's correct for
// billing/audit, but reads as noise here: a guest's real single visit to
// the venue showing up as 5-8 near-identical rows a few minutes apart.
// Purely a presentation grouping -- the real per-interval rows this reads
// are untouched, and nothing downstream of this file ever sees the merge.
const RECONNECT_GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * Collapses consecutive rows (this page's own already-sorted-newest-first,
 * already-paginated slice -- see getUsers() below) for the same guest+MAC
 * into one displayed "visit" whenever the gap between one row ending and
 * the next (chronologically earlier, since this list is newest-first)
 * starting is small. Deliberately narrow, mirroring the backend's own
 * `_find_reusable_active_session` precision concern: only ever merges
 * rows that share a real `guestId` *and* a real, matched `mac` (an
 * "Unknown" MAC never merges -- no reliable device fingerprint to prove
 * these rows are really the same visit rather than two different,
 * simultaneously-unmatched devices), and only ever merges strictly
 * adjacent rows -- a guest whose fragments land non-adjacently in this
 * page's slice (interleaved with a different guest's rows) is left
 * ungrouped rather than merged out of order.
 *
 * Known limitation: this only ever sees one server page (`pageSize` rows)
 * at a time, so a guest's fragments that straddle a page boundary stay on
 * separate pages/rows -- full cross-page grouping would need a real
 * server-side aggregate, out of scope for a display-only pass.
 */
function groupFragmentedVisits(rows: RawUserRow[]): RawUserRow[] {
  const groups: RawUserRow[][] = [];
  for (const row of rows) {
    const group = groups[groups.length - 1];
    const earliestInGroup = group?.[group.length - 1];
    const gapMs =
      earliestInGroup && row.disconnectedAt
        ? new Date(earliestInGroup.connectedAt).getTime() - new Date(row.disconnectedAt).getTime()
        : null;
    const sameVisit =
      !!earliestInGroup &&
      !!row.guestId &&
      row.guestId === earliestInGroup.guestId &&
      row.mac !== "Unknown" &&
      row.mac === earliestInGroup.mac &&
      gapMs !== null &&
      gapMs >= 0 &&
      gapMs <= RECONNECT_GROUP_GAP_MS;
    if (sameVisit) group.push(row);
    else groups.push([row]);
  }
  return groups.map((group) => {
    if (group.length === 1) return group[0];
    const newest = group[0];
    const oldest = group[group.length - 1];
    const totalMb = group.reduce((sum, r) => sum + (parseInt(r.download, 10) || 0), 0);
    const startMs = new Date(oldest.connectedAt).getTime();
    const endMs = newest.disconnectedAt ? new Date(newest.disconnectedAt).getTime() : Date.now();
    return {
      // id/status/device/etc from the most recent fragment -- the one
      // "Disconnect" (if online) or the detail panel should act on.
      ...newest,
      connectedAt: oldest.connectedAt,
      duration: `${Math.max(0, Math.round((endMs - startMs) / 60_000))} min`,
      download: `${totalMb} MB`,
      mergedSessionCount: group.length,
    };
  });
}

/** Real server-side pagination metadata -- this codebase's established
 * `PaginationMeta` shape (see backend/app/database/utils/pagination.py),
 * carried through as-is rather than re-derived on the frontend, so
 * `totalPages` always reflects what the server actually counted. */
export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface AdminLogsDashboardLoginRow {
  id: string;
  email: string;
  ipAddress: string;
  success: boolean;
  failureReason: string | null;
  time: string;
}
export interface AdminLogsRouterEventRow {
  id: string;
  locationName: string;
  routerName: string;
  eventType: string;
  message: string | null;
  isError: boolean;
  time: string;
}
export interface AdminLogsActivityRow {
  id: string;
  action: string;
  description: string | null;
  actor: string;
  entityType: string;
  time: string;
}

export interface CustomerFeatureData {
  analytics?: {
    totalSessions: number;
    uniqueGuests: number;
    returningRate: number;
    avgDuration: number;
  };
  campaigns?: {
    id: string;
    name: string;
    status: string;
    impressions: number;
    conversions: number;
  }[];
  vouchers?: { code: string; plan: string; status: string; used: number }[];
  portal?: { status: string; theme: string; authMethods: string[]; languages: string[] };
  devices?: { mac: string; ip: string; device: string; firstSeen: string; lastSeen: string }[];
  macAuth?: {
    id: string;
    mac: string;
    type: string;
    expiresAt: string | null;
    comment: string | null;
    enabled: boolean;
  }[];
  adminLogs?: {
    dashboardLogins: AdminLogsDashboardLoginRow[];
    routerLogs: AdminLogsRouterEventRow[];
    // Real administrative change-audit trail (role/permission/location/
    // member changes, etc.) -- merged in from what used to be the separate
    // "Audit Log" nav tab (`GET /audit/entries`, same `audit_log_entries`
    // table `app.domains.audit` already served that page from). Folded
    // into this one "admin-logs" feature fetch rather than kept as its own
    // "audit" case/query key, now that both live on the same Owner-only
    // Admin Logs page. `exclude_view_events=true` on that fetch drops the
    // "*_viewed" read-only access-logging noise (see customer.service.ts's
    // own "admin-logs" case for why); `actor` is an email when resolvable
    // from the dashboard-logins list fetched alongside it, else the raw
    // actor_user_id, else "System" -- never a fabricated name.
    accountActivity: AdminLogsActivityRow[];
  };
}

/* ── Demo Data ─────────────────────────────────────────────── */

// Every demo location runs a single router (one venue, one gateway --
// the realistic small-business topology this product actually targets),
// and ISPs are kept to the two carriers guests will actually recognize
// (Airtel/Jio) rather than a grab-bag of every regional ISP name.
const DEMO_LOCATIONS: CustomerLocationSummary[] = [
  {
    id: "loc-1",
    name: "Mumbai HQ",
    city: "Mumbai",
    status: "online",
    onlineUsers: 142,
    routerHealth: 98,
    bandwidth: "450 Mbps",
    isp: "Airtel",
    lastSync: "Just now",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 142,
    sessionsTotal: 892,
    propertyType: "office",
  },
  {
    id: "loc-2",
    name: "Delhi Office",
    city: "Delhi",
    status: "online",
    onlineUsers: 98,
    routerHealth: 95,
    bandwidth: "300 Mbps",
    isp: "Jio",
    lastSync: "2 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 98,
    sessionsTotal: 456,
    propertyType: "office",
  },
  {
    id: "loc-3",
    name: "Bangalore DC",
    city: "Bangalore",
    status: "degraded",
    onlineUsers: 76,
    routerHealth: 72,
    bandwidth: "180 Mbps",
    isp: "Jio",
    lastSync: "5 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 76,
    sessionsTotal: 312,
    propertyType: "coworking_space",
  },
  {
    id: "loc-4",
    name: "Chennai Office",
    city: "Chennai",
    status: "online",
    onlineUsers: 54,
    routerHealth: 99,
    bandwidth: "250 Mbps",
    isp: "Airtel",
    lastSync: "1 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 54,
    sessionsTotal: 234,
    propertyType: "cafe",
  },
  {
    id: "loc-5",
    name: "Hyderabad DC",
    city: "Hyderabad",
    status: "offline",
    onlineUsers: 0,
    routerHealth: 0,
    bandwidth: "0 Mbps",
    isp: "Airtel",
    lastSync: "15 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 0,
    sessionsActive: 0,
    sessionsTotal: 0,
    propertyType: "hotel",
  },
  {
    id: "loc-6",
    name: "Kolkata Office",
    city: "Kolkata",
    status: "online",
    onlineUsers: 32,
    routerHealth: 91,
    bandwidth: "200 Mbps",
    isp: "Jio",
    lastSync: "3 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 32,
    sessionsTotal: 156,
    propertyType: null,
  },
  {
    id: "loc-7",
    name: "Pune Office",
    city: "Pune",
    status: "online",
    onlineUsers: 67,
    routerHealth: 97,
    bandwidth: "350 Mbps",
    isp: "Jio",
    lastSync: "Just now",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 67,
    sessionsTotal: 345,
    propertyType: "restaurant",
  },
  {
    id: "loc-8",
    name: "Ahmedabad DC",
    city: "Ahmedabad",
    status: "online",
    onlineUsers: 89,
    routerHealth: 93,
    bandwidth: "280 Mbps",
    isp: "Airtel",
    lastSync: "4 min ago",
    organizationId: "org-1",
    organizationName: "Acme Corp",
    routersTotal: 1,
    routersOnline: 1,
    sessionsActive: 89,
    sessionsTotal: 423,
    propertyType: "hospital",
  },
];

/** Realistic (but fake) guest identities for demo mode -- previously
 * `getUsers()`/`getDashboard()` paired a real-looking name with a generic
 * `user{n}@email.com` address and no phone number at all, so a demo account
 * (used for sales walkthroughs and marketing-site screenshots) never had
 * anything to actually show off on the "data-masking" feature: there was no
 * phone field to mask, and every email looked like the same auto-generated
 * placeholder. One identity per name, reused everywhere that name is reused
 * (getUsers cycles through these by index, same as it already cycled through
 * names/devices) so the same demo guest carries the same email/phone across
 * rows -- more realistic than a fresh fake address per row, and gives
 * `maskEmail`/`maskPhone` real, varied strings to redact. */
const DEMO_GUEST_IDENTITIES: { name: string; email: string; phone: string }[] = [
  { name: "John Doe", email: "john.doe83@gmail.com", phone: "+91 98765 43210" },
  { name: "Jane Smith", email: "jane.smith22@yahoo.com", phone: "+91 91234 56780" },
  { name: "Raj Kumar", email: "raj.kumar99@outlook.com", phone: "+91 90000 12345" },
  { name: "Priya Sharma", email: "priya.sharma7@gmail.com", phone: "+91 88888 22334" },
  { name: "Alex Chen", email: "alex.chen@hotmail.com", phone: "+91 99887 76655" },
  { name: "Sarah Wilson", email: "sarah.wilson1@gmail.com", phone: "+91 97654 32109" },
  { name: "Mike Brown", email: "mike.brown44@yahoo.com", phone: "+91 96543 21098" },
  { name: "Emily Davis", email: "emily.davis5@gmail.com", phone: "+91 95432 10987" },
];

const DEMO_NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", module: "dashboard" },
  { id: "users", label: "Users", module: "guest_sessions" },
  { id: "analytics", label: "Analytics", module: "analytics" },
  { id: "reports", label: "Reports", module: "reports" },
  { id: "campaigns", label: "Campaigns", module: "campaigns" },
  { id: "portal", label: "Portal", module: "captive_portal" },
  { id: "vouchers", label: "Vouchers", module: "voucher" },
  { id: "policies", label: "Policies", module: "policy" },
  { id: "whitelist", label: "Always Allowed", module: "guest_access" },
  { id: "devices", label: "Devices", module: "connected_devices" },
  { id: "teams", label: "Guest Groups", module: "guest_teams" },
  { id: "agents", label: "Staff Access", module: "roles" },
  { id: "networking", label: "Networking", module: "dhcp" },
  { id: "advanced", label: "Advanced", module: "system_settings" },
  { id: "audit", label: "Audit Logs", module: "audit_logs" },
  { id: "help", label: "Help", module: "notifications" },
];

/* ── Helpers ───────────────────────────────────────────────── */

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cloudguest_token") === "demo-access-token";
}

interface MyOrganizationMembership {
  id: string;
  organization_id: string;
  status: string;
}

let cachedOrgId: string | null = null;
/** Resolves the current session's organization id for endpoints that
 * require X-Organization-Id (e.g. MAC authorization -- see
 * backend/app/domains/mac_authorization/service.py's OrganizationRequiredError).
 * Callers already run inside getFeatureData's try/catch, so a throw here
 * just falls back to demo data like any other failure.
 *
 * Uses /me/organizations (membership-scoped) rather than the platform-wide
 * GET /organizations -- an ordinary customer/org-owner session doesn't hold
 * the elevated permission that endpoint requires and gets a 403, which is
 * exactly what silently broke listLocations() below (see
 * ticket.service.ts's resolveOrgId for the identical fix, applied there
 * first). */
export async function resolveOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { data } = await api.get<MyOrganizationMembership[]>("/me/organizations");
  const membership = data.find((m) => m.status === "active") ?? data[0];
  if (!membership) throw new Error("No organization found for the current session");
  cachedOrgId = membership.organization_id;
  return cachedOrgId;
}

/** Buckets session user-agent strings into the OS categories the dashboard
 * chart shows. Deliberately simple substring sniffing, not a full UA
 * parser library -- good enough for a breakdown chart, not for anything
 * security- or billing-sensitive. */
function deviceDistributionFrom(
  sessions: { userAgent: string | null }[],
): { name: string; value: number }[] {
  const counts: Record<string, number> = {
    iOS: 0,
    Android: 0,
    Windows: 0,
    macOS: 0,
    Linux: 0,
    Other: 0,
  };
  for (const s of sessions) {
    const ua = (s.userAgent ?? "").toLowerCase();
    if (!ua) {
      counts.Other++;
      continue;
    }
    if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) counts.iOS++;
    else if (ua.includes("android")) counts.Android++;
    else if (ua.includes("windows")) counts.Windows++;
    else if (ua.includes("mac os") || ua.includes("macintosh")) counts.macOS++;
    else if (ua.includes("linux")) counts.Linux++;
    else counts.Other++;
  }
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

/** A friendly, single-device label sniffed from the session's user-agent --
 * same substring approach as deviceDistributionFrom() above, just returning
 * one label instead of a bucketed count. Used by getUsers(): the Users
 * table's "Device" column has no real device-name field to show (that
 * lives on GuestDevice, which /guest-sessions doesn't join in), so this is
 * the honest, non-fabricated stand-in -- not the session's device_id (a raw
 * UUID FK, not a device name). */
export function deviceLabelFrom(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "Unknown device";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("android")) return "Android device";
  if (ua.includes("windows")) return "Windows PC";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("linux")) return "Linux device";
  return "Unknown device";
}

/** Picks the real ConnectedDevice that was actually active during a given
 * session, out of a guest's possibly-several device rows -- not just
 * "whichever device is currently active for this guest," which produced a
 * real, reported inconsistency: a guest's session rows all showed the
 * SAME (current) device's MAC while the "Device" column, derived
 * per-session from that session's own real user_agent, correctly varied
 * session to session -- e.g. one MAC labeled "Android device" in some
 * rows and "Windows PC" in others, because that guest genuinely used more
 * than one real device over time, but every row's MAC was clamped to
 * whichever one happens to be active right now. Matches by real time-
 * window overlap ([connected_at, last_seen_at] vs. the session's own
 * started_at) instead, falling back to the active/most-recent device only
 * when there's no better signal (a guest with exactly one device row, the
 * overwhelmingly common case, is unaffected either way). */
function matchDeviceForSession(
  devices: RawConnectedDevice[],
  sessionStartedAt: string,
): RawConnectedDevice | undefined {
  if (devices.length === 0) return undefined;
  if (devices.length === 1) return devices[0];
  const startedMs = new Date(sessionStartedAt).getTime();
  const overlapping = devices.filter((d) => {
    const connectedMs = new Date(d.connected_at).getTime();
    const lastSeenMs = new Date(d.last_seen_at).getTime();
    return startedMs >= connectedMs && startedMs <= lastSeenMs;
  });
  if (overlapping.length > 0) {
    // More than one device's window could still overlap (e.g. two
    // sessions running back to back) -- prefer whichever's own window
    // started closest to this session, the real device most plausibly in
    // use at that moment.
    return overlapping.reduce((best, d) =>
      Math.abs(new Date(d.connected_at).getTime() - startedMs) <
      Math.abs(new Date(best.connected_at).getTime() - startedMs)
        ? d
        : best,
    );
  }
  // No device's real window covers this session at all (e.g. the device
  // was removed/re-synced since) -- fall back to the currently active
  // one, or the most recently seen, rather than guessing further.
  return (
    devices.find((d) => d.is_active) ??
    devices.reduce((latest, d) =>
      new Date(d.last_seen_at) > new Date(latest.last_seen_at) ? d : latest,
    )
  );
}

/** Real `Guest.identifier`/`display_name` (see backend `GET /guests` --
 * `GuestResponse.identifier`/`display_name` are `MaskedIdentifier`/
 * `MaskedName`, so the server itself already masks or reveals these per
 * the calling user's own `data_masking_enabled` setting; this file's own
 * `masked` toggle re-masking on top is a documented no-op on an
 * already-masked value, never double-mangling). `identifier` is a single
 * column holding either a phone number or an email, whichever the guest
 * actually presented at login -- same `@`-presence dispatch backend's own
 * `mask_identifier` uses, since there's no separate typed column to tell
 * them apart. */
export interface RawGuest {
  id: string;
  identifier: string | null;
  display_name: string | null;
  // Real `Guest.created_at` (backend `GuestResponse.created_at`, always
  // present) -- when the guest record itself was created, i.e. their very
  // first login ever, distinct from a *session's* started_at. Used by
  // UserReports.tsx's daily new-vs-returning breakdown to tell "first seen
  // today" apart from "seen today, but returning" without a separate
  // endpoint. Optional here only because this type is also used in call
  // sites that never read it and shouldn't be forced to supply it.
  created_at?: string;
}

/** Minimal shape for resolving this location's active ISP uplink, same
 * client-side "fetch up to 100 org-wide links, filter by location_id,
 * sort by is_active_uplink/role/priority" resolution `useWanSummary`
 * already does in the dashboard route -- no `location_id` filter exists
 * server-side (`GET /isp/links` only takes `router_id`), so this mirrors
 * that same real precedent rather than inventing a different one. */
interface RawIspLinkForSla {
  id: string;
  location_id: string | null;
  is_active_uplink: boolean;
  role: string;
  priority: number;
}

interface RawIspHealthCheckBucket {
  total_checks: number;
  uptime_percentage: number | null;
}

/** Real guest sessions never had *any* identity to show (Finding: every
 * row hardcoded `name: "Guest", email: "", phone: ""` regardless of what
 * the guest actually gave at sign-in) even though the backend fully
 * captures it (`Guest.identifier`/`display_name`) and the UI already has
 * working `maskEmail`/`maskPhone` display logic wired up -- built and
 * proven out against demo data, just never connected to the real API. */
export function identityFromGuest(guest: RawGuest | undefined): {
  name: string;
  email: string;
  phone: string;
} {
  const name = guest?.display_name || "Guest";
  const identifier = guest?.identifier ?? "";
  const isEmail = identifier.includes("@");
  return { name, email: isEmail ? identifier : "", phone: !isEmail ? identifier : "" };
}

function timeAgo(d: string): string {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  return m < 1 ? "Just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

/* ── Customer Service ──────────────────────────────────────── */

export const customerService = {
  /* ── Sidebar / Nav ─────────────────────────────────────── */
  async getNav(): Promise<NavItem[]> {
    if (isDemo()) return DEMO_NAV;
    try {
      const { data } = await api.get<{ items: { id: string; label: string; module: string }[] }>(
        "/dashboard/sidebar",
      );
      return data?.items?.map((i) => ({ id: i.id, label: i.label, module: i.module })) ?? [];
    } catch {
      return [];
    }
  },

  /* ── Location Switcher ─────────────────────────────────── */
  /**
   * Was a sequential `for (org) { for (loc) { await router; await sessions } }`
   * loop, where the per-location `routerService.list()` / `guestService.listSessions()`
   * calls each *internally* re-fan-out across every organization just to
   * resolve the one location's org id (see router.service.ts's
   * `fetchAllLocations()`, guest.service.ts's `fanOutPerOrg()`) -- so every
   * location cost O(orgs) extra requests on top of the O(orgs) already paid
   * to list locations, and every one of those requests was awaited one at a
   * time. With N orgs and L locations that's on the order of L*N sequential
   * round trips, which is what produced the "stuck loading" bug as test orgs
   * accumulated in the dev DB. Fixed by (1) fetching every org's locations in
   * parallel, matching location.service.ts's own `fetchAllLocations()`
   * `allSettled` pattern, and (2) enriching every location in parallel too,
   * hitting `/locations/{id}/routers` and `/guest-sessions?location_id=` directly
   * (org id is already known from step 1, so there's no need to re-resolve it)
   * instead of going through routerService/guestService's expensive fan-out helpers.
   */
  async listLocations(): Promise<CustomerLocationSummary[]> {
    if (isDemo()) return DEMO_LOCATIONS;
    try {
      // /organizations is the platform-wide admin listing -- an ordinary
      // customer/org-owner session gets a 403 (no organizations.read at
      // GLOBAL scope), which silently emptied this whole page. The login
      // response already carries every org the session belongs to,
      // including its name (persisted by AuthContext), so there's no need
      // to re-fetch it at all -- and no membership-scoped equivalent of
      // GET /organizations/{id} exists to fall back on (it also requires
      // GLOBAL scope, same bug, different endpoint).
      const stored = localStorage.getItem(ORGS_STORAGE_KEY);
      const memberships: OrganizationMembership[] = stored ? JSON.parse(stored) : [];
      const orgs = memberships.map((m) => ({ id: m.organizationId, name: m.organizationName }));

      // Deliberately not locationService.list({ organizationId }) -- even
      // with an organizationId given, it unconditionally calls the same
      // GLOBAL-only fetchAllOrganizations() just to resolve a display name
      // we already have from `orgs` above. Hitting the org-scoped endpoint
      // directly avoids that call (and its 403) entirely.
      const roles: RoleAssignment[] = (() => {
        try {
          return JSON.parse(localStorage.getItem(ROLES_STORAGE_KEY) || "[]") as RoleAssignment[];
        } catch {
          return [];
        }
      })();
      const perOrg = await Promise.allSettled(
        orgs.map(async (org) => {
          try {
            const { data } = await api.get<{ items: RawLocationSummary[] }>(
              `/organizations/${org.id}/locations`,
              { params: { page_size: 50 }, headers: { "X-Organization-Id": org.id } },
            );
            return (data?.items ?? []).map((loc) => ({ loc, orgId: org.id, orgName: org.name }));
          } catch (err) {
            // A location-scoped staff role (Network Engineer, Office Admin,
            // Location Manager, ...) can never satisfy this org-wide
            // listing's permission check -- the backend's RBAC scope
            // hierarchy correctly refuses a location-level grant for an
            // organization-level check, no matter what permissions the role
            // itself carries. Fall back to fetching just the specific
            // location(s) this user's own location-scoped role assignments
            // name -- the single-location endpoint CAN authorize that once
            // X-Location-Id is sent, since the check then resolves at
            // location scope instead. Without this, a location-scoped
            // staff member's own venue silently never appeared here.
            if ((err as { status?: number }).status !== 403) return [];
            const locationIds = Array.from(
              new Set(
                roles
                  .filter(
                    (r) =>
                      r.scopeType === "location" && r.organizationId === org.id && r.locationId,
                  )
                  .map((r) => r.locationId as string),
              ),
            );
            const perLocation = await Promise.allSettled(
              locationIds.map((locationId) =>
                api.get<RawLocationSummary>(`/locations/${locationId}`, {
                  headers: { "X-Organization-Id": org.id, "X-Location-Id": locationId },
                }),
              ),
            );
            const fallbackPairs: { loc: RawLocationSummary; orgId: string; orgName: string }[] = [];
            for (const result of perLocation) {
              if (result.status === "fulfilled") {
                fallbackPairs.push({ loc: result.value.data, orgId: org.id, orgName: org.name });
              }
            }
            return fallbackPairs;
          }
        }),
      );
      const locOrgPairs = perOrg
        .filter(
          (
            r,
          ): r is PromiseFulfilledResult<
            { loc: RawLocationSummary; orgId: string; orgName: string }[]
          > => r.status === "fulfilled",
        )
        .flatMap((r) => r.value);

      const enriched = await Promise.allSettled(
        locOrgPairs.map(async ({ loc, orgId, orgName }) => {
          // X-Location-Id (not just X-Organization-Id) matters here too --
          // without it, RBAC resolves these checks at organization scope,
          // which a location-scoped staff role's grants (routers.read,
          // guest_sessions.read) can never satisfy, same as the org-wide
          // locations listing above.
          const locationHeaders = { "X-Organization-Id": orgId, "X-Location-Id": loc.id };
          const [routersR, sessionsR] = await Promise.allSettled([
            api.get<{ items: RawRouterStatus[] }>(`/locations/${loc.id}/routers`, {
              params: { page_size: 100 },
              headers: locationHeaders,
            }),
            api.get<{ items: RawGuestSessionStatus[] }>("/guest-sessions", {
              params: { location_id: loc.id, page_size: 50 },
              headers: locationHeaders,
            }),
          ]);
          const routers = routersR.status === "fulfilled" ? (routersR.value.data?.items ?? []) : [];
          const sessions =
            sessionsR.status === "fulfilled" ? (sessionsR.value.data?.items ?? []) : [];
          const onR = routers.filter((r) => r.status === "online").length;
          const tR = routers.length || 1;
          // See getDashboard()'s identical guard below -- a location with
          // zero online routers can't genuinely have online guests, so
          // don't let a stale "active" session row contradict the
          // "offline" status this same summary reports.
          const active = onR === 0 ? 0 : sessions.filter((s) => s.status === "active").length;
          const summary: CustomerLocationSummary = {
            id: loc.id,
            name: loc.name,
            city: loc.city,
            status: onR === 0 && tR > 0 ? "offline" : onR < tR ? "degraded" : "online",
            onlineUsers: active,
            routerHealth: Math.round((onR / tR) * 100),
            bandwidth: `${(sessions.reduce((s, se) => s + (se.bytes_downloaded || 0) + (se.bytes_uploaded || 0), 0) / 1e6).toFixed(0)} MB`,
            isp: "Active",
            lastSync: "Just now",
            organizationId: orgId,
            organizationName: orgName,
            routersTotal: routers.length,
            routersOnline: onR,
            sessionsActive: active,
            sessionsTotal: sessions.length,
            propertyType: loc.property_type,
          };
          return summary;
        }),
      );
      const results = enriched
        .filter(
          (r): r is PromiseFulfilledResult<CustomerLocationSummary> => r.status === "fulfilled",
        )
        .map((r) => r.value);

      return results;
    } catch {
      return [];
    }
  },

  /* ── Executive Dashboard ───────────────────────────────── */
  async getDashboard(locationId: string): Promise<DashboardDataResult> {
    if (isDemo()) {
      // Each location has its own single router and ISP (see DEMO_LOCATIONS)
      // -- this dashboard used to return one hardcoded Mumbai-shaped snapshot
      // ("4/4" routers, Tata Communications) no matter which location was
      // open, so switching locations never changed the "Core systems" strip.
      const loc = DEMO_LOCATIONS.find((l) => l.id === locationId) ?? DEMO_LOCATIONS[0];
      return {
        health: {
          systemHealth: loc.status === "offline" ? "0%" : `${loc.routerHealth}%`,
          routersOnline: `${loc.routersOnline}/${loc.routersTotal}`,
          isp: loc.isp,
        },
        kpis: {
          onlineUsers: loc.onlineUsers,
          activeSessions: loc.sessionsActive,
          routersOnline: loc.routersOnline,
          totalRouters: loc.routersTotal,
          todayGuests: 456,
          avgSession: 34,
          peakConcurrent: 234,
          failedLogins: 12,
          newToday: 89,
          slaUptime: 99.97,
        },
        usersTrend: Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}`,
          users: 20 + ((i * 17) % 120),
        })),
        deviceDistribution: [
          { name: "iOS", value: 35 },
          { name: "Android", value: 28 },
          { name: "Windows", value: 18 },
          { name: "macOS", value: 12 },
          { name: "Linux", value: 5 },
          { name: "Other", value: 2 },
        ],
        hourlySessions: [
          { hour: "00", sessions: 45 },
          { hour: "04", sessions: 22 },
          { hour: "08", sessions: 156 },
          { hour: "12", sessions: 289 },
          { hour: "16", sessions: 342 },
          { hour: "20", sessions: 198 },
        ],
        recentUsers: DEMO_GUEST_IDENTITIES.slice(0, 6).map((identity, i) => ({
          id: `u${i + 1}`,
          name: identity.name,
          email: identity.email,
          device: [
            "iPhone 15",
            "Samsung S24",
            "MacBook Pro",
            "Pixel 8",
            "iPad Air",
            "Windows Laptop",
          ][i],
          time: `${[2, 5, 12, 18, 25, 32][i]} min ago`,
          status: i < 5 ? "online" : "offline",
        })),
        recentAlerts: [
          { type: "warning" as const, msg: "Router signal degradation", time: "2 min ago" },
          { type: "success" as const, msg: "ISP failover completed", time: "8 min ago" },
          { type: "error" as const, msg: `Bandwidth threshold at ${loc.name}`, time: "15 min ago" },
          { type: "info" as const, msg: "Firmware update available", time: "22 min ago" },
        ],
      };
    }
    // Real API composition. Deliberately not routerService.list()/
    // guestService.listSessions() -- both unconditionally fan out across
    // every organization (fetchAllLocations()/fanOutPerOrg(), the same
    // GLOBAL-only pattern fixed in listLocations() above) even when given
    // a specific locationId. Hitting the location-scoped endpoints
    // directly, with the org id this session actually holds, avoids that
    // 403 entirely.
    const orgId = await resolveOrgId();
    const orgHeaders = { headers: { "X-Organization-Id": orgId } };
    // X-Location-Id (not just X-Organization-Id) matters for every one of
    // these location-scoped reads -- without it, RBAC infers ORGANIZATION
    // scope for the permission check (see rbac/dependencies.py's own
    // _infer_scope_type), which a location-scoped staff role's grants
    // (routers.read, isp.read, alerts.read, ...) can never satisfy no
    // matter what the role actually holds -- the exact same gap fixed for
    // listLocations()'s own routers/guest-sessions enrichment above. Before
    // this, a location-scoped Network Engineer session with real, live
    // routers/ISP links/alerts still saw every one of these widgets render
    // an empty/onboarding state, not because the data or the permission
    // was missing, but because the request itself never named the location
    // it was asking about.
    const locationHeaders = {
      headers: { "X-Organization-Id": orgId, "X-Location-Id": locationId },
    };
    const [rR, sR, aR, hR, gR, iR, lR] = await Promise.allSettled([
      api.get<{ items: RawRouterStatus[] }>(`/locations/${locationId}/routers`, {
        params: { page_size: 100 },
        ...locationHeaders,
      }),
      api.get<{ items: RawGuestSession[] }>("/guest-sessions", {
        params: { location_id: locationId, page_size: 100 },
        ...locationHeaders,
      }),
      // Backend's AlertResponse (monitoring/schemas.py) uses `message` +
      // `triggered_at`, not `title`/`created_at` -- those two field names
      // don't exist on the real response and silently read as undefined.
      // `status` (AlertStatus: triggered/acknowledged/resolved) was
      // fetched from nowhere at all before -- every alert rendered as an
      // active error/warning regardless of whether it had long since
      // resolved (bug report from a product review: three alerts that
      // were all real Resolved incidents from 14-25h ago read as live
      // problems on the dashboard, the one surface meant to answer "is my
      // WiFi OK right now").
      api.get<{
        items: { severity: string; message: string; triggered_at: string; status: string }[];
      }>("/alerts", { params: { page_size: 10, organization_id: orgId }, ...locationHeaders }),
      api.get<{
        routers_online: number;
        routers_offline: number;
        total_guests: number;
        active_sessions: number;
      }>("/dashboard/organization", orgHeaders),
      // Bulk guest-identity lookup, same "one fetch per page load, matched
      // client-side by guest_id" shape as getUsers()' own connected-device
      // fetch below -- best-effort, so recentUsers just falls back to "Guest"
      // if this leg fails rather than failing the whole dashboard.
      api.get<{ items: RawGuest[] }>("/guests", {
        params: { location_id: locationId, page_size: 100 },
        ...locationHeaders,
      }),
      // For SLA uptime below -- same up-to-100-org-wide-then-filter
      // resolution as useWanSummary (see RawIspLinkForSla's own comment).
      api.get<{ items: RawIspLinkForSla[] }>("/isp/links", {
        params: { page_size: 100 },
        ...locationHeaders,
      }),
      // Real failed-login count, Owner-only (`_OWNER_ONLY_DEPENDENCIES` on
      // this endpoint) -- org-wide, not location-scoped, since a login
      // attempt isn't tied to any one location. Was previously hardcoded
      // to 0 despite the UI already having a dedicated "N failed logins
      // today" pill built and ready for it (see the render below).
      api.get<{ items: { success: boolean; created_at: string }[] }>(
        "/admin-logs/dashboard-logins",
        { params: { page_size: 100 }, ...orgHeaders },
      ),
    ]);
    const routers = rR.status === "fulfilled" ? (rR.value.data?.items ?? []) : [];
    const sessions = sR.status === "fulfilled" ? (sR.value.data?.items ?? []) : [];
    const alerts = aR.status === "fulfilled" ? (aR.value.data?.items ?? []) : [];
    const health = hR.status === "fulfilled" ? (hR.value.data ?? null) : null;
    const guestsById = new Map<string, RawGuest>();
    if (gR.status === "fulfilled") {
      for (const g of gR.value.data?.items ?? []) guestsById.set(g.id, g);
    }
    const today = new Date().toISOString().slice(0, 10);
    const failedLoginsToday =
      lR.status === "fulfilled"
        ? (lR.value.data?.items ?? []).filter((l) => !l.success && l.created_at?.startsWith(today))
            .length
        : 0;

    // Real ~24h SLA uptime for this location's active ISP uplink -- a
    // weighted average of the same time-bucketed `uptime_percentage` the
    // "Internet Connection" history dialog already charts (never a flat,
    // always-99.9% placeholder that wouldn't have budged even during
    // today's own real outage). `null` (stat omitted, never a fabricated
    // number) when there's no active link or no bucket data yet.
    let slaUptime: number | null = null;
    if (iR.status === "fulfilled") {
      const links = (iR.value.data?.items ?? [])
        .filter((l) => l.location_id === locationId)
        .sort((a, b) => {
          if (a.is_active_uplink !== b.is_active_uplink) return a.is_active_uplink ? -1 : 1;
          if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
          return a.priority - b.priority;
        });
      const activeLink = links[0];
      if (activeLink) {
        try {
          const end = new Date();
          const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
          const { data } = await api.get<{ buckets: RawIspHealthCheckBucket[] }>(
            `/isp/links/${activeLink.id}/health-checks/summary`,
            {
              params: { start_date: start.toISOString(), end_date: end.toISOString() },
              ...locationHeaders,
            },
          );
          const buckets = (data?.buckets ?? []).filter(
            (b) => b.uptime_percentage != null && b.total_checks > 0,
          );
          const totalChecks = buckets.reduce((sum, b) => sum + b.total_checks, 0);
          if (totalChecks > 0) {
            slaUptime =
              buckets.reduce(
                (sum, b) => sum + (b.uptime_percentage as number) * b.total_checks,
                0,
              ) / totalChecks;
          }
        } catch {
          // Stays null -- an honest omission, not a fabricated fallback.
        }
      }
    }
    const onR = routers.filter((r) => r.status === "online").length;
    const tR = routers.length || 1;
    const hourly = new Array(24).fill(0);
    sessions.forEach((s) => {
      if (s.started_at) hourly[new Date(s.started_at).getHours()]++;
    });
    // "Online Users" and "Active Sessions" are the same real thing (one
    // online guest == one active session) and must come from the same
    // count -- `sessions` here is every row /guest-sessions returned
    // (active *and* already-ended), so `sessions.length` alone used to
    // silently double as "Active Sessions", inflating it past the
    // correctly-filtered "Online Users" figure right next to it. And if
    // every router at this location is offline, no guest can genuinely
    // still be online through it -- a stale "active" session row left
    // over from before the router dropped shouldn't make the dashboard
    // contradict its own "Offline" status pill, so floor both to 0 in
    // that case rather than trusting a session row that's outlived its
    // router.
    const activeSessionCount = onR === 0 ? 0 : sessions.filter((s) => s.status === "active").length;
    return {
      health: {
        systemHealth: `${Math.round((onR / tR) * 100)}%`,
        routersOnline: `${onR}/${routers.length}`,
        isp: health ? "Active" : "Unknown",
      },
      kpis: {
        onlineUsers: activeSessionCount,
        activeSessions: activeSessionCount,
        routersOnline: onR,
        totalRouters: routers.length,
        todayGuests: sessions.filter((s) => s.started_at?.startsWith(today)).length,
        avgSession:
          sessions.length > 0
            ? Math.round(
                sessions.reduce((s, se) => s + (se.bytes_downloaded || 0), 0) /
                  sessions.length /
                  1e6,
              )
            : 0,
        peakConcurrent: Math.max(...hourly),
        failedLogins: failedLoginsToday,
        newToday: sessions.filter((s) => s.started_at?.startsWith(today)).length,
        slaUptime,
      },
      usersTrend: hourly.map((c, i) => ({ hour: `${i}`, users: c })),
      deviceDistribution: deviceDistributionFrom(
        sessions.map((s) => ({ userAgent: s.user_agent ?? null })),
      ),
      hourlySessions: hourly.map((c, i) => ({ hour: `${i}`, sessions: c })),
      // s.device_id is the session's raw GuestDevice UUID FK, not a device
      // name -- /guest-sessions doesn't join the device row that would
      // carry one, so this rendered as a bare UUID (bug report: a raw
      // GUID in an owner-facing table reads as "this is broken," not as
      // data). deviceLabelFrom's own honest "Unknown device" fallback
      // (already used by getUsers() below) is the same real fix applied
      // here.
      recentUsers: sessions.slice(0, 6).map((s) => {
        const identity = identityFromGuest(s.guest_id ? guestsById.get(s.guest_id) : undefined);
        return {
          id: s.id,
          name: identity.name,
          email: identity.email,
          device: deviceLabelFrom(s.user_agent),
          time: timeAgo(s.started_at),
          status: s.status === "active" ? ("online" as const) : ("offline" as const),
        };
      }),
      // Resolved alerts (AlertStatus.RESOLVED) get their own "success"
      // type instead of inheriting severity's error/warning coloring --
      // see the fetch above's own comment for why this matters on the
      // dashboard specifically.
      recentAlerts: alerts.slice(0, 5).map((a) => ({
        type:
          a.status === "resolved"
            ? ("success" as const)
            : a.severity === "critical"
              ? ("error" as const)
              : ("warning" as const),
        msg: a.status === "resolved" ? `Resolved: ${a.message}` : a.message,
        time: timeAgo(a.triggered_at),
      })),
    };
  },

  /* ── Users ─────────────────────────────────────────────── */
  async getUsers(
    locationId: string,
    search?: string,
    status?: string,
    page = 1,
    pageSize = 20,
  ): Promise<CustomerUsersData> {
    if (isDemo()) {
      const all = Array.from({ length: 24 }, (_, i) => {
        const identity = DEMO_GUEST_IDENTITIES[i % DEMO_GUEST_IDENTITIES.length];
        const durationMinutes = 15 + (i % 6) * 10;
        const status = (i < 16 ? "online" : i < 20 ? "idle" : "offline") as
          | "online"
          | "offline"
          | "idle";
        // Demo has no real GuestSession row to read started_at/ended_at
        // from, so these are derived to stay consistent with the fixture's
        // own `duration` figure above: connectedAt is `durationMinutes` ago,
        // and only an "offline" demo row gets a disconnectedAt (now) -- an
        // online/idle row is still connected, same "no ended_at yet" shape
        // real active sessions have.
        const connectedAt = new Date(Date.now() - durationMinutes * 60_000).toISOString();
        const disconnectedAt = status === "offline" ? new Date().toISOString() : null;
        return {
          id: `u-${i}`,
          name: identity.name,
          email: identity.email,
          phone: identity.phone,
          device: [
            "iPhone 15",
            "Samsung S24",
            "MacBook Pro",
            "Pixel 8",
            "iPad Air",
            "Windows Laptop",
          ][i % 6],
          mac: `00:1A:${10 + i}`,
          ip: `10.0.${Math.floor(i / 8) + 1}.${100 + i}`,
          duration: `${durationMinutes} min`,
          connectedAt,
          disconnectedAt,
          download: `${(Math.random() * 500).toFixed(0)} MB`,
          status,
          // No real guest/device row backs a demo fixture -- disconnectSession()
          // is already a no-op in demo mode, so this is never dereferenced, but
          // keeping it null (not a fabricated id) matches this file's honest-
          // placeholder convention rather than pretending it's real.
          guestId: null as string | null,
        };
      });
      let f = [...all];
      if (search) {
        const q = search.toLowerCase();
        f = f.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      }
      if (status && status !== "all") f = f.filter((u) => u.status === status);
      return {
        users: f.slice((page - 1) * pageSize, page * pageSize),
        total: f.length,
        page,
        pageSize,
      };
    }
    try {
      // Same GLOBAL-only fan-out this file's other real-data methods already
      // route around -- see listLocations()/getDashboard()'s comments.
      const orgId = await resolveOrgId();
      const orgHeaders = { headers: { "X-Organization-Id": orgId } };
      const [sessionsResult, devicesResult, guestsResult] = await Promise.allSettled([
        api.get<{ items: RawGuestSession[]; total_items: number }>("/guest-sessions", {
          params: { location_id: locationId, page, page_size: pageSize },
          ...orgHeaders,
        }),
        // Real MAC lookup: one bulk fetch of this location's connected-device
        // rows per page load, matched to sessions client-side by guest_id --
        // cheaper than one /connected-devices request per row, and this list
        // is naturally bounded to one location's currently-known devices
        // (not the unbounded, ever-growing session history). Best-effort --
        // a guest legitimately has zero device rows if the router-sync
        // mechanism hasn't discovered them yet, so this is wrapped separately
        // from the sessions fetch and never fails the whole page.
        api.get<{ items: RawConnectedDevice[] }>("/connected-devices", {
          params: { location_id: locationId, page_size: 100 },
          ...orgHeaders,
        }),
        // Real guest identity lookup (see identityFromGuest's own comment
        // for the "every row hardcoded 'Guest'/blank" bug this fixes) --
        // same bulk-fetch-and-match-by-guest_id shape as the device lookup
        // above, best-effort for the same reason.
        api.get<{ items: RawGuest[] }>("/guests", {
          params: { location_id: locationId, page_size: 100 },
          ...orgHeaders,
        }),
      ]);
      if (sessionsResult.status === "rejected") throw sessionsResult.reason;
      const data = sessionsResult.value.data;
      const guestsById = new Map<string, RawGuest>();
      if (guestsResult.status === "fulfilled") {
        for (const g of guestsResult.value.data?.items ?? []) guestsById.set(g.id, g);
      }

      // Every real ConnectedDevice row for each guest (not just one) --
      // see matchDeviceForSession's own docstring for why picking a single
      // "the" device per guest (whichever is active right now) produced a
      // real, reported bug: a guest with more than one real device over
      // time showed the SAME MAC on every session row while "Device" (from
      // that session's own real user_agent) correctly varied, reading as
      // "this MAC is sometimes Android, sometimes Windows."
      const devicesByGuest = new Map<string, RawConnectedDevice[]>();
      if (devicesResult.status === "fulfilled") {
        for (const d of devicesResult.value.data?.items ?? []) {
          if (!d.guest_id) continue;
          const list = devicesByGuest.get(d.guest_id);
          if (list) list.push(d);
          else devicesByGuest.set(d.guest_id, [d]);
        }
      }

      let users = (data?.items ?? []).map((s) => {
        const matched = s.guest_id
          ? matchDeviceForSession(devicesByGuest.get(s.guest_id) ?? [], s.started_at)
          : undefined;
        const identity = identityFromGuest(s.guest_id ? guestsById.get(s.guest_id) : undefined);
        return {
          // s.device_id is the session's raw GuestDevice UUID FK, not a MAC
          // address or a device name -- /guest-sessions doesn't join the
          // device row that actually carries those. mac/ip now come from
          // the real ConnectedDevice row that was actually active during
          // THIS session (matchDeviceForSession, above) when one exists;
          // otherwise they stay an honest "Unknown"/blank rather than
          // fabricating one from that UUID.
          id: s.id,
          name: identity.name,
          email: identity.email,
          phone: identity.phone,
          device: deviceLabelFrom(s.user_agent),
          mac: matched?.mac_address || "Unknown",
          guestId: s.guest_id ?? null,
          // s.ip_address is only a fallback for a session with no matched
          // device row at all.
          ip: matched?.ip_address || s.ip_address || "",
          duration:
            s.started_at && s.ended_at
              ? `${Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)} min`
              : "Active",
          // Real per-row session timestamps -- GuestSession.started_at/
          // ended_at, already read above for `duration` but never
          // surfaced to the UI on their own. ended_at stays null (not a
          // fabricated time) for a still-active session.
          connectedAt: s.started_at,
          disconnectedAt: s.ended_at ?? null,
          download: `${Math.round((s.bytes_downloaded || 0) / 1e6)} MB`,
          status: (s.status === "active"
            ? "online"
            : s.status === "paused"
              ? "idle"
              : "offline") as "online" | "offline" | "idle",
        };
      });
      // See groupFragmentedVisits()'s own docstring -- collapses a burst of
      // reconnect-driven fragments (same guest+device, a few minutes apart)
      // into one row before search/status filtering runs, so a filter/
      // search reflects what the guest actually sees, not the raw
      // per-interval row count.
      users = groupFragmentedVisits(users);
      if (search) {
        const q = search.toLowerCase();
        users = users.filter((u) => u.name.toLowerCase().includes(q));
      }
      if (status && status !== "all") users = users.filter((u) => u.status === status);
      return { users, total: data?.total_items ?? users.length, page, pageSize };
    } catch {
      return { users: [], total: 0, page, pageSize };
    }
  },

  /** Real, location-wide "how many guests are online right now" count --
   * NOT derived from the current page's rows (see this file's Users-page
   * comment history for why that was misleading). A second, lightweight
   * request against the same /guest-sessions endpoint with the real
   * server-side `status=active` filter and `page_size=1`, reading only
   * `total_items` -- never pulls the actual session rows just to count
   * them. */
  async getOnlineCount(locationId: string): Promise<number> {
    if (isDemo()) return 16; // matches getUsers()'s demo fixture (16 of 24 rows are "online")
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<{ total_items: number }>("/guest-sessions", {
        params: { location_id: locationId, status: "active", page_size: 1 },
        headers: { "X-Organization-Id": orgId },
      });
      return data?.total_items ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * The genuine "forcefully clear their session, IP, etc." action the
   * founder asked for -- confirmed live that ending only the app-level
   * session (the original body of this method) does NOT force a stuck
   * device off the router; it still shows connected in
   * `/interface wireless registration-table` / still holds its
   * `/ip dhcp-server lease`. So this now does both real, separate things:
   *
   *  1. POST /guest-sessions/{id}/disconnect (unchanged, always attempted
   *     first) -- ends our own session row and best-effort RADIUS
   *     CoA-Disconnect. This part is real and valuable on its own, so it's
   *     NOT wrapped in a try/catch -- a genuine failure here should still
   *     surface to the caller/toast, same as before.
   *  2. If this session's guest_id has a matching, currently-active
   *     ConnectedDevice row at this location (looked up fresh, not from
   *     the page's stale bulk map -- see getUsers()'s comment), POST
   *     /connected-devices/{device_id}/disconnect for each one. This is
   *     the part that calls the real MikroTik adapter (device_adapters.py)
   *     to remove the wireless registration and the DHCP lease -- the
   *     part that actually matters for the wired-behind-AP topology this
   *     deployment runs.
   *
   * Step 2 is deliberately best-effort: a guest can have zero tracked
   * device rows (router-sync hasn't discovered them yet), and returning
   * `deviceDisconnected: false` in that case lets the caller show an
   * honest "session ended, device-level disconnect wasn't available"
   * toast instead of either silently swallowing the gap or failing the
   * whole operation over a part that was never guaranteed to exist.
   */
  async disconnectSession(
    sessionId: string,
    guestId: string | null,
    locationId: string,
  ): Promise<{ deviceDisconnected: boolean }> {
    if (isDemo()) return { deviceDisconnected: false };
    // Same missing-X-Organization-Id gap already fixed on every other
    // real call in this file (see resolveOrgId's own docstring) -- absent
    // it, `guest_sessions.execute` falls back to a GLOBAL-scope check an
    // ordinary org-owner session never holds, so this 403'd for a real
    // customer with no error ever surfaced (useDisconnectSession had no
    // onError handler either -- see useCustomerDashboard.ts). The backend
    // endpoint also requires a real (if empty) JSON body -- `payload:
    // SessionDisconnectRequest` has no request-level default, so no body
    // at all 422'd here too.
    const orgId = await resolveOrgId();
    const orgHeaders = { headers: { "X-Organization-Id": orgId } };
    await api.post(`/guest-sessions/${sessionId}/disconnect`, {}, orgHeaders);

    let deviceDisconnected = false;
    if (guestId) {
      try {
        const { data } = await api.get<{ items: { id: string }[] }>("/connected-devices", {
          params: { location_id: locationId, guest_id: guestId, is_active: true, page_size: 10 },
          ...orgHeaders,
        });
        const devices = data?.items ?? [];
        for (const d of devices) {
          try {
            await api.post(`/connected-devices/${d.id}/disconnect`, {}, orgHeaders);
            deviceDisconnected = true;
          } catch {
            // Best-effort per device -- one device's adapter call failing
            // (e.g. router offline) shouldn't stop the others, and the
            // session-level disconnect above is already real and done.
          }
        }
      } catch {
        // Lookup itself failing (network blip, org mismatch) is the same
        // "device-level disconnect wasn't available" case as finding zero
        // devices -- don't fail the whole operation over it.
      }
    }
    return { deviceDisconnected };
  },

  /* ── Feature Data ──────────────────────────────────────── */
  async getFeatureData(feature: string, locationId: string): Promise<CustomerFeatureData> {
    if (isDemo()) return getDemoFeatureData(feature);

    try {
      switch (feature) {
        case "analytics": {
          const [summary, guests] = await Promise.allSettled([
            api
              .get<{
                visitors: number;
                unique_guests: number;
                returning_guests: number;
                average_session_duration_seconds: number | null;
              }>("/guest-analytics/summary")
              .catch(() => null),
            api.get<{ items: any[] }>("/guest-analytics/top-devices").catch(() => null),
          ]);
          const s =
            summary.status === "fulfilled" && summary.value?.data ? summary.value.data : null;
          return {
            analytics: {
              totalSessions: s?.visitors ?? 0,
              uniqueGuests: s?.unique_guests ?? 0,
              returningRate: s?.returning_guests ?? 0,
              avgDuration: (s?.average_session_duration_seconds ?? 0) / 60,
            },
          };
        }
        case "campaigns": {
          const { data } = await api
            .get<{
              items: { id: string; name: string; status: string }[];
            }>("/campaigns", { params: { page_size: 20 } })
            .catch(() => ({ data: { items: [] } }));
          return {
            campaigns: (data?.items ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              impressions: 0,
              conversions: 0,
            })),
          };
        }
        case "vouchers": {
          const { data } = await api
            .get<{
              items: { code?: string; plan?: string; status: string; used_count?: number }[];
            }>("/voucher-batches", { params: { page_size: 20 } })
            .catch(() => ({ data: { items: [] } }));
          return {
            vouchers:
              data?.items?.map((v) => ({
                code: v.code ?? "",
                plan: v.plan ?? "",
                status: v.status,
                used: v.used_count ?? 0,
              })) ?? [],
          };
        }
        case "portal": {
          const caption = locationId
            ? await api
                .get(`/captive-portal`, { params: { location_id: locationId } })
                .catch(() => null)
            : null;
          return {
            portal: {
              status: "Live",
              theme: "Enterprise Blue",
              authMethods: ["Email OTP", "SMS", "Voucher"],
              languages: ["EN", "HI", "AR"],
            },
          };
        }
        case "devices": {
          // Same fix -- /connected-devices requires connected_devices.read
          // at ORGANIZATION scope via X-Organization-Id.
          const orgId = await resolveOrgId();
          const { data } = await api
            .get<{
              items: {
                mac_address: string;
                ip_address: string;
                hostname: string | null;
                connected_at: string;
                last_seen_at: string;
              }[];
            }>("/connected-devices", {
              params: { location_id: locationId, page_size: 10 },
              headers: { "X-Organization-Id": orgId },
            })
            .catch(() => ({ data: { items: [] } }));
          return {
            devices: (data?.items ?? []).map((d) => ({
              mac: d.mac_address,
              ip: d.ip_address,
              device: d.hostname ?? "Unknown",
              firstSeen: timeAgo(d.connected_at),
              lastSeen: timeAgo(d.last_seen_at),
            })),
          };
        }
        case "mac-auth": {
          const orgId = await resolveOrgId();
          const { data } = await api.get<{
            items: {
              id: string;
              mac_address: string;
              authorization_type: string;
              expires_at: string | null;
              comment: string | null;
              is_enabled: boolean;
            }[];
          }>("/mac-authorization/entries", {
            params: { location_id: locationId, page: 1, page_size: 50 },
            headers: { "X-Organization-Id": orgId },
          });
          return {
            macAuth: data.items.map((e) => ({
              id: e.id,
              mac: e.mac_address,
              type: e.authorization_type,
              expiresAt: e.expires_at,
              comment: e.comment,
              enabled: e.is_enabled,
            })),
          };
        }
        case "admin-logs": {
          // Owner-only on the backend for all three sections below --
          // dashboard-logins/router-events via app.domains.admin_logs
          // .router's RequirePermission("audit_logs.read") + RequireRole
          // ("organization-owner", ...) + RequireFeature; accountActivity
          // (/audit/entries, the former standalone "Audit Log" tab's real
          // data source) via app.domains.audit.router's own
          // RequirePermission + the same RequireRole narrowing, added when
          // this section was folded in here. An Agent session 403s on all
          // three even if it somehow reaches this route (the sidebar/route
          // guard already keep it from getting this far in the first
          // place, see customerNav.ts/authGuards.ts). Each call is caught
          // independently via allSettled rather than one try/catch, so one
          // endpoint 403ing/erroring doesn't blank out the others -- and,
          // deliberately, a failure here resolves to an *empty* section,
          // never demo/fabricated log rows: this is a security audit
          // trail, and a fake "who logged in"/"who changed what" row would
          // be actively misleading, unlike the numeric placeholders every
          // other feature's own demo fallback shows.
          const orgId = await resolveOrgId();
          const orgHeaders = { headers: { "X-Organization-Id": orgId } };
          const [loginsR, routerR, activityR] = await Promise.allSettled([
            api.get<{
              items: {
                id: string;
                user_id: string | null;
                email: string;
                ip_address: string;
                success: boolean;
                failure_reason: string | null;
                created_at: string;
              }[];
            }>("/admin-logs/dashboard-logins", { params: { page_size: 50 }, ...orgHeaders }),
            api.get<{
              items: {
                id: string;
                location_name: string;
                router_name: string;
                event_type: string;
                message: string | null;
                is_error: boolean;
                occurred_at: string;
              }[];
            }>("/admin-logs/router-events", { params: { page_size: 50 }, ...orgHeaders }),
            // exclude_view_events=true drops the "*_viewed" read-only
            // access-logging noise (billing/analytics dashboard loads --
            // fired on effectively every page view) that would otherwise
            // vastly outnumber and bury the real role/location/policy/etc.
            // change events this section exists to show -- see
            // repository.search_audit_log_entries's own docstring.
            api.get<{
              items: {
                id: string;
                action: string;
                description: string | null;
                actor_user_id: string | null;
                entity_type: string;
                created_at: string;
              }[];
            }>("/audit/entries", {
              params: { page_size: 30, exclude_view_events: true },
              ...orgHeaders,
            }),
          ]);
          const logins = loginsR.status === "fulfilled" ? (loginsR.value.data?.items ?? []) : [];
          const routerEvents =
            routerR.status === "fulfilled" ? (routerR.value.data?.items ?? []) : [];
          const activity =
            activityR.status === "fulfilled" ? (activityR.value.data?.items ?? []) : [];
          // Real login history already carries user_id <-> email pairs for
          // this same org -- reuse it to show a human actor instead of a
          // raw UUID (accountActivity itself only has actor_user_id). Not
          // exhaustive (only actors who have ever logged in appear), so
          // this stays a display nicety with a UUID fallback, never a
          // fabricated name.
          const actorEmailById = new Map(
            logins.filter((l) => l.user_id).map((l) => [l.user_id as string, l.email]),
          );
          return {
            adminLogs: {
              dashboardLogins: logins.map((l) => ({
                id: l.id,
                email: l.email,
                ipAddress: l.ip_address,
                success: l.success,
                failureReason: l.failure_reason,
                time: timeAgo(l.created_at),
              })),
              routerLogs: routerEvents.map((e) => ({
                id: e.id,
                locationName: e.location_name,
                routerName: e.router_name,
                eventType: e.event_type,
                message: e.message,
                isError: e.is_error,
                time: timeAgo(e.occurred_at),
              })),
              accountActivity: activity.map((a) => ({
                id: a.id,
                action: a.action,
                description: a.description,
                actor: a.actor_user_id
                  ? (actorEmailById.get(a.actor_user_id) ?? a.actor_user_id)
                  : "System",
                entityType: a.entity_type,
                time: timeAgo(a.created_at),
              })),
            },
          };
        }
        default:
          return {};
      }
    } catch {
      return getDemoFeatureData(feature);
    }
  },

  /* ── Logs (real, server-side–paginated) ───────────────────
   * Dedicated per-section paginated fetches for the customer dashboard's
   * "Logs" (formerly "Admin Logs") page -- unlike the bundled
   * getFeatureData("admin-logs", ...) case above (which pulls a single
   * fixed page of all three sections for the page's first paint), each of
   * these hits its own real backend page/page_size so a real numbered
   * pager (NumberedPagination) can jump straight to any page of any one
   * section independently, matching this codebase's established
   * server-side-pagination convention (PaginationMeta) rather than
   * fetching everything and slicing client-side. Same Owner-only,
   * real-data-or-empty posture as the bundled case above -- see its own
   * comment for why a failed/blocked fetch resolves to an empty page,
   * never fabricated rows. */
  async getAdminLogsDashboardLogins(
    page = 1,
    pageSize = 25,
  ): Promise<{ items: AdminLogsDashboardLoginRow[]; meta: PageMeta }> {
    if (isDemo()) return paginateDemoAdminLogs("dashboardLogins", page, pageSize);
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<{
        items: {
          id: string;
          user_id: string | null;
          email: string;
          ip_address: string;
          success: boolean;
          failure_reason: string | null;
          created_at: string;
        }[];
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
      }>("/admin-logs/dashboard-logins", {
        params: { page, page_size: pageSize },
        headers: { "X-Organization-Id": orgId },
      });
      return {
        items: data.items.map((l) => ({
          id: l.id,
          email: l.email,
          ipAddress: l.ip_address,
          success: l.success,
          failureReason: l.failure_reason,
          time: timeAgo(l.created_at),
        })),
        meta: {
          page: data.page,
          pageSize: data.page_size,
          totalItems: data.total_items,
          totalPages: data.total_pages,
          hasNext: data.has_next,
          hasPrevious: data.has_previous,
        },
      };
    } catch {
      return { items: [], meta: emptyPageMeta(page, pageSize) };
    }
  },

  async getAdminLogsRouterEvents(
    page = 1,
    pageSize = 25,
  ): Promise<{ items: AdminLogsRouterEventRow[]; meta: PageMeta }> {
    if (isDemo()) return paginateDemoAdminLogs("routerLogs", page, pageSize);
    try {
      const orgId = await resolveOrgId();
      const { data } = await api.get<{
        items: {
          id: string;
          location_name: string;
          router_name: string;
          event_type: string;
          message: string | null;
          is_error: boolean;
          occurred_at: string;
        }[];
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
        has_next: boolean;
        has_previous: boolean;
      }>("/admin-logs/router-events", {
        params: { page, page_size: pageSize },
        headers: { "X-Organization-Id": orgId },
      });
      return {
        items: data.items.map((e) => ({
          id: e.id,
          locationName: e.location_name,
          routerName: e.router_name,
          eventType: e.event_type,
          message: e.message,
          isError: e.is_error,
          time: timeAgo(e.occurred_at),
        })),
        meta: {
          page: data.page,
          pageSize: data.page_size,
          totalItems: data.total_items,
          totalPages: data.total_pages,
          hasNext: data.has_next,
          hasPrevious: data.has_previous,
        },
      };
    } catch {
      return { items: [], meta: emptyPageMeta(page, pageSize) };
    }
  },

  async getAdminLogsAccountActivity(
    page = 1,
    pageSize = 25,
  ): Promise<{ items: AdminLogsActivityRow[]; meta: PageMeta }> {
    if (isDemo()) return paginateDemoAdminLogs("accountActivity", page, pageSize);
    try {
      const orgId = await resolveOrgId();
      const orgHeaders = { headers: { "X-Organization-Id": orgId } };
      const [activityR, loginsR] = await Promise.allSettled([
        api.get<{
          items: {
            id: string;
            action: string;
            description: string | null;
            actor_user_id: string | null;
            entity_type: string;
            created_at: string;
          }[];
          page: number;
          page_size: number;
          total_items: number;
          total_pages: number;
          has_next: boolean;
          has_previous: boolean;
        }>("/audit/entries", {
          params: { page, page_size: pageSize, exclude_view_events: true },
          ...orgHeaders,
        }),
        // A separate, fixed lookup (not the paginated table above) purely
        // to resolve actor_user_id -> email for whichever activity page is
        // showing -- independent of which page of dashboard-logins (if
        // any) the other section happens to be on. Same "not exhaustive,
        // never fabricated" nicety the bundled case above already
        // documents, just decoupled from that section's own pagination now.
        api.get<{ items: { user_id: string | null; email: string }[] }>(
          "/admin-logs/dashboard-logins",
          { params: { page: 1, page_size: 100 }, ...orgHeaders },
        ),
      ]);
      if (activityR.status !== "fulfilled")
        return { items: [], meta: emptyPageMeta(page, pageSize) };
      const data = activityR.value.data;
      const logins = loginsR.status === "fulfilled" ? (loginsR.value.data?.items ?? []) : [];
      const actorEmailById = new Map(
        logins.filter((l) => l.user_id).map((l) => [l.user_id as string, l.email]),
      );
      return {
        items: data.items.map((a) => ({
          id: a.id,
          action: a.action,
          description: a.description,
          actor: a.actor_user_id
            ? (actorEmailById.get(a.actor_user_id) ?? a.actor_user_id)
            : "System",
          entityType: a.entity_type,
          time: timeAgo(a.created_at),
        })),
        meta: {
          page: data.page,
          pageSize: data.page_size,
          totalItems: data.total_items,
          totalPages: data.total_pages,
          hasNext: data.has_next,
          hasPrevious: data.has_previous,
        },
      };
    } catch {
      return { items: [], meta: emptyPageMeta(page, pageSize) };
    }
  },
};

function emptyPageMeta(page: number, pageSize: number): PageMeta {
  return { page, pageSize, totalItems: 0, totalPages: 0, hasNext: false, hasPrevious: false };
}

/** Demo-mode fallback for the three paginated Logs endpoints -- slices the
 * same fixed demo rows getDemoFeatureData("admin-logs") already returns,
 * so demo mode still renders (with a single page, since there are only a
 * handful of fixed demo rows) rather than erroring. */
function paginateDemoAdminLogs<K extends keyof NonNullable<CustomerFeatureData["adminLogs"]>>(
  section: K,
  page: number,
  pageSize: number,
): { items: NonNullable<CustomerFeatureData["adminLogs"]>[K]; meta: PageMeta } {
  const all = getDemoFeatureData("admin-logs").adminLogs![section];
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize) as NonNullable<
    CustomerFeatureData["adminLogs"]
  >[K];
  const totalItems = all.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

type DashboardDataResult = CustomerDashboardData;

function getDemoFeatureData(feature: string): CustomerFeatureData {
  switch (feature) {
    case "analytics":
      return {
        analytics: { totalSessions: 1892, uniqueGuests: 847, returningRate: 34, avgDuration: 28 },
      };
    case "campaigns":
      return {
        campaigns: [
          { id: "1", name: "Summer Promo", status: "active", impressions: 2841, conversions: 423 },
          { id: "2", name: "New Year", status: "draft", impressions: 0, conversions: 0 },
        ],
      };
    case "vouchers":
      return {
        vouchers: [
          { code: "VCH-8821", plan: "1h", status: "active", used: 3 },
          { code: "VCH-8822", plan: "24h", status: "active", used: 12 },
        ],
      };
    case "portal":
      return {
        portal: {
          status: "Live",
          theme: "Enterprise Blue",
          authMethods: ["Email OTP", "SMS", "Voucher"],
          languages: ["EN", "HI", "AR"],
        },
      };
    case "devices":
      return {
        devices: [
          {
            mac: "00:1A:2B:3C:4D:5E",
            ip: "10.0.1.42",
            device: "iPhone 15",
            firstSeen: "Today",
            lastSeen: "Just now",
          },
          {
            mac: "AA:BB:CC:DD:EE:FF",
            ip: "10.0.1.87",
            device: "MacBook Pro",
            firstSeen: "Today",
            lastSeen: "2 min ago",
          },
        ],
      };
    case "mac-auth":
      return {
        macAuth: [
          {
            id: "1",
            mac: "7C:70:DB:B5:76:92",
            type: "permanent",
            expiresAt: null,
            comment: "Front desk tablet",
            enabled: true,
          },
          {
            id: "2",
            mac: "9E:CB:12:2C:02:52",
            type: "temporary",
            expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
            comment: "Contractor laptop",
            enabled: true,
          },
          {
            id: "3",
            mac: "C2:7C:20:00:F2:24",
            type: "permanent",
            expiresAt: null,
            comment: null,
            enabled: false,
          },
        ],
      };
    case "admin-logs":
      return {
        adminLogs: {
          dashboardLogins: [
            {
              id: "1",
              email: "owner@acme.demo",
              ipAddress: "49.36.128.4",
              success: true,
              failureReason: null,
              time: "3 min ago",
            },
            {
              id: "2",
              email: "owner@acme.demo",
              ipAddress: "49.36.128.4",
              success: true,
              failureReason: null,
              time: "1 hour ago",
            },
            {
              id: "3",
              email: "owner@acme.demo",
              ipAddress: "103.22.9.71",
              success: false,
              failureReason: "invalid_password",
              time: "Yesterday",
            },
          ],
          routerLogs: [
            {
              id: "1",
              locationName: "Mumbai HQ",
              routerName: "mikrotik-mumbai-1",
              eventType: "config_applied",
              message: "Hotspot policy pushed",
              isError: false,
              time: "12 min ago",
            },
            {
              id: "2",
              locationName: "Delhi Office",
              routerName: "mikrotik-delhi-1",
              eventType: "config_apply_failed",
              message: "Device unreachable during push",
              isError: true,
              time: "2 hours ago",
            },
            {
              id: "3",
              locationName: "Bangalore DC",
              routerName: "mikrotik-blr-1",
              eventType: "enrollment_approved",
              message: null,
              isError: false,
              time: "Yesterday",
            },
          ],
          accountActivity: [
            {
              id: "1",
              action: "role_assigned",
              description: "Assigned role 'Helpdesk' to reception@acme.demo",
              actor: "owner@acme.demo",
              entityType: "user_role",
              time: "8 min ago",
            },
            {
              id: "2",
              action: "location_created",
              description: "Created location 'Pune Office'",
              actor: "owner@acme.demo",
              entityType: "location",
              time: "1 day ago",
            },
            {
              id: "3",
              action: "organization_member_removed",
              description: "Removed member manager@acme.demo",
              actor: "owner@acme.demo",
              entityType: "organization_member",
              time: "3 days ago",
            },
          ],
        },
      };
    default:
      return {};
  }
}
