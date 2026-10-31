import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  Palette,
  Ticket,
  ShieldCheck,
  Shield,
  Monitor,
  UsersRound,
  Bot,
  Network,
  Bell,
  Sun,
  Globe,
  ScrollText,
  Fingerprint,
  Server,
  Signal,
  Wifi,
  Ban,
  BrickWall,
  LifeBuoy,
  Share2,
  HelpCircle,
  Radar,
  ShieldAlert,
  Send,
  Waypoints,
  Logs,
} from "lucide-react";

export type CustomerLoginRole = "owner" | "agent";

export interface CustomerNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  roles: CustomerLoginRole[];
  /** `false` keeps the item out of the sidebar rail while leaving it a known
   * feature (route, palette, permission gate). Absent means "in the
   * sidebar". Only Staff Access uses it: it is offered from the avatar menu. */
  inSidebar?: false;
  /** Other words people use for this screen. The command palette matches on
   * them (English, beside the translated label), so typing "coupon" still
   * lands on Vouchers now that Vouchers is a tab rather than a row. */
  keywords?: readonly string[];
  /** Starts a sub-group in its section's tab bar: a divider, then this
   * label (`nav:customerTabGroup.<id>`), before this tab and every tab after
   * it until the next `tabGroup`. Visual only -- it changes no URL, order
   * or permission. */
  tabGroup?: { id: string; label: string };
  /** Folds this tab into one dropdown tab of the section's tab bar
   * (`nav:customerTabMenu.<id>`), together with every adjacent tab carrying
   * the same id. The tab reads "Advanced ▾" and, while one of its screens is
   * open, "Advanced · IP Addresses". Visual only, like `tabGroup`: every
   * screen keeps its own id, URL, palette entry and permission rule. */
  tabMenu?: { id: string; label: string };
}

export interface CustomerNavGroup {
  id: string;
  label: string;
  /** The sidebar row's icon, for a `tabs` section. Unused for `rows`. */
  icon?: LucideIcon;
  /**
   * How the group reaches the sidebar.
   *
   * - `"rows"`: every item is its own sidebar row and its page has no tab
   *   bar (Home: Dashboard, Alerts, Fix a Problem -- the "something is
   *   wrong" path stays one click and zero tabs away).
   * - `"tabs"` (the default): the group is ONE sidebar row, labelled with the
   *   group's own name, that opens the first item the caller can see; the
   *   items are the tabs of a tab bar on each of their pages.
   */
  presentation?: "rows" | "tabs";
  items: CustomerNavItem[];
}

/** Network's installer screens, folded into one dropdown tab (`tabMenu`). */
const ADVANCED_TAB_MENU = { id: "advanced", label: "Advanced" } as const;

/** Single source of truth for the customer-workspace sidebar — shared by
 * the dashboard, users, and feature routes (via the shared `CustomerSidebar`
 * component, see src/components/customer/CustomerSidebar.tsx) so they can't
 * drift out of sync with each other again.
 *
 * SECTIONS WITH TABS (docs/design/nav-consolidation.md)
 * ---------------------------------------------------
 * Ten sidebar rows, not twenty-nine. Home's three items stay rows of their
 * own (`presentation: "rows"`); every other group is ONE row -- Guests,
 * Marketing, Login Page, Network, Security, Logs, Help -- whose items are
 * the tabs on each of its pages (`SectionTabs`). Plus one off-sidebar
 * "Account" group holding Staff Access, which the avatar menu offers.
 *
 * This was tried once before (#219) and reverted (#220), because the long
 * menu was what customers navigated by. What is different this time is that
 * nothing moved out of reach: there is no second "destinations" module to
 * drift from this one -- the groups below ARE the sections -- every item
 * keeps its id and its URL (`customerFeatureHref`), every item is still its
 * own command-palette entry by its own name (plus `keywords`), and each tab
 * is filtered by exactly the role + permission rules its row was.
 *
 * `CUSTOMER_NAVS` below is just this flattened for call sites that only need
 * the plain list (id/icon/role lookups, the "is this a known feature id"
 * check, etc). Group ids are translation keys (`nav:customerGroup.<id>`);
 * item ids are routes, and neither this regroup nor any rename before it
 * changed an item id. */
