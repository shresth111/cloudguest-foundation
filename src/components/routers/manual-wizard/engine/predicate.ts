/**
 * Manual wizard engine — the `Predicate` evaluator.
 *
 * ---------------------------------------------------------------------
 * THREE-VALUED, AND THAT IS THE WHOLE POINT
 * ---------------------------------------------------------------------
 * Every predicate returns `true`, `false`, or `null` — "cannot tell".
 *
 *   - `null` NEVER collapses to `false`.
 *   - A rule containing a `null` NEVER matches, so an undecidable check
 *     lands on UNKNOWN instead of on whichever outcome happened to be
 *     listed first.
 *   - `all` returns null if any operand is null and none is false.
 *     `any` returns null if any operand is null and none is true.
 *     `not` maps null to null.
 *
 * `guided-setup/analyse.ts` reached the same three values independently
 * and its `evaluate` uses exactly this null propagation; the semantics
 * here are deliberately identical so the two can be merged without
 * anyone having to reconcile two meanings of UNKNOWN.
 *
 * ---------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT DONE
 * ---------------------------------------------------------------------
 * No comparison in this file is an exact string match on a device value
 * that has a type. Durations become seconds, comma lists become sets,
 * versions become numbers, addresses become integers. `eq` falls back to
 * a case-insensitive text compare only for a `string` fact or an untyped
 * sub-field, which is the only place the content actually asks for one.
 *
 * No comparison in this file reads a translatable (`T`) field. Predicates
 * address facts by `Fact.key`, which `types.ts` lists under
 * `NEVER_TRANSLATE_FIELD_PATHS`.
 *
 * ---------------------------------------------------------------------
 * THE UNSPECIFIED-ADDRESS RULE
 * ---------------------------------------------------------------------
 * `0.0.0.0 !== ""` let a dead default route through and every ping came
 * back "no route to host". `isIpv4 { excludeUnspecified: true }` is the
 * direct fix and the content uses it in 21 places.
 *
 * This file adds a second, quieter guard: `eq` / `neq` / `in` / `notIn`
 * over a fact DECLARED as `ipv4` or `ipv4cidr` returns `null`, not `true`,
 * when either side is the unspecified address. Two unspecified addresses
 * being equal to each other is not evidence of anything, and step 17's
 * pass condition (`radius-src` equals `$tunnel-ip`) would otherwise be
 * satisfied by a router where BOTH are `0.0.0.0`.
 */

import type { Lit, Predicate } from "../types";
import { CROSS_FACT_PREFIX } from "../types";
import type { CoercedValue } from "./coerce";
import {
  cidrsOverlap,
  coerce,
  isUnspecifiedIpv4,
  parseCidr,
  parseDurationSeconds,
  parseBool,
  parseRouterDate,
  stripQuotes,
  toMembers,
} from "./coerce";
import type { FactRow, FactStore, FactValue } from "./facts";

export type Tri = boolean | null;

export type EvalContext = {
  store: FactStore;
  /** The app's own clock. The router's is not trusted. */
  nowMs: number;
  /** Set while inside `some` / `every`. */
  row?: FactRow;
  /** The multi fact whose rows are being quantified over. */
  rowKey?: Lit;
  /** Stable ids of every reason a null was produced, for the UI. */
  trace: Lit[];
};

export function makeContext(store: FactStore, nowMs: number): EvalContext {
  return { store, nowMs, trace: [] };
}

function cannotTell(ctx: EvalContext, reason: Lit): null {
  if (!ctx.trace.includes(reason)) ctx.trace.push(reason);
  return null;
}

// ---------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------

type Resolved =
  | { kind: "fact"; fact: FactValue }
  | { kind: "sub"; text: Lit }
  | { kind: "absent" }
  /** The key names a sub-field but we are not inside a row. */
  | { kind: "out-of-scope" };

