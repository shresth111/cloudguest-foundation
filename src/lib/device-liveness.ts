/**
 * How one piece of network hardware's liveness is described in words.
 *
 * ## The defect this exists to prevent
 *
 * The Network Hardware list rendered `"Up"` immediately followed by
 * `formatSince(statusChangedAt)`, so a row read as **"Up · 4m"** -- which
 * every reader takes to mean "this device has been up for four minutes".
 *
 * It did not mean that. `statusChangedAt` on a real account was the
 * backend's `last_seen_at`: the moment a router's own sync sweep last
 * observed that MAC on the network. "We heard from it four minutes ago"
 * and "it has been running for four minutes" are different facts, and the
 * screen was printing the first under the name of the second.
 *
 * Measured on the live router `HJP0ATMRJ6X` on 2026-09-07:
 *
 *     device `/system/resource` uptime : 7h 28m 51s
 *     backend last_seen_at             : 2 minutes ago
 *     dashboard displayed              : "4 mins up"
 *
 * ## Why this is worse than a wrong word
 *
 * That router had rebooted three times in the preceding two hours (03:50,
 * 04:18 and 05:43 UTC, each confirmed by `/system/resource` and a
 * cold-boot log entry with NTP correcting the clock). It came back and
 * resumed heartbeating after every one of them, so time-since-heartbeat
 * looked healthy throughout and hid all three. Uptime is the only one of
 * the two numbers that makes a reboot visible at all -- and a venue owner
 * needs "this access point has restarted three times today" far more than
 * "we pinged it four minutes ago".
 *
 * ## The rule
 *
 * Every duration this module emits is labelled with the measurement it
 * actually is. Uptime is shown only when the backend sent a real uptime
 * reading (`GET /monitored-hardware` -> `uptime_seconds`, sourced from
 * `router_health_snapshots`, which the RouterOS-API health sweep fills
 * from `/system/resource` every 600s). When it did not, the row says
 * "last seen ..." and never silently promotes that into "up for ...".
 *
 * Most rows will legitimately have no uptime: a third-party access point,
 * printer or camera has no uptime source anywhere in this platform. That
 * is a real absence, not a hole to be plugged with the heartbeat age.
 */

/** Every field this module needs from a hardware row. Deliberately a
 * structural subset, so the demo store and the real API row both satisfy
 * it without either being reshaped for the other's benefit. */
export interface DeviceLiveness {
  status: "up" | "down" | "unknown";
  /** When the network last observed this MAC. ISO, or null if never. */
  lastSeenAt: string | null;
  /** Real seconds since the device last booted, or null when this
   * platform has no way to know (everything that is not a router it
   * manages). Never derived from `lastSeenAt`. */
  uptimeSeconds: number | null;
  /** When `uptimeSeconds` was actually read off the device. ISO, or null. */
  uptimeRecordedAt: string | null;
}

/**
 * A reading older than this is quoted with its age attached. The RouterOS
 * health sweep runs every 600s and the SNMP one every 300s, so anything
 * past two sweep intervals means the sweep itself is late or stopped --
 * at which point "7h uptime" is a claim about the past, and saying so
 * plainly is the difference between a stale number and a wrong one.
 */
export const UPTIME_STALE_AFTER_MS = 20 * 60 * 1000;

/** Formats a duration in seconds as "3d 4h" / "7h 28m" / "12m" / "45s". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/** Formats the gap between `iso` and `now` as an age, e.g. "4m". */
export function formatAge(iso: string, now: number): string {
  return formatDuration((now - new Date(iso).getTime()) / 1000);
}

export interface LivenessDescription {
  /** "Up" / "Down" / "Never observed" -- the status word, alone. */
  state: string;
  /**
   * The measurement beside it, already carrying its own name, or null
   * when there is nothing true to say. Never a bare duration: a bare
   * duration next to "Up" is exactly how this bug read.
   */
  detail: string | null;
  /** Which fact `detail` reports, for callers that style them apart. */
  detailKind: "uptime" | "lastSeen" | null;
  /** True when `detail` is an uptime whose reading has gone stale. */
  stale: boolean;
}

/**
 * The one place that decides what a hardware row's liveness cell says.
 *
 * Uptime wins when it exists, because it is the stronger fact: it answers
 * "has this rebooted?", which time-since-heartbeat cannot. Otherwise the
 * heartbeat age is reported as a heartbeat age.
 */
export function describeLiveness(
  device: DeviceLiveness,
  now: number = Date.now(),
): LivenessDescription {
  const state =
    device.status === "up" ? "Up" : device.status === "down" ? "Down" : "Never observed";

  // A device the network has never seen has no liveness history at all;
  // an uptime reading for it would be a contradiction, not a bonus.
  if (device.status === "unknown") {
    return { state, detail: null, detailKind: null, stale: false };
  }

  if (device.uptimeSeconds != null) {
    const stale =
      device.uptimeRecordedAt != null &&
      now - new Date(device.uptimeRecordedAt).getTime() > UPTIME_STALE_AFTER_MS;
    const base = `up ${formatDuration(device.uptimeSeconds)}`;
    return {
      state,
      detail: stale
        ? `${base} as of ${formatAge(device.uptimeRecordedAt as string, now)} ago`
        : base,
      detailKind: "uptime",
      stale,
    };
  }

  if (device.lastSeenAt != null) {
    return {
      state,
      detail: `last seen ${formatAge(device.lastSeenAt, now)} ago`,
      detailKind: "lastSeen",
      stale: false,
    };
  }

  return { state, detail: null, detailKind: null, stale: false };
}

/**
 * How many of `devices` this platform can actually report uptime for.
 * Lets a screen explain a column that is mostly blank ("uptime is
 * available for the 1 router we manage; the other 4 devices report none")
 * rather than leaving it looking broken.
 */
export function uptimeCoverage(devices: DeviceLiveness[]): {
  measured: number;
  total: number;
} {
  return {
    measured: devices.filter((d) => d.uptimeSeconds != null).length,
    total: devices.length,
  };
}
