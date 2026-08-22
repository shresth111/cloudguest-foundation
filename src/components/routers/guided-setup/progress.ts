/**
 * Per-router progress for the Guided Setup module.
 *
 * Persisted so the operator can close the tab mid-provision (he will --
 * this runs on a laptop next to WinBox, sometimes on a phone) and come
 * back to the same phase with the same answers.
 *
 * Keyed by router id, never global: two routers provisioned the same
 * evening must not share a cursor.
 *
 * Storage access is wrapped in try/catch, not just a `typeof window`
 * check. `typeof window` answers "is there a window", which says nothing
 * about whether that window's `localStorage` *works* -- private browsing,
 * a locked-down profile and a full quota all make the access itself
 * throw. Same discipline as `src/context/PortalRuntimeContext.tsx`'s
 * safeGet/safeSet, and for the same reason: losing saved progress is a
 * nuisance, throwing on the render path is a broken page.
 */
import type { Phase } from "./types";
import type { Verdict } from "./analyse";

/**
 * What a check resolved to. Was `"haan" | "nahi"` -- the operator's own
 * yes/no. It is now the analyser's verdict over the terminal output he
 * pasted, because self-reporting is what this product kept getting burned
 * by.
 *
 * PASS / WARNING advance a `stopGate`. FAIL, UNKNOWN, INCOMPLETE and
 * WRONG_OUTPUT do not -- notably UNKNOWN, which is never quietly promoted
 * to PASS. When the app genuinely cannot decide (the phase-7 phone test,
 * an output whose flags could not be resolved) the operator may still
 * confirm by hand; that records PASS and the UI labels it as
 * self-reported. He is never offered that escape on a FAIL or a
 * WRONG_OUTPUT, since waving those through would rebuild the exact hole
 * this change closes.
 */
export type CheckAnswer = Verdict;

export interface GuidedProgress {
  /** Bumped 1 -> 2 when `CheckAnswer` stopped being "haan"/"nahi". A
   * stored v1 blob would deserialise into answers this code reads as
   * "not one of my verdicts", i.e. neither passed nor failed, which is a
   * defensible outcome but a confusing one. `loadProgress` discards any
   * version it does not recognise -- re-answering a few checks is cheap,
   * acting on a stale "already done" is not. */
  version: 2;
  /** Phase currently on screen. Null = not started yet. */
  currentPhaseId: string | null;
  /** `${phaseId}:${checkId}` -> answer. Flat so a phase reorder in the
   * content file never invalidates answers already given. */
  answers: Record<string, CheckAnswer>;
  /** Phase ids the operator has explicitly finished ("Aage badho"). */
  donePhaseIds: string[];
  /** Phase ids where he confirmed he has a durable copy of the secrets
   * (downloaded the .rsc, or ticked "mere paas copy hai"). */
  secretsSafePhaseIds: string[];
  updatedAt: number;
}

const KEY_PREFIX = "cg_guided_setup_";

export const answerKey = (phaseId: string, checkId: string) => `${phaseId}:${checkId}`;

/** The step number shown to the operator.
 *
 * `Phase.n` is 0-based in the content file, which is right for the data
 * and wrong for a human: "Step 0" reads as something that failed to load,
 * not as the first thing to do. Every number he sees -- the rail, the
 * phase heading, a downloaded filename, the recovery copy -- goes through
 * here, so the display can never drift from itself while `n` stays
 * exactly as the content author wrote it. */
export const stepNumber = (phase: Phase): number => phase.n + 1;

export function emptyProgress(): GuidedProgress {
  return {
    version: 2,
    currentPhaseId: null,
    answers: {},
    donePhaseIds: [],
    secretsSafePhaseIds: [],
    updatedAt: 0,
  };
}

export function loadProgress(routerId: string): GuidedProgress {
  if (typeof window === "undefined") return emptyProgress();
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + routerId);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as GuidedProgress;
    // A stored blob from an older shape is discarded rather than
    // half-trusted -- re-answering a few checks is cheap, acting on a
    // wrong "already done" is not.
    if (parsed?.version !== 2) return emptyProgress();
    return {
      ...emptyProgress(),
      ...parsed,
      answers: parsed.answers ?? {},
      donePhaseIds: parsed.donePhaseIds ?? [],
      secretsSafePhaseIds: parsed.secretsSafePhaseIds ?? [],
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(routerId: string, p: GuidedProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY_PREFIX + routerId,
      JSON.stringify({ ...p, updatedAt: Date.now() }),
    );
  } catch {
    // Persistence here is a convenience, never a precondition -- the
    // in-memory state stays correct for this tab either way.
  }
}

export function clearProgress(routerId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + routerId);
  } catch {
    // Nothing was stored, so nothing needs clearing.
  }
}

/** Verdicts that let a `stopGate` open.
 *
 * WARNING is included on purpose: it means the pass condition held and
 * something worth recording is off anyway (a portal IP that is not the
 * expected one, a shared-users that is not the fleet value). Blocking on
 * those would train operators to route around the gate, which costs more
 * than the warnings are worth. UNKNOWN is excluded on equal purpose -- it
 * is the verdict for "the app could not tell", and promoting it to a pass
 * is the single easiest way to rebuild the bug this module exists to
 * prevent. */
const SATISFYING: ReadonlySet<CheckAnswer> = new Set<CheckAnswer>(["PASS", "WARNING"]);

/** Every check in this phase resolved to a satisfying verdict. A phase
 * with no checks is trivially satisfied -- a `stopGate` on a check-less
 * phase would otherwise be an unopenable door.
 *
 * Name kept as-is: `GuidedSetup.tsx` and `PhaseView.tsx` call it and are
 * out of scope for this change. */
export function phaseAllHaan(phase: Phase, answers: Record<string, CheckAnswer>): boolean {
  return phase.checks.every((c) => {
    const a = answers[answerKey(phase.id, c.id)];
    return a !== undefined && SATISFYING.has(a);
  });
}

/** Any check that says the ROUTER is broken -- drives the "is kuch toota
 * hua hai" tone on the phase rail.
 *
 * Deliberately only FAIL. WRONG_OUTPUT and INCOMPLETE mean the paste was
 * wrong, not the router, and colouring the rail red for a mis-paste
 * teaches operators to ignore red. */
export function phaseHasNahi(phase: Phase, answers: Record<string, CheckAnswer>): boolean {
  return phase.checks.some((c) => answers[answerKey(phase.id, c.id)] === "FAIL");
}

export function phaseAnswered(phase: Phase, answers: Record<string, CheckAnswer>): number {
  return phase.checks.filter((c) => answers[answerKey(phase.id, c.id)] !== undefined).length;
}
