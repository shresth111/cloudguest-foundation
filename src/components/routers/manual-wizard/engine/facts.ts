/**
 * Manual wizard engine — turning a normalised paste into `Fact` values.
 *
 * ---------------------------------------------------------------------
 * THE DISTINCTION THAT DOES ALL THE WORK HERE
 * ---------------------------------------------------------------------
 * There are four different ways a fact can fail to give an answer, and
 * collapsing any two of them is how this product has shipped bugs:
 *
 *   MISSING     the key never appeared. If the fact is `required`, the
 *               paste is INCOMPLETE_OUTPUT — never FAIL. "I didn't see a
 *               problem" is not "there is no problem".
 *   EMPTY       the key appeared with nothing after it. That is the DEVICE
 *               saying "nothing here", which is a real statement, and it
 *               is not re-pastable — so it never raises
 *               INCOMPLETE_OUTPUT. Predicates over it are null.
 *   MALFORMED   non-empty, and did not parse for its declared type. Per
 *               `parsing.rules.ts` WRAP_HAZARD, the overwhelmingly likely
 *               cause is a paste split mid-token by a narrow terminal, so
 *               this is INCOMPLETE_OUTPUT, not FAIL.
 *   OVER-LENGTH longer than `MAX_SANE_VALUE_LEN`. Same treatment, same
 *               reason.
 *
 * None of the four ever produces `false`.
 */

import type { Fact, Lit, ManualStep } from "../types";
import type { NormalisedPaste } from "./normalise";
import { splitRow } from "./normalise";
import type { Coercion } from "./coerce";
import { coerce } from "./coerce";

export type FactStatus = "ok" | "missing" | "empty" | "malformed" | "over-length";

export type FactRow = {
  raw: Lit;
  /** The part before the first `;`. */
  primary: Lit;
  /** `;`-separated `k=v` pairs after it, keys lowercased. */
  sub: Record<Lit, Lit>;
};

export type FactValue = {
  spec: Fact;
  status: FactStatus;
  /** Raw scalar text as the device printed it. Null when missing. */
  raw: Lit | null;
  /** Coerced scalar. Null unless `status === "ok"`. */
  coerced: Coercion["value"];
  /** Populated for `multi` facts; empty otherwise. */
  rows: FactRow[];
};

export type FactStore = {
  byKey: Map<Lit, FactValue>;
  /** Required facts that never appeared, or that arrived corrupt.
   * Either way the paste, not the router, is the problem. */
  incompleteKeys: Lit[];
  /** Facts the device printed as empty. Not a paste problem. */
  emptyKeys: Lit[];
};

/**
 * Facts the app computes rather than reads. `counters.ts` supplies the
 * `delta-*` values; they are injected here so the predicate evaluator sees
 * one uniform store and never has to know where a value came from.
 */
export type ComputedFacts = Record<Lit, number>;

export function extractFacts(
  step: ManualStep,
  paste: NormalisedPaste,
  computed: ComputedFacts = {},
): FactStore {
  const byKey = new Map<Lit, FactValue>();
  const incompleteKeys: Lit[] = [];
  const emptyKeys: Lit[] = [];

  for (const spec of step.probe.emits) {
    const computedValue = computed[spec.key];
    if (computedValue !== undefined) {
      const c = coerce(spec.type, String(computedValue));
      byKey.set(spec.key, {
        spec,
        status: c.status,
        raw: String(computedValue),
        coerced: c.value,
        rows: [],
      });
      continue;
    }

    const values = paste.kv[spec.key];
    if (values === undefined || values.length === 0) {
      byKey.set(spec.key, { spec, status: "missing", raw: null, coerced: null, rows: [] });
      if (spec.required) incompleteKeys.push(spec.key);
      continue;
    }

    if (spec.multi) {
      const rows: FactRow[] = values.map((raw) => {
        const { primary, sub } = splitRow(raw);
        return { raw, primary, sub };
      });
      byKey.set(spec.key, {
        spec,
        status: "ok",
        raw: values[values.length - 1],
        coerced: null,
        rows,
      });
      continue;
    }

    // A non-multi key printed twice: the LAST value wins, because a
    // terminal that echoes the pasted script prints the earlier one as
    // echo rather than as output.
    const raw = values[values.length - 1];
    const c = coerce(spec.type, raw);
    byKey.set(spec.key, { spec, status: c.status, raw, coerced: c.value, rows: [] });
    if (c.status === "malformed" || c.status === "over-length") incompleteKeys.push(spec.key);
    else if (c.status === "empty") emptyKeys.push(spec.key);
  }

  return { byKey, incompleteKeys, emptyKeys };
}

/**
 * Facts whose key ends in `-count`. `parsing.rules.ts`: an empty match
 * reported by an explicit count is trustworthy; an empty paste is not.
 * This is the ONLY route by which the engine will believe a set is empty.
 */
export function countFacts(store: FactStore): { key: Lit; value: number }[] {
  const out: { key: Lit; value: number }[] = [];
  for (const [key, fact] of store.byKey) {
    if (!key.endsWith("-count")) continue;
    if (fact.status !== "ok" || fact.coerced === null) continue;
    if (fact.coerced.kind === "int") out.push({ key, value: fact.coerced.n });
  }
  return out;
}
