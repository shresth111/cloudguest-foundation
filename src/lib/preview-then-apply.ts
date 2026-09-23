/**
 * Preview-then-apply: the pure half.
 *
 * WHERE THIS CAME FROM
 * --------------------
 * Every one of the rules below was already written, once, inside
 * `src/routes/master.integrations.tsx` — by someone who had the automatic
 * controller setup fail on a live QA venue on 2026-09-12 and then fixed what
 * the failure showed. The Omada management surfaces now being designed
 * (`~/wyfy-omada/FE-OMADA-MANAGEMENT-FRONTEND-PLAN.md` §5) each need the same
 * machinery — ACL rules, port forwarding, SSID creation — and the alternative
 * to lifting it out is fifteen near-copies, of which the first one to drop the
 * casing normalisation regresses the venue that taught us about it.
 *
 * So this module holds the decisions, as data and pure functions, and
 * `useReviewThenWrite` / `<PreviewThenApply>` hold the wiring and the markup.
 * Nothing here imports React, a service, or a query client: it is bundled and
 * driven directly by `scripts/test-preview-then-apply.mjs`.
 *
 * THE ONE DOMAIN FACT THIS MODULE IS SHAPED AROUND
 * ------------------------------------------------
 * **On this platform a write can return success and do nothing.** Three
 * separate writes against a real Omada controller returned `errorCode 0` and
 * changed nothing: a dropped field silently reset, an unknown field silently
 * ignored, an ordering change silently discarded. A fourth failure mode is
 * already encoded in `ControllerSetupOutcome`: `ok: false` arrives with HTTP
 * 200, so even the envelope is not the answer.
 *
 * The consequence is a rule, not a caveat: **no write may be reported as
 * successful on the strength of its own response.** Success is established by
 * reading the configuration back.
 *
 * That rule is expressed here as a type you cannot avoid answering:
 * `ReadBackPlan` is a required option of the hook, and its two arms are
 * "here is how to read it back" and "this surface does not read back, and
 * here is why". There is no third arm meaning "the 200 was enough".
 */

/**
 * One step of a preview or an apply, already reduced to what gets rendered.
 *
 * The step and outcome *vocabularies* stay at the call site — `ssid_takeover`
 * means nothing to a port-forwarding screen and `created | updated | unchanged
 * | skipped | failed` is the controller-setup vocabulary, not a universal one.
 * A caller maps its own response into this shape with its own label tables,
 * which is why `label` and `outcomeLabel` arrive resolved.
 */
export interface PreviewApplyStep {
  /** Stable key for React, and the raw step name for support. */
  key: string;
  /** The step in an operator's words. */
  label: string;
  /** The outcome in an operator's words. */
  outcomeLabel: string;
  /** Rendered in the destructive tone. Derived by the caller from its own
   * outcome vocabulary, because only the caller knows which of its values
   * mean "this did not happen". */
  failed: boolean;
  message?: string | null;
  /** The controller's own error number, for the support conversation that
   * follows a failure. Rendered only on a failed step. */
  providerCode?: number | string | null;
}

/** A preview or an apply, reduced to what gets rendered. */
export interface PreviewApplyOutcome {
  /** True for a dry run. Drives every heading in the panel. */
  dryRun: boolean;
  /** False when any step failed. NOT the only failure path — see the module
   * docstring. A false envelope must never suppress the steps, because on the
   * 200-with-`ok: false` path the steps are the only place the reason
   * exists. */
  ok: boolean;
  changed: boolean;
  steps: PreviewApplyStep[];
  /** Everything the backend returned, unmodified, behind a `<details>`. A
   * response an operator may need verbatim mid-incident, and a field added
   * server-side should reach the screen without a frontend release. */
  raw: unknown;
}

/**
 * What we know about whether the write actually landed.
 *
 * `not-read-back` is a declaration a surface makes about itself, in advance,
 * with a reason — not a state a run falls into by accident.
 */
export type WriteConfirmation =
  | {
      state: "confirmed";
      /** What the read-back saw, in an operator's words. */
      detail: string;
    }
  | {
      state: "contradicted";
      /** What the read-back saw instead. This is the `errorCode 0` case: the
       * write said it worked and the configuration says otherwise. */
      detail: string;
    }
  | {
      state: "unreadable";
      /** The read-back itself failed, so we know nothing either way. Not a
       * failure of the write — saying so would be the same invention in the
       * other direction. */
      detail: string;
    }
  | {
      state: "not-read-back";
      /** Why this surface cannot read its own write back. Required. */
      why: string;
    };

/**
 * The answer to "how do you know this landed?", required of every caller.
 *
 * `{ kind: "read-back" }` runs `verify` immediately after a real apply and the
 * panel reports what it saw. `{ kind: "not-read-back" }` is the honest opt-out
 * and costs a sentence explaining itself; the panel then claims nothing.
 */
export type ReadBackPlan<TResult> =
  | {
      kind: "read-back";
      /**
       * Read the configuration back off the device and say what you found.
       * Throwing is allowed and lands as `unreadable`.
       */
      verify: (applied: TResult) => Promise<WriteConfirmation>;
    }
  | { kind: "not-read-back"; why: string };

