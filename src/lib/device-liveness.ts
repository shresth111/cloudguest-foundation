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
 *
 * ## The same rule, one level up: "unknown" is two different facts
 *
 * The backend derives up/down from `connected_devices`, and both writers of
 * that table reach a venue by opening a RouterOS session against its uplink
 * router. A TP-Link Omada controller has no RouterOS, so at a venue whose
 * network is run by one, nothing ever probes a registered device: the row is
 * `unknown` on the day it is added and `unknown` for as long as the venue
 * exists.
 *
 * Rendered as "Never observed" that reads as *we looked and never saw it* --
 * a device to go and check. Nothing here ever looked. The backend now sends
 * `status_source`/`status_reason` (see `MonitoredHardwareResponse`) and this
 * module turns the second case into its own words. It is the same predicate
 * `routerLivenessIsMeasured` applies one screen over, for the same reason.
 */

/**
 * Why a device that is not up has no trustworthy observation behind it --
 * the backend's `observation_issue` (`app.domains.monitored_hardware
 * .constants.ObservationIssue`), passed through verbatim.
 *
 * ## The defect this exists to prevent
 *
 * Founder report, 2026-09-15: "Added access point but ... its status shows
 * 'Never observed' even though it is working." The AP was fine. The venue
 * router was rejecting the platform's stored RouterOS login, so the
 * discovery read that records devices failed every 15 minutes and never
 * recorded anything -- and "unknown" was rendered as a claim about the
 * access point ("never observed") when the true fact was about the router
 * ("we can't read it").
 */
export type ObservationIssue =
  | "no_router"
  | "controller_managed"
  | "router_missing_credentials"
  | "router_auth_failed"
  | "router_unreachable"
  | "router_read_failed"
  | "router_not_synced_yet"
  | "not_seen_by_router";

/** Issues where the router, not the device, is what failed. A device
 * behind one of these is neither confirmed missing nor confirmed down. */
const ROUTER_UNREADABLE: ReadonlySet<string> = new Set([
  "router_missing_credentials",
  "router_auth_failed",
  "router_unreachable",
  "router_read_failed",
]);

export function isRouterUnreadable(issue: string | null | undefined): boolean {
  return issue != null && ROUTER_UNREADABLE.has(issue);
}

/** What the owner can act on, per issue. Short enough for a table cell. */
const ISSUE_DETAIL: Record<ObservationIssue, string | null> = {
  router_auth_failed: "router rejected our login",
  router_missing_credentials: "router login not set up",
  router_unreachable: "router not responding",
  router_read_failed: "router read failed",
  router_not_synced_yet: "first check within 15 min",
  controller_managed: "listed under your controller",
  no_router: "no router at this venue",
  not_seen_by_router: null,
};

/** Every field this module needs from a hardware row. Deliberately a
 * structural subset, so the demo store and the real API row both satisfy
 * it without either being reshaped for the other's benefit. */
export interface DeviceLiveness {
  status: "up" | "down" | "unknown";
  /** When the network last observed this MAC. ISO, or null if never. */
  lastSeenAt: string | null;
  /** When this MAC was first observed *and has stayed on since* -- the
   * backend's sync sweep preserves `connected_at` across ticks for an
   * active device, so for an "up" row it answers "how long has it been
   * connected", which the age of `lastSeenAt` (the age of the sweep's
   * own view) cannot. ISO, or null for down/unknown/never-observed. */
  connectedAt: string | null;
  /** Real seconds since the device last booted, or null when this
   * platform has no way to know (everything that is not a router it
   * manages). Never derived from `lastSeenAt`. */
  uptimeSeconds: number | null;
  /** When `uptimeSeconds` was actually read off the device. ISO, or null. */
  uptimeRecordedAt: string | null;
  /**
   * Whether this platform probes this device at all -- NOT what the probe
   * found. Optional so the demo fixture (`stores/deviceStore.ts`) and any
   * older backend response satisfy this interface unchanged; absent reads
   * as `"measured"`, which is the pre-existing meaning of every row.
   */
  statusSource?: HardwareStatusSource | null;
  /** Why the status reads as it does. Only meaningful for `unknown`. */
  statusReason?: HardwareStatusReason | null;
  /** Why a non-up status has no trustworthy observation, or null/absent
   * (an older backend, or the demo store, sends none). */
  observationIssue?: ObservationIssue | string | null;
}

/** Mirrors the backend's `monitored_hardware.constants.StatusSource`. */
export type HardwareStatusSource = "measured" | "unmeasured";

/** Mirrors the backend's `monitored_hardware.constants.StatusReason`. */
export type HardwareStatusReason = "liveness_probe" | "never_observed" | "controller_managed";

/**
 * What an unmeasured row says, per reason code.
 *
 * The words live here and only here -- the backend deliberately sends a code
 * and no prose, so that a sentence composed server-side cannot drift from
 * the one a customer reads. Each entry names the venue's own equipment
 * rather than the platform's internals: "we do not poll this" is our
 * problem, "your controller reports these" is their answer.
 */
