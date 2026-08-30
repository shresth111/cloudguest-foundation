import { cn } from "@/lib/utils";
import { scriptClassOf } from "@/lib/portal-script";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN, PG_INPUT } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphRedirect } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { PortalSurvey } from "@/types/portal-runtime";

/**
 * Renders a captive portal's configured *content mode* -- the venue-authored
 * block shown instead of / before the sign-in card when `config.contentMode`
 * is anything other than `"login"`.
 *
 * TWO-STEP FLOW. The intro content modes (`image`/`text`/`survey`) are a
 * *first step* the guest completes before the sign-in card, not a block
 * crowded on top of it: the venue's content shows with a single "Continue"
 * action, and only after that does the real sign-in card appear. That step
 * state is owned one level up, by `GuestSignInCard` (the single component
 * every portal surface renders -- the real `/portal/welcome` route, the
 * dashboard's embedded Live Preview, and the `/preview/portal/*` routes), so
 * every surface gets the same two-step flow with no per-surface wiring, and
 * `GuestSignInCard` (not this component) decides which step is on screen.
 *
 * This component therefore renders in one of two roles, selected by whether
 * it is handed an `onContinue`:
 *   - **Step 1 (gating intro):** `onContinue` is provided. Renders the
 *     `image`/`text`/`survey` content plus a "Continue" button that calls
 *     `onContinue` to advance to the sign-in card. Renders `null` for
 *     `login` (nothing to show) and `redirect` (see below).
 *   - **Alongside sign-in:** `onContinue` is omitted. Renders `only`
 *     `redirect` (the one mode that is not a gating pre-step: it leads with a
 *     "continue to our site" action but leaves the sign-in card reachable
 *     right below it, exactly as before). Renders `null` for every other
 *     mode -- crucially it does NOT re-render the survey/image/text on the
 *     sign-in step.
 *
 * `"login"` renders `null` in both roles: the default mode, and every
 * existing venue's mode, is "show only the sign-in card", so this component
 * adds nothing to that path -- the portal is byte-identical to before content
 * modes existed.
 *
 * Each non-login mode degrades to `null` (i.e. the sign-in card alone) when
 * its source column is empty -- `hasGatingContentStep` (in
 * `@/types/portal-runtime`, the gate `GuestSignInCard` uses to decide whether
 * a step-1 exists) shares the exact same per-mode "is there real content"
 * predicate, so the gate and this render can never disagree.
 */
export function PortalContentBlock({
  onContinue,
  surveyAnswers,
  onSurveyAnswer,
}: {
  /** When provided, this is the step-1 gating render (intro content + a
   * Continue button that calls this). When omitted, only `redirect` renders,
   * alongside the sign-in card. */
  onContinue?: () => void;
  /** Survey answers, lifted to `GuestSignInCard` so they survive the step
   * transition (the survey is non-networked -- answers live only in React
   * state, and must not reset when the guest advances to sign-in). */
  surveyAnswers?: Record<string, string>;
  onSurveyAnswer?: (id: string, value: string) => void;
} = {}) {
  const { config, t } = usePortalRuntime();
  if (!config) return null;

  // Alongside-sign-in role: only `redirect` renders here. Everything else --
  // including the intro modes, which have already had their turn on step 1 --
  // is `null` so the survey/image/text never re-appears above the sign-in
  // card on step 2.
  if (!onContinue) {
    return config.contentMode === "redirect" && config.redirectUrl ? (
      <RedirectContent heading={config.contentHeading} url={config.redirectUrl} />
    ) : null;
  }

  // Step-1 gating role: the venue's intro content, then a single Continue
  // action. The per-mode content guards mirror `hasGatingContentStep`
  // exactly, so a mode that reports a step here always yields real content.
  let content: React.ReactNode = null;
  switch (config.contentMode) {
    case "image":
      content = config.contentImageUrl ? (
        <ImageContent heading={config.contentHeading} imageUrl={config.contentImageUrl} />
      ) : null;
      break;
    case "text":
      content =
        config.contentBody || config.contentHeading ? (
          <TextContent heading={config.contentHeading} body={config.contentBody} />
        ) : null;
      break;
    case "survey":
      content = config.survey ? (
        <SurveyContent
          heading={config.contentHeading}
          survey={config.survey}
          answers={surveyAnswers ?? {}}
          onAnswer={onSurveyAnswer ?? (() => {})}
        />
      ) : null;
      break;
    default:
      content = null;
  }

  if (!content) return null;

  return (
    <div className="flex flex-col gap-3">
      {content}
      {/* The step's forward action -- advances to the sign-in card WITHOUT
       * connecting. Deliberately "Continue", never a "submit & connect"
       * label: the survey/intro is step 1, the actual sign-in is step 2. */}
      <button type="button" onClick={onContinue} className={PG_PRIMARY_BTN}>
        {t("continueCta")}
      </button>
    </div>
  );
}

