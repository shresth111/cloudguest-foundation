import { ExternalLink, Star, X } from "lucide-react";
import { PortalCard } from "@/components/portal-runtime/PortalShell";
import { PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { isSafeGoogleReviewUrl } from "@/lib/portal-post-connect";
import type { RuntimeSession } from "@/types/portal-runtime";

/**
 * The venue's Google review ask, on `/portal/session`, on arrival.
 *
 * ═══ THE ORDERING IS THE COMPLIANCE ARGUMENT ═══
 *
 * This card renders BEFORE any sentiment has been collected from this
 * guest. Not "not adjacent to" the star prompt -- before it exists at all.
 * Google's Rating Manipulation policy bans *"selectively soliciting
 * positive reviews from customers"*, and selection requires information.
 * At the moment this renders, the product holds no stars, no thumbs, no
 * emoji, no rating of any kind about this guest. There is no variable to
 * select on, which makes the prohibited behaviour **impossible rather than
 * merely absent**.
 *
 * That claim survives two tests the reverse ordering cannot:
 *
 *   - **The screen recording test.** Recording the flow produces: connect →
 *     "Been here before?" → dismiss → session page. Stars appear later, on
 *     a different screen, with no Google link anywhere on it. There is no
 *     frame in which the two co-exist.
 *   - **The code-review test.** `resolvePostConnectAsk`
 *     (src/lib/portal-post-connect.ts) decides whether this renders, and
 *     its inputs contain no reference to any rating, response or feedback
 *     value. Nothing to argue about.
 *
 * The penalty for losing that argument lands on the VENUE's Business
 * Profile -- reviews unpublished, a public "fake reviews were removed"
 * banner, suspension across every profile a chain owns -- so a design that
 * removes the argument entirely is worth its cost.
 *
 * ═══ WHAT THIS MUST NEVER DO ═══
 *
 * No stars pre-filled and no `&rating=` on the URL (influencing the rating;
 * the parameter is dead anyway). No "how was it?" question on the same
 * screen. No variation of copy, colour, position, size or timing based on
 * anything the guest has told the venue. No incentive of any kind -- free
 * WiFi is itself a "free good and/or service" under the incentive clause,
 * which is why nothing about the WiFi may be conditioned on this card in
 * either direction. No adjective describing the review: not "great", not
 * "honest", not "5-star". `Write a Google review` is the whole CTA.
 *
 * ═══ WHY IT IS NOT A CAMPAIGN ═══
 *
 * The obvious implementation is `CampaignType += "review"`, inheriting
 * scheduling and impressions for free. It is the wrong call twice over.
 * `get_next_campaign_for_session` returns exactly ONE campaign per session,
 * so a review campaign would compete with the venue's actual promotions for
 * that slot -- a cafe running a weekend offer would silently stop asking
 * for reviews and nobody could tell why. And campaigns render as a
 * full-screen takeover, which is precisely the shape a review request must
 * not have: a modal the guest must dismiss before seeing that they are
 * online reads as a toll gate whatever the code says. This is an inline,
 * dismissible card in the same `PortalCard` family as everything else in
 * the stack.
 *
 * ═══ THE HONEST LIMIT ═══
 *
 * There is no way to know whether a guest actually left a review. Google
 * publishes no API answering "has user X reviewed place Y" and will not --
 * it would leak review authorship. The product has exactly one signal:
 * did this guest tap the link. Treat it as final (over-asking a guest who
 * already reviewed is the worse error), and never report it as "reviews"
 * anywhere. See `PortalPage`'s "opened your review link".
 *
 * ⚠ Inside Apple's CNA this link will often not work usefully: the
 * websheet is not Safari, an external navigation may open inside the sheet
 * and be destroyed with it, cookies and all. That is not fixable from
 * here, and it is the strongest practical argument for the post-visit
 * message being the real review channel and this card being the free
 * supplement.
 */
export function GoogleReviewNudge({
  session,
  onResolved,
}: {
  session: RuntimeSession;
  onResolved: (outcome: "tapped" | "dismissed") => void;
}) {
  const { t, config, setSession, previewMode, demoMode } = usePortalRuntime();
  /** See `GuestProfileNudge`'s own note: neither the operator preview nor
   * the guest walkthrough may record a tap or persist a synthetic session. */
  const isSimulated = previewMode || demoMode;
  const venueName = config?.name?.trim() || "";
  // BOTH, never either: `reviewCardEnabled` is the venue's intent and
  // `reviewUrl` is the material. `resolvePostConnectAsk` has already
  // applied the same pair through `reviewCardEligible` before this
  // component mounts -- this is the render-site restatement, kept because
  // a card that can render itself off half a contract is one refactor away
  // from doing so.
  const url = config?.reviewCardEnabled ? (config?.reviewUrl ?? null) : null;

  // Last line before an `href`. The URL is merchant-pasted free text that
  // reaches a navigation sink, so the same scheme guard
  // `CampaignOverlay.openBanner` applies to an operator-authored
  // `clickUrl` applies here -- plus a Google-host check, so a mis-pasted
  // link cannot quietly turn a venue's review card into a redirect
  // somewhere else. No review URL, or an unsafe one: nothing renders. No
  // placeholder, no empty state.
  if (!isSafeGoogleReviewUrl(url)) return null;

  const onTap = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSimulated) {
      // The operator is looking at a phone mockup inside their dashboard;
      // opening the venue's real Google page from it would be a surprise,
      // and recording a tap for it would be a lie in the one counter this
      // feature has.
      e.preventDefault();
      onResolved("tapped");
      return;
    }
    // Fire-and-forget, deliberately NOT awaited: a slow analytics call must
    // never delay the link, and a failed one must not cost the venue the
    // tap. This is also the only signal the dashboard has -- see the
    // service method's own docstring on why it is intent, not outcome.
    portalRuntimeService
      .recordReviewLinkOpened({ guestId: session.guestId, sessionId: session.sessionId })
      .catch(() => undefined);
    setSession({ ...session, hasOpenedReviewLink: true });
    onResolved("tapped");
  };

  return (
    <PortalCard className="relative space-y-3">
      <button
        type="button"
        onClick={() => onResolved("dismissed")}
        aria-label={t("dismissCardLabel")}
        className="absolute right-1.5 top-1.5 grid h-11 w-11 place-items-center rounded-full text-[var(--pg-ink-faint)] hover:bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] hover:text-[var(--pg-ink-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pr-primary,#6366f1)]/15"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 pr-11">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
          {/* Not pre-filled, not a rating control, not tappable -- an icon.
              A filled star row here would be "attempting to influence the
              rating" in the most literal possible way. */}
          <Star className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          {/* "Been here before?" is the only honest framing for an ask this
              early: it aims at the returning guest, who does have something
              to review, WITHOUT varying by sentiment -- the question is
              rhetorical and the copy is byte-identical for every guest. It
              also quietly excuses a first-timer from feeling addressed. */}
          <p className="pg-body font-semibold text-[var(--pg-ink)]">{t("reviewCardTitle")}</p>
          {venueName && (
            <p className="pg-meta font-normal text-[var(--pg-ink-muted)]">
              {t("reviewCardSubtitle").replace("{venue}", venueName)}
            </p>
          )}
        </div>
      </div>

      {/* SECONDARY, never primary. A full-bleed brand-filled button reads as
          the required next step, and this is not a step. `rel` carries both
          `noopener` and `noreferrer`; the href is the venue's stored URL
          verbatim -- no interstitial, no click-tracking bounce through a
          third-party domain, which would be both slower and more suspicious
          on a network the guest already distrusts. */}
      <a
        href={url!}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onTap}
        className={`${PG_SECONDARY_BTN} flex items-center justify-center gap-2`}
      >
        {t("reviewCardCta")}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </PortalCard>
  );
}
