/**
 * Pure decision logic for "is this location live, and if not, why not".
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * Same reasoning as `src/lib/discovery-preflight.ts`, and deliberately the
 * same vocabulary: a precondition has a `key`, a `label`, a ternary
 * `status` (`pass` / `fail` / `unknown`, where `unknown` is a first-class
 * outcome and never a polite spelling of `pass`), a `detail` sentence and
 * a `nextStep`. The customer dashboard had no such vocabulary at all --
 * it rendered one word and a colour -- so rather than invent a second one,
 * this reuses the shape the fleet wizard's Discovery pre-flight already
 * ships (`@/types/router-fleet-wizard`'s `DiscoveryPrecondition`).
 *
 * THE DEFECT THIS EXISTS FOR (2026-08-23): a real router was provisioned
 * at "sector 12". The location row was `active`, the router row was
 * `provisioning`, and its heartbeat had never arrived -- the operator had
 * used the single-line paste, a syntax error partway through aborted the
 * rest of that console line, and the Heartbeat chunk (which is last) never
 * ran, so its scheduler was never created. The dashboard said "Offline".
 * Exactly the same word it says for a venue with no router at all, for a
 * venue whose router has gone quiet, and -- because a failed
 * `/locations/{id}/routers` read fell through to an empty array -- for a
 * venue whose routers it simply could not read.
 *
 * WHAT THE BACKEND ACTUALLY REPORTS (verified, not assumed)
 * --------------------------------------------------------
 * `GET /locations/{id}/routers` serialises `RouterResponse`
 * (`app/domains/router/schemas.py`), which carries both `status` and
 * `last_seen_at`. Both are needed, because neither alone is liveness:
 *
 *  - `status` is a stored column with six values
 *    (`app/domains/router/enums.py`): `pending_provisioning`,
 *    `provisioning`, `online`, `offline`, `suspended`, `decommissioned`.
 *  - The ONLY writer of `online` is `RouterService.heartbeat`, and it is
 *    also the only transition out of `provisioning`. So a router still
 *    sitting at `provisioning` has, by construction, never sent a single
 *    heartbeat -- that is a fact about the schema, not a guess.
 *  - `RouterService.check_in` (the provisioning-token exchange) ALSO
 *    stamps `last_seen_at`. So a non-null `last_seen_at` on a
 *    `provisioning` router is the enrolment handshake, NOT a heartbeat.
 *    Rendering it as "last seen" would report a measurement nobody took;
 *    `lastContactKind` exists so the UI can say which it was.
 *  - Nothing anywhere flips `online -> offline` when heartbeats stop.
 *    There is no such beat task (see
 *    `app/domains/analytics/router_availability.py`'s own note). `offline`
 *    is written by exactly one place: reinstating a suspended router. So
 *    trusting `status === "online"` on its own would report a router that
 *    died three weeks ago as live, forever. Staleness has to be computed
 *    here, from `last_seen_at`, the same way the backend's own readers do.
 */

/**
 * Heartbeat staleness windows, mirroring the backend's own
 * `ROUTER_HEARTBEAT_WARNING_STALE_MINUTES` / `ROUTER_HEARTBEAT_OFFLINE_STALE_MINUTES`
 * (`app/domains/monitoring/constants.py`), which are in turn what
 * `compute_lifecycle_stage` and `compute_internet_availability` use. Kept
 * as named exports so the copy below and the tests read off the same
 * numbers, and so a drift from the backend's values is a one-line change
 * rather than a hunt through string literals.
 */
export const HEARTBEAT_LATE_AFTER_MINUTES = 5;
export const HEARTBEAT_SILENT_AFTER_MINUTES = 15;

/**
 * How far into the future a `last_seen_at` may sit before we stop
 * believing we can measure staleness from it at all. Small amounts of
 * clock skew between the router, the API and this browser are ordinary;
 * a timestamp meaningfully ahead of now means the arithmetic below would
 * silently produce a *negative* age and render a dead router as freshly
 * seen -- an unknown dressed as a definite state.
 */
const CLOCK_SKEW_TOLERANCE_MINUTES = 2;

/** Ternary, same as the Discovery pre-flight's. `unknown` is never `pass`. */
export type LivenessStatus = "pass" | "fail" | "unknown";

