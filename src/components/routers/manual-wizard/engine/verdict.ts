/**
 * Manual wizard engine — verdict assembly.
 *
 * `parsing.rules.ts` stage 10:
 *   fingerprint -> required facts -> pass predicate -> outcomes in order,
 *   first match wins.
 *
 * ---------------------------------------------------------------------
 * THE DECISION TABLE, IN FULL
 * ---------------------------------------------------------------------
 * `pass` is three-valued and the first matching outcome may be absent, so
 * there are nine cases. They are enumerated rather than collapsed, because
 * every shortcut anyone has taken here has resolved in the optimistic
 * direction:
 *
 *   matched outcome | pass=true | pass=null | pass=false
 *   ----------------+-----------+-----------+------------
 *   FAIL            | FAIL *    | FAIL      | FAIL
 *   WRONG_OUTPUT    | WRONG     | WRONG     | WRONG
 *   INCOMPLETE      | INCOMPL.  | INCOMPL.  | INCOMPL.
 *   UNKNOWN         | UNKNOWN   | UNKNOWN   | UNKNOWN
 *   WARNING         | WARNING   | UNKNOWN   | FAIL **
 *   (none)          | PASS      | UNKNOWN   | FAIL **
 *
 *   *  pass true AND a FAIL outcome matching is a CONTRADICTION in the
 *      content. FAIL is taken because it is the pessimistic reading and
 *      because it is the actionable one, and the contradiction is
 *      recorded in `contradictions` so it can be fixed.
 *   ** pass false with nothing explaining it is `unexplainedFailure`. The
 *      pass predicate is a determinate statement that a fact contradicts
 *      the expected state, so it is a FAIL — but with no `meaning` to
 *      show, which is a content gap and is reported as one.
 *
 * A WARNING outcome may never be reported while `pass` is anything other
 * than true. `Verdict.WARNING` is defined as "pass predicate true, but
 * something is off"; reporting it otherwise would be exactly the
 * optimistic collapse this module exists to prevent.
 *
 * ---------------------------------------------------------------------
 * A SELF-REPORTED `RESULT:` LINE ONLY EVER MOVES A VERDICT DOWN
 * ---------------------------------------------------------------------
 * The legacy 9-phase blocks print their own `RESULT: PASS`. Per
 * `parsing.rules.ts` that is a CLAIM, never an authority: believed only
 * when the evidence agrees, and scored as a failure when it contradicts.
 * So a `RESULT: PASS` sitting above evidence this engine scored FAIL stays
 * FAIL, and a `RESULT: FAIL` above evidence this engine scored PASS
 * downgrades to UNKNOWN — two readings disagreeing is never resolved by
 * taking the cheerful one.
 *
 * ---------------------------------------------------------------------
 * NOTHING HERE JOINS ON A HUMAN-READABLE STRING
 * ---------------------------------------------------------------------
 * Outcomes are selected by evaluating `Outcome.when` and identified by
 * `Outcome.id` — both `Lit`. `guided-setup/analyse.ts` selects a repair
 * with `failFix.findIndex(f => f.when === fixWhen)`, an exact match on a
 * human-readable string, and translating that string silently degraded a
 * pinpointed repair into a generic list in one language only. This engine
 * returns `outcomeId` and `fixIndex`; the caller looks the prose up.
 */

import type { Lit, ManualStep, Outcome, Predicate, Verdict } from "../types";
import type { ComputedFacts, FactStore } from "./facts";
import { extractFacts } from "./facts";
import type { NormalisedPaste } from "./normalise";
import { normalise } from "./normalise";
import { classify, isRawPrintWithNoRecords } from "./classify";
import type { Classification } from "./classify";
import { evaluate, makeContext } from "./predicate";
import type { Tri } from "./predicate";
import type { CounterDiff, CounterReading } from "./counters";
import { DELTA_KEY_PREFIX, diffCounters, readCounters } from "./counters";

// ---------------------------------------------------------------------
// Known limitations, kept next to the code rather than in a report
// ---------------------------------------------------------------------

/**
 * Checks this engine deliberately does NOT assert, and why. Declaring a
 * check unassertable is a result; writing an assertion nobody trusts is
 * not. Every id here is a `Lit`, so a test can pin the list.
 */
