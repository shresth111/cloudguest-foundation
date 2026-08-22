import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, PartyPopper, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { MasterShell } from "@/components/master/MasterShell";
import { MButton, MPageShell } from "@/components/master/MasterKit";
import { cn } from "@/lib/utils";
import type { RouterDevice } from "@/types/router";
import { PHASES } from "./phases.content";
import { SYMPTOMS } from "./diagnostics.content";
import { PhaseView } from "./PhaseView";
import { DiagnosticsLookup } from "./DiagnosticsLookup";
import {
  answerKey,
  emptyProgress,
  clearProgress,
  loadProgress,
  phaseAllHaan,
  phaseHasNahi,
  saveProgress,
  stepNumber,
  type CheckAnswer,
  type GuidedProgress,
} from "./progress";

/** The recovery phase. Reached normally at the end of the flow, and
 * jumped to directly by the regenerate guard -- it owns the "did the
 * secrets rotate underneath me" detection and the surgical reset, so
 * nothing else in this module duplicates those commands. */
const RECOVERY_PHASE_ID = "recovery";
const SECRETS_PHASE_ID = "tunnel";

/**
 * Guided Setup -- one router, one phase on screen, yes/no answers.
 *
 * The whole design constraint is that the operator should not have to
 * hold anything in his head: no ordering to remember, no eighteen-chunk
 * wall to find his place in, and no silent failures. Everything that can
 * go wrong is either a "Nahi" with an inline fix, or a lookup entry.
 *
 * Progress is per router and survives the tab closing, because it will:
 * this runs on a laptop next to WinBox, and sometimes on a phone while
 * he is standing at the rack.
 */