/** Every piece of preview/apply state, in one place so a reducer can own it. */
export interface PreviewApplyState {
  outcome: PreviewApplyOutcome | null;
  /** Hard gate on Apply. Only a completed dry run sets it. */
  previewed: boolean;
  /** Preconditions the backend refused on, read off a 409. */
  gaps: string[];
  /** Null until a real apply has finished. */
  confirmation: WriteConfirmation | null;
}

export const PREVIEW_APPLY_INITIAL: PreviewApplyState = {
  outcome: null,
  previewed: false,
  gaps: [],
  confirmation: null,
};

export type PreviewApplyEvent =
  | { type: "run-succeeded"; dryRun: boolean; outcome: PreviewApplyOutcome }
  | { type: "run-refused"; gaps: string[] }
  | { type: "run-failed" }
  | { type: "confirmed"; confirmation: WriteConfirmation }
  /** The inputs changed, so a held preview no longer describes what Apply
   * would do. */
  | { type: "invalidate" }
  | { type: "reset" };

/**
 * The state machine, lifted verbatim from the route's four `setState` sites.
 *
 * Each transition is a decision somebody made for a reason, so each one is
 * commented with the reason rather than the mechanics.
 */
export function previewApplyReducer(
  state: PreviewApplyState,
  event: PreviewApplyEvent,
): PreviewApplyState {
  switch (event.type) {
    case "run-succeeded":
      return {
        ...state,
        outcome: event.outcome,
        // Got far enough to return a body, so nothing is blocking it any more.
        gaps: [],
        // Only a dry run arms Apply. A real apply leaves the flag where it
        // was, so a second apply of the same previewed change stays available.
        previewed: event.dryRun ? true : state.previewed,
        // A real apply has not been read back yet; a dry run wrote nothing, so
        // there is nothing to read back.
        confirmation: null,
      };

    case "run-refused":
      return {
        ...state,
        gaps: event.gaps,
        // A stale preview describes a run that is now refused, and leaving it
        // on screen under a fresh refusal reads as though it still applies.
        outcome: null,
        previewed: false,
        confirmation: null,
      };

    // An untyped error is a toast, not a state change. Blanking the panel
    // would destroy a preview an operator is mid-way through reading because
    // one request timed out.
    case "run-failed":
      return state;

    case "confirmed":
      return { ...state, confirmation: event.confirmation };

    case "invalidate":
      // Gaps deliberately survive: a precondition the controller refused on is
      // still unmet after an option is toggled, and clearing the amber panel
      // would read as "fixed".
      return { ...state, outcome: null, previewed: false, confirmation: null };

    case "reset":
      return PREVIEW_APPLY_INITIAL;

    default:
      return state;
  }
}

/**
 * The 409 refusal, and BOTH halves of it matter.
 *
 * Verified against the live QA venue on 2026-09-12, where the route rendered
 * "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS — this build does not recognise
 * that precondition" instead of the one gap that was actually unmet.
 *
 *   {"data": {"code": "NETWORK_INTEGRATION_AUTOCONFIG_PRECONDITIONS",
 *             "missing": ["openapi_required"]}}
 *
 * `data.code` names the REFUSAL; `data.missing` is the gap list. They are
 * different things, and rendering the code as a gap produces an amber panel
 * that names no fix — the precise failure the panel exists to prevent.
 * `missing` is absent on the other pre-write refusals (a foreign portal on the
 * SSID, a shared site), so the code stays as the fallback rather than leaving
 * those silent.
 *
 * Casing is the second half: the backend emits gap values lowercase
 * (`openapi_required`) while the copy tables are keyed on an uppercase union.
 * Without this normalisation a correct list still renders as unrecognised, so
 * the two bugs hid each other.
 *
 * @returns the gap list, or `null` when this is not a typed refusal and the
 * caller should fall through to its ordinary error handling.
 */
export function refusalGapsFromError(err: unknown): string[] | null {
  const e = err as
    | { status?: number | null; code?: string; data?: Record<string, unknown> }
    | null
    | undefined;
  const typed = (e?.data?.code ?? e?.code) as string | undefined;
  const rawMissing = e?.data?.missing;
  const missing = Array.isArray(rawMissing)
    ? rawMissing.filter((g): g is string => typeof g === "string").map((g) => g.toUpperCase())
    : [];
  if (e?.status === 409 && (missing.length > 0 || typed)) {
    return missing.length > 0 ? missing : [typed as string];
  }
  return null;
}

/**
 * Gaps in the backend's documented fix order, with anything unrecognised last
 * rather than dropped.
 *
 * The order is a dependency chain: choosing a site before storing the
 * credentials that can list sites sends an operator to a screen that cannot
 * answer. Generic over the order table because each surface has its own.
 */
export function orderGapsBy(order: readonly string[], gaps: string[]): string[] {
  const rank = (g: string) => {
    const i = order.indexOf(g);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...gaps].sort((a, b) => rank(a) - rank(b));
}

/**
 * The sentence the panel prints under a finished apply.
 *
 * Deliberately has no "applied successfully" arm. The strongest thing this
 * vocabulary can say is that something read the configuration back and it
 * matched.
 */
export function describeWriteConfirmation(c: WriteConfirmation): string {
  switch (c.state) {
    case "confirmed":
      return c.detail;
    case "contradicted":
      return c.detail;
    case "unreadable":
      return c.detail;
    case "not-read-back":
      return c.why;
  }
}
