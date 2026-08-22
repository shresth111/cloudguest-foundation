/**
 * Manual MikroTik Configuration Wizard — the runtime.
 *
 * `manual-wizard/` above this directory is data, types and declarative
 * rules. Nothing there executes. This is the code that does:
 *
 *   normalise.ts        stages 0-8 of the pipeline in parsing.rules.ts
 *   coerce.ts           stage 9, plus every parser a comparison needs
 *   classify.ts         is this the output of the command we asked for
 *   facts.ts            Fact values, and the four ways one can be absent
 *   predicate.ts        the Predicate union, three-valued, with $fact
 *   counters.ts         the mandatory two-reading RADIUS diff
 *   verdict.ts          assembly, and the full decision table
 *   protected-tokens.ts the {{token}} i18n lint
 *
 * ---------------------------------------------------------------------
 * THE ONE PROPERTY EVERYTHING ELSE SERVES
 * ---------------------------------------------------------------------
 * A predicate is true, false, or NULL — cannot tell. Null never collapses
 * to false, never lets a rule match, and always ends in UNKNOWN. Every
 * incident behind this module has the same shape: the system reported
 * success while doing nothing. An engine that guesses optimistically is
 * worse than no engine, because it retires the operator's suspicion.
 */

export * from "./coerce";
export * from "./normalise";
export * from "./classify";
export * from "./facts";
export * from "./predicate";
export * from "./counters";
export * from "./verdict";
export * from "./protected-tokens";