export const UNASSERTABLE: { id: Lit; why: Lit }[] = [
  {
    id: "step13-lan-address:noOverlap-on-pppoe",
    why: "noOverlap compares the guest range against wan-address, which the probe reads only from ether1. On a PPPoE venue the WAN address lives on the virtual interface, wan-address is legitimately empty, and an empty set cannot overlap - so the check passes vacuously rather than being evaluated. Not wrong, just silent.",
  },
  {
    id: "step18-end-to-end:operator-checklist",
    why: "STEP18_OPERATOR_CHECKLIST cannot be answered by any paste. The engine never scores it; an unanswered item is UNKNOWN and the caller must collect an explicit yes or no.",
  },
  {
    id: "any-step:contextCommands",
    why: "contextCommands are displayed and attached to tickets, never scored. parsing.rules.ts WRAP_HAZARD: a value read out of a wide table can be corrupted by a narrow terminal in a way that still looks like a value.",
  },
  {
    id: "i18n:colliding-token-lint-is-best-effort",
    why: "engine/protected-tokens.ts enforces the {{token}} convention absolutely for tokens that are never ordinary English, and only in narrow device-cue contexts for the eight that are (bridge, bound, connected, none, accepts, rejects, timeouts, established). The colliding tier has deliberate false negatives so it has no false positives; `connected` is its weakest case and is documented there.",
  },
  {
    id: "engine:never-run-against-a-real-router",
    why: "Every fixture in scripts/test-manual-wizard-engine.mjs is hand-written from the probe commands and from RouterOS output shapes recorded in this repo. No paste in this suite came off a live hEX. The parser is therefore verified against what the content SAYS the device prints, not against what a 7.23.3 box actually printed. Confirm on hardware before promoting any unverified rule to a hard FAIL.",
  },
];

// ---------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------

export type StepResult = {
  stepId: Lit;
  verdict: Verdict;
  /** Stable id of the outcome that produced the verdict, or null. */
  outcomeId: Lit | null;
  /** Stable id of the rule that forced a classification verdict. */
  gate: Lit | null;
  /** Three-valued result of `step.pass.when`. */
  pass: Tri;
  /** Reason ids for every null the evaluator produced. Never prose. */
  trace: Lit[];
  classification: Classification;
  facts: FactStore;
  counters: { current: CounterReading | null; diff: CounterDiff };
  /** Required facts missing or corrupt — the INCOMPLETE_OUTPUT evidence. */
  incompleteKeys: Lit[];
  /** pass true and a FAIL outcome matched: the content disagrees with
   * itself. Report it; do not paper over it. */
  contradictions: Lit[];
  /** pass false and no outcome explains it. A content gap. */
  unexplainedFailure: boolean;
  /** A legacy `RESULT:` self-report found in the paste, recorded as a
   * claim. Never promoted to a verdict. */
  claimedResult: Lit | null;
  paste: NormalisedPaste;
};

export type EvaluateOptions = {
  /** App clock. Defaults to `Date.now()`. */
  nowMs?: number;
  /** The counter reading taken BEFORE the phone test. */
  previousCounters?: CounterReading | null;
  /** Extra app-computed facts, merged after the counter deltas. */
  computed?: ComputedFacts;
};

// ---------------------------------------------------------------------
// Predicate key walking, used to decide whether a step needs a diff
// ---------------------------------------------------------------------

export function predicateKeys(predicate: Predicate, into: Lit[] = []): Lit[] {
  switch (predicate.op) {
    case "all":
    case "any":
      for (const p of predicate.of) predicateKeys(p, into);
      return into;
    case "not":
      return predicateKeys(predicate.of, into);
    case "some":
    case "every":
      into.push(predicate.key);
      return predicateKeys(predicate.of, into);
    case "noOverlap":
      into.push(predicate.key, predicate.otherKey);
      return into;
    default:
      into.push(predicate.key);
      return into;
  }
}

function stepDependsOnCounterDeltas(step: ManualStep): boolean {
  const keys = predicateKeys(step.pass.when);
  for (const outcome of step.outcomes) predicateKeys(outcome.when, keys);
  return keys.some((k) => k.startsWith(DELTA_KEY_PREFIX));
}

// ---------------------------------------------------------------------
// The entry point
// ---------------------------------------------------------------------

