/**
 * Manual MikroTik Configuration Wizard — public surface.
 *
 * The loop this module describes:
 *   the app shows a command -> the installer runs it on the router ->
 *   the installer pastes the raw terminal output back ->
 *   the app parses it and returns PASS / WARNING / FAIL / UNKNOWN /
 *   INCOMPLETE_OUTPUT / WRONG_OUTPUT -> the app produces the next command
 *   or a fix.
 *
 * The parsing is the product. Everything else is UI around it.
 *
 * ---------------------------------------------------------------------
 * WHAT IS HERE
 * ---------------------------------------------------------------------
 *   types.ts            the contract: verdicts, facts, predicates,
 *                       fingerprints, outcomes, steps, resolver entries,
 *                       and the i18n rules
 *   fleet.defaults.ts   every device literal, with its provenance and how
 *                       much a builder may trust it
 *   parsing.rules.ts    the normalisation pipeline, the regexes, the menu
 *                       fingerprint registry, the emptiness rules, and the
 *                       v6/v7 divergences
 *   steps.part1..5.ts   the 18 steps (step 3 in three variants)
 *   steps.content.ts    the assembled array, the 9-phase mapping, and the
 *                       invariants a test should assert
 *   resolver.content.ts the error knowledge base, the safety rules, and the
 *                       list of tempting-and-wrong fixes
 *
 * ---------------------------------------------------------------------
 * WHAT A BUILDER STILL HAS TO WRITE
 * ---------------------------------------------------------------------
 * Nothing in here executes. The four pieces of code this data expects are:
 *   1. the normaliser + parser described in `parsing.rules.ts`
 *   2. a predicate evaluator for the `Predicate` union in `types.ts`,
 *      including the `$fact` cross-reference form
 *   3. verdict assembly: fingerprint -> required facts -> pass predicate ->
 *      outcomes in order, first match wins
 *   4. the two-reading diff for the login server counters, which are the
 *      only facts in the module the app computes rather than reads
 *
 * ---------------------------------------------------------------------
 * READ BEFORE CHANGING ANY RULE IN HERE
 * ---------------------------------------------------------------------
 * This fleet is one or two genuine venues. A confidently wrong rule is
 * worse than an absent one, so every rule carries a `confidence` and
 * anything not confirmable from the repo or a recorded live session says
 * so. Do not promote an `unverified` rule to a hard FAIL without a device
 * in front of you.
 */

export * from "./types";
export * from "./fleet.defaults";
export * from "./parsing.rules";
export * from "./steps.content";
export * from "./resolver.content";
export { STEP18_OPERATOR_CHECKLIST } from "./steps.part5";
