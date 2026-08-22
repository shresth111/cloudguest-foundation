import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  HelpCircle,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import masterI18n from "@/lib/master-i18n";
import { useGuidedAssertion } from "./content-i18n";
import { CopyBlock } from "./CopyBlock";
import { analyseOutput } from "./analyse";
import type { AnalysisResult, Verdict } from "./analyse";
import { ASSERTIONS } from "./assertions";
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

/** Colour only. The chip TEXT lives in the locale bundles under
 * `check.verdict.*`, so `PhaseView`'s stop-gate hint can interpolate the
 * same strings and the two can never end up naming different verdicts.
 *
 * `PASS` and `FAIL` are identical in all three registers on purpose, and
 * not out of laziness: thirteen of the paste blocks in
 * `phases.content.ts` make the router itself print `RESULT: PASS` /
 * `RESULT: FAIL`. The chip is something the operator matches against a
 * token his own terminal emitted, so translating it would break the
 * comparison this whole screen exists to make. The four softer verdicts
 * are the app talking about itself, and those do translate. */
const VERDICT_STYLE: Record<Verdict, { border: string; bg: string; chip: string }> = {
  PASS: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    chip: "border-emerald-600 bg-emerald-600 text-white",
  },
  WARNING: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/5",
    chip: "border-amber-600 bg-amber-600 text-white",
  },
  FAIL: {
    border: "border-destructive/50",
    bg: "bg-destructive/5",
    chip: "border-destructive bg-destructive text-white",
  },
  UNKNOWN: {
    border: "border-border",
    bg: "bg-muted/20",
    chip: "border-border bg-muted text-foreground",
  },
  INCOMPLETE: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    chip: "border-sky-600 bg-sky-600 text-white",
  },
  WRONG_OUTPUT: {
    border: "border-sky-500/40",
    bg: "bg-sky-500/5",
    chip: "border-sky-600 bg-sky-600 text-white",
  },
};

function VerdictIcon({ verdict }: { verdict: Verdict | undefined }) {
  if (verdict === "PASS")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (verdict === "WARNING")
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
  if (verdict === "FAIL") return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  if (verdict) return <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
  return (
    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-muted-foreground/50" />
  );
}

