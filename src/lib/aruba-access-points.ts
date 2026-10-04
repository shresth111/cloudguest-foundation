/**
 * Access points at an Aruba Instant On venue -- the pure half of the
 * customer "Access points" card and the Guests page's access-point column
 * (DASHBOARD_PLAN P0-A3). Pure so `scripts/test-aruba-access-points.mjs` can
 * exercise it without a browser.
 *
 * One Instant On site is one Wyfy location. Every AP in the site sends the
 * same NAS-Identifier and its own MAC in Called-Station-Id, so the backend
 * (P0-A2, `GET /locations/{id}/access-points`) can say per AP how many guests
 * are on it now and how much they used today -- from OUR OWN RADIUS records,
 * plus the Instant On read when the venue's poller is switched on.
 *
 * Rules this module enforces, because the card must not be the shipped mock
 * the 2026-09-02 QA pass found:
 *  - A figure the backend did not send renders "—", never 0.
 *  - An AP that has sent nothing for a while is "No recent activity", never
 *    "Offline": an idle access point sends no RADIUS at all, so silence is
 *    not evidence of a fault (PLAN P0-A2 `status`).
 *  - A read that failed is "unavailable", never an empty list: "no access
 *    points" is a claim the read did not establish.
 *
 * Only ever rendered for a NAS-only venue (`locationIsNasOnly`); nothing here
 * is reachable from a MikroTik or Omada screen.
 */

import { formatBytes } from "@/lib/analytics-format";

export type ArubaApStatus = "online" | "no_recent_activity";

/** What the Instant On read said about the AP, when the venue's poller is on.
 * Null when nothing was read (the usual case today). */
export type InstantOnApStatus = "online" | "offline" | "unknown";

/**
 * One access point, as `GET /locations/{id}/access-points` returns it (BE
 * P0-A1/A2 contract, DASHBOARD_STATUS.md "REAL API CONTRACT").
 *
 * The counts and byte totals are measured from OUR guest_sessions and are
 * always integers on that contract; they stay `number | null` here so a row
 * that ever arrives without one renders "—" rather than a 0 we did not
 * measure.
 */
export interface ArubaAccessPoint {
  /** The registry id, or `primary:<MAC>` for the synthesized primary row
   * (the router's own MAC, no registry row -> backend `id: null`). Only ever
   * used as a React key. */
  id: string;
  name: string | null;
  mac: string;
  model: string | null;
  serial: string | null;
  /** The venue's first AP: the one whose MAC is on the router row itself. */
  isPrimary: boolean;
  clientsNow: number | null;
  sessionsToday: number | null;
  /** Guest download / upload today (sessions started today or still active). */
  downloadBytesToday: number | null;
  uploadBytesToday: number | null;
  lastSeenAt: string | null;
  status: ArubaApStatus;
  /** Where `status` came from: our RADIUS records, or the Instant On read. */
  statusSource: "radius" | "instant_on" | null;
  instantOnStatus: InstantOnApStatus | null;
}

/** The read's outcome. `unavailable` is a failed or refused read, or a
 * venue the backend says the list does not apply to (`applicable: false`) --
 * it never carries an empty list standing in for "no access points". */
export type ArubaAccessPointsState =
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ok";
      items: ArubaAccessPoint[];
      /** When the backend computed the figures. */
      asOf: string | null;
      /** Guests online now whose session has not named its AP yet (signed in
       * before the AP was recorded). Null when not sent. */
      unattributedClientsNow: number | null;
    };

const DASH = "—";

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

/** "aa-bb-cc-dd-ee-ff" / "aabbccddeeff" -> "AA:BB:CC:DD:EE:FF". Anything that
 * is not 12 hex digits is returned as given (upper-cased), never guessed. */
export function canonicalApMac(mac: string): string {
  const hex = mac.replace(/[^0-9a-fA-F]/g, "");
  if (hex.length !== 12) return mac.toUpperCase();
  return hex.toUpperCase().match(/.{2}/g)!.join(":");
}

/** One row of the backend's list. Null when the row has no MAC -- an AP we
 * cannot name by address cannot be filtered on or told apart. */
export function toArubaAccessPoint(raw: unknown): ArubaAccessPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawMac = str(r.mac);
  if (!rawMac) return null;
  const mac = canonicalApMac(rawMac);
  const source = r.status_source;
  const io = r.instant_on_status;
  return {
    id: str(r.id) ?? `primary:${mac}`,
    name: str(r.name),
    mac,
    model: str(r.model),
    serial: str(r.serial),
    isPrimary: r.is_primary === true,
    clientsNow: num(r.clients_now),
    sessionsToday: num(r.sessions_today),
    downloadBytesToday: num(r.download_bytes_today),
    uploadBytesToday: num(r.upload_bytes_today),
    lastSeenAt: str(r.last_seen_at),
    // Anything but an explicit "online" is the neutral state. There is no
    // "offline" pill here on purpose: an idle AP sends nothing.
    status: r.status === "online" ? "online" : "no_recent_activity",
    statusSource: source === "radius" || source === "instant_on" ? source : null,
    instantOnStatus: io === "online" || io === "offline" || io === "unknown" ? io : null,
  };
}

