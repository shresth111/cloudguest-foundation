import type { ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { MButton } from "@/components/master/MasterKit";
import {
  describeWriteConfirmation,
  type PreviewApplyState,
  type WriteConfirmation,
} from "@/lib/preview-then-apply";

/**
 * The panel half of preview-then-apply: gaps, the outcome, the options a
 * surface adds, the contract block, and the two buttons.
 *
 * Lifted out of `src/routes/master.integrations.tsx` unchanged — the markup
 * and every string below are that route's, moved rather than rewritten,
 * because each of them is a decision somebody made after this failed on a live
 * venue. The Omada management surfaces in
 * `~/wyfy-omada/FE-OMADA-MANAGEMENT-FRONTEND-PLAN.md` §5 (ACL rules, port
 * forwarding, SSID creation) each write to a hotel's live network and each
 * need exactly this; copying it is how the first of them loses the casing
 * normalisation.
 *
 * NO DATA FETCHING HERE, AND NO STATE. It renders a `PreviewApplyState` and
 * calls back. `usePreviewThenApply` owns the state; the route owns both, so it
 * can fold `isRunning` into a screen-wide busy flag and invalidate a held
 * preview from a dialog outside this panel.
 *
 * EVERY VOCABULARY IS THE CALLER'S. Step names, outcome names and gap copy
 * arrive resolved. `ssid_takeover` means nothing to a port-forwarding screen,
 * and a shared table of them is how two surfaces start lying about each
 * other's steps.
 */
export interface PreviewThenApplyProps {
  /** What this control does, above everything else. */
  intro?: ReactNode;

  state: PreviewApplyState;

  // --- The gap panel (a typed 409 refusal) --------------------------------
  /** Gap id -> operator copy. Return null for one this build does not know;
   * it is printed verbatim rather than dropped. */
  gapCopy?: (gap: string) => { title: string; fix: string } | null;
  /** The backend's documented fix order. Unordered if omitted. */
  orderGaps?: (gaps: string[]) => string[];
  /** A gap whose fix is a control on this screen gets that control, rather
   * than a sentence pointing at one. */
  renderGapAction?: (gap: string) => ReactNode;
  gapHeading?: string;
  unrecognisedGapFix?: string;

  // --- The outcome panel --------------------------------------------------
  previewHeading?: string;
  changedHeading?: string;
  unchangedHeading?: string;
  partialPreviewWarning?: string;
  partialApplyWarning?: string;
  noStepsLabel?: string;
  rawSummaryLabel?: string;

  /** Per-surface options — a take-over checkbox, a rule form. Rendered
   * between the outcome and the buttons, where an operator reads it before
   * deciding, and where changing one should invalidate the preview. */
  children?: ReactNode;

  // --- Refusal to offer the control at all --------------------------------
  /** Non-null disables both buttons and explains itself in a panel and in
   * both `title`s. This is the "we will not do this here" state, distinct
   * from a gap, which is "not yet". */
  blocked?: string | null;
  blockedTitle?: string;

  // --- The two buttons ----------------------------------------------------
  /** Anything on this screen that writes to the same device is in flight. */
  busy: boolean;
  /** This control's own run is in flight — the spinner. */
  running: boolean;
  onPreview: () => void;
  onApply: () => void;
  previewLabel?: string;
  applyLabel?: string;
  previewIcon?: ReactNode;
  applyNeedsPreviewTitle?: string;
}

/** Whether this confirmation is worth a line of its own. A surface that
 * declared up front that it does not read back has already said so in its own
 * copy; repeating it under every apply is noise, and the declaration exists to
 * be answered at the type level, not rendered. */
function confirmationIsReportable(c: WriteConfirmation | null): c is WriteConfirmation {
  return c != null && c.state !== "not-read-back";
}

export function PreviewThenApply({
  intro,
  state,
  gapCopy,
  orderGaps,
  renderGapAction,
  gapHeading = "Not ready yet — fix this first:",
  unrecognisedGapFix = "This build does not recognise that precondition — ask support.",
  previewHeading = "What this would change",
  changedHeading = "What was changed",
  unchangedHeading = "Nothing needed changing",
  partialPreviewWarning = "Some steps would fail. The controller is unchanged.",
  partialApplyWarning = "Some steps failed — the controller is only partly configured.",
  noStepsLabel = "The controller reported no steps.",
  rawSummaryLabel = "Exactly what the controller reported",
  children,
  blocked = null,
  blockedTitle = "Not available on this contract",
  busy,
  running,
  onPreview,
  onApply,
  previewLabel = "Preview changes",
  applyLabel = "Apply to controller",
  previewIcon = <ShieldCheck />,
  applyNeedsPreviewTitle = "Run the preview first — this writes to a live controller.",
}: PreviewThenApplyProps) {
  const { outcome, previewed, gaps, confirmation } = state;
  const gapList = orderGaps ? orderGaps(gaps) : gaps;
  const stopped = busy || blocked !== null;

  return (
    <div className="space-y-3">
      {intro}

      {/* GAPS COME FROM THE 409, NOT FROM THE SUCCESS BODY. A refusal
          before any write -- an unmet precondition, a foreign portal on
          the SSID, a shared site -- is a 409 carrying a typed
          `data.code`, and never a success body. Reading gaps off the
          response would mean they never appeared at all, because a
          response only exists for a run that got past them. */}
      {gapList.length > 0 && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-sm font-medium">{gapHeading}</p>
          <ol className="space-y-1.5">
            {gapList.map((g) => {
              const copy = gapCopy?.(g) ?? null;
              return (
                <li key={g} className="text-sm">
                  <span className="font-medium">{copy?.title ?? g}</span>
                  <span className="block text-xs text-muted-foreground">
                    {/* An unrecognised precondition is printed verbatim
                        rather than dropped: one nobody renders is a
                        refusal with no reason given. */}
                    {copy?.fix ?? unrecognisedGapFix}
                  </span>
                  {/* UPPERCASE. `refusalGapsFromError` normalises the
                      backend's lowercase gap values to the uppercase union
                      the copy tables are keyed on, so by the time a gap
                      reaches this list it is `OPENAPI_REQUIRED`. A caller
                      comparing against the wire casing here would have made
                      its action never render -- the same casing trap that
                      made the whole panel print "unrecognised" until #279. */}
                  {renderGapAction?.(g)}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {outcome && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <p className="text-sm font-medium">
            {outcome.dryRun ? previewHeading : outcome.changed ? changedHeading : unchangedHeading}
          </p>

          {/* `ok: false` arrives with HTTP 200 and a false envelope, so
              the steps are the only place the reason exists. Surfaced
              loudly rather than left to the toast, which is gone by the
              time anyone reads the detail. */}
          {!outcome.ok && (
            <p className="text-sm font-medium text-destructive">
              {outcome.dryRun ? partialPreviewWarning : partialApplyWarning}
            </p>
          )}

          {outcome.steps.length > 0 ? (
            <ul className="space-y-1.5">
              {outcome.steps.map((st, i) => (
                <li key={`${st.key}-${i}`} className="text-sm">
                  <span className="font-medium">{st.label}</span>{" "}
                  <span className={st.failed ? "text-destructive" : "text-muted-foreground"}>
                    — {st.outcomeLabel}
                  </span>
                  {st.message && (
                    <span className="block text-xs text-muted-foreground">{st.message}</span>
                  )}
                  {/* The controller's own error number, for the support
                      conversation that follows a failure. */}
                  {st.failed && st.providerCode != null && (
                    <span className="block text-xs text-muted-foreground">
                      Controller error code {st.providerCode}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{noStepsLabel}</p>
          )}

          {/* THE READ-BACK, AND IT IS THE ONLY THING ALLOWED TO SAY A WRITE
              LANDED. A write on this platform can return success and do
              nothing -- three separate writes returned `errorCode 0` and
              changed nothing on real hardware. So the steps above report what
              the controller SAID, and this line reports what something SAW
              when it read the configuration back. A surface that declared it
              cannot read back renders no line here rather than borrowing this
              vocabulary. */}
          {confirmationIsReportable(confirmation) && (
            <p
              className={
                confirmation.state === "contradicted"
                  ? "text-sm font-medium text-destructive"
                  : "text-sm text-muted-foreground"
              }
            >
              {describeWriteConfirmation(confirmation)}
            </p>
          )}

          {/* Kept from the version written before the schema was known.
              This is a response an operator may need verbatim during an
              incident, and a field added server-side should reach the
              screen without a frontend release. */}
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {rawSummaryLabel}
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[11px] leading-relaxed">
              {JSON.stringify(outcome.raw, null, 2)}
            </pre>
          </details>
        </div>
      )}

      {children}

      {blocked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">{blockedTitle}</p>
          <p className="text-muted-foreground">{blocked}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <MButton
          variant="outline"
          disabled={stopped}
          aria-disabled={stopped}
          title={blocked ?? undefined}
          onClick={onPreview}
        >
          {running ? <Loader2 className="animate-spin" /> : previewIcon}
          {previewLabel}
        </MButton>
        <MButton
          variant="primary"
          disabled={!previewed || stopped}
          aria-disabled={!previewed || stopped}
          title={blocked ?? (previewed ? undefined : applyNeedsPreviewTitle)}
          onClick={onApply}
        >
          {applyLabel}
        </MButton>
      </div>
    </div>
  );
}