export function GuidedSetup({ router, onBack }: { router: RouterDevice; onBack: () => void }) {
  const [progress, setProgress] = useState<GuidedProgress>(() => emptyProgress());
  const [hydrated, setHydrated] = useState(false);
  const [diag, setDiag] = useState<{ open: boolean; seed: string }>({ open: false, seed: "" });
  const [finished, setFinished] = useState(false);

  // Read storage after mount, never in a render body or a lazy useState
  // initializer -- the server render has no localStorage, so seeding
  // state from it during the first render is a hydration mismatch.
  useEffect(() => {
    setProgress(loadProgress(router.id));
    setHydrated(true);
  }, [router.id]);

  const phases = PHASES;
  const currentIndex = useMemo(() => {
    const i = phases.findIndex((p) => p.id === progress.currentPhaseId);
    return i >= 0 ? i : 0;
  }, [phases, progress.currentPhaseId]);
  const phase = phases[currentIndex];

  // Persist alongside the state change rather than inside the updater
  // function -- a `setState(prev => ...)` callback must stay pure (React
  // may invoke it twice), and every caller here is a discrete user click,
  // so reading the current `progress` from the closure is correct.
  function update(next: Partial<GuidedProgress>) {
    const merged = { ...progress, ...next };
    setProgress(merged);
    saveProgress(router.id, merged);
  }

  function goToPhaseId(id: string) {
    update({ currentPhaseId: id });
    setFinished(false);
    setDiag({ open: false, seed: "" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onAnswer(checkId: string, a: CheckAnswer) {
    if (!phase) return;
    update({ answers: { ...progress.answers, [answerKey(phase.id, checkId)]: a } });
  }

  function onAdvance() {
    if (!phase) return;
    const done = progress.donePhaseIds.includes(phase.id)
      ? progress.donePhaseIds
      : [...progress.donePhaseIds, phase.id];
    const next = phases[currentIndex + 1];
    if (!next) {
      update({ donePhaseIds: done });
      setFinished(true);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    update({ donePhaseIds: done, currentPhaseId: next.id });
    setDiag({ open: false, seed: "" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onReset() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Is router ka guided progress mit jayega (jo answers diye the woh sab). Router pe kuch nahi badlega. Reset karein?",
      )
    )
      return;
    clearProgress(router.id);
    setProgress(emptyProgress());
    setFinished(false);
    toast.success("Progress reset ho gaya");
  }

  const secretsAck = progress.secretsSafePhaseIds.includes(SECRETS_PHASE_ID);
  function onSecretsAck(v: boolean) {
    update({
      secretsSafePhaseIds: v
        ? [...new Set([...progress.secretsSafePhaseIds, SECRETS_PHASE_ID])]
        : progress.secretsSafePhaseIds.filter((id) => id !== SECRETS_PHASE_ID),
    });
  }

  function goToRecovery() {
    const target = phases.find((p) => p.id === RECOVERY_PHASE_ID) ?? phases[phases.length - 1];
    if (target) goToPhaseId(target.id);
  }

  const title = `Guided Setup — ${router.name}`;

  if (!hydrated) {
    return (
      <MasterShell title={title}>
        <MPageShell>
          <div className="p-10 text-center text-sm text-muted-foreground">Khul raha hai…</div>
        </MPageShell>
      </MasterShell>
    );
  }

  if (phases.length === 0 || !phase) {
    return (
      <MasterShell title={title}>
        <MPageShell>
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Abhi koi setup phase load nahi hua.
          </div>
          <div className="mt-4 flex justify-center">
            <MButton variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Router Fleet
            </MButton>
          </div>
        </MPageShell>
      </MasterShell>
    );
  }

  return (
    <MasterShell title={title}>
      <MPageShell>
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{router.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {router.model} · {router.locationName} · {router.status}
              </p>
            </div>
            <div className="flex gap-1.5">
              <MButton variant="ghost" onClick={onReset}>
                <RotateCcw className="h-4 w-4" /> Reset
              </MButton>
              <MButton variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" /> Fleet
              </MButton>
            </div>
          </div>

          <PhaseRail
            phases={phases}
            currentId={phase.id}
            progress={progress}
            onPick={goToPhaseId}
          />

          {finished ? (
            <FinishedCard
              onRestart={() => goToPhaseId(phases[0]!.id)}
              onRecovery={goToRecovery}
              onBack={onBack}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-card p-4">
              <PhaseView
                phase={phase}
                routerId={router.id}
                routerName={router.name}
                answers={progress.answers}
                onAnswer={onAnswer}
                secretsAck={secretsAck}
                onSecretsAck={onSecretsAck}
                onOpenDiagnostics={(seed) => {
                  setDiag({ open: true, seed });
                  if (typeof window !== "undefined")
                    window.setTimeout(
                      () =>
                        document
                          .getElementById("guided-diagnostics")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      0,
                    );
                }}
                onGoToRecovery={goToRecovery}
                onBack={() => {
                  const prev = phases[currentIndex - 1];
                  if (prev) goToPhaseId(prev.id);
                }}
                onAdvance={onAdvance}
                isFirst={currentIndex === 0}
                isLast={currentIndex === phases.length - 1}
              />
            </div>
          )}

          {diag.open && (
            <div id="guided-diagnostics">
              <DiagnosticsLookup
                symptoms={SYMPTOMS}
                seed={diag.seed}
                onClose={() => setDiag({ open: false, seed: "" })}
              />
            </div>
          )}
        </div>
      </MPageShell>
    </MasterShell>
  );
}

/**
 * Orientation only -- "kahan hoon main". Deliberately a thin numbered
 * strip, not a second navigation surface: the wall of steps is exactly
 * what this module exists to replace. It scrolls horizontally rather than
 * wrapping, so on a phone it stays one line instead of eating the screen.
 */
function PhaseRail({
  phases,
  currentId,
  progress,
  onPick,
}: {
  phases: typeof PHASES;
  currentId: string;
  progress: GuidedProgress;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {phases.map((p) => {
        const done = progress.donePhaseIds.includes(p.id);
        const allHaan = phaseAllHaan(p, progress.answers);
        const hasNahi = phaseHasNahi(p, progress.answers);
        const current = p.id === currentId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            title={p.title}
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
              current && "border-primary bg-primary text-primary-foreground",
              !current &&
                hasNahi &&
                "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-500",
              !current &&
                !hasNahi &&
                done &&
                allHaan &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-500",
              !current &&
                !hasNahi &&
                !(done && allHaan) &&
                "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {done && allHaan && !current ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <span className="font-bold">{stepNumber(p)}</span>
            )}
            <span className="max-w-[7.5rem] truncate">{p.title}</span>
          </button>
        );
      })}
    </div>
  );
}

function FinishedCard({
  onRestart,
  onRecovery,
  onBack,
}: {
  onRestart: () => void;
  onRecovery: () => void;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center">
      <PartyPopper className="mx-auto h-8 w-8 text-emerald-600" />
      <p className="mt-2 text-lg font-semibold text-foreground">Router taiyar hai</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        Saare phases ho gaye. Guest ab is router pe sign in karke internet chala sakte hain. Kuch
        baad me toota to seedha "Kuch galat ho gaya" phase kholo.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <MButton variant="primary" onClick={onBack}>
          Router Fleet
        </MButton>
        <MButton variant="outline" onClick={onRecovery}>
          Kuch galat ho gaya
        </MButton>
        <MButton variant="ghost" onClick={onRestart}>
          Shuru se dekho
        </MButton>
      </div>
    </div>
  );
}
