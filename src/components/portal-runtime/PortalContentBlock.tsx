import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { scriptClassOf } from "@/lib/portal-script";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import {
  PG_PRIMARY_BTN,
  PG_SECONDARY_BTN,
  PG_INPUT,
} from "@/components/portal-runtime/PortalGuestUi";
import { GlyphRedirect } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { PortalSurvey } from "@/types/portal-runtime";

/**
 * Renders a captive portal's configured *content mode* -- the venue-authored
 * block shown above the sign-in card when `config.contentMode` is anything
 * other than `"login"`. One component, one switch, so every surface that
 * already renders `GuestSignInCard` (the real `/portal/welcome` route, the
 * dashboard's embedded Live Preview, and the full-page `/preview/portal/*`
 * routes) picks up all four modes with no per-surface wiring -- and the
 * dashboard's live-rebuilt `livePreviewConfig` re-renders this on every
 * keystroke exactly as it does the sign-in card.
 *
 * `"login"` renders `null`: the default mode, and every existing venue's
 * mode, is "show only the sign-in card", so this component adds nothing to
 * that path -- the portal is byte-identical to before content modes existed.
 *
 * Each non-login mode degrades to `null` (i.e. the sign-in card alone) when
 * its source column is empty, so a mode selected in the dashboard before its
 * content is filled in never renders a broken/empty block. The sign-in card
 * itself is always still shown below this: a captive portal's job is to get
 * the guest online, so the content block augments the login rather than
 * replacing it -- `redirect` mode is the one that leads with a "continue"
 * action, and even it leaves the card reachable below.
 */
export function PortalContentBlock() {
  const { config } = usePortalRuntime();
  if (!config) return null;

  switch (config.contentMode) {
    case "image":
      return config.contentImageUrl ? (
        <ImageContent heading={config.contentHeading} imageUrl={config.contentImageUrl} />
      ) : null;
    case "text":
      return config.contentBody || config.contentHeading ? (
        <TextContent heading={config.contentHeading} body={config.contentBody} />
      ) : null;
    case "redirect":
      return config.redirectUrl ? (
        <RedirectContent heading={config.contentHeading} url={config.redirectUrl} />
      ) : null;
    case "survey":
      return config.survey ? (
        <SurveyContent heading={config.contentHeading} survey={config.survey} />
      ) : null;
    case "login":
    default:
      return null;
  }
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

function SurveyContent({ heading, survey }: { heading: string | null; survey: PortalSurvey }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <PortalCard className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="h-8 w-8 text-[var(--pr-primary,#6366f1)]" />
        <p className="pg-subtitle text-[var(--pg-ink)]">Thanks for your feedback!</p>
        <p className="pg-meta text-[var(--pg-ink-muted)]">Connect below to get online.</p>
      </PortalCard>
    );
  }

  const setAnswer = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }));

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
                    onClick={() => setAnswer(q.id, value)}
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
                    onClick={() => setAnswer(q.id, opt)}
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
              onChange={(e) => setAnswer(q.id, e.target.value)}
              placeholder="Type your answer"
              className={cn(PG_INPUT, "w-full")}
            />
          )}
        </div>
      ))}
      <button type="button" onClick={() => setSubmitted(true)} className={PG_SECONDARY_BTN}>
        {survey.submitLabel || "Submit feedback"}
      </button>
    </PortalCard>
  );
}
