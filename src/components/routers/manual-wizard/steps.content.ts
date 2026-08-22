/**
 * Manual MikroTik Configuration Wizard — assembled step content.
 *
 * `MANUAL_STEPS` is the single array a builder renders. The `steps.part*.ts`
 * files exist only so no one file is unreadable.
 *
 * ---------------------------------------------------------------------
 * TWO STRUCTURES OVER ONE SET OF CONTENT
 * ---------------------------------------------------------------------
 * The RouterOS content was specified as 18 fine-grained steps. The product
 * decision after it was written is that the shipping UI keeps the existing
 * Guided Setup's 9 phases rather than introducing a second, finer
 * structure.
 *
 * Both are served from the same data, and nothing is duplicated:
 *   - `MANUAL_STEPS`   — the 18 steps, each self-contained.
 *   - `PHASE_MAPPING`  — which steps make up each of the 9 phases.
 *
 * A 9-phase UI renders `PHASE_MAPPING` and never sees a step boundary. A
 * finer view, or a support tool that needs to point at one specific check,
 * renders `MANUAL_STEPS` directly. Deleting the step granularity to fit the
 * phase structure would have thrown away the per-check probe, fingerprint
 * and outcome set, which is the actual deliverable.
 *
 * ---------------------------------------------------------------------
 * A GAP IN THE 9-PHASE STRUCTURE, FLAGGED
 * ---------------------------------------------------------------------
 * The existing 9 phases have no phase covering device and cloud
 * registration — the management account and the reporting task. That is
 * precisely the area whose failure mode is "the router serves guests
 * perfectly and shows offline in Master console forever", which is the most
 * expensive silent failure recorded on this product. It is mapped into the
 * tunnel phase below because that is where the Master console blocks are
 * pasted, but it deserves its own phase and currently has none. Raised, not
 * decided.
 */

import type { Lit, ManualStep, T } from "./types";
import { STEPS_PART1 } from "./steps.part1";
import { STEPS_PART2 } from "./steps.part2";
import { STEPS_PART3 } from "./steps.part3";
import { STEPS_PART4 } from "./steps.part4";
import { STEPS_PART5 } from "./steps.part5";

export const MANUAL_STEPS: ManualStep[] = [
  ...STEPS_PART1,
  ...STEPS_PART2,
  ...STEPS_PART3,
  ...STEPS_PART4,
  ...STEPS_PART5,
];

/** The three mutually exclusive forms of step 3. The app picks one from the
 * venue's connection type and hides the other two entirely — showing all
 * three is how an installer ends up running the wrong one. */
export const WAN_VARIANT_STEP_IDS: Record<Lit, Lit> = {
  dhcp: "step03-wan-dhcp",
  static: "step03-wan-static",
  pppoe: "step03-wan-pppoe",
};

/**
 * Which steps make up each of the 9 Guided Setup phases.
 *
 * `phaseId` matches the existing `guided-setup/phases.content.ts` ids, so a
 * 9-phase UI can line the two up without a translation table.
 *
 * `alsoCovers` names steps whose content is genuinely split across two
 * phases. Nothing is scored twice — a step is scored once, under
 * `stepIds`, and `alsoCovers` only tells a phase view which extra results
 * to surface.
 */