export function evaluateStep(
  step: ManualStep,
  rawPaste: string,
  options: EvaluateOptions = {},
): StepResult {
  const nowMs = options.nowMs ?? Date.now();
  const paste = normalise(rawPaste);
  const classification = classify(step, paste);

  // --- counters, before facts, because they become facts -------------
  const current = readCounters(paste.kv, nowMs);
  const diff = diffCounters(options.previousCounters ?? null, current);
  const computed: ComputedFacts = { ...diff.deltas, ...(options.computed ?? {}) };

  const facts = extractFacts(step, paste, computed);

  const base: Omit<StepResult, "verdict" | "outcomeId" | "pass"> = {
    stepId: step.id,
    gate: classification.gate,
    trace: [],
    classification,
    facts,
    counters: { current, diff },
    incompleteKeys: facts.incompleteKeys,
    contradictions: [],
    unexplainedFailure: false,
    claimedResult: paste.claimedResult,
    paste,
  };

  // --- 1. classification gates ---------------------------------------
  if (classification.verdict !== null) {
    return { ...base, verdict: classification.verdict, outcomeId: null, pass: null };
  }

  // --- 2. required facts ---------------------------------------------
  // parsing.rules.ts: "Absence of a required fact is INCOMPLETE_OUTPUT,
  // never PASS and never FAIL."
  if (facts.incompleteKeys.length > 0) {
    return {
      ...base,
      verdict: "INCOMPLETE_OUTPUT",
      outcomeId: null,
      pass: null,
      gate: base.gate ?? "requiredFactMissing",
    };
  }

  // --- 3. the raw-print-with-no-records case --------------------------
  if (isRawPrintWithNoRecords(paste)) {
    return {
      ...base,
      verdict: "UNKNOWN",
      outcomeId: null,
      pass: null,
      gate: base.gate ?? "rawPrintNoRecords",
    };
  }

  // --- 4. pass predicate and outcomes --------------------------------
  const ctx = makeContext(facts, nowMs);
  const pass = evaluate(step.pass.when, ctx);

  let matched: Outcome | null = null;
  for (const outcome of step.outcomes) {
    // A null NEVER matches. That is the property that keeps an
    // undecidable check off the first outcome in the list.
    if (evaluate(outcome.when, ctx) === true) {
      matched = outcome;
      break;
    }
  }

  const trace = ctx.trace.slice();
  const contradictions: Lit[] = [];
  let unexplainedFailure = false;
  let verdict: Verdict;

  if (matched === null) {
    if (pass === true) verdict = "PASS";
    else if (pass === null) verdict = "UNKNOWN";
    else {
      verdict = "FAIL";
      unexplainedFailure = true;
    }
  } else if (matched.verdict === "WARNING") {
    if (pass === true) verdict = "WARNING";
    else if (pass === null) verdict = "UNKNOWN";
    else {
      verdict = "FAIL";
      unexplainedFailure = true;
    }
  } else {
    verdict = matched.verdict;
    if (matched.verdict === "FAIL" && pass === true) contradictions.push(matched.id);
  }

  // --- 5. the counter cap ---------------------------------------------
  // A step whose scoring reads a `delta-*` fact cannot be decided from a
  // degenerate diff. One reading, a router that restarted between the two,
  // and four zeros on both sides are all "cannot tell".
  //
  // The cap covers two directions, not one:
  //   PASS / WARNING       — obviously. Zero traffic and working traffic
  //                          are indistinguishable from one sample.
  //   an UNEXPLAINED FAIL  — a pass predicate that only went false because
  //                          `delta-accepts` is a meaningless zero, with no
  //                          outcome willing to name a fault, is not a
  //                          finding. Reporting FAIL there would send an
  //                          installer to rebuild a working router.
  //
  // A FAIL that a MATCHED outcome named stands: that outcome read a real
  // fact (`use-radius=false`, a drifted source address) and does not
  // depend on the diff.
  const degradedByCounters =
    stepDependsOnCounterDeltas(step) &&
    !diff.usable &&
    (verdict === "PASS" || verdict === "WARNING" || (verdict === "FAIL" && unexplainedFailure));
  if (degradedByCounters) {
    verdict = "UNKNOWN";
    unexplainedFailure = false;
    for (const problem of diff.problems) if (!trace.includes(problem)) trace.push(problem);
  }

  // --- 6. a self-reported RESULT line, as a claim only -----------------
  if (paste.claimedResult !== null) {
    const claimsPass = /\bPASS\b/i.test(paste.claimedResult);
    const claimsFail = /\b(FAIL|ERROR)\b/i.test(paste.claimedResult);
    if (claimsFail && (verdict === "PASS" || verdict === "WARNING")) {
      // The block says it failed and the evidence reads clean. Two
      // readings disagreeing is UNKNOWN, never the cheerful one.
      verdict = "UNKNOWN";
      if (!trace.includes("self-report-contradicts-evidence"))
        trace.push("self-report-contradicts-evidence");
    }
    if (claimsPass && verdict === "FAIL") {
      // Evidence wins. Recorded so the contradiction is visible.
      contradictions.push("self-report-claims-pass");
    }
  }

  return {
    ...base,
    verdict,
    outcomeId: matched ? matched.id : null,
    pass,
    trace,
    contradictions,
    unexplainedFailure,
  };
}

// ---------------------------------------------------------------------
// Fix selection — by index, never by prose
// ---------------------------------------------------------------------

/**
 * The repairs to offer for a result, as INDICES into
 * `outcome.fix`. The caller renders `note` / `confirmPrompt` from its own
 * locale bundle. Nothing is matched on a rendered string.
 */
export function fixIndicesFor(step: ManualStep, result: StepResult): number[] {
  if (result.outcomeId === null) return [];
  const outcome = step.outcomes.find((o) => o.id === result.outcomeId);
  if (!outcome || !outcome.fix) return [];
  return outcome.fix.map((_, index) => index);
}

/**
 * A `destructive` repair is a hard gate, not documentation: `types.ts`
 * forbids offering one without a typed confirmation naming what is lost.
 * A destructive fix with no `confirmPrompt` is withheld entirely.
 */
export function isFixOfferable(step: ManualStep, outcomeId: Lit, fixIndex: number): boolean {
  const outcome = step.outcomes.find((o) => o.id === outcomeId);
  const fix = outcome?.fix?.[fixIndex];
  if (!fix) return false;
  if (!fix.destructive) return true;
  return typeof fix.confirmPrompt === "string" && fix.confirmPrompt.trim() !== "";
}
