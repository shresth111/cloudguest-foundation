/**
 * Manual wizard engine — the RADIUS counter diff.
 *
 * These are the only facts in the whole module the app COMPUTES rather
 * than reads, and they are the only ones where a single, perfectly valid,
 * completely parsed reading must still score UNKNOWN.
 *
 * ---------------------------------------------------------------------
 * WHY ONE READING CAN NEVER PASS
 * ---------------------------------------------------------------------
 * `/radius monitor` prints TOTALS SINCE THE ROUTER LAST RESTARTED. So
 * `accepts=41` says forty-one guests logged in at some point in the last
 * three weeks. It says nothing whatsoever about whether a guest can log in
 * now, which is the only question this step is asking. The answer is the
 * DIFFERENCE across the phone test, and a difference needs two readings.
 *
 * ---------------------------------------------------------------------
 * WHY ALL-ZERO IS ALSO NOT AN ANSWER
 * ---------------------------------------------------------------------
 * Zero traffic and working traffic are indistinguishable from one sample,
 * and two all-zero samples are indistinguishable from "nobody ran the
 * phone test". Both readings being entirely zero is therefore DEGENERATE:
 * the deltas are arithmetically computable and meaningless, so the diff is
 * marked and `verdict.ts` refuses to let it produce PASS or WARNING.
 *
 * ---------------------------------------------------------------------
 * FOUR COUNTERS, NOT THREE
 * ---------------------------------------------------------------------
 * `bad-replies` means a reply ARRIVED and failed validation. It is neither
 * a rejection nor a timeout, and watching only rejections makes it
 * invisible — which is what the 2026-08-18 outage cost. It is required
 * here, and a diff that cannot see it is incomplete rather than clean.
 */

import type { Lit } from "../types";

/** The four that decide the verdict, plus the two that only inform. */
export const REQUIRED_COUNTER_KEYS: Lit[] = ["accepts", "rejects", "timeouts", "bad-replies"];
export const OPTIONAL_COUNTER_KEYS: Lit[] = ["pending", "requests", "resends"];

export const DELTA_KEY_PREFIX = "delta-";

export type CounterReading = {
  /** App clock, milliseconds. The router's clock is not trusted. */
  atMs: number;
  values: Record<Lit, number>;
};

export type CounterDiffProblem =
  /** Fewer than two readings exist. */
  | "single-reading"
  /** A counter went DOWN — the router restarted between readings, so the
   * two are not on the same baseline and no difference is meaningful. */
  | "counter-reset"
  /** Every required counter is zero in both readings. */
  | "all-zero"
  /** A required counter is absent from one of the readings. */
  | "missing-counter";

export type CounterDiff = {
  /** True only when a real, interpretable difference was computed. */
  usable: boolean;
  problems: CounterDiffProblem[];
  /** `delta-accepts`, `delta-rejects`, ... Empty when not computable. */
  deltas: Record<Lit, number>;
  /** Counters absent from one of the two readings. */
  missing: Lit[];
  /** Counters that decreased. */
  decreased: Lit[];
  elapsedMs: number | null;
};

export function readCounters(kv: Record<Lit, Lit[]>, atMs: number): CounterReading | null {
  const values: Record<Lit, number> = {};
  let sawAny = false;
  for (const key of [...REQUIRED_COUNTER_KEYS, ...OPTIONAL_COUNTER_KEYS]) {
    const raw = kv[key];
    if (raw === undefined || raw.length === 0) continue;
    const n = Number(raw[raw.length - 1].trim());
    if (!Number.isFinite(n)) continue;
    values[key] = n;
    sawAny = true;
  }
  return sawAny ? { atMs, values } : null;
}

/**
 * `previous` is the reading taken BEFORE the phone test, `current` the one
 * taken after. Passing `null` for `previous` is the normal first-run case
 * and yields `single-reading` — never an optimistic zero.
 */
export function diffCounters(
  previous: CounterReading | null,
  current: CounterReading | null,
): CounterDiff {
  const empty: CounterDiff = {
    usable: false,
    problems: [],
    deltas: {},
    missing: [],
    decreased: [],
    elapsedMs: null,
  };

  if (current === null)
    return { ...empty, problems: ["missing-counter"], missing: REQUIRED_COUNTER_KEYS.slice() };
  if (previous === null) return { ...empty, problems: ["single-reading"] };

  const problems: CounterDiffProblem[] = [];
  const missing: Lit[] = [];
  const decreased: Lit[] = [];
  const deltas: Record<Lit, number> = {};

  for (const key of REQUIRED_COUNTER_KEYS) {
    const a = previous.values[key];
    const b = current.values[key];
    if (a === undefined || b === undefined) {
      missing.push(key);
      continue;
    }
    if (b < a) decreased.push(key);
    deltas[`${DELTA_KEY_PREFIX}${key}`] = b - a;
  }

  if (missing.length > 0) problems.push("missing-counter");
  if (decreased.length > 0) problems.push("counter-reset");

  const allZero =
    missing.length === 0 &&
    REQUIRED_COUNTER_KEYS.every((key) => previous.values[key] === 0 && current.values[key] === 0);
  if (allZero) problems.push("all-zero");

  // A reset or a missing counter means the numbers are not on a shared
  // baseline. Publishing the arithmetic anyway would hand the predicate
  // evaluator a number that looks like evidence, so nothing is published.
  const computable = missing.length === 0 && decreased.length === 0;

  return {
    usable: computable && !allZero,
    problems,
    deltas: computable ? deltas : {},
    missing,
    decreased,
    elapsedMs: current.atMs - previous.atMs,
  };
}

/** True when a step's scoring depends on a counter difference at all. */
export function stepUsesCounterDeltas(keys: Lit[]): boolean {
  return keys.some((k) => k.startsWith(DELTA_KEY_PREFIX));
}
