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

export type CheckAnswer = "haan" | "nahi";

export interface GuidedProgress {
  version: 1;
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
    version: 1,
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
    if (parsed?.version !== 1) return emptyProgress();
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

/** Every check in this phase answered "Haan". A phase with no checks is
 * trivially satisfied -- a `stopGate` on a check-less phase would
 * otherwise be an unopenable door. */
export function phaseAllHaan(phase: Phase, answers: Record<string, CheckAnswer>): boolean {
  return phase.checks.every((c) => answers[answerKey(phase.id, c.id)] === "haan");
}

/** Any check answered "Nahi" -- drives the "is kuch toota hua hai" tone
 * on the phase card without needing every check answered yet. */
export function phaseHasNahi(phase: Phase, answers: Record<string, CheckAnswer>): boolean {
  return phase.checks.some((c) => answers[answerKey(phase.id, c.id)] === "nahi");
}

export function phaseAnswered(phase: Phase, answers: Record<string, CheckAnswer>): number {
  return phase.checks.filter((c) => answers[answerKey(phase.id, c.id)] !== undefined).length;
}