/** Optional heading shared by every mode -- `pg-subtitle`, script-aware
 * leading, and only rendered when there is real copy (never an empty node
 * that would still take the card's `space-y` gap). */
function ContentHeading({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <h2
      data-pg-script={scriptClassOf(text)}
      className="pg-subtitle text-balance text-[var(--pg-ink)]"
    >
      {text}
    </h2>
  );
}

function ImageContent({ heading, imageUrl }: { heading: string | null; imageUrl: string }) {
  return (
    <PortalCard className="space-y-3">
      <ContentHeading text={heading} />
      {/* `w-full` + intrinsic aspect: the venue's promo/menu/event graphic
       * shown at the card's full width. `rounded-xl` matches the card's own
       * inner radius; the neutral ring keeps a white-background graphic from
       * bleeding into the card. */}
      <img
        src={imageUrl}
        alt={heading ?? "Portal announcement"}
        className="w-full rounded-xl ring-1 ring-[var(--pg-border)]"
        loading="eager"
      />
    </PortalCard>
  );
}

function TextContent({ heading, body }: { heading: string | null; body: string | null }) {
  return (
    <PortalCard className="space-y-2.5">
      <ContentHeading text={heading} />
      {body && (
        // `whitespace-pre-line` so a venue's paragraph breaks survive; the
        // body is plain text, never HTML (it is rendered as a text node, so
        // it cannot inject markup).
        <p
          data-pg-script={scriptClassOf(body)}
          className="whitespace-pre-line pg-body text-pretty text-[var(--pg-ink-muted)]"
        >
          {body}
        </p>
      )}
    </PortalCard>
  );
}

function RedirectContent({ heading, url }: { heading: string | null; url: string }) {
  let host = url;
  try {
    host = new URL(url, "https://example.invalid").hostname || url;
  } catch {
    /* keep the raw value */
  }
  // Only ever expose an http/https destination as a clickable link -- the
  // same guard `/portal/redirect` applies before its own navigation sink.
  const safe = /^https?:\/\//i.test(url);
  return (
    <PortalCard className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--pr-primary,#6366f1)] text-[color:var(--pr-primary-foreground,#ffffff)]">
          <GlyphRedirect className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <ContentHeading text={heading ?? "Continue to our site"} />
          <p className="pg-meta text-[var(--pg-ink-muted)]">
            You'll be taken to <span className="font-semibold text-[var(--pg-ink)]">{host}</span>.
          </p>
        </div>
      </div>
      {safe && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={cn(PG_PRIMARY_BTN, "flex items-center justify-center")}
        >
          Continue to {host}
        </a>
      )}
    </PortalCard>
  );
}

function SurveyContent({
  heading,
  survey,
  answers,
  onAnswer,
}: {
  heading: string | null;
  survey: PortalSurvey;
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
}) {
  // Purely presentational: the answer state is owned by `GuestSignInCard`
  // (passed in as `answers`/`onAnswer`) so it survives the step-1 -> step-2
  // transition. The survey is deliberately non-networked -- there is no
  // submit here; the step's Continue button (rendered by `PortalContentBlock`
  // below this card) advances to sign-in.
  return (
    <PortalCard className="space-y-4">
      <ContentHeading text={heading ?? "Before you connect"} />
      {survey.questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p
            data-pg-script={scriptClassOf(q.label)}
            className="pg-meta font-medium text-[var(--pg-ink)]"
          >
            {q.label}
          </p>
          {q.type === "rating" ? (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => {
                const value = String(n);
                const active = answers[q.id] === value;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onAnswer(q.id, value)}
                    className={cn(
                      "grid h-10 flex-1 place-items-center rounded-xl border pg-body font-semibold transition-colors",
                      active
                        ? "border-[var(--pr-primary,#6366f1)] bg-[var(--pr-primary,#6366f1)] text-[color:var(--pr-primary-foreground,#ffffff)]"
                        : "border-[var(--pg-border)] text-[var(--pg-ink-muted)] hover:border-[var(--pg-ink-faint)]",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : q.type === "choice" ? (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map((opt) => {
                const active = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onAnswer(q.id, opt)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 pg-meta font-medium transition-colors",
                      active
                        ? "border-[var(--pr-primary,#6366f1)] bg-[var(--pr-primary,#6366f1)] text-[color:var(--pr-primary-foreground,#ffffff)]"
                        : "border-[var(--pg-border)] text-[var(--pg-ink-muted)] hover:border-[var(--pg-ink-faint)]",
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              type="text"
              value={answers[q.id] ?? ""}
              onChange={(e) => onAnswer(q.id, e.target.value)}
              placeholder="Type your answer"
              className={cn(PG_INPUT, "w-full")}
            />
          )}
        </div>
      ))}
    </PortalCard>
  );
}