/**
 * `fact` addresses a top-level fact.
 * `fact[]` addresses the current row's primary value.
 * `fact[].sub` addresses a sub-field of the current row.
 *
 * `types.ts`: inside `some` / `every`, a `$name` cross-reference still
 * points at a TOP-LEVEL fact, never at a sibling sub-field. Sub-fields are
 * only ever reachable through this bracket form.
 */
export function resolveKey(key: Lit, ctx: EvalContext): Resolved {
  const bracket = key.indexOf("[]");
  if (bracket === -1) {
    const fact = ctx.store.byKey.get(key);
    if (!fact) return { kind: "absent" };
    return { kind: "fact", fact };
  }
  const factKey = key.slice(0, bracket);
  const rest = key.slice(bracket + 2);
  if (!ctx.row || ctx.rowKey !== factKey) return { kind: "out-of-scope" };
  if (rest === "" || rest === ".") return { kind: "sub", text: ctx.row.primary };
  const subName = rest.startsWith(".") ? rest.slice(1) : rest;
  const value = ctx.row.sub[subName.toLowerCase()];
  if (value === undefined) return { kind: "absent" };
  return { kind: "sub", text: value };
}

/** The raw text behind a key, or undefined. */
function rawOf(key: Lit, ctx: EvalContext): Lit | undefined {
  const r = resolveKey(key, ctx);
  if (r.kind === "sub") return r.text;
  if (r.kind === "fact") return r.fact.raw ?? undefined;
  return undefined;
}

/** The coerced value behind a key, when the key names a typed fact. */
function coercedOf(key: Lit, ctx: EvalContext): CoercedValue | null {
  const r = resolveKey(key, ctx);
  if (r.kind !== "fact") return null;
  return r.fact.coerced;
}

// ---------------------------------------------------------------------
// Cross-fact references
// ---------------------------------------------------------------------

type Side =
  | { kind: "literal"; value: Lit | number | boolean }
  | { kind: "fact"; key: Lit }
  | { kind: "unresolvable"; key: Lit };

/**
 * `types.ts`: a `value` starting with `$` names another fact from the SAME
 * paste. Only ONE level of indirection — a fact whose own value starts
 * with `$` is compared literally.
 */
export function classifyValue(value: Lit | number | boolean, ctx: EvalContext): Side {
  if (typeof value !== "string") return { kind: "literal", value };
  if (!value.startsWith(CROSS_FACT_PREFIX)) return { kind: "literal", value };
  const key = value.slice(CROSS_FACT_PREFIX.length);
  const fact = ctx.store.byKey.get(key);
  if (!fact) return { kind: "unresolvable", key };
  return { kind: "fact", key };
}

// ---------------------------------------------------------------------
// Comparison primitives
// ---------------------------------------------------------------------

function textEq(a: string, b: string): boolean {
  return stripQuotes(a).toLowerCase() === stripQuotes(b).toLowerCase();
}

function looksBoolLiteral(v: Lit | number | boolean): boolean {
  if (typeof v === "boolean") return true;
  if (typeof v !== "string") return false;
  return parseBool(v) !== null && /^(true|false|yes|no|enabled|disabled)$/i.test(v.trim());
}

function numberOf(c: CoercedValue | null): number | null {
  if (c === null) return null;
  if (c.kind === "int") return c.n;
  if (c.kind === "duration") return c.seconds;
  if (c.kind === "version") return c.version.major + c.version.minor / 1000;
  if (c.kind === "datetime") return c.ms;
  return null;
}

/**
 * `eq` / `neq`, three-valued, coerced. Returns null whenever either side
 * cannot be reduced to a comparable value — which includes the
 * unspecified-address case described in this file's header.
 */
