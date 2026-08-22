import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, LifeBuoy, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CopyBlock } from "./CopyBlock";
import { CheckRow } from "./CheckRow";
import { GeneratedChunkCallout } from "./GeneratedChunkCallout";
import { phaseNeedsGeneratedChunk } from "./generated-chunks";
import { buildPhaseRsc, downloadRsc, rscFilename } from "./rsc";
import { answerKey, phaseAllHaan, phaseAnswered, stepNumber } from "./progress";
import type { CheckAnswer } from "./progress";
import type { Phase } from "./types";

/** The one phase whose Master-console chunks actually carry secrets that
 * are disclosed exactly once (WireGuard private key, RADIUS shared
 * secret, API password). Advancing past it requires an explicit "I have a
 * copy" -- see `GeneratedChunkCallout`. The other two generated phases
 * (`hotspot`, `portal`) are per-router but not secret, so they advise
 * rather than block: a gate that fires on every one of the three would be
 * three clicks of the same acknowledgement, which is how people learn to
 * click acknowledgements without reading them. */
const SECRETS_PHASE_ID = "tunnel";

/**
 * One phase, filling the screen. Never two, never a list of eighteen.
 *
 * Order on screen follows the operator's hands: what am I doing and why
 * (title + why) -> the per-router chunk from the Master console, if this
 * phase needs one -> the universal blocks -> did it work (checks) -> can
 * I move on.
 *
 * The two kinds of paste block are never interleaved: the generated one
 * sits in its own bordered callout above, labelled as per-router and
 * single-use, and the universal ones sit below under their own heading,
 * labelled as re-runnable. Mixing them would hide the single most
 * important operational difference between them.
 */
export function PhaseView({
  phase,
  routerId,
  routerName,
  answers,
  onAnswer,
  secretsAck,
  onSecretsAck,
  onOpenDiagnostics,
  onGoToRecovery,
  onBack,
  onAdvance,
  isFirst,
  isLast,
}: {
  phase: Phase;
  routerId: string;
  routerName: string;
  answers: Record<string, CheckAnswer>;
  onAnswer: (checkId: string, a: CheckAnswer) => void;
  secretsAck: boolean;
  onSecretsAck: (v: boolean) => void;
  onOpenDiagnostics: (seed: string) => void;
  onGoToRecovery: () => void;
  onBack: () => void;
  onAdvance: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const allHaan = phaseAllHaan(phase, answers);
  const answered = phaseAnswered(phase, answers);
  const needsGenerated = phaseNeedsGeneratedChunk(phase.id);

  const gateBlocked = !!phase.stopGate && !allHaan;
  const secretsBlocked = phase.id === SECRETS_PHASE_ID && !secretsAck;
  const canAdvance = !gateBlocked && !secretsBlocked;

  function onDownload() {
    downloadRsc(rscFilename(routerName, phase), buildPhaseRsc(phase, routerName));
    toast.success("Is phase ke commands ka .rsc download ho gaya");
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {stepNumber(phase)}
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{phase.title}</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> ~{phase.estMinutes} min
          </span>
          {phase.oncePerRouter && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-500">
              Sirf ek baar
            </span>
          )}
        </div>
        {phase.why && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{phase.why}</p>
        )}
      </div>

      {needsGenerated && (
        <GeneratedChunkCallout
          phaseId={phase.id}
          routerId={routerId}
          routerName={routerName}
          secretsAck={secretsAck}
          onSecretsAck={onSecretsAck}
          onGoToRecovery={onGoToRecovery}
        />
      )}

      {phase.paste.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {needsGenerated ? "Phir yeh blocks chalao" : "Router pe paste karo"}
            </p>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
              har router pe same · dobara chala sakte ho
            </span>
          </div>

          {phase.paste.map((p, i) => (
            <CopyBlock
              key={`${p.label}-${i}`}
              label={p.label}
              script={p.script}
              index={i}
              total={phase.paste.length}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Copy ho gaya matlab router pe chal gaya <strong>nahi</strong> hota. Neeche wale checks
              hi asli saboot hain.
            </p>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary hover:bg-accent hover:text-foreground"
            >
              <Download className="h-3 w-3" /> In commands ka .rsc
            </button>
          </div>
        </div>
      )}

      {phase.checks.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ab check karo
            </p>
            <span className="text-[11px] text-muted-foreground">
              {answered}/{phase.checks.length} answer diye
            </span>
          </div>
          {phase.checks.map((c) => (
            <CheckRow
              key={c.id}
              check={c}
              phaseTitle={phase.title}
              answer={answers[answerKey(phase.id, c.id)]}
              onAnswer={(a) => onAnswer(c.id, a)}
              onOpenDiagnostics={onOpenDiagnostics}
            />
          ))}
        </div>
      )}

      {phase.stopGate && (
        <div
          className={cn(
            "rounded-xl border p-3",
            allHaan
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-destructive/50 bg-destructive/5",
          )}
        >
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {allHaan ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sab clear -- aage badh sakte
                ho
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-destructive" /> Yahan rukna zaroori hai
              </>
            )}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{phase.stopGate}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenDiagnostics("")}
        className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <LifeBuoy className="h-3.5 w-3.5" /> Kuch aur ajeeb dikh raha hai?
      </button>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isFirst}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Peeche
        </button>
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          {isLast ? "Setup poora karo" : "Aage badho"} <ArrowRight className="h-4 w-4" />
        </button>
        {gateBlocked && (
          <span className="text-[11px] text-destructive">
            Har check ka jawab "Haan" hona chahiye.
          </span>
        )}
        {!gateBlocked && secretsBlocked && (
          <span className="text-[11px] text-amber-600">Pehle "mere paas copy hai" tick karo.</span>
        )}
      </div>
    </div>
  );
}