export type RouterLivenessState =
  /** Heartbeat is current. */
  | "online"
  /** Heartbeat arrived, but later than the schedule. Still alive. */
  | "heartbeat-late"
  /** Came online once, and we have stopped hearing from it. */
  | "went-silent"
  /** Enrolled (token exchanged) but no heartbeat has EVER arrived. */
  | "never-checked-in"
  /** Added to the location, but has never contacted us at all. */
  | "setup-not-started"
  /** Administratively disabled. */
  | "suspended"
  /** Retired. */
  | "retired"
  /** We cannot say. Includes statuses this build does not recognise. */
  | "unknown";

/**
 * What a `lastContactIso` timestamp actually is. The distinction is not
 * pedantry: on a `provisioning` router the timestamp is the enrolment
 * handshake, and calling it "last seen" tells a venue owner the router
 * has been checking in when it never has once.
 */
export type LastContactKind =
  /** A real heartbeat from the device. */
  | "heartbeat"
  /** The provisioning-token exchange. Not evidence of a working agent. */
  | "enrolment"
  /** A timestamp we cannot attribute to either with confidence. */
  | "unspecified"
  /** No contact of any kind has ever been recorded. */
  | "none";

/**
 * One router's liveness, shaped like `DiscoveryPrecondition` on purpose --
 * `key`/`label`/`status`/`detail`/`nextStep` are the same five fields the
 * wizard's `PreconditionRow` already knows how to render.
 */
export interface RouterLiveness {
  key: string;
  label: string;
  status: LivenessStatus;
  state: RouterLivenessState;
  /** Short badge word for this router, in a venue owner's vocabulary. */
  shortLabel: string;
  detail: string;
  nextStep: string | null;
  lastContactIso: string | null;
  lastContactKind: LastContactKind;
  /** The raw backend status, for support conversations. Never rendered as the answer. */
  rawStatus: string;
}

export type LocationLivenessState =
  /** Every router at this location is checking in. */
  | "live"
  /** At least one is checking in, at least one is not. */
  | "partly-live"
  /** Routers exist here and none of them is checking in. */
  | "not-live"
  /** No router has ever been added to this location. */
  | "no-router"
  /** We could not determine liveness. Never rendered as live or not-live. */
  | "unknown";

export interface LocationLiveness {
  state: LocationLivenessState;
  /** The word on the badge. */
  label: string;
  /** One sentence saying what is actually true. Never "Not live". */
  summary: string;
  /** What to do about it, or null when there is nothing to do. */
  nextStep: string | null;
  /** Per-router breakdown, in the order the API returned them. */
  routers: RouterLiveness[];
  /**
   * `null` -- not `0` -- when the routers could not be read. A count of
   * zero is a claim ("this venue has no routers online"); null is the
   * absence of one.
   */
  routersOnline: number | null;
  routersTotal: number | null;
}

/** The wire shape, straight off `/locations/{id}/routers`. */
export interface RawRouterLiveness {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  last_seen_at?: string | null;
}

/**
 * Minutes between `iso` and `now`, or `null` when that cannot honestly be
 * computed: no timestamp, an unparseable one, or one far enough in the
 * future that the clocks disagree. Every one of those must reach the
 * caller as "unknown" rather than as a very small (or negative) age.
 */
export function minutesSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const minutes = (now.getTime() - then) / 60_000;
  if (minutes < -CLOCK_SKEW_TOLERANCE_MINUTES) return null;
  return minutes;
}

/**
 * "3 hours ago". Returns null for anything `minutesSince` refuses to
 * measure, so callers are forced to write the "never"/"unknown" copy
 * themselves rather than being handed a plausible-looking string.
 */
