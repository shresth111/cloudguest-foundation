/**
 * Aruba + MikroTik hybrid: per-guest speed at an Aruba Instant On venue.
 *
 * Instant On has no per-guest speed control (measured 2026-10-03: the AP21
 * ignores RADIUS bandwidth attributes, and Instant On only offers one
 * SSID-wide per-client cap). So a venue that wants a speed per guest puts a
 * Wyfy-managed MikroTik between the ISP and the access points. The MikroTik
 * hands the guests their IPs by DHCP, and Wyfy adds a `/queue simple` per
 * guest IP on it when the access point reports the guest online, and removes
 * it when the guest leaves.
 *
 * Backend contract (cloud-guest, flag CLOUDGUEST_ARUBA_HYBRID_SPEED_GATEWAY_ENABLED,
 * OFF by default):
 *   Master  GET/PUT/DELETE /platform/instant-on/routers/{router_id}/speed-gateway
 *   Customer GET /network-integrations/locations/{location_id}/speed-control
 *
 * Pure: no React, no axios. Parsing, the error-code sentences and the
 * candidate verdicts live here so they are testable on their own.
 */

export interface SpeedGatewayRouter {
  routerId: string;
  name: string;
  model: string | null;
  status: string | null;
  hasApiCredentials: boolean;
}

export interface SpeedGatewayStatus {
  routerId: string;
  locationId: string | null;
  featureEnabled: boolean;
  gateway: SpeedGatewayRouter | null;
  perGuestSpeedActive: boolean;
  candidates: SpeedGatewayRouter[];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

function toRouter(raw: unknown): SpeedGatewayRouter | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const routerId = str(r.router_id);
  if (!routerId) return null;
  return {
    routerId,
    name: str(r.name) ?? routerId,
    model: str(r.model),
    status: str(r.status),
    // Only an explicit `true` counts: a router we could not vouch for is one
    // the backend would refuse anyway.
    hasApiCredentials: r.has_api_credentials === true,
  };
}

/** The Master read/write response, snake_case in, camelCase out. */
export function toSpeedGatewayStatus(raw: unknown): SpeedGatewayStatus {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const candidates = Array.isArray(r.candidates)
    ? r.candidates.map(toRouter).filter((c): c is SpeedGatewayRouter => c !== null)
    : [];
  return {
    routerId: str(r.router_id) ?? "",
    locationId: str(r.location_id),
    featureEnabled: r.feature_enabled === true,
    gateway: toRouter(r.gateway),
    perGuestSpeedActive: r.per_guest_speed_active === true,
    candidates,
  };
}

/** The customer read: `true` only when the backend says so. Anything else --
 * no body, a missing field, an older backend -- is "no gateway", which keeps
 * the venue on the "set it in Instant On" answer it already has. */
/** The whole customer `speed-control` read. Only an explicit `true` counts
 * for either flag: an older backend that sends no `instant_on_cloud_control`
 * reads as "cloud control off", which offers nothing it cannot do. */
export interface SpeedControlRead {
  perGuestSpeed: boolean;
  instantOnCloudControl: boolean;
}

export function toSpeedControl(raw: unknown): SpeedControlRead {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    perGuestSpeed: r.per_guest_speed === true,
    instantOnCloudControl: r.instant_on_cloud_control === true,
  };
}

export function toPerGuestSpeed(raw: unknown): boolean {
  return (
    !!raw && typeof raw === "object" && (raw as Record<string, unknown>).per_guest_speed === true
  );
}

export const SPEED_GATEWAY_ERROR_COPY: Record<string, string> = {
  SPEED_GATEWAY_NOT_NAS_ONLY: "This device is not an Aruba Instant On site.",
  SPEED_GATEWAY_WRONG_VENDOR: "Only a Wyfy-managed MikroTik router can be the speed gateway.",
  SPEED_GATEWAY_LOCATION_MISMATCH:
    "That router is at a different location. The gateway must be at the same venue as the access points.",
  SPEED_GATEWAY_NO_CREDENTIALS:
    "Wyfy has no API login for that router, so it could not add guest speed limits to it. Finish its setup first.",
  SPEED_GATEWAY_ROUTER_NOT_FOUND: "That router no longer exists.",
};

/** The sentence for a refused link/unlink, from `data.code` (never the
 * status), else the backend's own message, else `fallback`. */
export function speedGatewayErrorMessage(error: unknown, fallback: string): string {
  const e = (error && typeof error === "object" ? error : {}) as {
    data?: { code?: unknown };
    message?: unknown;
  };
  const code = typeof e.data?.code === "string" ? e.data.code : null;
  if (code && SPEED_GATEWAY_ERROR_COPY[code]) return SPEED_GATEWAY_ERROR_COPY[code];
  return typeof e.message === "string" && e.message ? e.message : fallback;
}

export const NO_CANDIDATES_COPY = "Add the venue's MikroTik to this location first.";
export const NO_CREDENTIALS_REASON = "No API login on this router yet";
export const FEATURE_OFF_COPY =
  "Off on this server (CLOUDGUEST_ARUBA_HYBRID_SPEED_GATEWAY_ENABLED). A link can be saved, but no guest speed is applied until it is switched on.";

/** What the wiring has to be for this to work at all (Master copy). */
export const HYBRID_WIRING_COPY: readonly string[] = [
  "The MikroTik sits between the ISP and the Aruba access points (ISP → MikroTik → AP).",
  "The MikroTik hands out the guests' IP addresses by DHCP. The Instant On guest network must not use Instant On's own NAT/DHCP, or the MikroTik sees one address for every guest.",
  "Wyfy adds one /queue simple per guest IP on that MikroTik when the access point reports the guest online, and removes it when they leave. The speed is the location's Bandwidth setting, a cap, not a promise.",
  "The MikroTik must not run its own Wyfy hotspot on the access points' network, or guests meet two sign-in pages.",
];

/** May this candidate be picked, and if not, why not. */
export function candidateVerdict(c: SpeedGatewayRouter): {
  selectable: boolean;
  reason: string | null;
} {
  return c.hasApiCredentials
    ? { selectable: true, reason: null }
    : { selectable: false, reason: NO_CREDENTIALS_REASON };
}

/** The one-line state of the section. */
export function speedGatewaySummary(s: SpeedGatewayStatus): string {
  if (!s.gateway)
    return "No gateway linked. Guest speed is whatever Instant On sets on the guest network.";
  if (!s.featureEnabled)
    return `Linked to ${s.gateway.name}, but the feature is off on this server, so no per-guest speed is applied.`;
  if (!s.perGuestSpeedActive)
    return `Linked to ${s.gateway.name}, but per-guest speed is not active (check the router's API login and status).`;
  return `Per-guest speed is live: ${s.gateway.name} applies each guest's limit.`;
}