export const PHASE_MAPPING: {
  phaseId: Lit;
  n: number;
  /** TRANSLATE — what this phase is called. Mirrors the existing phase
   * titles in meaning; the existing file is authoritative for wording. */
  title: T;
  stepIds: Lit[];
  alsoCovers?: Lit[];
  /** TRANSLATE — anything a builder needs to know about this grouping. */
  note?: T;
}[] = [
  {
    phaseId: "audit",
    n: 0,
    title: "Is the router clean",
    stepIds: ["step02-interfaces"],
    note: "The existing phase also runs a leftover-configuration sweep, which has no equivalent step here because it inspects config this wizard has not yet created. Keep the existing sweep and add the port checks from step 2 to it.",
  },
  {
    phaseId: "clock",
    n: 1,
    title: "Internet and clock",
    stepIds: ["step01-router-info"],
    note: "Step 1 is dominated by the clock and the firmware gate, which is what this phase is for. Its identity and storage checks are incidental and can be shown as secondary detail.",
  },
  {
    phaseId: "wan",
    n: 2,
    title: "Internet connection and route",
    stepIds: ["step03-wan-dhcp", "step03-wan-static", "step03-wan-pppoe"],
    note: "Exactly one of these three is ever shown. The app chooses from the venue's connection type before the phase opens.",
  },
  {
    phaseId: "gate",
    n: 3,
    title: "Proof the internet works",
    stepIds: ["step04-dns", "step05-internet-validation"],
  },
  {
    phaseId: "hotspot",
    n: 4,
    title: "Guest network and hotspot",
    stepIds: [
      "step11-bridge-lan",
      "step13-lan-address",
      "step14-dhcp-pool",
      "step15-dhcp-server",
      "step16-hotspot",
    ],
    note: "Five steps, and the order matters: each binds by name to the one before it, so a failure early in the sequence makes every later one report success while attaching to nothing.",
  },
  {
    phaseId: "portal",
    n: 5,
    title: "The way through to the portal",
    stepIds: [],
    alsoCovers: ["step16-hotspot"],
    note: "The portal page paths and both walled-garden lists live inside step 16, because they cannot be checked independently of the hotspot profile they hang off. A phase view should surface step 16's portal-related outcomes here — the file path check, both walled-garden checks, and the page content checks — rather than duplicating the step.",
  },
  {
    phaseId: "tunnel",
    n: 6,
    title: "Tunnel and login server",
    stepIds: [
      "step06-identity",
      "step07-cloud-registration",
      "step08-wireguard",
      "step09-wireguard-validation",
      "step10-radius",
      "step17-radius-hotspot",
    ],
    note: "Registration is mapped here because it is pasted from the same Master console screen, not because it belongs here. See this file's header — it should have its own phase.",
  },
  {
    phaseId: "phonetest",
    n: 7,
    title: "A real phone test",
    stepIds: ["step18-end-to-end"],
    note: "The operator checklist in steps.part5.ts belongs here too. An unanswered checklist item is UNKNOWN, never PASS.",
  },
  {
    phaseId: "recovery",
    n: 8,
    title: "Something went wrong",
    stepIds: [],
    note: "This phase is served by the resolver, not by a step. The secret-rotation entry is the one it exists for.",
  },
];

/**
 * Steps deliberately not in `PHASE_MAPPING`, and why.
 *
 * These stay in `MANUAL_STEPS` so nothing is lost and a future decision can
 * pick them up without rewriting them, but a 9-phase UI does not render
 * them.
 */
export const EXCLUDED_FROM_PHASES: { stepId: Lit; reason: T; conflict?: T }[] = [
  {
    stepId: "step12-vlan",
    reason:
      "No hEX in this fleet uses VLANs; the concept exists only in backend network configuration. The step is a proof-of-absence check rather than a configuration step, so on a fleet where the answer is always none it costs the installer time and returns nothing.",
    conflict:
      "The original RouterOS content brief listed VLAN as one of the 18 steps. It has been written and kept rather than deleted, so if a venue ever does arrive with VLANs the check is ready. Do not treat its absence from the phase mapping as a statement that VLANs are impossible here — only that no current venue has them. Verify against a real device before relying on the step's pass condition, which is the least field-tested in this module.",
  },
];

// ---------------------------------------------------------------------
// Invariants a test should assert over the assembled content
// ---------------------------------------------------------------------

/**
 * These are cheap to check and each one catches a class of mistake that has
 * actually shipped in this product's content before.
 */
export const CONTENT_INVARIANTS: T[] = [
  "No probe command anywhere contains the words PASS or FAIL. The router prints facts; the app decides.",
  "Every probe command opens with a WYFY-BEGIN line and closes with a WYFY-END line carrying the same id as the step's fingerprint.",
  "Every probe that inspects a set emits at least one fact whose key ends in -count.",
  "Every print command in a probe or context command carries without-paging.",
  "Every gateway or address comparison uses isIpv4 with excludeUnspecified, never a check for a non-empty string.",
  "No duration, comma list, or flag column is compared with eq against a device-formatted string.",
  "Every step id referenced in dependsOn, PHASE_MAPPING or a resolver seenInSteps exists in MANUAL_STEPS.",
  "Every resolverRef on an outcome matches an id in RESOLVER.",
  "Every FixAction with destructive true has a confirmPrompt.",
  "No FixAction command matches a NEVER_AUTO_RUN pattern unless destructive is true and a confirmPrompt is present.",
  "Every FixAction that changes state prints a count before it changes anything.",
  "Every step's outcomes are ordered most-specific first, since the first match wins.",
];
