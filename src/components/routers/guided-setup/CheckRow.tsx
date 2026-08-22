import { AlertTriangle, CheckCircle2, Eye, LifeBuoy, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyBlock } from "./CopyBlock";
import type { Check } from "./types";
import type { CheckAnswer } from "./progress";

/** Is this check something he pastes into a terminal, or something he
 * looks at?
 *
 * Phase 7 is the phone test: its checks carry instructions like
 * "(WiFi connect karo, portal apne aap khulna chahiye)" in the same
 * `command` field a RouterOS check uses. Rendering that as a monospaced
 * terminal block with a Copy button would be actively misleading -- there
 * is nothing to paste and nowhere to paste it. Every real RouterOS
 * command in this content starts with `/` (a command path) or `:` (a
 * scripting keyword), and nothing else does, so that is the test. */
function isRouterCommand(command: string): boolean {
  return /^\s*[/:]/.test(command);
}

/**
 * One verification step. The operator runs or observes `command`, looks
 * at what came back, and answers one of two buttons.
 *
 * Two explicit buttons instead of a checkbox is deliberate: a checkbox
 * invites "tick everything and move on". Buttons, with the expected
 * output sitting right above them, make him actually compare. And "Nahi"
 * is a first-class, useful answer -- it is the only thing that opens the
 * repair path -- so it must not look like a failure he wants to avoid
 * clicking.
 */
export function CheckRow({
  check,
  phaseTitle,
  answer,
  onAnswer,
  onOpenDiagnostics,
}: {
  check: Check;
  phaseTitle: string;
  answer: CheckAnswer | undefined;
  onAnswer: (a: CheckAnswer) => void;
  onOpenDiagnostics: (seed: string) => void;
}) {
  const failed = answer === "nahi";
  const passed = answer === "haan";
  const fixes = check.failFix ?? [];
  const pasteable = isRouterCommand(check.command);

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        passed && "border-emerald-500/40 bg-emerald-500/5",
        failed && "border-amber-500/50 bg-amber-500/5",
        !answer && "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        {passed ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : failed ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground/50" />
        )}
        <p className="text-sm font-medium text-foreground">{check.label}</p>
      </div>

      <div className="mt-2.5 space-y-2 pl-6">
        {pasteable ? (
          <CopyBlock label="Yeh command chalao" script={check.command} index={0} total={1} />
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-foreground">{check.command}</p>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {pasteable ? "Aisa dikhna chahiye" : "Yeh hona chahiye"}
          </p>
          <pre
            className={cn(
              "mt-1 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground",
              pasteable ? "font-mono" : "font-sans",
            )}
          >
            {check.expect}
          </pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAnswer("haan")}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
              passed
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-border bg-background text-foreground hover:border-emerald-600 hover:bg-emerald-500/10",
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" /> Haan, aisa hi aaya
          </button>
          <button
            type="button"
            onClick={() => onAnswer("nahi")}
            className={cn(
              "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:flex-none",
              failed
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-border bg-background text-foreground hover:border-amber-600 hover:bg-amber-500/10",
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" /> Nahi
          </button>
        </div>

        {failed && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-background p-3">
            {fixes.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-foreground">
                  Theek karne ke liye -- jo case match kare wahi karo:
                </p>
                {fixes.map((fix, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-2.5">
                    <p className="text-xs font-medium text-foreground">
                      <span className="text-amber-600">Agar:</span> {fix.when}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {fix.note}
                    </p>
                    {fix.command && (
                      <div className="mt-2">
                        <CopyBlock label="Yeh chalao" script={fix.command} index={0} total={1} />
                      </div>
                    )}
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Fix ke baad upar wala step dobara karo aur phir se dekho.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Is check ke liye koi ready-made fix nahi hai -- diagnostics me dhoondo.
              </p>
            )}

            <button
              type="button"
              onClick={() => onOpenDiagnostics(`${check.label} ${phaseTitle}`)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:bg-accent"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> Inme se kuch match nahi hua -- diagnostics kholo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