function compareEq(key: Lit, value: Lit | number | boolean, ctx: EvalContext): Tri {
  const target = classifyValue(value, ctx);
  if (target.kind === "unresolvable") {
    // types.ts: "If the referenced fact is absent, the predicate is
    // neither true nor false."
    return cannotTell(ctx, `cross-fact-absent:${target.key}`);
  }

  const left = resolveKey(key, ctx);
  if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${key}`);
  if (left.kind === "out-of-scope") return cannotTell(ctx, `subfield-out-of-scope:${key}`);

  // ---- cross-fact -------------------------------------------------
  if (target.kind === "fact") {
    const other = ctx.store.byKey.get(target.key);
    if (!other) return cannotTell(ctx, `cross-fact-absent:${target.key}`);
    if (other.status !== "ok") return cannotTell(ctx, `cross-fact-unusable:${target.key}`);
    if (left.kind === "fact" && left.fact.status !== "ok")
      return cannotTell(ctx, `fact-unusable:${key}`);

    const leftC =
      left.kind === "fact" ? left.fact.coerced : coerce(other.spec.type, left.text).value;
    const rightC = other.coerced;
    if (leftC === null || rightC === null) return cannotTell(ctx, `uncoercible:${key}`);

    if (leftC.kind === "ipv4" && rightC.kind === "ipv4") {
      if (leftC.unspecified || rightC.unspecified)
        return cannotTell(ctx, `unspecified-address:${key}`);
      return leftC.n === rightC.n;
    }
    if (leftC.kind === "ipv4cidr" && rightC.kind === "ipv4cidr") {
      if (leftC.unspecified || rightC.unspecified)
        return cannotTell(ctx, `unspecified-address:${key}`);
      return leftC.text === rightC.text;
    }
    if (leftC.kind === "set" && rightC.kind === "set") {
      const a = new Set(leftC.members);
      const b = new Set(rightC.members);
      return a.size === b.size && [...a].every((m) => b.has(m));
    }
    const ln = numberOf(leftC);
    const rn = numberOf(rightC);
    if (ln !== null && rn !== null) return ln === rn;
    if (leftC.kind === "bool" && rightC.kind === "bool") return leftC.b === rightC.b;
    const lt = left.kind === "fact" ? left.fact.raw : left.text;
    const rt = other.raw;
    if (lt === null || rt === null) return cannotTell(ctx, `uncoercible:${key}`);
    return textEq(lt, rt);
  }

  // ---- literal ----------------------------------------------------
  const literal = target.value;

  if (left.kind === "sub") {
    // Untyped sub-field: the OPERAND decides the coercion.
    if (typeof literal === "boolean" || looksBoolLiteral(literal)) {
      const b = parseBool(left.text);
      if (b === null) return cannotTell(ctx, `not-a-bool:${key}`);
      const want = typeof literal === "boolean" ? literal : parseBool(String(literal));
      if (want === null) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return b === want;
    }
    if (typeof literal === "number") {
      const n = Number(stripQuotes(left.text));
      if (!Number.isFinite(n)) return cannotTell(ctx, `not-a-number:${key}`);
      return n === literal;
    }
    if (left.text.trim() === "") return cannotTell(ctx, `empty-value:${key}`);
    return textEq(left.text, String(literal));
  }

  const fact = left.fact;
  if (fact.status === "missing") return cannotTell(ctx, `fact-missing:${key}`);
  if (fact.status !== "ok") return cannotTell(ctx, `fact-${fact.status}:${key}`);
  const c = fact.coerced;
  if (c === null) return cannotTell(ctx, `uncoercible:${key}`);

  switch (c.kind) {
    case "bool": {
      const want = typeof literal === "boolean" ? literal : parseBool(String(literal));
      if (want === null) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return c.b === want;
    }
    case "int": {
      const want = typeof literal === "number" ? literal : Number(stripQuotes(String(literal)));
      if (!Number.isFinite(want)) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return c.n === want;
    }
    case "duration": {
      const want = typeof literal === "number" ? literal : parseDurationSeconds(String(literal));
      if (want === null) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return c.seconds === want;
    }
    case "version": {
      const want = typeof literal === "number" ? literal : Number(stripQuotes(String(literal)));
      if (!Number.isFinite(want)) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return c.version.major === Math.trunc(want);
    }
    case "ipv4": {
      const want = String(literal);
      if (c.unspecified || isUnspecifiedIpv4(want))
        return cannotTell(ctx, `unspecified-address:${key}`);
      return c.n === (parseCidr(want)?.addressN ?? NaN);
    }
    case "ipv4cidr": {
      const want = String(literal);
      if (c.unspecified) return cannotTell(ctx, `unspecified-address:${key}`);
      return textEq(c.text, want);
    }
    case "datetime": {
      const want = parseRouterDate(String(literal));
      if (want === null) return cannotTell(ctx, `bad-rule-operand:${key}`);
      return c.ms === want;
    }
    case "set": {
      const want = toMembers(String(literal));
      const have = new Set(c.members);
      return want.length === have.size && want.every((m) => have.has(m));
    }
    case "string": {
      // A `string` fact carrying a boolean-shaped value is compared as a
      // boolean, so that a probe printing `unknown` (which several do,
      // from a `:do {...} on-error={...}`) yields null and not false.
      if (looksBoolLiteral(literal)) {
        const b = parseBool(c.text);
        const want = typeof literal === "boolean" ? literal : parseBool(String(literal));
        if (want === null) return cannotTell(ctx, `bad-rule-operand:${key}`);
        if (b === null) return cannotTell(ctx, `not-a-bool:${key}`);
        return b === want;
      }
      return textEq(c.text, String(literal));
    }
  }
}

function compareOrdinal(key: Lit, bound: number, mode: "gte" | "lte", ctx: EvalContext): Tri {
  const left = resolveKey(key, ctx);
  if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${key}`);
  if (left.kind === "out-of-scope") return cannotTell(ctx, `subfield-out-of-scope:${key}`);
  let n: number | null;
  if (left.kind === "sub") {
    const parsed = Number(stripQuotes(left.text));
    n = Number.isFinite(parsed) ? parsed : null;
  } else {
    if (left.fact.status === "missing") return cannotTell(ctx, `fact-missing:${key}`);
    if (left.fact.status !== "ok") return cannotTell(ctx, `fact-${left.fact.status}:${key}`);
    const c = left.fact.coerced;
    if (c !== null && c.kind === "version") return versionOrdinal(c, bound, mode);
    n = numberOf(c);
  }
  if (n === null) return cannotTell(ctx, `not-a-number:${key}`);
  return mode === "gte" ? n >= bound : n <= bound;
}