export const UNMEASURED_REASON_COPY: Record<HardwareStatusReason, string> = {
  controller_managed:
    "This venue's network is run by a controller, so nothing here pings this device. " +
    // "on the Devices page", not "above": this sentence is also read on the
    // Dashboard tile and in the location picker's cross-location panel,
    // where there is nothing above it.
    "Your controller's own view of its access points is on the Devices page.",
  // Neither of these can reach an unmeasured row today; present so that a
  // new reason code renders as itself instead of as `undefined`.
  never_observed: "Nothing on this platform measures this device's status.",
  liveness_probe: "Nothing on this platform measures this device's status.",
};

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
  /** "Up" / "Down" / "Can't reach router" / "Never observed" / ... -- the
   * status word, alone. */
  state: string;
  /**
   * The measurement beside it, already carrying its own name, or null
   * when there is nothing true to say. Never a bare duration: a bare
   * duration next to "Up" is exactly how this bug read.
   */
  detail: string | null;
  /** Which fact `detail` reports, for callers that style them apart.
   * `"unmeasured"` is not a measurement at all -- it is the row saying that
   * no measurement of it exists, which a caller should style as neutral
   * (never as a failure: nothing failed). */
  detailKind: "uptime" | "connected" | "lastSeen" | "unmeasured" | null;
  /** True when `detail` is an uptime whose reading has gone stale. */
  stale: boolean;
  /**
   * A full sentence for a tooltip, when the cell's short words need one --
   * currently only for an unmeasured row, where the badge says "Not
   * measured" and this says why. `null` everywhere else, so no call site has
   * to decide when an explanation exists.
   */
  explanation: string | null;
  /**
   * How the badge should read. `"warning"` is its own tone on purpose:
   * "we can't read the router" is neither the neutral "not seen yet" nor
   * the red "confirmed down", and painting it either colour repeats the
   * lie this module exists to stop.
   */
  tone: "up" | "down" | "neutral" | "warning";
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
  // Asked before the status word is chosen, because it replaces it. A row
  // nothing probes is not "Never observed" -- that is a claim about having
  // looked. See the module docstring.
  if (device.statusSource === "unmeasured") {
    return {
      state: "Not measured",
      // Deliberately no `detail`: a bare status word with nothing beside it
      // is the honest shape here. Every other `detail` this module emits is
      // a measurement, and inventing one for a row nothing measures would
      // be the original defect wearing different words.
      detail: null,
      detailKind: "unmeasured",
      stale: false,
      explanation: UNMEASURED_REASON_COPY[device.statusReason ?? "never_observed"],
      tone: "neutral",
    };
  }

  const issue = device.status === "up" ? null : (device.observationIssue ?? null);
  const issueDetail =
    issue != null && issue in ISSUE_DETAIL ? ISSUE_DETAIL[issue as ObservationIssue] : null;

  // The router could not be read. Whatever `status` says -- "unknown"
  // because nothing was ever recorded, or "down" because an old sighting
  // aged out -- it is a verdict about the router, not the device.
  if (isRouterUnreadable(issue)) {
    const lastSeen =
      device.lastSeenAt != null ? `last seen ${formatAge(device.lastSeenAt, now)} ago` : null;
    return {
      state: "Can't reach router",
      detail: lastSeen ? `${issueDetail} · ${lastSeen}` : issueDetail,
      detailKind: lastSeen ? "lastSeen" : null,
      stale: false,
      tone: "warning",
      explanation: null,
    };
  }

  const state =
    device.status === "up"
      ? "Up"
      : device.status === "down"
        ? "Down"
        : issue === "router_not_synced_yet"
          ? "Not checked yet"
          : issue === "controller_managed" || issue === "no_router"
            ? "Not monitored"
            : issue === "not_seen_by_router"
              ? "Not seen on network"
              : "Never observed";
  const tone: LivenessDescription["tone"] =
    device.status === "up" ? "up" : device.status === "down" ? "down" : "neutral";

  // A device the network has never seen has no liveness history at all;
  // an uptime reading for it would be a contradiction, not a bonus.
  if (device.status === "unknown") {
    return { state, detail: issueDetail, detailKind: null, stale: false, explanation: null, tone };
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
      explanation: null,
      tone,
    };
  }

  // No boot-uptime source (a third-party AP/printer/camera has none), but
  // the device is up and the backend knows when it first came on and
  // stayed on. "Connected for 3d" is the fact a venue owner means when
  // they ask "how long has it been up?" -- and it is strictly better than
  // falling through to "last seen X ago", which for an UP device answers
  // the age of the sync sweep's own view (a 15-minute cadence), not the
  // device's liveness, and reads as a contradiction ("Up ... but last
  // seen 11m ago?") to exactly the people this screen is for.
  if (device.status === "up" && device.connectedAt != null) {
    return {
      state,
      detail: `connected ${formatAge(device.connectedAt, now)}`,
      detailKind: "connected",
      stale: false,
      explanation: null,
      tone,
    };
  }

  if (device.lastSeenAt != null) {
    return {
      state,
      detail: `last seen ${formatAge(device.lastSeenAt, now)} ago`,
      detailKind: "lastSeen",
      stale: false,
      explanation: null,
      tone,
    };
  }

  return { state, detail: null, detailKind: null, stale: false, explanation: null, tone };
}

/** True when this platform probes this device's liveness at all.
 *
 * The console-side sibling of `routerLivenessIsMeasured` in
 * `@/lib/router-vendors`, one screen down: same question, different row
 * type. An absent `statusSource` reads as measured so that the demo fixture
 * and any pre-field backend response behave exactly as they did before. */
export function hardwareLivenessIsMeasured(device: DeviceLiveness): boolean {
  return device.statusSource !== "unmeasured";
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