/** The payload as the `api` interceptor hands it over (envelope stripped):
 * `{location_id, applicable, as_of, unattributed_clients_now, items: [...]}`.
 * `applicable: false` (not a NAS-only venue, or not the caller's) and any
 * shape we do not recognise are "unavailable", not "none". */
export function toArubaAccessPointsState(payload: unknown): ArubaAccessPointsState {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { status: "unavailable" };
  }
  const p = payload as Record<string, unknown>;
  if (p.applicable === false || !Array.isArray(p.items)) return { status: "unavailable" };
  const items = (p.items as unknown[])
    .map(toArubaAccessPoint)
    .filter((ap): ap is ArubaAccessPoint => ap !== null)
    // The venue's primary AP first, then by name.
    .sort(
      (a, b) =>
        Number(b.isPrimary) - Number(a.isPrimary) ||
        apDisplayName(a).localeCompare(apDisplayName(b)),
    );
  return {
    status: "ok",
    items,
    asOf: str(p.as_of),
    unattributedClientsNow: num(p.unattributed_clients_now),
  };
}

/** The AP's name, or its MAC when Instant On gave it none. */
export function apDisplayName(ap: Pick<ArubaAccessPoint, "name" | "mac">): string {
  return ap.name ?? ap.mac;
}

export function apStatusLabel(status: ArubaApStatus): string {
  return status === "online" ? "Online" : "No recent activity";
}

/** "Last guest activity 2 minutes ago" -- the evidence behind the pill, so a
 * reader can tell our own sign-in records from an Instant On read. `asOf` is
 * the read's own timestamp; `relative` is injected so tests can pin the
 * clock. */
export function apStatusDetail(
  ap: Pick<ArubaAccessPoint, "statusSource" | "lastSeenAt" | "instantOnStatus">,
  asOf: string | null,
  relative: (iso: string) => string,
): string {
  if (ap.statusSource === "instant_on") {
    const from = asOf ? `From the Instant On app, ${relative(asOf)}` : "From the Instant On app";
    return ap.instantOnStatus === "offline" ? `${from} · the app shows it disconnected` : from;
  }
  return ap.lastSeenAt ? `Last guest activity ${relative(ap.lastSeenAt)}` : "No guest activity yet";
}

export function apCount(v: number | null): string {
  return v == null ? DASH : v.toLocaleString();
}

/** Today's guest data through this AP (download + upload). One side
 * unmeasured is shown as such; both unmeasured is "—", never "0 B". */
export function apDataToday(
  ap: Pick<ArubaAccessPoint, "downloadBytesToday" | "uploadBytesToday">,
): string {
  const { downloadBytesToday: down, uploadBytesToday: up } = ap;
  if (down == null && up == null) return DASH;
  if (down != null && up != null) return formatBytes(down + up);
  return formatBytes(down ?? up);
}

/** "2 guests online haven't been matched to an access point yet" -- only when
 * there are some; null otherwise (the line is then not rendered). */
export function apUnattributedNote(n: number | null): string | null {
  if (n == null || n <= 0) return null;
  return n === 1
    ? "1 guest online isn't matched to an access point yet."
    : `${n.toLocaleString()} guests online aren't matched to an access point yet.`;
}

/** The filter options for the Guests page: one per AP, by MAC. */
export function apFilterOptions(
  items: readonly ArubaAccessPoint[],
): { value: string; label: string }[] {
  return items.map((ap) => ({ value: ap.mac, label: apDisplayName(ap) }));
}

/** The access-point cell on a guest row. The session's own `ap_name` wins;
 * else the AP list's name for that MAC; else the MAC; else "—" (a session
 * that did not record its AP, e.g. one from before the column existed). */
export function sessionApLabel(
  apMac: string | null | undefined,
  apName: string | null | undefined,
  items: readonly ArubaAccessPoint[] | undefined,
): string {
  if (apName && apName.trim()) return apName;
  if (!apMac) return DASH;
  const mac = canonicalApMac(apMac);
  const match = items?.find((ap) => ap.mac === mac);
  return match ? apDisplayName(match) : mac;
}

export const ARUBA_AP_UNAVAILABLE = "Access point data is unavailable right now.";
export const ARUBA_AP_EMPTY =
  "No access points are listed for this venue yet. They appear here once your access points are added to this venue.";
export const ARUBA_AP_MANAGE_NOTE = "Manage access points in the Instant On app.";