export const CUSTOMER_NAV_GROUPS: CustomerNavGroup[] = [
  {
    // "Overview" until the task-based regroup; the label is "Home" now so it
    // stops colliding with every page's own "overview" wording. Same id, so
    // `customerGroup.overview` and every test keyed on it still hold.
    id: "overview",
    label: "Home",
    // Rows, not a section: these are the three screens an owner opens when
    // something is wrong, and a tab bar in front of them would be one more
    // thing between the owner and the answer.
    presentation: "rows",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["owner", "agent"],
        keywords: ["home", "overview", "summary"],
      },
      // Alerts sits with Dashboard and Fix a Problem: the three rows an owner
      // opens when something is wrong are the first three rows of the rail.
      {
        id: "alerts",
        label: "Alerts",
        icon: Bell,
        roles: ["owner", "agent"],
        keywords: ["notifications", "warnings", "down", "outage"],
      },
      // "Network Diagnostics" -> "Connection Tools" -> "Fix a Problem".
      // The first rename was display-only and the complaint it was meant
      // to fix outlived it; this one comes with the page actually being
      // rebuilt around the venue's question. Same id and route, as both
      // previous renames correctly kept.
      //
      // `agent` is here deliberately. The person standing in front of an
      // unhappy guest is the front desk, and Reception Staff/Helpdesk
      // already hold GUEST_SESSIONS: OPERATE -- they could already reset
      // a guest's session via the API, they just could not see the screen
      // it lives on. The zones that need diagnostics or ISP permissions
      // degrade on their own rather than 403ing, so this offers the
      // answers without handing the front desk a router console.
      //
      // This narrows what is OFFERED and is not an access boundary -- the
      // route has never had a role guard and the backend enforces every
      // request on its own. See customerNavPermissions.ts.
      //
      // In Home, not near the bottom: it is what an owner opens when the
      // WiFi is down, and as the only row of its own "Operations" group it
      // sat below the fold on a laptop. Moved, not duplicated -- the group
      // it came from is gone.
      {
        id: "debugging",
        label: "Fix a Problem",
        icon: Wifi,
        roles: ["owner", "agent"],
        keywords: [
          "troubleshoot",
          "diagnostics",
          "not working",
          "no internet",
          "guest can't connect",
        ],
      },
    ],
  },
  {
    // Everything about the people on the WiFi: who they are, the groups and
    // codes they sign in with, and the numbers.
    id: "guests",
    label: "Guests",
    icon: Users,
    items: [
      {
        id: "users",
        label: "Guests",
        icon: Users,
        roles: ["owner", "agent"],
        // "unblock" lands here as well as on Security -> Blocking: a blocked
        // guest's row carries an Unblock action, and this is the screen the
        // front desk can see (Blocking is owner-only). Hindi beside English
        // because the palette matches keywords as typed.
        keywords: [
          "visitors",
          "users",
          "customers",
          "people",
          "sessions",
          "online",
          "unblock",
          "blocked guest",
          "अनब्लॉक",
          "ब्लॉक हटाएं",
          "ब्लॉक मेहमान",
        ],
      },
      {
        id: "teams",
        label: "Guest Groups",
        icon: UsersRound,
        roles: ["owner"],
        keywords: ["teams", "groups", "plans"],
      },
      {
        id: "vouchers",
        label: "Vouchers",
        icon: Ticket,
        roles: ["owner", "agent"],
        keywords: ["codes", "access code", "coupon", "wifi code", "passes"],
      },
      {
        id: "reports",
        label: "Reports",
        icon: FileText,
        roles: ["owner", "agent"],
        keywords: ["analytics", "statistics", "export", "usage", "numbers"],
      },
    ],
  },
  {
    // Promoting something to the venue's guests: by message after the visit
    // (Guest Messaging) or on the login page during it (Login Page Offers).
    // Two separate products with their own consent and send lifecycle --
    // they share a section, never a screen. Its own row, not a tab of
    // Guests, because Guest Messaging is a paid add-on and a customer cannot
    // ask for a feature they cannot see (spec D5).
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      // Moved here from Login Page (same id, same /guest-campaigns route).
      // FIRST, on the owner's call (2026-10-31): it is free and already in
      // use, so a non-subscriber's Marketing click lands on something they
      // have instead of an upsell. Staff cannot see it (owner-only), so their
      // Marketing row still opens Guest Messaging -- the sidebar row links to
      // the first tab the caller can see.
      {
        id: "campaigns",
        label: "Login Page Offers",
        icon: Megaphone,
        roles: ["owner"],
        keywords: ["offers", "banner", "survey", "promotion", "ads", "campaigns"],
      },
      // The Marketing add-on (wyfy-specs/guest-marketing-campaigns.md §3.5).
      // Outbound WhatsApp/SMS/email TO guests who opted in. Not the same
      // thing as Login Page Offers beside it (captive-portal banners shown
      // DURING login). The add-on lock badge (CustomerSidebar, SectionTabs)
      // still marks it when the org has not bought it.
      //
      // Both roles on purpose. `cg_login_role` is a sign-in radio button in
      // localStorage and must not decide who sees this (known defect, see
      // customerNavPermissions.ts). Visibility comes from the real
      // `marketing.read` grant; whether the add-on is unlocked comes from
      // `/me/entitlements` (CustomerSidebar's lock badge) and, finally, from
      // the backend's own 402 on every marketing route.
      //
      // `Send`, not `Megaphone`: Megaphone is Login Page Offers (and the
      // Marketing row itself), and two palette entries or tabs with the same
      // glyph are harder to tell apart.
      {
        id: "marketing",
        label: "Guest Messaging",
        icon: Send,
        roles: ["owner", "agent"],
        keywords: ["whatsapp", "sms", "email", "campaign", "broadcast", "promotion"],
      },
    ],
  },
  {
    // What a guest sees before they are online: the page itself and the
    // hours it lets anyone in. (Login Page Offers moved to Marketing.)
    id: "login-page",
    label: "Login Page",
    icon: Palette,
    items: [
      {
        id: "portal",
        label: "Portal",
        icon: Palette,
        roles: ["owner"],
        keywords: ["captive portal", "splash page", "branding", "logo", "design", "login screen"],
      },
      // Renamed from "Business Hours" (same id/route/data) -- see
      // customerFeatureCatalog.ts's own note.
      {
        id: "business-hours",
        label: "Open Hours",
        icon: Sun,
        roles: ["owner"],
        keywords: ["business hours", "schedule", "timings", "opening hours"],
      },
      // "Background Image" used to sit in this neighbourhood. Removed: the
      // login-screen backdrop is now uploaded from Portal -> Design, next to
      // the logo and the headline it has to stay legible against, with the
      // Live Preview right there (PortalPage.tsx). Keeping a second entry
      // point for the same single org-level image only made it look like two
      // separate settings. /background-image redirects to Portal.
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: Network,
    // Renamed the same three as customerFeatureCatalog.ts (same id/route/
    // data, see that file's own note).
    items: [
      // Devices leads the group: the hardware is the first thing to check
      // when the network misbehaves, and it was alone in "Devices & Team".
      {
        id: "devices",
        label: "Devices",
        icon: Monitor,
        roles: ["owner", "agent"],
        keywords: ["router", "access point", "hardware", "mikrotik", "ap"],
      },
      // "Website Blocking" used to sit in this group. It is now the
      // "Websites & IPs" tab of Security -> Blocking, next to blocked guests,
      // so everything a venue can block is in one place. Same screen, same
      // rules, same requests; `/website-blocking` redirects to that tab. See
      // lib/blocking.ts.
      {
        id: "isp-details",
        label: "Internet Connection",
        icon: Globe,
        roles: ["owner"],
        keywords: ["isp", "broadband", "uplink", "wan", "failover", "speed"],
      },
      // Traffic Lens (paid add-on; wyfy-specs/flow-visibility/PRODUCT.md C1):
      // what the venue's traffic is made of. Read-only, and owner-only like
      // Guest Connection Records -- it shows device addresses. Three layers,
      // as there: this row, `venue_traffic.read` in customerNavPermissions.ts,
      // and the backend's own 402 / 403 on every route. Whether the add-on
      // is UNLOCKED is the sidebar's lock badge (`/me/entitlements`), not
      // this list: a locked owner still sees the row and the lock screen.
      // Not in CONTROLLER_UNSUPPORTED_FEATURE_IDS: the page itself says
      // "not available at this venue", from the backend's own answer.
      {
        id: "traffic-lens",
        label: "Traffic Lens",
        icon: Waypoints,
        roles: ["owner"],
        keywords: ["traffic", "netflow", "bandwidth", "apps", "top sites"],
      },
      // The router-configuration screens, folded into ONE "Advanced ▾" tab
      // (owner's call, 2026-10-31): set once by whoever installed the
      // network and rarely opened again, so they stay one click away for a
      // technician without four tabs in the owner's line of sight -- and the
      // tab bar no longer runs off a phone screen. URLs unchanged.
      {
        id: "dhcp",
        label: "IP Addresses",
        icon: Server,
        roles: ["owner"],
        keywords: ["dhcp", "ip pool", "leases", "static ip"],
        tabMenu: ADVANCED_TAB_MENU,
      },
      {
        id: "vlans",
        label: "Network Zones",
        icon: Network,
        roles: ["owner"],
        keywords: ["vlan", "segments", "separate network"],
        tabMenu: ADVANCED_TAB_MENU,
      },
      {
        id: "port-forwarding",
        label: "Port Forwarding",
        icon: Share2,
        roles: ["owner"],
        keywords: ["nat", "ports", "cctv", "remote access"],
        tabMenu: ADVANCED_TAB_MENU,
      },
      {
        id: "voip",
        label: "Call Priority",
        icon: Signal,
        roles: ["owner"],
        keywords: ["voip", "qos", "calls", "voice"],
        tabMenu: ADVANCED_TAB_MENU,
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    // Three rows, and each opens a screen that does something. The posture
    // page is the only security surface whose numbers this platform can
    // actually produce (see SecurityOverviewView's own note), and Block
    // Websites is the one place to stop a website (by name or by category),
    // an address or a guest -- built entirely from screens that already
    // worked elsewhere (lib/blocking.ts). "Web filtering" was a fourth row;
    // its categories are a section of Block Websites now and /web-filtering
    // redirects there, because two rows for "block a website" sent owners
    // looking in the wrong one.
    // Firewall joined them once rules could actually reach the router
    // (cloud-guest#304's push): a rules screen with no way to apply them
    // would have been the placeholder this group refuses to ship. Zone
    // isolation joins when it is real; listing it now would put a row in the
    // sidebar that opens a placeholder.
    //
    // The first label is "Security Score", not "Security": the group header
    // already says Security, and a row repeating its own group is the same
    // duplicated heading this dashboard has been pulled up on elsewhere. It
    // was "Overview", which collided with the Overview group above it.
    //
    // Blocking takes `Ban`, which moved with it from the retired Network
    // row -- no other row uses it, so the collapsed rail stays unambiguous.
    // Owner-only, like Access Rules that "Blocked Guests" came from.
    //
    // The three "who may connect" rows (Access Rules, Guest Allow-list,
    // Trusted Devices) follow, moved in from the retired "Access & Policy"
    // group: they are the venue's other half of "who gets in". Appended
    // after the three above, not interleaved, so this group's first block
    // stays exactly as it was.
    items: [
      {
        id: "security",
        label: "Security Score",
        icon: ShieldAlert,
        roles: ["owner"],
        keywords: ["security", "posture", "protection"],
      },
      {
        id: "blocking",
        // "Blocking", not "Block Websites": the page has two tabs, Websites
        // AND Guests & devices (lib/blocking.ts), and an owner looking for a
        // blocked guest did not think to open a screen named for websites.
        // Same id, same /blocking URL.
        label: "Blocking",
        icon: Ban,
        roles: ["owner"],
        keywords: [
          "block websites",
          "website blocking",
          "web filter",
          "block site",
          "content filter",
          "block guest",
          "unblock",
          "blocked guest",
          "अनब्लॉक",
          "ब्लॉक हटाएं",
          "ब्लॉक मेहमान",
        ],
      },
      // Owner-only, like every other screen that writes the venue's router.
      // `BrickWall`: unused elsewhere, and it is what the word means. At a
      // controller-only venue the row is muted and the page shows the
      // controller notice ("firewall" is in CONTROLLER_UNSUPPORTED_FEATURE_IDS).
      {
        id: "firewall",
        label: "Firewall",
        icon: BrickWall,
        roles: ["owner"],
        keywords: ["rules", "block port", "filter"],
      },
      // "Who may connect", after a divider in the tab bar.
      {
        id: "policies",
        label: "Access Rules",
        icon: ShieldCheck,
        roles: ["owner"],
        keywords: ["policies", "time limit", "speed limit", "data limit"],
        tabGroup: { id: "who-can-connect", label: "Who can connect" },
      },
      {
        id: "whitelist",
        label: "Guest Allow-list",
        icon: Shield,
        roles: ["owner"],
        keywords: ["whitelist", "allow list", "walled garden", "allowed sites"],
      },
      {
        id: "mac-auth",
        label: "Trusted Devices",
        icon: Fingerprint,
        roles: ["owner"],
        keywords: ["mac", "mac address", "bypass", "staff devices", "printer"],
      },
    ],
  },
  {
    // Records, not tools: rarely opened. It used to render collapsed by
    // default to save three rows; as one row with tabs there is nothing left
    // to collapse, so that behaviour is retired.
    id: "logs",
    label: "Logs",
    icon: ScrollText,
    items: [
      // The former separate "Audit Log" tab was merged into Admin Logs' own
      // "Account Activity" section -- one log destination, not two. Owner-only
      // -- see customer.$locationId.$feature.tsx's own AdminLogsView render
      // for the same restriction and why (a real, org-wide login + change
      // audit trail, independently enforced by the backend too).
      {
        id: "admin-logs",
        label: "Staff Activity",
        icon: ScrollText,
        roles: ["owner"],
        keywords: ["audit log", "admin logs", "changes", "who changed"],
      },
      // Distinct nav item from "Staff Activity" above -- different data (real *guest*
      // WiFi usage records: session connections + login/access attempts),
      // different audience framing (a compliance-relevant record, not a
      // dashboard/infra-access log) -- see
      // docs/ipdr-logs-syslog-spec.md §4/§7 for the full reasoning against
      // merging this into admin-logs. Owner-only, same restriction and same
      // reasoning as "Staff Activity" (security-sensitive guest data) -- see
      // NetworkActivityLog.tsx's own render-time guard for the matching
      // three-layer defense-in-depth.
      {
        id: "network-activity",
        label: "Guest Connection Records",
        icon: Radar,
        roles: ["owner"],
        keywords: ["ipdr", "cert-in", "compliance", "connection logs", "session logs"],
      },
      // NetLogs: this account's router + sign-in log lines (cloud-guest#420,
      // `GET /device-logs`). Both roles: the backend seeds
      // `network_logs.read` at LOCATION scope for the site-level staff roles
      // too, and that key -- not this list -- decides who sees the row (see
      // customerNavPermissions.ts). Not the Master "Device Logs" viewer: that
      // one is GLOBAL-only and shows tunnel internals; this one never does.
      // `Logs`: unused elsewhere, so the collapsed rail stays unambiguous.
      {
        id: "netlogs",
        label: "NetLogs",
        icon: Logs,
        roles: ["owner", "agent"],
        keywords: ["router logs", "syslog", "device logs", "sign-in log"],
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    icon: LifeBuoy,
    items: [
      {
        id: "tickets",
        label: "Support Tickets",
        icon: LifeBuoy,
        roles: ["owner", "agent"],
        keywords: ["support", "help", "contact", "complaint", "issue"],
      },
      // A static reference page, not a data-backed feature -- lives here
      // (rather than getting its own top-level nav group) because "Help" is
      // exactly where a customer already looks for it, right alongside
      // Support Tickets. See how-it-works.tsx / HowItWorksPage.tsx.
      {
        id: "how-it-works",
        label: "How It Works",
        icon: HelpCircle,
        roles: ["owner", "agent"],
        keywords: ["guide", "documentation", "manual", "faq"],
      },
    ],
  },
  {
    // Not a sidebar group. Staff Access is account administration, so it is
    // offered from the avatar menu in CustomerHeader.tsx instead of costing a
    // sidebar row. It stays in this list -- and so in CUSTOMER_NAVS -- so
    // `/agents` still resolves as a known feature id, the command palette
    // can still find it, and customerNavPermissions.ts still gates it on
    // `users.read`. `inSidebar: false` is what keeps it out of the rail; see
    // customerSidebarGroupsForRole().
    id: "account",
    label: "Account",
    items: [
      {
        id: "agents",
        label: "Staff Access",
        icon: Bot,
        roles: ["owner"],
        inSidebar: false,
        keywords: ["staff", "team members", "roles", "permissions", "users", "employees"],
      },
    ],
  },
];

/** Flattened view of CUSTOMER_NAV_GROUPS, for call sites that just need the
 * plain item list (id/role lookups) rather than the grouped rendering. */
export const CUSTOMER_NAVS: CustomerNavItem[] = CUSTOMER_NAV_GROUPS.flatMap((g) => g.items);

/** Login-time landing preference (see `src/lib/roles.ts`), not an
 * authorization mechanism — only used to decide which sidebar items to
 * show, real access is still gated by actual permissions. */
export function getCustomerLoginRole(): CustomerLoginRole {
  if (typeof window === "undefined") return "owner";
  // Validate, don't just cast: `cg_login_role` can hold "super-admin" left
  // over from a Master Console login in the same browser (master-login.tsx
  // sets it on operator sign-in and it's never a valid CustomerLoginRole).
  // An unvalidated cast made customerNavsForRole() filter against a role
  // string no CUSTOMER_NAVS entry lists, silently emptying the sidebar --
  // the real guard against this session ever reaching here at all is
  // requireCustomerSession() (see src/lib/authGuards.ts), this is just a
  // defensive fallback so a bad value degrades to "owner" instead of to
  // an unrecognized role.
  const stored = localStorage.getItem("cg_login_role");
  return stored === "agent" ? "agent" : "owner";
}

export function customerNavsForRole(role: CustomerLoginRole): CustomerNavItem[] {
  return CUSTOMER_NAVS.filter((item) => item.roles.includes(role));
}

/** Same role-based filter as `customerNavsForRole`, but keeping the section
 * groups (and dropping groups left empty by the filter) -- every grouped
 * feature, including the off-sidebar ones. The command palette renders this;
 * the sidebar renders `customerSidebarGroupsForRole` below. */
export function customerNavGroupsForRole(role: CustomerLoginRole): CustomerNavGroup[] {
  return CUSTOMER_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

/** `customerNavGroupsForRole`, minus the items that are not sidebar rows
 * (`inSidebar: false`) and any group that leaves empty. What the rail and
 * the How It Works page render; the command palette keeps the full list so
 * Staff Access stays searchable. */
export function customerSidebarGroupsForRole(role: CustomerLoginRole): CustomerNavGroup[] {
  return customerNavGroupsForRole(role)
    .map((g) => ({ ...g, items: g.items.filter((item) => item.inSidebar !== false) }))
    .filter((g) => g.items.length > 0);
}

/** One sidebar row: a single screen (Home's rows) or a section whose
 * visible items are its tabs. */
export type CustomerSidebarEntry =
  | { kind: "item"; item: CustomerNavItem }
  | { kind: "section"; group: CustomerNavGroup };

/** Already-filtered groups (role, then permissions) -> sidebar rows.
 * `rows` groups contribute each item; every other group contributes one
 * section row, which callers point at `group.items[0]` -- the first tab the
 * caller can see, since the filters already removed the rest. */
export function customerSidebarEntries(groups: CustomerNavGroup[]): CustomerSidebarEntry[] {
  return groups.flatMap((g): CustomerSidebarEntry[] =>
    g.presentation === "rows"
      ? g.items.map((item) => ({ kind: "item", item }))
      : [{ kind: "section", group: g }],
  );
}

/** The (unfiltered) group a feature id belongs to, or `undefined` for an id
 * that is not a nav item. */
export function customerNavGroupOf(featureId: string): CustomerNavGroup | undefined {
  return CUSTOMER_NAV_GROUPS.find((g) => g.items.some((i) => i.id === featureId));
}

/** True when this feature's page carries a section tab bar. */
export function featureHasSectionTabs(featureId: string): boolean {
  const g = customerNavGroupOf(featureId);
  return !!g && g.presentation !== "rows" && g.items.some((i) => i.inSidebar !== false);
}

/** The only 4 customer feature ids whose bare name is already owned by
 * something else in this app, checked exhaustively against every
 * registered top-level route (see routeTree.gen.ts) before picking these:
 * - `dashboard` -- `_authenticated/dashboard.tsx` (legacy operator shell)
 * - `campaigns` -- `_authenticated/campaigns.index.tsx` (same shell)
 * - `vouchers` -- `_authenticated/vouchers.index.tsx` (same shell)
 * - `portal` -- `portal.tsx` (the actual guest-facing captive portal --
 *   this one's a real naming clash in meaning too, not just the URL)
 * `dashboard` gets the bare root ("/", see index.tsx) since it's the
 * single most-visited page and the root route already had an "anonymous
 * visitor sees the sign-in form in place" pattern to extend. The other
 * three get a `guest-` prefix, which doubles as a legitimately clearer
 * name (this *is* configuring what a guest sees). Every other feature id
 * checked clean against the full route table and gets its bare name
 * directly -- no shared namespace prefix needed for any of them (an
 * earlier `/c/*` prefix approach was replaced by this per-route mapping
 * once it turned out only these 4 ids actually needed one). */
const RESERVED_FEATURE_HREFS: Record<string, string> = {
  dashboard: "/",
  campaigns: "/guest-campaigns",
  portal: "/guest-portal",
  vouchers: "/guest-vouchers",
};

/** Builds the location-id-free URL for a customer nav item id -- single
 * source of truth for this mapping so the dashboard, every feature page,
 * and the old `/customer/...`/`/customer/$locationId/...`/`/c/...` compat
 * redirects can't drift apart on where a given nav id actually lives. */
export function customerFeatureHref(id: string): string {
  return RESERVED_FEATURE_HREFS[id] ?? `/${id}`;
}

/** One entry of a section's tab bar: a plain tab, or a dropdown tab holding
 * the adjacent tabs that share a `tabMenu` (Network's "Advanced ▾"). */
export type SectionTabEntry =
  | { kind: "tab"; item: CustomerNavItem }
  | { kind: "menu"; menu: { id: string; label: string }; items: CustomerNavItem[] };

/** Already-filtered tabs -> tab-bar entries, in order. Adjacent tabs with the
 * same `tabMenu.id` become one `menu` entry; everything else stays a tab.
 * A menu is kept even when the caller can see only one of its screens, so
 * an installer screen never reappears as a top-level tab by accident. */
export function sectionTabEntries(tabs: readonly CustomerNavItem[]): SectionTabEntry[] {
  const out: SectionTabEntry[] = [];
  for (const item of tabs) {
    const last = out[out.length - 1];
    if (item.tabMenu && last?.kind === "menu" && last.menu.id === item.tabMenu.id) {
      last.items.push(item);
    } else if (item.tabMenu) {
      out.push({ kind: "menu", menu: item.tabMenu, items: [item] });
    } else {
      out.push({ kind: "tab", item });
    }
  }
  return out;
}
