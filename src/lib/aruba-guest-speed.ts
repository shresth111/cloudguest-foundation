/**
 * Guest WiFi speed at an Aruba Instant On venue: ONE speed for every device on
 * the guest network, set through Instant On's cloud.
 *
 * WHAT IS TRUE ABOUT INSTANT ON (measured, ~/wyfy-ops/aruba-ap21/
 * INSTANT_ON_CLOUD_CONTROL.md):
 *  - There is no per-device (per-guest) speed on any path: Instant On's own
 *    capability list says `qosBandwidthLimiting: false` for client policies,
 *    and the AP21 ignores the RADIUS bandwidth attributes (512/256 kbps sent,
 *    ~200 Mbps measured).
 *  - The guest network has a per-client cap: `qos.perClientDownload/Upload
 *    BandwidthLimitInMbps`, integer Mbps 1..1000. Every device on that WiFi
 *    network gets the same cap. The presets below (10..100 Mbps) are values it
 *    stores as-is, so nothing is rounded.
 *
 * Backend (cloud-guest, behind the Instant On cloud-control gates):
 *   GET /network-integrations/locations/{id}/instant-on/guest-speed
 *   PUT  same, `{network_id, download_mbps, upload_mbps}` (a preset or null)
 * A PUT is reported `applied` only after Instant On's own read-back shows the
 * cap. Neither answer ever carries the network's WiFi password or RADIUS
 * secret.
 *
 * Pure: no React, no axios, so `scripts/test-aruba-guest-speed.mjs` drives it.
 */

export const GUEST_SPEED_PRESETS_MBPS: readonly number[] = [
  10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
];

export interface GuestNetworkSpeed {
  networkId: string;
  networkName: string | null;
  /** A cap is on for at least one direction. */
  enabled: boolean;
  /** null = no limit in that direction. */
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export type GuestSpeedStatus = "ok" | "applied" | "unavailable" | "failed";

export interface VenueGuestSpeed {
  status: GuestSpeedStatus;
  /** Backend reason code: `cloud_control_not_enabled`, `write_not_confirmed`,
   * `write_forbidden`, `network_not_found`, ... */
  reason: string | null;
  presetsMbps: number[];
  networks: GuestNetworkSpeed[];
  applied: GuestNetworkSpeed | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const mbps = (v: unknown): number | null =>
  typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;

function toNetwork(raw: unknown): GuestNetworkSpeed | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const networkId = str(r.network_id);
  if (!networkId) return null;
  const downloadMbps = mbps(r.download_mbps);
  const uploadMbps = mbps(r.upload_mbps);
  return {
    networkId,
    networkName: str(r.network_name),
    enabled: r.enabled === true && (downloadMbps !== null || uploadMbps !== null),
    downloadMbps,
    uploadMbps,
  };
}

const STATUSES: GuestSpeedStatus[] = ["ok", "applied", "unavailable", "failed"];

/** The backend answer, snake_case in. Anything unparseable reads as
 * `failed` -- never as "no limit". */
export function toVenueGuestSpeed(raw: unknown): VenueGuestSpeed {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const status = STATUSES.includes(r.status as GuestSpeedStatus)
    ? (r.status as GuestSpeedStatus)
    : "failed";
  const presets = Array.isArray(r.presets_mbps)
    ? r.presets_mbps.filter((p): p is number => mbps(p) !== null)
    : [];
  return {
    status,
    reason: str(r.reason),
    presetsMbps: presets.length > 0 ? presets : [...GUEST_SPEED_PRESETS_MBPS],
    networks: Array.isArray(r.networks)
      ? r.networks.map(toNetwork).filter((n): n is GuestNetworkSpeed => n !== null)
      : [],
    applied: toNetwork(r.applied),
  };
}

/** "10 Mbps" / "No limit". */
export function speedLabel(value: number | null): string {
  return value === null ? "No limit" : `${value} Mbps`;
}

/** A select value <-> a request value. "none" is no limit. */
export const NO_LIMIT = "none";
export function toSelectValue(value: number | null): string {
  return value === null ? NO_LIMIT : String(value);
}
export function fromSelectValue(value: string): number | null {
  if (value === NO_LIMIT) return null;
  const n = Number(value);
  return GUEST_SPEED_PRESETS_MBPS.includes(n) ? n : null;
}

/** What the network holds right now, in one line. */
export function currentSpeedSentence(network: GuestNetworkSpeed): string {
  if (!network.enabled) return "No speed limit on this network right now.";
  return (
    `Every device on this network is held to ${speedLabel(network.downloadMbps)} down and ` +
    `${speedLabel(network.uploadMbps)} up right now.`
  );
}

/** Said beside the control, always: it is one speed for everyone. */
export const SAME_FOR_EVERY_DEVICE =
  "One speed for every device on this guest WiFi network. Aruba Instant On can't give one " +
  "guest a different speed from another, so this applies to everyone on it alike. It's the " +
  "most a device can use, not a guaranteed speed.";

/** The per-network tiers below (Speed tiers by WiFi network) write the same
 * Instant On setting, so the two must not be read as independent. */
export const SAME_SETTING_AS_SSID_TIERS =
  "Speed tiers by WiFi network (below) set this same Instant On speed for their networks: " +
  "whichever is applied last is the one Instant On holds.";

/** Cloud control off: what is needed, and who does it. Never a save. */
export const GUEST_SPEED_NEEDS_CLOUD =
  "Setting the guest WiFi speed from Wyfy needs Instant On cloud control, which isn't switched " +
  "on for this venue yet. Ask your Wyfy Guest contact to turn it on. Until then, the speed can " +
  "be set on the guest network in the Instant On app.";

/** The sentence after an apply, from what the server said. `applied` only
 * when Instant On's read-back confirmed it. */
export function applyOutcomeMessage(result: VenueGuestSpeed): {
  tone: "success" | "warning" | "error";
  text: string;
} {
  if (result.status === "applied" && result.applied) {
    const a = result.applied;
    return {
      tone: "success",
      text: a.enabled
        ? `Instant On confirmed it: every device on ${a.networkName ?? "the guest network"} is ` +
          `now held to ${speedLabel(a.downloadMbps)} down and ${speedLabel(a.uploadMbps)} up.`
        : `Instant On confirmed it: ${a.networkName ?? "the guest network"} has no speed limit now.`,
    };
  }
  if (result.status === "unavailable") return { tone: "warning", text: GUEST_SPEED_NEEDS_CLOUD };
  switch (result.reason) {
    case "write_not_confirmed":
    case "rate_limit_not_kept":
      return {
        tone: "warning",
        text:
          "Instant On didn't keep that speed when we checked it afterwards, so nothing has " +
          "changed for your guests. Try again, and tell your Wyfy Guest contact if it keeps " +
          "happening.",
      };
    case "write_forbidden":
      return {
        tone: "error",
        text:
          "Instant On refused the change: the account Wyfy uses for this venue can't edit " +
          "networks. Ask your Wyfy Guest contact to give it a management role.",
      };
    case "network_not_found":
      return {
        tone: "error",
        text: "That guest WiFi network isn't on this venue's Instant On site any more. Reload and try again.",
      };
    default:
      return {
        tone: "error",
        text:
          "We couldn't reach Instant On to change the speed, so nothing has changed. Try again " +
          "in a moment.",
      };
  }
}
