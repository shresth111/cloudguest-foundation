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

export interface ArubaAccessPoint {
  id: string;
  name: string | null;
  mac: string;
  model: string | null;
  serial: string | null;
  clientsNow: number | null;
  sessionsToday: number | null;
  bytesTodayIn: number | null;
  bytesTodayOut: number | null;
  lastSeenAt: string | null;
  status: ArubaApStatus;
  /** Where `status` came from: our RADIUS records, or the Instant On read. */
  statusSource: "radius" | "instant_on" | null;
  asOf: string | null;
}

/** The read's outcome. `unavailable` is a failed or refused read -- it never
 * carries an empty list standing in for "no access points". */
export type ArubaAccessPointsState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; items: ArubaAccessPoint[] };

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
  const mac = str(r.mac);
  if (!mac) return null;
  const bytesToday =
    r.bytes_today && typeof r.bytes_today === "object"
      ? (r.bytes_today as Record<string, unknown>)
      : null;
  const source = r.status_source;
  return {
    id: str(r.id) ?? canonicalApMac(mac),
    name: str(r.name),
    mac: canonicalApMac(mac),
    model: str(r.model),
    serial: str(r.serial) ?? str(r.serial_number),
    clientsNow: num(r.clients_now),
    sessionsToday: num(r.sessions_today),
    bytesTodayIn: num(r.bytes_today_in) ?? num(bytesToday?.in),
    bytesTodayOut: num(r.bytes_today_out) ?? num(bytesToday?.out),
    lastSeenAt: str(r.last_seen_at),
    // Anything but an explicit "online" is the neutral state. There is no
    // "offline" here on purpose.
    status: r.status === "online" ? "online" : "no_recent_activity",
    statusSource: source === "radius" || source === "instant_on" ? source : null,
    asOf: str(r.as_of),
  };
}

/** The payload as the `api` interceptor hands it over: `{items: [...]}` or a
 * bare list. Anything else is a contract we do not recognise, which is
 * "unavailable", not "none". */
export function toArubaAccessPointsState(payload: unknown): ArubaAccessPointsState {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : null;
  if (!list) return { status: "unavailable" };
  const items = list
    .map(toArubaAccessPoint)
    .filter((ap): ap is ArubaAccessPoint => ap !== null)
    .sort((a, b) => apDisplayName(a).localeCompare(apDisplayName(b)));
  return { status: "ok", items };
}

/** The AP's name, or its MAC when Instant On gave it none. */
export function apDisplayName(ap: Pick<ArubaAccessPoint, "name" | "mac">): string {
  return ap.name ?? ap.mac;
}

export function apStatusLabel(status: ArubaApStatus): string {
  return status === "online" ? "Online" : "No recent activity";
}

/** "Guests are signing in through it (seen 2 minutes ago)" -- the evidence
 * behind the pill, so a reader can tell a RADIUS heartbeat from an Instant On
 * read. `relative` is injected so tests can pin the clock. */
export function apStatusDetail(
  ap: Pick<ArubaAccessPoint, "statusSource" | "lastSeenAt" | "asOf">,
  relative: (iso: string) => string,
): string {
  if (ap.statusSource === "instant_on") {
    return ap.asOf ? `From the Instant On app, ${relative(ap.asOf)}` : "From the Instant On app";
  }
  return ap.lastSeenAt ? `Last guest activity ${relative(ap.lastSeenAt)}` : "No guest activity yet";
}

export function apCount(v: number | null): string {
  return v == null ? DASH : v.toLocaleString();
}

/** Today's guest data through this AP. One side unmeasured is shown as such;
 * both unmeasured is "—", never "0 B". */
export function apDataToday(ap: Pick<ArubaAccessPoint, "bytesTodayIn" | "bytesTodayOut">): string {
  const { bytesTodayIn: down, bytesTodayOut: up } = ap;
  if (down == null && up == null) return DASH;
  if (down != null && up != null) return formatBytes(down + up);
  return formatBytes(down ?? up);
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