/**
 * One verification step.
 *
 * The operator runs `command` on the router, copies the raw terminal
 * output, and pastes it here. The app reads it and decides -- it does not
 * ask him whether it worked. That question was the product's single
 * biggest source of false "provisioned" states.
 *
 * Three things this UI is careful about:
 *
 *  1. SECRETS NEVER SETTLE. `analyseOutput` redacts on the way in, and the
 *     textarea is a controlled input bound to the REDACTED text. What the
 *     installer typed is discarded within the same event handler. There
 *     is no code path where the raw paste reaches state, storage, a log,
 *     or a screenshot -- `/interface wireguard print detail` and
 *     `/radius print detail` both print live secrets, and this content
 *     tells him to run them.
 *
 *  2. UNPARSEABLE IS SAID OUT LOUD. Six checks have no assertion (the
 *     five phase-7 phone tests, plus `cert-optional` whose every possible
 *     output is acceptable). Those get no paste box at all -- a paste box
 *     would imply the app was going to check something. They get an
 *     explicit "aap confirm karo, app verify nahi kar sakti" button.
 *
 *  3. THE HUMAN OVERRIDE EXISTS, BUT NOT WHERE IT WOULD HURT. A verdict
 *     of UNKNOWN or INCOMPLETE can be overridden by hand, because the app
 *     admitting it cannot tell must not brick a provisioning session. A
 *     FAIL or WRONG_OUTPUT cannot -- letting a human wave those through
 *     is precisely the hole this feature closes.
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
  const { t } = useTranslation("guided", { i18n: masterI18n });
  const fixes = useMemo(() => check.failFix ?? [], [check.failFix]);
  const pasteable = isRouterCommand(check.command);
  // `reason` is built by `analyse.ts` out of the matching rule's `why`
  // (or the assertion's `fallback`), both authored Hinglish -- so the
  // assertion is localized BEFORE it goes into the analyser, and no change
  // to `analyse.ts` is needed. Only those two prose fields move; every
  // condition, verdict and `fix` join key passes through by reference.
  const assertion = useGuidedAssertion(check.id, check.assert ?? ASSERTIONS[check.id]);
  const canParse = Boolean(assertion);

  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selfReported, setSelfReported] = useState(false);

  const onPaste = useCallback(
    (raw: string) => {
      // Redaction happens inside analyseOutput and the REDACTED text is
      // what goes into state. The raw string does not outlive this call.
      const r = analyseOutput({ raw, assertion, failFix: fixes });
      setPasted(r.redactedText);
      setResult(r);
      setSelfReported(false);
      onAnswer(r.verdict);
    },
    [assertion, fixes, onAnswer],
  );

  // A language switch must also re-language a verdict ALREADY on screen.
  // `result` is state, captured at paste time, so without this the reason
  // panel would keep speaking the previous register until the operator
  // pasted again -- and re-pasting means going back to the terminal.
  //
  // Re-analysing is safe and is NOT a second verdict: the input is the
  // already-redacted text (redaction is idempotent by contract), and only
  // `why`/`fallback` differ between registers, so the verdict and
  // `fixIndex` are identical by construction. `onAnswer` is deliberately
  // NOT called -- nothing the operator has been credited with changes.
  const reanalyse = useRef(false);
  useEffect(() => {
    if (!reanalyse.current) {
      reanalyse.current = true;
      return;
    }
    if (!pasted) return;
    setResult(analyseOutput({ raw: pasted, assertion, failFix: fixes }));
    // `pasted` is intentionally absent: this effect exists to react to a
    // language change, and re-running it on every keystroke would duplicate
    // the work `onPaste` already did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assertion, fixes]);

  const confirmByHand = useCallback(() => {
    setSelfReported(true);
    onAnswer("PASS");
  }, [onAnswer]);

  const style = answer ? VERDICT_STYLE[answer] : null;
  const showFixes = answer === "FAIL";
  const selectedFix = result?.fixIndex ?? null;
  const overridable = answer === "UNKNOWN" || answer === "INCOMPLETE";

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        style ? `${style.border} ${style.bg}` : "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-2">
        <VerdictIcon verdict={answer} />
        <p className="flex-1 text-sm font-medium text-foreground">{check.label}</p>
        {style && (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide",
              style.chip,
            )}
          >
            {selfReported ? t("check.selfReported") : t(`check.verdict.${answer}`)}
          </span>
        )}
      </div>

      <div className="mt-2.5 space-y-2 pl-6">
        {pasteable ? (
          <CopyBlock label={t("check.runThis")} script={check.command} index={0} total={1} />
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {/* Observe-only: `command` here is an instruction to the
                human, not something to paste, so it has a localized
                display label. Pasteable checks never reach this branch. */}
            <p className="text-xs leading-relaxed text-foreground">
              {check.commandLabel ?? check.command}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {pasteable ? t("check.expectOutput") : t("check.expectObserve")}
          </p>
          <pre
            className={cn(
              "mt-1 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground",
              pasteable ? "font-mono" : "font-sans",
            )}
          >
            {/* Same split: for a pasteable check this is the text he
                compares against his terminal and `expectLabel` is never
                set; for an observe-only check it is a sentence. */}
            {(pasteable ? undefined : check.expectLabel) ?? check.expect}
          </pre>
        </div>

        {canParse ? (
          <>
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("check.pasteLabel")}
              </span>
              <textarea
                value={pasted}
                onChange={(e) => onPaste(e.target.value)}
                rows={4}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={t("check.pastePlaceholder")}
                className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </label>

            {result && result.redaction.count > 0 && (
              <p className="inline-flex items-start gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>
                  {/* `keys` are RouterOS field names the redactor found in
                      the operator's own paste -- device data, never copy.
                      Interpolated, never extracted into a locale file. */}
                  {t("check.redacted", {
                    count: result.redaction.count,
                    keys: result.redaction.keys.join(", "),
                  })}
                </span>
              </p>
            )}
            {result?.redaction.columnSecretSuspected && (
              <p className="inline-flex items-start gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/5 px-2.5 py-1.5 text-[11px] leading-relaxed text-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{t("check.columnSecret")}</span>
              </p>
            )}

            {result && answer && (
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-xs leading-relaxed text-foreground">{result.reason}</p>
                {result.evidence.length > 0 && (
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    {result.evidence.map((e) => (
                      <div key={e.label} className="contents">
                        <dt className="font-mono text-[10px] text-muted-foreground">{e.label}</dt>
                        <dd className="truncate font-mono text-[10px] text-foreground">
                          {e.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            {overridable && (
              <button
                type="button"
                onClick={confirmByHand}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:bg-accent"
              >
                <Sparkles className="h-3.5 w-3.5" /> {t("check.overrideUnknown")}
              </button>
            )}
          </>
        ) : (
          <div className="space-y-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-2.5">
            <p className="text-[11px] leading-relaxed text-foreground">
              <Trans
                i18n={masterI18n}
                t={t}
                i18nKey="check.unverifiable"
                components={{ b: <strong /> }}
              />
            </p>
            <button
              type="button"
              onClick={confirmByHand}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold",
                answer === "PASS"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-border bg-background text-foreground hover:border-emerald-600 hover:bg-emerald-500/10",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("check.selfConfirmYes")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelfReported(false);
                onAnswer("FAIL");
              }}
              className={cn(
                "ml-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold",
                answer === "FAIL"
                  ? "border-destructive bg-destructive text-white"
                  : "border-border bg-background text-foreground hover:border-destructive hover:bg-destructive/10",
              )}
            >
              <XCircle className="h-3.5 w-3.5" /> {t("check.selfConfirmNo")}
            </button>
          </div>
        )}

        {showFixes && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-background p-3">
            {fixes.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-foreground">
                  {selectedFix !== null ? t("check.fixHeadingMatched") : t("check.fixHeading")}
                </p>
                {fixes.map((fix, i) => {
                  const picked = selectedFix === i;
                  const dimmed = selectedFix !== null && !picked;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-2.5",
                        picked
                          ? "border-destructive/60 bg-destructive/5"
                          : "border-border bg-muted/20",
                        dimmed && "opacity-60",
                      )}
                    >
                      <p className="text-xs font-medium text-foreground">
                        <span className={picked ? "text-destructive" : "text-amber-600"}>
                          {picked ? t("check.thisHappened") : t("check.if")}
                        </span>{" "}
                        {/* `whenLabel` is the localized display text.
                            `when` itself is the key `analyse.ts` matches a
                            VerdictRule against, so it is never translated
                            -- see Fix in types.ts. */}
                        {fix.whenLabel ?? fix.when}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {fix.note}
                      </p>
                      {fix.command && (
                        <div className="mt-2">
                          <CopyBlock
                            label={t("check.runFix")}
                            script={fix.command}
                            index={0}
                            total={1}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                <p className="pt-1 text-[11px] text-muted-foreground">{t("check.afterFix")}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">{t("check.noFix")}</p>
            )}

            <button
              type="button"
              onClick={() => onOpenDiagnostics(`${check.label} ${phaseTitle}`)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:bg-accent"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> {t("check.openDiagnostics")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
