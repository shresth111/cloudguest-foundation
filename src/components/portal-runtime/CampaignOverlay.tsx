import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, Copy, MessageSquareText, Star, TicketPercent, X } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { campaignPortalService } from "@/services/campaign-portal.service";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import type { CampaignAnswerValue, NextCampaign, NextCampaignQuestion } from "@/types/campaign";

/** How long a *skippable* banner/redirect campaign stays up before it
 * auto-advances on its own -- long enough to actually register (a real
 * banner image, not a flash), short enough it never feels like it's stuck.
 * Never applies to a SURVEY (auto-submitting a guest's unfinished answers
 * would be dishonest) or to a non-skippable campaign (that one only ever
 * advances on the guest's own explicit action). */
const BANNER_AUTO_ADVANCE_MS = 15_000;

/** True only when there is real, renderable content for this campaign --
 * the founder's own live "test" campaign is a real, current, ACTIVE
 * SURVEY with zero `CampaignQuestion` rows (a data-completeness gap on
 * the admin side, not a bug here), and an admin could equally forget to
 * attach a `CampaignAsset` to a BANNER/REDIRECT. Both are honestly treated
 * as "nothing to show" rather than rendering an empty card or crashing on
 * a missing field. */
export function campaignHasRenderableContent(campaign: NextCampaign): boolean {
  if (campaign.campaignType === "survey") return campaign.questions.length > 0;
  const asset = campaign.asset;
  // A banner is renderable as a tappable image, a bare click-through, or --
  // for a "Banner & Discounts" campaign -- as a text/coupon card with a
  // headline and/or a coupon code (no image or link required).
  return !!(asset?.imageUrl || asset?.clickUrl || asset?.headline || asset?.couponCode);
}

function isAnswerFilled(value: CampaignAnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: NextCampaignQuestion;
  value: CampaignAnswerValue | undefined;
  onChange: (v: CampaignAnswerValue) => void;
}) {
  const { t } = usePortalRuntime();
  if (question.answerType === "single_choice") {
    return (
      <RadioGroup
        value={typeof value === "string" ? value : undefined}
        onValueChange={onChange}
        className="gap-2.5"
      >
        {question.options.map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 transition hover:border-indigo-300 has-[[data-state=checked]]:border-indigo-400 has-[[data-state=checked]]:bg-indigo-50/60"
          >
            <RadioGroupItem value={opt} className="border-slate-300 text-indigo-600" />
            {opt}
          </label>
        ))}
      </RadioGroup>
    );
  }

  if (question.answerType === "multi_choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2.5">
        {question.options.map((opt) => {
          const checked = selected.includes(opt);
          return (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 transition hover:border-indigo-300 has-[[data-state=checked]]:border-indigo-400 has-[[data-state=checked]]:bg-indigo-50/60"
            >
              <Checkbox
                checked={checked}
                className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                onCheckedChange={(v) =>
                  onChange(v ? [...selected, opt] : selected.filter((o) => o !== opt))
                }
              />
              {opt}
            </label>
          );
        })}
      </div>
    );
  }

  if (question.answerType === "rating_5") {
    const rating = typeof value === "number" ? value : 0;
    return (
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="p-1"
          >
            <Star
              className="h-8 w-8 transition"
              strokeWidth={1.5}
              fill={n <= rating ? "#f59e0b" : "none"}
              stroke={n <= rating ? "#f59e0b" : "#cbd5e1"}
            />
          </button>
        ))}
      </div>
    );
  }

  // free_text
  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("answerPlaceholder")}
      rows={3}
      className="rounded-xl border-slate-200 bg-white text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-400 focus-visible:ring-4 focus-visible:ring-indigo-500/15"
    />
  );
}

interface Props {
  campaign: NextCampaign;
  sessionId: string;
  /** Called exactly once, after the guest is done with this campaign one
   * way or another (submitted, skipped, clicked through, or the
   * auto-advance timer elapsed) -- the caller reveals whatever it would
   * have shown next. */
  onDone: () => void;
  /** Threaded to `PortalShell` for the admin Portal Preview, which renders
   * this inside a fixed-size bezel and must keep the backdrop `absolute`
   * (not viewport-`fixed`, which would escape the bezel). Defaults to the
   * real guest surface's full-viewport shell. */
  constrained?: boolean;
}

