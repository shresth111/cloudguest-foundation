/**
 * The customer Instant On reads, the pure half:
 * `GET /network-integrations/locations/{id}/instant-on/{kind}`.
 *
 * Three answers besides "loading":
 *  - `off`: nobody switched this on (`not_configured`, `polling_disabled`). Show nothing.
 *  - `unavailable`: it is on, but the backend can't vouch for the data (poll failed,
 *    stale, never polled), or the request failed. Say so; never an empty list or a zero.
 *  - `ok`: real items.
 *
 * Only ever requested at an Aruba Instant On venue (`locationIsNasOnly`).
 */

export type InstantOnKind = "access-points" | "clients" | "ssids" | "alerts" | "events";

export interface InstantOnAp {
  name: string | null;
  status: "online" | "offline" | "unknown";
}
export interface InstantOnSsid {
  name: string;
}
export interface InstantOnAlert {
  type: string;
  severity: string | null;
  deviceName: string | null;
  raisedAt: string | null;
  cleared: boolean;
}
export interface InstantOnEvent {
  id: string | null;
  event: string;
  occurredAt: string | null;
  deviceName: string | null;
  networkName: string | null;
}

export type InstantOnView<T> =
  | { status: "loading" }
  | { status: "off" }
  | { status: "unavailable" }
  | { status: "ok"; asOf: string | null; items: T[] };

const OFF_REASONS = new Set(["not_configured", "polling_disabled"]);

const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function view<T>(
  payload: unknown,
  item: (raw: Record<string, unknown>) => T | null,
): InstantOnView<T> {
  const p = obj(payload);
  if (p && p.status === "unavailable" && OFF_REASONS.has(String(p.unavailable_reason))) {
    return { status: "off" };
  }
  if (!p || p.status !== "ok" || !Array.isArray(p.items)) return { status: "unavailable" };
  const items = p.items
    .map((i) => (obj(i) ? item(obj(i)!) : null))
    .filter((i): i is NonNullable<typeof i> => i !== null) as T[];
  return { status: "ok", asOf: str(p.as_of), items };
}

export const toInstantOnAps = (payload: unknown): InstantOnView<InstantOnAp> =>
  view(payload, (r) => ({
    name: str(r.name),
    status: r.status === "online" || r.status === "offline" ? r.status : "unknown",
  }));

/** Clients are only counted on screen, so nothing about them is kept. */
export const toInstantOnClients = (payload: unknown): InstantOnView<Record<string, never>> =>
  view(payload, () => ({}));

export const toInstantOnSsids = (payload: unknown): InstantOnView<InstantOnSsid> =>
  view(payload, (r) => (str(r.name) ? { name: str(r.name)! } : null));

export const toInstantOnAlerts = (payload: unknown): InstantOnView<InstantOnAlert> =>
  view(payload, (r) =>
    str(r.type)
      ? {
          type: str(r.type)!,
          severity: str(r.severity),
          deviceName: str(r.device_name),
          raisedAt: str(r.raised_at),
          cleared: r.is_cleared === true || !!str(r.cleared_at),
        }
      : null,
  );

export const toInstantOnEvents = (payload: unknown): InstantOnView<InstantOnEvent> =>
  view(payload, (r) =>
    str(r.event)
      ? {
          id: str(r.event_id),
          event: str(r.event)!,
          occurredAt: str(r.occurred_at),
          deviceName: str(r.device_name),
          networkName: str(r.network_name),
        }
      : null,
  );

/** "Client captive portal failure" from `clientCaptivePortalFailure`, or
 * "Wireless network down" from `wireless_network_down`. */
export function instantOnLabel(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : type;
}
