/**
 * THE PRE-GATE PHASE: what a guest is shown AFTER they have signed in and
 * BEFORE the NAS gate is opened for them.
 *
 * ## Why this phase exists
 *
 * QA, Aruba Instant On venue, 2026-10-06: "Auto closing login screen in
 * android just after login, not showing the offer/survey or anything."
 *
 * Android's captive-portal sign-in sheet (AOSP `CaptivePortalLogin`,
 * shipped as a Mainline module and unchanged in this respect from Android
 * 11 through `main`) closes ITSELF the moment the network validates:
 *
 *   - every page start/finish in the sheet calls
 *     `CaptivePortal.reevaluateNetwork()`, i.e. asks NetworkMonitor to
 *     re-probe `connectivitycheck.gstatic.com/generate_204`;
 *   - `handleCapabilitiesChanged` calls `done(Result.DISMISSED)` ->
 *     `finishAndRemoveTask()` as soon as the network gains
 *     `NET_CAPABILITY_VALIDATED`.
 *
 * So the instant the gate opens, the very navigation that carries the
 * guest to `/portal/session` (RouterOS `dst`, Aruba `url`, Omada's
 * `window.location.assign`) triggers the re-probe, the probe now passes,
 * and the sheet is gone -- before the offer, survey or profile card on the
 * session page can paint. iOS's Captive Network Assistant does the same
 * thing by its own route (see `@/lib/portal-cna`). Anything rendered after
 * the gate is, for every phone guest in a captive sheet, never seen.
 *
 * The only place content is reliably visible inside a sheet is BEFORE the
 * gate opens: the network is still captive, NetworkMonitor still sees the
 * portal, and the sheet stays up for as long as the guest is reading.
 * That is what this phase is.
 *
 * ## The rules this module owns
 *
 * Kept import-free so `scripts/test-portal-pre-gate.mjs` can bundle it and
 * assert the real rules, and so it touches no storage (Web Storage throws
 * inside iOS's CNA).
 *
 *   1. Never hold the gate on a slow network call: the content lookup is
 *      bounded by `PRE_GATE_FETCH_TIMEOUT_MS`, and a timeout or failure
 *      means "nothing to show", never "wait".
 *   2. Never hold the gate forever: `PRE_GATE_MAX_MS` is a hard ceiling on
 *      the whole phase, well inside the backend's 10-minute presence grace
 *      (`SESSION_PRESENCE_GRACE_MINUTES`) and the venue idle sweep's own
 *      slack, so a guest who walks away mid-survey still gets online and
 *      their session is never swept before the NAS has seen them.
 *   3. Every step is skippable. Nothing here gates access -- the guest is
 *      already authenticated; this only decides when the door opens.
 *   4. Content that needs the open internet (the Google review link) or a
 *      dwell (the 25-minute star prompt) stays AFTER the gate, where it
 *      always was.
 *
 * ## Extension point
 *
 * `PreGateStep` is the seam for an ordered, venue-configurable step
 * sequence: a new step kind is added to the union, `resolvePreGateSteps`
 * decides whether it applies, and the phase renders the steps in order.
 */

/** How long the phase waits for the venue's next offer/survey before
 * deciding there is none. Short on purpose: this sits between a verified
 * sign-in and the guest's internet. */
export const PRE_GATE_FETCH_TIMEOUT_MS = 3_000;

/** Hard ceiling on the whole phase. After this the gate opens regardless
 * of where the guest is. 3 minutes: long enough for a real survey, far
 * inside every server-side grace window a not-yet-admitted session has. */
export const PRE_GATE_MAX_MS = 180_000;

/** How long a pre-gate impression write may hold the gate. The very next
 * thing after it is a full-document navigation that would cancel an
 * in-flight request, so it is awaited -- but never for long. */
export const PRE_GATE_IMPRESSION_TIMEOUT_MS = 1_500;

/**
 * Query parameter `/portal/session` reads to know the pre-gate phase
 * already showed this guest their arrival content. Its VALUE is the
 * session id, so a stale parameter from an earlier session can never
 * suppress anything for a new one. A URL parameter, not storage, for the
 * reason `lang` is one (see `@/lib/portal-session-url`): it is the one
 * channel that survives the gate's document boundary on every browser.
 */
export const PRE_GATE_SESSION_PARAM = "pregate";

export type PreGateStep = "campaign" | "profile";

/** Why the phase is skipped outright, or `null` when it may run. */
export type PreGateSkipReason =
  | "no-session"
  | "simulated"
  | "nas-already-authorized"
  | "recent-gate-submit"
  | "already-done"
  | null;

export interface PreGateSkipInput {
  hasSession: boolean;
  /** Operator Portal Preview or the demo walkthrough: no real session, and
   * their own flows render the offer elsewhere. */
  simulated: boolean;
  /** RouterOS said the gate is ALREADY open (`hspage`). The sheet, if any,
   * is closing already; holding anything here would show it to nobody. */
  nasAlreadyAuthorized: boolean;
  /** A gate submit for this guest a few seconds ago: this mount is one of
   * the OS's remount bounces, not a new sign-in. */
  recentlySubmitted: boolean;
  /** The phase already ran for this session (a re-entry after the AP
   * intercepted a load). Showing it again would re-serve an every-login
   * offer twice in one visit. */
  alreadyDone: boolean;
}

export function preGateSkipReason(input: PreGateSkipInput): PreGateSkipReason {
  if (!input.hasSession) return "no-session";
  if (input.simulated) return "simulated";
  if (input.nasAlreadyAuthorized) return "nas-already-authorized";
  if (input.recentlySubmitted) return "recent-gate-submit";
  if (input.alreadyDone) return "already-done";
  return null;
}

export interface PreGateStepsInput {
  /** A renderable offer/survey the server says this guest is eligible for
   * right now, that is NOT the dwell-gated star prompt. */
  campaignRenderable: boolean;
  /** The profile card's own eligibility (`profileCardEligible`). */
  profileEligible: boolean;
}

/**
 * The ordered steps the phase renders. The offer/survey first (venue
 * content the guest is shown on arrival today), then the profile ask --
 * the same order `/portal/session` used, so moving them ahead of the gate
 * changes WHEN, never WHAT or in which order.
 */
export function resolvePreGateSteps(input: PreGateStepsInput): PreGateStep[] {
  const steps: PreGateStep[] = [];
  if (input.campaignRenderable) steps.push("campaign");
  if (input.profileEligible) steps.push("profile");
  return steps;
}

/** Resolves to `fallback` if `promise` has not settled within `ms`, or if
 * it rejects. Never rejects itself: every caller here would rather show
 * nothing than make a guest wait. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** True when `search` carries the pre-gate marker for exactly this
 * session. */
export function preGateMarkerMatches(
  search: string,
  sessionId: string | null | undefined,
): boolean {
  if (!sessionId) return false;
  try {
    return new URLSearchParams(search).get(PRE_GATE_SESSION_PARAM) === sessionId;
  } catch {
    return false;
  }
}