/**
 * The real guest-facing Campaigns screen -- the thing this whole feature
 * was missing (see this module's own PR: a founder could build a real
 * survey/banner campaign through the admin UI and it would never reach an
 * actual guest). Rendered by `portal.success.tsx` as a full replacement
 * for its own connected-confirmation content while a real, currently-
 * eligible campaign is being shown -- see that file's own comment on why
 * this never delays the real hotspot-login POST underneath it.
 */
export function CampaignOverlay({ campaign, sessionId, onDone, constrained = false }: Props) {
  const { t, previewMode } = usePortalRuntime();
  const [answers, setAnswers] = useState<Record<string, CampaignAnswerValue>>({});
  const finished = useRef(false);

  const finish = (outcome: { wasSkipped: boolean; wasClicked: boolean }) => {
    if (finished.current) return;
    finished.current = true;
    // Best-effort telemetry -- a failed impression/response write should
    // never trap a guest on this screen (they already got real value, or
    // explicitly chose to skip; see this file's own module docstring). The
    // operator Portal Preview has no real guest session behind it, so it
    // never records an impression -- it is a content preview, not a real
    // guest whose engagement should count.
    if (!previewMode) {
      campaignPortalService
        .recordImpression(campaign.campaignId, { guestSessionId: sessionId, ...outcome })
        .catch(() => undefined);
    }
    onDone();
  };

  const submitSurvey = useMutation({
    mutationFn: () =>
      previewMode
        ? Promise.resolve()
        : campaignPortalService.submitResponse(campaign.campaignId, {
            guestSessionId: sessionId,
            answers,
          }),
    onSuccess: () => finish({ wasSkipped: false, wasClicked: false }),
    // A submission that genuinely fails server-side (expired mid-fill,
    // network drop) still shouldn't strand a guest waiting for their
    // internet -- treat it the same as a skip rather than retry-looping
    // them on a captive-portal screen.
    onError: () => finish({ wasSkipped: false, wasClicked: false }),
  });

  const requiredQuestions = useMemo(
    () => campaign.questions.filter((q) => q.isRequired),
    [campaign.questions],
  );
  const canSubmit = requiredQuestions.every((q) => isAnswerFilled(answers[q.id]));

  // Skippable BANNER/REDIRECT campaigns auto-advance on their own after a
  // fixed delay -- never a SURVEY (see BANNER_AUTO_ADVANCE_MS's own
  // docstring), never a non-skippable campaign (that one only advances on
  // the guest's own explicit action).
  useEffect(() => {
    if (campaign.campaignType === "survey" || !campaign.isSkippable) return;
    const id = setTimeout(
      () => finish({ wasSkipped: false, wasClicked: false }),
      BANNER_AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.campaignType, campaign.isSkippable]);

  const skip = () => finish({ wasSkipped: true, wasClicked: false });

  const openBanner = () => {
    // `clickUrl` is operator-authored free text shown to GUESTS -- guard its
    // scheme before handing it to a navigation sink, exactly as
    // PortalContentBlock's RedirectContent and /portal/redirect already do.
    // Only http/https may open: a `javascript:`/`data:` value passed to
    // window.open() can execute script, so restricting the scheme is what
    // keeps a malicious/compromised campaign from running code at guests.
    const clickUrl = campaign.asset?.clickUrl;
    const safeClickUrl = clickUrl && /^https?:\/\//i.test(clickUrl) ? clickUrl : null;
    if (safeClickUrl) {
      window.open(safeClickUrl, "_blank", "noopener,noreferrer");
    }
    finish({ wasSkipped: false, wasClicked: !!safeClickUrl });
  };

  // "Banner & Discounts" promo copy: a headline/subtext and/or a redeemable
  // coupon code the guest can read and copy, rendered as a coupon card
  // rather than only a tappable image (see NextCampaignAsset).
  const asset = campaign.asset;
  const bannerHasPromo = !!(asset?.headline || asset?.subtext || asset?.couponCode);
  const [couponCopied, setCouponCopied] = useState(false);
  const copyCoupon = async () => {
    if (!asset?.couponCode) return;
    try {
      await navigator.clipboard.writeText(asset.couponCode);
      setCouponCopied(true);
      setTimeout(() => setCouponCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) -- the code is
      // shown on screen regardless, so a guest can still read and type it.
    }
  };
  const validUntil = asset?.couponExpiresAt ? new Date(asset.couponExpiresAt) : null;
  const validUntilLabel =
    validUntil && !Number.isNaN(validUntil.getTime())
      ? validUntil.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <PortalShell constrained={constrained}>
      {/* v4 §5: this used to run its own `framer-motion` fade+rise
       * (opacity 0->1, y 10->0) on top of PortalShell's own CSS-only
       * `pg-enter` fade+rise, already applied to the <main> this content
       * sits inside -- the exact same "same entrance animated twice via
       * two different mechanisms" pattern portal.index.tsx's own
       * framer-motion removal already fixed elsewhere on this surface.
       * `pg-enter` alone already covers it; dropping this import is one
       * of the two real, live `framer-motion` usages left on the guest
       * portal (`ConnectedIllustration`, portal.session.tsx, is the
       * other) -- closing both is what makes the "zero framer-motion on
       * this surface" budget line actually true. */}
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            <MessageSquareText className="h-3.5 w-3.5" />
            {campaign.campaignType === "survey" ? t("surveyQuestion") : t("sponsored")}
          </span>
          {campaign.isSkippable && (
            <button
              type="button"
              onClick={skip}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              {t("skipAd")} <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {campaign.campaignType === "survey" ? (
          <>
            <PortalCard className="space-y-6">
              {campaign.questions
                .slice()
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((q) => (
                  <div key={q.id} className="space-y-2.5">
                    <p className="text-sm font-semibold text-slate-800">
                      {q.questionText}
                      {q.isRequired && <span className="ml-1 text-red-500">*</span>}
                    </p>
                    <QuestionField
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    />
                  </div>
                ))}
            </PortalCard>
            <button
              type="button"
              disabled={!canSubmit || submitSurvey.isPending}
              onClick={() => submitSurvey.mutate()}
              className={PG_PRIMARY_BTN}
            >
              {submitSurvey.isPending ? t("submitting") : t("submit")}
            </button>
          </>
        ) : (
          <>
            <PortalCard className="overflow-hidden p-0">
              {asset?.imageUrl && (
                <button type="button" onClick={openBanner} className="block w-full">
                  <img
                    src={asset.imageUrl}
                    alt={asset.altText ?? ""}
                    className="w-full object-cover"
                  />
                </button>
              )}
              {bannerHasPromo ? (
                <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    <TicketPercent className="h-3.5 w-3.5" />
                    {t("offer")}
                  </span>
                  {asset?.headline && (
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                      {asset.headline}
                    </h2>
                  )}
                  {asset?.subtext && (
                    <p className="text-sm leading-relaxed text-slate-600">{asset.subtext}</p>
                  )}
                  {asset?.couponCode && (
                    <button
                      type="button"
                      onClick={copyCoupon}
                      aria-label={`${t("useCode")} ${asset.couponCode}`}
                      className="group inline-flex items-center gap-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-5 py-3 transition hover:border-amber-400 hover:bg-amber-100/70"
                    >
                      <span className="font-mono text-lg font-bold tracking-[0.2em] text-amber-800">
                        {asset.couponCode}
                      </span>
                      {couponCopied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-amber-500 transition group-hover:text-amber-700" />
                      )}
                    </button>
                  )}
                  {couponCopied && (
                    <p className="text-xs font-medium text-emerald-600">{t("couponCopied")}</p>
                  )}
                  {validUntilLabel && (
                    <p className="text-xs text-slate-400">
                      {t("validUntil")} {validUntilLabel}
                    </p>
                  )}
                </div>
              ) : (
                !asset?.imageUrl && (
                  <div className="p-8 text-center">
                    <p className="text-sm text-slate-500">{t("sponsorMessage")}</p>
                  </div>
                )
              )}
            </PortalCard>
            <button type="button" onClick={openBanner} className={PG_PRIMARY_BTN}>
              <span className="inline-flex items-center justify-center gap-2">
                {t("continueCta")} <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </>
        )}
      </div>
    </PortalShell>
  );
}
