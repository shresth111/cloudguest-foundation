import { useRef, useState } from "react";
import { Star, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { AlertBanner, PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { campaignPortalService } from "@/services/campaign-portal.service";
import type { NextCampaign } from "@/types/campaign";

/**
 * Private 1-5 star feedback, as an inline card, asked once the guest has
 * actually been somewhere long enough to have an opinion.
 *
 * ═══ WHAT WAS WRONG, AND IT WAS THE TIMING, NOT THE PIXELS ═══
 *
 * A `rating_5` campaign fired from `getNextCampaign` on ARRIVAL at
 * `/portal/session` and rendered as a full-screen takeover. So the guest
 * sat down, connected, and instead of "you're connected" got a full-screen
 * *"How was your visit?"* about a visit ninety seconds old. That is wrong
 * twice: it measures a moment that has not happened yet, so the data is
 * noise; and it is a modal standing between a guest and confirmation that
 * their WiFi works, which guests read as a toll gate.
 *
 * `portal.session.tsx` now gates this on ~25 minutes of dwell against
 * `session.startedAt` -- a comparison the page already runs every second
 * for its own countdown -- and routes the star-prompt shape here instead of
 * to the takeover. Banner and redirect campaigns, and genuine
 * multi-question surveys, keep the takeover: those are arrival content a
 * venue authored to be read.
 *
 * ═══ THIS IS A DIFFERENT PRODUCT FROM THE GOOGLE CARD ═══
 *
 * It is private venue feedback. It never leaves the venue's dashboard and
 * is never routed anywhere public, which is what *"Goes straight to the
 * owner. Not public."* -- the most important line on the card -- says out
 * loud. It is what makes an honest 2 star possible, and it is the sentence
 * that visibly distinguishes this card from a review ask in a screen
 * recording. It is never rendered in a session where the Google review
 * card appeared; `resolvePostConnectAsk` enforces that in one place.
 *
 * ═══ NO SENTIMENT BRANCH, ANYWHERE ═══
 *
 * The thank-you is identical for 1 star and 5 stars: same words, same
 * colour, same follow-up field. The optional free-text box is offered to
 * everyone at every rating -- it is the pressure valve that makes a 2 star
 * feel heard, and offering it only to unhappy guests would itself be a
 * sentiment branch. The instant this UI varies by rating, a screenshot of
 * it looks like sentiment routing, and the habit spreads.
 */
export function GuestFeedbackNudge({
  campaign,
  sessionId,
  onResolved,
}: {
  campaign: NextCampaign;
  sessionId: string;
  onResolved: () => void;
}) {
  const { t, config, previewMode, demoMode } = usePortalRuntime();
  const venueName = config?.name?.trim() || "";

  const ratingQuestion = campaign.questions.find((q) => q.answerType === "rating_5");
  const commentQuestion = campaign.questions.find((q) => q.answerType === "free_text");

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState(false);
  const impressionSent = useRef(false);

  /** Both simulated surfaces, not just `previewMode`: the operator Portal
   * Preview and the guest walkthrough both carry a literal
   * "preview"/"demo-session" id and both write to the UNAUTHENTICATED
   * `/portal/campaigns/*` endpoints, so a response fired from either would
   * either 404 or land as a real row against the venue's own campaign. A
   * walkthrough an operator runs three times for three prospects must not
   * read as three guests. Same guard, same reasoning, as
   * `CampaignOverlay`. */
  const isSimulated = previewMode || demoMode;

  const recordImpression = (wasClicked: boolean) => {
    if (impressionSent.current || isSimulated) return;
    impressionSent.current = true;
    campaignPortalService
      .recordImpression(campaign.campaignId, {
        guestSessionId: sessionId,
        wasSkipped: !wasClicked,
        wasClicked,
      })
      .catch(() => undefined);
  };

  const post = async (answers: Record<string, string | number>) => {
    if (isSimulated) return;
    await campaignPortalService.submitResponse(campaign.campaignId, {
      guestSessionId: sessionId,
      answers,
    });
  };

  /** Two silent retries, and a failure is NOT surfaced.
   *
   * Deliberately different from the profile card, which shows a banner: a
   * star tap is a one-gesture opinion, and an error banner about it costs
   * more attention than the datum is worth. The star stays filled, so the
   * guest's mental model ("I rated it") stays true from their side. Typed
   * effort -- the comment below -- is the case that does get an error. */
  const postQuietly = async (answers: Record<string, string | number>) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await post(answers);
        return true;
      } catch {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    return false;
  };

  const onStar = (n: number) => {
    if (rating || !ratingQuestion) return;
    setRating(n);
    recordImpression(true);
    // Posts IMMEDIATELY. Tapping a star *is* the answer -- a guest who taps
    // 4 and closes the page has still given the venue a 4, and on this card
    // abandonment mid-way is the common case rather than the edge case.
    void postQuietly({ [ratingQuestion.id]: n });
  };

  const onSend = async () => {
    const text = comment.trim();
    if (!text || !commentQuestion) {
      onResolved();
      return;
    }
    setSending(true);
    setCommentError(false);
    try {
      // NOTE FOR THE BACKEND: `POST /portal/campaigns/{id}/respond` inserts
      // a row per call (`create_response`), so a guest who both rates and
      // comments produces two response rows for one session -- the rating
      // in the first, the comment in the second. Aggregation is unaffected
      // (`averageRating` reads only rating keys, `freeTextAnswers` only
      // text), but the raw response COUNT for such a guest is 2. The fix is
      // an upsert keyed on (campaign_id, guest_session_id); until then this
      // is the deliberate trade, because the alternative -- holding the
      // rating back until the guest taps Send -- loses the rating for every
      // guest who taps a star and leaves, which is most of them.
      await post({ [commentQuestion.id]: text });
      onResolved();
    } catch {
      setCommentError(true);
    } finally {
      setSending(false);
    }
  };

  if (!ratingQuestion) return null;

  const dismiss = () => {
    recordImpression(rating > 0);
    onResolved();
  };

  return (
    <PortalCard className="relative space-y-3">
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismissCardLabel")}
        className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full text-[var(--pg-ink-faint)] hover:bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] hover:text-[var(--pg-ink-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-11">
        <p className="pg-body font-semibold text-[var(--pg-ink)]">
          {rating
            ? t("feedbackThanksTemplate").replace("{venue}", venueName)
            : t("feedbackCardTitle").replace("{venue}", venueName)}
        </p>
        {!rating && (
          <p className="pg-meta font-normal text-[var(--pg-ink-muted)]">
            {t("feedbackCardSubtitle")}
          </p>
        )}
      </div>

      {/* 44x44 hit areas. Five of them plus gaps fit inside 390px with room
          to spare; they are not shrunk to look elegant. */}
      {!rating && (
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={t("feedbackStarLabelTemplate").replace("{n}", String(n))}
              onClick={() => onStar(n)}
              className="grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15"
            >
              <Star
                className="h-7 w-7 transition"
                strokeWidth={1.5}
                fill={n <= rating ? "#f59e0b" : "none"}
                stroke={n <= rating ? "#f59e0b" : "#cbd5e1"}
              />
            </button>
          ))}
        </div>
      )}

      {rating > 0 && commentQuestion && (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("feedbackFreeTextLabel")}
            aria-label={t("feedbackFreeTextLabel")}
            rows={2}
            disabled={sending}
            className="rounded-xl border-[var(--pg-border)] bg-[var(--pg-surface)] text-[15px] text-[var(--pg-ink)]"
          />
          {/* The comment is typed effort, so unlike the star tap its
              failure IS surfaced -- same rule as the profile card. */}
          {commentError && <AlertBanner message={t("profileSaveFailed")} />}
          <button type="button" onClick={onSend} disabled={sending} className={PG_SECONDARY_BTN}>
            {sending
              ? t("savingLabel")
              : commentError
                ? t("profileRetryCta")
                : t("feedbackSendCta")}
          </button>
        </>
      )}
    </PortalCard>
  );
}
