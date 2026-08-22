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

/** One concrete repair for a failed check: when it applies, optionally a
 * command to run, and a plain-language note explaining what it does. */
export type Fix = { when: string; command?: string; note: string };

/** One thing the operator verifies on the device after pasting. `expect`
 * is what a healthy device prints back; `failFix` are the repairs offered
 * inline the moment he answers "Nahi". */
export type Check = { id: string; label: string; command: string; expect: string; failFix?: Fix[] };

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
