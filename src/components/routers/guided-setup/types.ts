/**
 * The shared contract for the Guided Setup module.
 *
 * Three files are written by three different people and meet here:
 *   - `types.ts`               (this file)      -- the contract
 *   - `phases.content.ts`      exports `PHASES: Phase[]`      -- MikroTik engineer
 *   - `diagnostics.content.ts` exports `SYMPTOMS: Symptom[]`  -- network engineer
 *
 * Nothing in this file may change without all three agreeing -- the two
 * content files are already being written against exactly these shapes.
 */

import type { OutputAssertion } from "./analyse";

/** One concrete repair for a failed check: when it applies, optionally a
 * command to run, and a plain-language note explaining what it does.
 *
 * `when` is load-bearing beyond its display text: an assertion rule that
 * selects this fix carries a `fix` string that must match it character for
 * character, and `scripts/test-output-analyser.mjs` fails the build if one
 * ever drifts from the other. */
export type Fix = {
  /** ALSO A JOIN KEY, not just display text. `analyse.ts`'s `fixIndexFor`
   * selects which repair to highlight with `failFix.findIndex(f => f.when
   * === rule.fix)`, an exact string comparison against the static
   * Hinglish `fix` on the matching `VerdictRule`. So `when` must be
   * byte-identical to that rule in every locale, and is a never-translate
   * field: translating it would silently return `fixIndex: null` and drop
   * the analyser back to "try whichever of these matches" in English and
   * Hindi, with nothing anywhere reporting it. Translate `whenLabel`. */
  when: string;
  command?: string;
  note: string;
  /** Display-only override for `when`, supplied by the active locale (see
   * `content-i18n.ts`). Never read by the analyser. Absent = render
   * `when`, which is what the Hinglish register does. */
  whenLabel?: string;
};

/** One thing the operator verifies on the device after pasting. `expect`
 * is what a healthy device prints back; `failFix` are the repairs offered
 * inline the moment the pasted output scores FAIL.
 *
 * `assert` -- how the app reads the pasted terminal output and decides the
 * verdict itself, instead of asking the operator whether it worked. See
 * `analyse.ts`. Optional, and today no content file sets it: the shipping
 * specs live in `assertions.ts`, keyed by `Check.id`, so that
 * `phases.content.ts` did not have to be touched. A content author may
 * inline one here at any time and it takes precedence -- `CheckRow`
 * resolves `check.assert ?? ASSERTIONS[check.id]`.
 *
 * A check with no assertion from either source is human-confirmed only,
 * and the UI says so rather than implying the app verified anything. */
export type Check = {
  id: string;
  label: string;
  command: string;
  expect: string;
  failFix?: Fix[];
  assert?: OutputAssertion;
};

/** One screen of the guided flow. Exactly one phase is visible at a time.
 *
 * `stopGate` -- when set, the flow cannot advance past this phase until
 * every check is answered "Haan". The string is the reason, shown to the
 * operator, e.g. why continuing past a failed WAN check is unsafe.
 *
 * `oncePerRouter` -- this phase mints or consumes something that cannot be
 * re-issued (provisioning secrets). The UI treats these phases as
 * destructive on any second run: see `OnceOnlyGuard`. */
export type Phase = {
  id: string;
  n: number;
  title: string;
  why?: string;
  estMinutes: number;
  paste: { label: string; script: string }[];
  checks: Check[];
  stopGate?: string;
  oncePerRouter: boolean;
};

/** One recognizable "it looks wrong like THIS" entry in the diagnostics
 * lookup. `surface` is where the operator is standing when he sees it;
 * `probe` is the single cheapest thing to check first. */
export type Symptom = {
  id: string;
  seen: string;
  surface: "router" | "portal" | "phone" | "dashboard";
  probe: string;
  causes: { tell: string; cause: string; fix?: string; note: string }[];
};