export function formatAgo(iso: string | null | undefined, now: Date): string | null {
  const minutes = minutesSince(iso, now);
  if (minutes === null) return null;
  if (minutes < 1) return "just now";
  if (minutes < 60) {
    const m = Math.round(minutes);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.round(hours);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.round(hours / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const PASTE_THE_HEARTBEAT_BLOCK =
  "Paste the Heartbeat block from this router's setup script into its terminal. " +
  "It is the last block in the script, and it is the one that creates the check-in " +
  "scheduler — if the script was pasted as a single line, an error earlier in that " +
  "line stops everything after it, including this block.";

/**
 * One router's liveness, from the two fields the API actually sends.
 *
 * Every branch that cannot establish liveness returns `status: "unknown"`,
 * never `"pass"`. In particular an unrecognised `status` string degrades to
 * unknown, so a backend that grows a seventh `RouterStatus` value cannot
 * make an older frontend build render an unknown router as live.
 */
export function deriveRouterLiveness(raw: RawRouterLiveness, now: Date): RouterLiveness {
  const rawStatus = typeof raw.status === "string" ? raw.status : "";
  const lastSeenIso = typeof raw.last_seen_at === "string" ? raw.last_seen_at : null;
  const key = typeof raw.id === "string" && raw.id ? raw.id : "router";
  const label = typeof raw.name === "string" && raw.name ? raw.name : "This router";
  const age = minutesSince(lastSeenIso, now);
  const ago = formatAgo(lastSeenIso, now);

  const base = { key, label, rawStatus };

  switch (rawStatus) {
    case "online": {
      // `status === "online"` alone is not liveness: nothing in the
      // backend ever moves a router out of `online` when its heartbeats
      // stop (see the module docstring). Without a usable timestamp there
      // is no evidence of life to report, so this is unknown -- not live.
      if (age === null) {
        return {
          ...base,
          status: "unknown",
          state: "unknown",
          shortLabel: "Can't confirm",
          detail:
            "This router is marked online, but it has no usable last-check-in time, " +
            "so we cannot confirm it is still reporting.",
          nextStep: "Refresh in a minute. If this persists, contact support.",
          lastContactIso: lastSeenIso,
          lastContactKind: "unspecified",
        };
      }
      if (age >= HEARTBEAT_SILENT_AFTER_MINUTES) {
        return {
          ...base,
          status: "fail",
          state: "went-silent",
          shortLabel: "Gone quiet",
          detail:
            `This router came online, but its last check-in was ${ago}. ` +
            `Anything past ${HEARTBEAT_SILENT_AFTER_MINUTES} minutes means we have stopped ` +
            "hearing from it.",
          nextStep:
            "Check the router has power and a working internet connection. If it does, " +
            "its check-in scheduler may have been lost — re-run the Heartbeat block from " +
            "the setup script.",
          lastContactIso: lastSeenIso,
          lastContactKind: "heartbeat",
        };
      }
      if (age >= HEARTBEAT_LATE_AFTER_MINUTES) {
        return {
          ...base,
          status: "pass",
          state: "heartbeat-late",
          shortLabel: "Online",
          detail:
            `This router is checking in, but its last check-in was ${ago} — later than ` +
            `the ${HEARTBEAT_LATE_AFTER_MINUTES}-minute schedule.`,
          nextStep:
            `No action needed yet. If it goes ${HEARTBEAT_SILENT_AFTER_MINUTES} minutes ` +
            "without checking in, this venue will stop reading as live.",
          lastContactIso: lastSeenIso,
          lastContactKind: "heartbeat",
        };
      }
      return {
        ...base,
        status: "pass",
        state: "online",
        shortLabel: "Online",
        detail: `This router checked in ${ago}.`,
        nextStep: null,
        lastContactIso: lastSeenIso,
        lastContactKind: "heartbeat",
      };
    }

    case "provisioning": {
      // The only transition out of `provisioning` is a heartbeat, so a
      // router still here has never sent one. `last_seen_at`, if set, is
      // the provisioning-token exchange -- reported as "setup started",
      // never as "last seen".
      return {
        ...base,
        status: "fail",
        state: "never-checked-in",
        shortLabel: "Never checked in",
        detail: ago
          ? `Setup started on this router ${ago}, but it has never checked in since — ` +
            "so it has never come online."
          : "This router has never checked in, so it has never come online.",
        nextStep: PASTE_THE_HEARTBEAT_BLOCK,
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "enrolment" : "none",
      };
    }

    case "pending_provisioning": {
      // Either a brand-new router record, or one deliberately rewound for
      // re-provisioning. With a prior timestamp we cannot tell which from
      // here, so the timestamp is reported without claiming what produced it.
      return {
        ...base,
        status: "fail",
        state: ago ? "never-checked-in" : "setup-not-started",
        shortLabel: ago ? "Waiting for setup" : "Setup not started",
        detail: ago
          ? `This router is waiting to be set up. Its last contact was ${ago}, before ` +
            "it was reset for setup."
          : "This router has been added here, but it has never contacted us — its setup " +
            "script has not been run yet.",
        nextStep: "Run this router's setup script on the device, from the first block to the last.",
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "unspecified" : "none",
      };
    }

    case "offline": {
      return {
        ...base,
        status: "fail",
        state: "went-silent",
        shortLabel: "Gone quiet",
        detail: ago
          ? `This router is offline. Its last check-in was ${ago}.`
          : "This router is offline, and has no recorded check-in to date from.",
        nextStep:
          "Check the router has power and a working internet connection, then wait a " +
          "minute for it to check in.",
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "heartbeat" : "none",
      };
    }

    case "suspended": {
      return {
        ...base,
        status: "fail",
        state: "suspended",
        shortLabel: "Suspended",
        detail: "This router has been suspended, so it is not serving guests.",
        nextStep: "Contact support to have it reinstated.",
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "heartbeat" : "none",
      };
    }

    case "decommissioned": {
      return {
        ...base,
        status: "fail",
        state: "retired",
        shortLabel: "Retired",
        detail: "This router has been decommissioned and is no longer in service.",
        nextStep: "Add a replacement router to this location.",
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "unspecified" : "none",
      };
    }

    default: {
      // Fail-safe direction, same as `normalizePreconditionStatus`'s: an
      // unrecognised status must never render as live.
      return {
        ...base,
        status: "unknown",
        state: "unknown",
        shortLabel: "Can't confirm",
        detail: rawStatus
          ? `This router reports a status this dashboard does not recognise ("${rawStatus}"), ` +
            "so we cannot say whether it is online."
          : "This router did not report a status, so we cannot say whether it is online.",
        nextStep: "Refresh. If this persists, contact support and quote this router's name.",
        lastContactIso: lastSeenIso,
        lastContactKind: lastSeenIso ? "unspecified" : "none",
      };
    }
  }
}

/**
 * "Last check-in 3 hours ago" / "Never heard from this router".
 *
 * Two facts the old dashboard could not tell apart, and a third it would
 * have got wrong: on a router still at `provisioning`, `last_seen_at` is
 * the provisioning-token exchange, so calling it a check-in would report
 * the router as having reported in when it never has. Each
 * `LastContactKind` gets its own sentence for exactly that reason.
 */
export function lastContactLabel(router: RouterLiveness, now: Date = new Date()): string {
  if (router.lastContactKind === "none") return "Never heard from this router";
  const ago = formatAgo(router.lastContactIso, now);
  if (ago === null) return "Last contact time unknown";
  switch (router.lastContactKind) {
    case "heartbeat":
      return `Last check-in ${ago}`;
    case "enrolment":
      return `Setup started ${ago} — no check-in since`;
    case "unspecified":
      return `Last contact ${ago}`;
  }
}

/**
 * Which unmet router speaks for the location when several are unmet.
 * Ordered by how actionable it is for a venue owner, so a multi-router
 * venue always gives the same, most useful answer rather than whichever
 * router the API happened to return first.
 */
const NOT_LIVE_PRIORITY: RouterLivenessState[] = [
  "never-checked-in",
  "setup-not-started",
  "went-silent",
  "suspended",
  "retired",
  "heartbeat-late",
  "online",
  "unknown",
];

/**
 * A location's liveness, and why.
 *
 * `routers` is deliberately nullable and `null` is NOT the same as `[]`:
 *
 *  - `null`/`undefined` means the routers could not be read (the request
 *    failed, or was never made). That is `unknown`. The bug this module
 *    exists for included exactly this: `listLocations()` turned a failed
 *    `/locations/{id}/routers` request into an empty array, which then
 *    rendered as the definite, wrong statement "Offline".
 *  - `[]` means the API answered and this location genuinely has no
 *    routers. That is `no-router`, which is a different sentence with a
 *    different next step.
 */
export function deriveLocationLiveness(
  routers: RawRouterLiveness[] | null | undefined,
  now: Date = new Date(),
): LocationLiveness {
  if (routers == null) {
    return {
      state: "unknown",
      label: "Can't tell",
      summary:
        "We could not read this location's routers just now, so we cannot say whether it is live.",
      nextStep:
        "Refresh. If it keeps failing, your account may not have permission to see this " +
        "location's routers.",
      routers: [],
      routersOnline: null,
      routersTotal: null,
    };
  }

  if (routers.length === 0) {
    return {
      state: "no-router",
      label: "No router yet",
      summary:
        "No router has been added to this location, so there is nothing here to bring online yet.",
      nextStep: "Add a router to this location, then run its setup script on the device.",
      routers: [],
      routersOnline: 0,
      routersTotal: 0,
    };
  }

  const derived = routers.map((r) => deriveRouterLiveness(r, now));
  const online = derived.filter((r) => r.status === "pass");
  const unknown = derived.filter((r) => r.status === "unknown");
  const total = derived.length;

  if (online.length === total) {
    const late = derived.filter((r) => r.state === "heartbeat-late");
    return {
      state: "live",
      label: "Live",
      summary:
        late.length > 0
          ? late[0].detail
          : total === 1
            ? derived[0].detail
            : `All ${total} routers at this location are checking in.`,
      nextStep: late.length > 0 ? late[0].nextStep : null,
      routers: derived,
      routersOnline: online.length,
      routersTotal: total,
    };
  }

  if (online.length > 0) {
    const worst = pickSpokesperson(derived.filter((r) => r.status !== "pass"));
    return {
      state: "partly-live",
      label: "Partly live",
      summary: `${online.length} of ${total} routers here are checking in. ${worst.label}: ${worst.detail}`,
      nextStep: worst.nextStep,
      routers: derived,
      routersOnline: online.length,
      routersTotal: total,
    };
  }

  // Nothing is checking in. If any router's state could not be
  // established, we do not get to call the location not-live -- we do not
  // know that. Unknown wins over a definite answer we cannot support.
  if (unknown.length > 0) {
    const worst = pickSpokesperson(unknown);
    return {
      state: "unknown",
      label: "Can't tell",
      summary: `${worst.label}: ${worst.detail}`,
      nextStep: worst.nextStep,
      routers: derived,
      routersOnline: null,
      routersTotal: total,
    };
  }

  const worst = pickSpokesperson(derived);
  const others = total - 1;
  return {
    state: "not-live",
    label: worst.shortLabel,
    summary:
      others > 0
        ? `${worst.label}: ${worst.detail} (${others} other router${others === 1 ? "" : "s"} here ${others === 1 ? "is" : "are"} also not checking in.)`
        : worst.detail,
    nextStep: worst.nextStep,
    routers: derived,
    routersOnline: 0,
    routersTotal: total,
  };
}

function pickSpokesperson(candidates: RouterLiveness[]): RouterLiveness {
  const sorted = [...candidates].sort(
    (a, b) => NOT_LIVE_PRIORITY.indexOf(a.state) - NOT_LIVE_PRIORITY.indexOf(b.state),
  );
  return sorted[0];
}

/**
 * Whether the dashboard may imply this location is fine.
 *
 * Distinct from `state === "live"` only in intent, and kept separate for
 * the same reason `discoveryPreflightIsReassuring` is separate from
 * `!isDiscoveryBlocked`: it is the single predicate every "show a green
 * tick" decision must go through, so no surface can independently decide
 * that an unknown looks close enough to fine.
 */
export function locationLivenessIsReassuring(
  liveness: LocationLiveness | null | undefined,
): boolean {
  if (!liveness) return false;
  return liveness.state === "live";
}

/**
 * What to show while the answer is still in flight.
 *
 * Deliberately its own value rather than reusing `unknown` ("we asked and
 * could not tell") or, as the header used to, falling through a ternary's
 * else-branch into a red dot. A state that is still loading gets a
 * loading-shaped word, and neither of the definite answers.
 */
export const CHECKING_LIVENESS: LocationLiveness = {
  state: "unknown",
  label: "Checking…",
  summary: "Checking this location's routers.",
  nextStep: null,
  routers: [],
  routersOnline: null,
  routersTotal: null,
};

/**
 * The verdict when nothing was read at all -- e.g. a location summary
 * persisted by a build of this app that predates `liveness`. Same object
 * `deriveLocationLiveness(null)` produces, so the two can never drift.
 */
export const UNKNOWN_LIVENESS: LocationLiveness = deriveLocationLiveness(null);

/**
 * The tone a badge/dot should take. `unknown` and `no-router` get their
 * own tone rather than borrowing "offline"'s red: neither is a fault, and
 * colouring them as one is the same collapse this module undoes.
 */
export type LivenessTone = "live" | "warn" | "down" | "neutral";

export function livenessTone(state: LocationLivenessState): LivenessTone {
  switch (state) {
    case "live":
      return "live";
    case "partly-live":
      return "warn";
    case "not-live":
      return "down";
    case "no-router":
    case "unknown":
      return "neutral";
  }
}
