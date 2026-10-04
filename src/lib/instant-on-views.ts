/**
 * The customer Instant On reads (DASHBOARD_PLAN P1-K), the pure half:
 * `GET /network-integrations/locations/{id}/instant-on/{access-points|clients|ssids|alerts}`
 * (cloud-guest #327/#328). Pure so `scripts/test-aruba-instant-on-data.mjs`
 * can drive it.
 *
 * The backend answers `status: "unavailable"` with `items: null` whenever it
 * cannot vouch for the data (no Viewer service account, the venue not switched
 * on for customers, a stale poll). That -- and any failed request -- is
 * `unavailable` here and renders "Data unavailable · source Instant On",
 * never an empty list and never a zero.
 *
 * Only ever requested at an Aruba Instant On venue (`locationIsNasOnly`).
 */

export type InstantOnKind = "access-points" | "clients" | "ssids" | "alerts";

export const INSTANT_ON_UNAVAILABLE = "Data unavailable · source Instant On";

export interface InstantOnAp {
  name: string | null;
  mac: string | null;
  status: "online" | "offline" | "unknown";
}
export interface InstantOnSsid {
  name: string;
  enabled: boolean | null;
}
export interface InstantOnAlert {
  type: string;
  severity: string | null;
  deviceName: string | null;
  raisedAt: string | null;
  cleared: boolean;
}

export type InstantOnView<T> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ok"; asOf: string | null; items: T[] };

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function view<T>(
  payload: unknown,
  item: (raw: Record<string, unknown>) => T | null,
): InstantOnView<T> {
  const p = obj(payload);
  if (!p || p.status !== "ok" || !Array.isArray(p.items)) return { status: "unavailable" };
  const items = p.items
    .map((i) => (obj(i) ? item(obj(i)!) : null))
    .filter((i): i is T => i !== null);
  return { status: "ok", asOf: str(p.as_of), items };
}

export const toInstantOnAps = (payload: unknown): InstantOnView<InstantOnAp> =>
  view(payload, (r) => ({
    name: str(r.name),
    mac: str(r.mac),
    status: r.status === "online" || r.status === "offline" ? r.status : "unknown",
  }));

/** Clients are only counted on screen, never listed (a guest's device name
 * is not the venue owner's dashboard's business beyond the Guests page). */
export const toInstantOnClients = (payload: unknown): InstantOnView<{ mac: string }> =>
  view(payload, (r) => (str(r.mac) ? { mac: str(r.mac)! } : null));

export const toInstantOnSsids = (payload: unknown): InstantOnView<InstantOnSsid> =>
  view(payload, (r) =>
    str(r.name)
      ? { name: str(r.name)!, enabled: typeof r.enabled === "boolean" ? r.enabled : null }
      : null,
  );

export const toInstantOnAlerts = (payload: unknown): InstantOnView<InstantOnAlert> =>
  view(payload, (r) =>
    str(r.type)
      ? {
          type: str(r.type)!,
          severity: str(r.severity),
          deviceName: str(r.device_name),
          raisedAt: str(r.raised_at),
          cleared: r.is_cleared === true,
        }
      : null,
  );

/** "1 of 2 online" from the app's own AP list. */
export function instantOnApSummary(v: InstantOnView<InstantOnAp>): string | null {
  if (v.status !== "ok") return null;
  const online = v.items.filter((a) => a.status === "online").length;
  return `${online} of ${v.items.length} online`;
}

/** "Wireless network down" from `wireless_network_down`-style types. */
export function instantOnAlertLabel(type: string): string {
  const words = type.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : type;
}