/**
 * A version compared against a WHOLE number is a major-version test.
 *
 * The content writes `{ op: "lte", key: "version", value: 6 }` to mean
 * "this box is on RouterOS 6". Treating `6.49.10` as the number 6.049
 * makes that false and hides the one fault — no WireGuard menu — that
 * makes a router un-onboardable. Only a fractional bound compares the
 * minor version.
 */
function versionOrdinal(c: CoercedValue, bound: number, mode: "gte" | "lte"): boolean {
  if (c.kind !== "version") throw new Error("versionOrdinal called on a non-version");
  const isWhole = Number.isInteger(bound);
  const left = isWhole ? c.version.major : c.version.major + c.version.minor / 1000;
  return mode === "gte" ? left >= bound : left <= bound;
}

// ---------------------------------------------------------------------
// The evaluator
// ---------------------------------------------------------------------

export function evaluate(predicate: Predicate, ctx: EvalContext): Tri {
  switch (predicate.op) {
    case "all": {
      let sawNull = false;
      for (const p of predicate.of) {
        const r = evaluate(p, ctx);
        if (r === false) return false;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : true;
    }

    case "any": {
      let sawNull = false;
      for (const p of predicate.of) {
        const r = evaluate(p, ctx);
        if (r === true) return true;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : false;
    }

    case "not": {
      const r = evaluate(predicate.of, ctx);
      return r === null ? null : !r;
    }

    case "present": {
      const r = resolveKey(predicate.key, ctx);
      if (r.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);
      if (r.kind === "absent") return false;
      if (r.kind === "sub") return true;
      return r.fact.status !== "missing";
    }

    case "absent": {
      const r = resolveKey(predicate.key, ctx);
      if (r.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);
      if (r.kind === "absent") return true;
      if (r.kind === "sub") return false;
      return r.fact.status === "missing";
    }

    case "eq":
      return compareEq(predicate.key, predicate.value, ctx);

    case "neq": {
      const r = compareEq(predicate.key, predicate.value, ctx);
      return r === null ? null : !r;
    }

    case "gte":
      return compareOrdinal(predicate.key, predicate.value, "gte", ctx);

    case "lte":
      return compareOrdinal(predicate.key, predicate.value, "lte", ctx);

    case "in": {
      let sawNull = false;
      for (const v of predicate.values) {
        const r = compareEq(predicate.key, v, ctx);
        if (r === true) return true;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : false;
    }

    case "notIn": {
      let sawNull = false;
      for (const v of predicate.values) {
        const r = compareEq(predicate.key, v, ctx);
        if (r === true) return false;
        if (r === null) sawNull = true;
      }
      return sawNull ? null : true;
    }

    case "matches": {
      const raw = rawOf(predicate.key, ctx);
      if (raw === undefined) return cannotTell(ctx, `fact-absent:${predicate.key}`);
      let re: RegExp;
      try {
        re = new RegExp(predicate.regex);
      } catch {
        return cannotTell(ctx, `bad-regex:${predicate.key}`);
      }
      return re.test(raw);
    }

    case "isIpv4": {
      const left = resolveKey(predicate.key, ctx);
      if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (left.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);

      if (left.kind === "fact") {
        if (left.fact.status === "missing") return cannotTell(ctx, `fact-missing:${predicate.key}`);
        // EMPTY is the device saying "there is no address here". That is a
        // determinate NO for "is this a usable address", not a null.
        if (left.fact.status === "empty") return false;
        if (left.fact.status !== "ok")
          return cannotTell(ctx, `fact-${left.fact.status}:${predicate.key}`);
      }
      const raw = left.kind === "sub" ? left.text : (left.fact.raw ?? "");
      const cidr = parseCidr(raw);
      if (cidr === null) return false;
      if (!predicate.excludeUnspecified) return true;
      const address = raw.includes("/") ? raw.split("/")[0] : raw;
      return !isUnspecifiedIpv4(address);
    }

    case "contains":
    case "notContains": {
      const want = String(predicate.value).trim().toLowerCase();
      const left = resolveKey(predicate.key, ctx);
      if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (left.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);

      // A DECLARED `csv` / `flags` fact is strict set membership, per the
      // `Predicate` contract in types.ts. An UNTYPED sub-field additionally
      // allows a prefix match on one element, because that is the only way
      // the content's one such rule can be evaluated at all:
      //
      //   { op: "contains", key: "pool[].ranges", value: "10.5.50.1-" }
      //
      // means "does this range start at the router's own address". As pure
      // membership it can never be true, so the check — the one that
      // catches a pool handing one guest per venue the gateway's address —
      // would be dead. The trailing separator makes the prefix exact:
      // `10.5.50.10-...` does not start with `10.5.50.1-`.
      let members: string[];
      let allowPrefix = false;
      if (left.kind === "fact") {
        if (left.fact.status === "missing") return cannotTell(ctx, `fact-missing:${predicate.key}`);
        if (left.fact.status !== "ok")
          return cannotTell(ctx, `fact-${left.fact.status}:${predicate.key}`);
        const c = left.fact.coerced;
        if (c !== null && c.kind === "set") members = c.members;
        else if (left.fact.raw !== null) {
          members = toMembers(left.fact.raw);
          allowPrefix = true;
        } else return cannotTell(ctx, `uncoercible:${predicate.key}`);
      } else {
        if (left.text.trim() === "") return cannotTell(ctx, `empty-value:${predicate.key}`);
        members = toMembers(left.text);
        allowPrefix = true;
      }

      const prefixable = allowPrefix && /[-./:]$/.test(want);
      const hit = members.includes(want) || (prefixable && members.some((m) => m.startsWith(want)));
      return predicate.op === "contains" ? hit : !hit;
    }

    case "durationBetween": {
      const left = resolveKey(predicate.key, ctx);
      if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (left.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);
      let seconds: number | null;
      if (left.kind === "sub") seconds = parseDurationSeconds(left.text);
      else if (left.fact.status === "missing")
        return cannotTell(ctx, `fact-missing:${predicate.key}`);
      else if (left.fact.status !== "ok")
        return cannotTell(ctx, `fact-${left.fact.status}:${predicate.key}`);
      else seconds = left.fact.coerced?.kind === "duration" ? left.fact.coerced.seconds : null;
      if (seconds === null) return cannotTell(ctx, `not-a-duration:${predicate.key}`);
      return seconds >= predicate.minSeconds && seconds <= predicate.maxSeconds;
    }

    case "dateNear": {
      const left = resolveKey(predicate.key, ctx);
      if (left.kind === "absent") return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (left.kind === "out-of-scope")
        return cannotTell(ctx, `subfield-out-of-scope:${predicate.key}`);
      const raw = left.kind === "sub" ? left.text : left.fact.raw;
      if (raw === null) return cannotTell(ctx, `fact-missing:${predicate.key}`);
      const ms = parseRouterDate(raw);
      if (ms === null) return cannotTell(ctx, `not-a-date:${predicate.key}`);
      return Math.abs(ctx.nowMs - ms) / 86400000 <= predicate.days;
    }

    case "noOverlap": {
      const mine = cidrsOf(predicate.key, ctx);
      const theirs = cidrsOf(predicate.otherKey, ctx);
      if (mine === null || theirs === null)
        return cannotTell(ctx, `no-overlap-unreadable:${predicate.key}`);
      // An explicitly EMPTY side is a trustworthy statement by the device
      // that no such address exists, and an empty set cannot overlap.
      // See `engine/LIMITATIONS` in verdict.ts for where this is vacuous.
      if (mine.length === 0 || theirs.length === 0) return true;
      for (const a of mine) for (const b of theirs) if (cidrsOverlap(a, b)) return false;
      return true;
    }

    case "some":
    case "every": {
      const fact = ctx.store.byKey.get(predicate.key);
      if (!fact) return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (fact.status === "missing") {
        // No rows at all. `some` over nothing is false; `every` over
        // nothing is vacuously true, which is exactly the shape that lets
        // "no rows" masquerade as "all rows fine" — so it is null instead.
        return predicate.op === "some"
          ? false
          : cannotTell(ctx, `no-rows-for-every:${predicate.key}`);
      }
      let sawNull = false;
      for (const row of fact.rows) {
        const child: EvalContext = { ...ctx, row, rowKey: predicate.key, trace: ctx.trace };
        const r = evaluate(predicate.of, child);
        if (predicate.op === "some" && r === true) return true;
        if (predicate.op === "every" && r === false) return false;
        if (r === null) sawNull = true;
      }
      if (sawNull) return cannotTell(ctx, `row-undecidable:${predicate.key}`);
      return predicate.op === "some" ? false : true;
    }

    case "countEq": {
      const fact = ctx.store.byKey.get(predicate.key);
      if (!fact) return cannotTell(ctx, `fact-absent:${predicate.key}`);
      if (fact.status === "missing") return predicate.value === 0 ? null : false;
      return fact.rows.length === predicate.value;
    }
  }
}

function cidrsOf(key: Lit, ctx: EvalContext): { addressN: number; bits: number }[] | null {
  const fact = ctx.store.byKey.get(key);
  if (!fact) return null;
  if (fact.status === "missing") return null;
  if (fact.spec.multi) {
    const out: { addressN: number; bits: number }[] = [];
    for (const row of fact.rows) {
      const c = parseCidr(row.primary);
      if (c === null) {
        if (row.primary.trim() === "") continue;
        return null;
      }
      out.push(c);
    }
    return out;
  }
  if (fact.raw === null || fact.raw.trim() === "") return [];
  const c = parseCidr(fact.raw);
  return c === null ? null : [c];
}
