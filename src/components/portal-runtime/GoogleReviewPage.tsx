import { useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN, PG_SECONDARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { scriptClassOf } from "@/lib/portal-script";

/**
 * The "Rate us on Google" page, as a guest sees it -- shared by
 * `/portal/review` (the real page) and the dashboard's preview
 * (`/preview/portal/$locationId?step=review`), so the operator previews
 * exactly what guests get.
 *
 * ═══ WHAT THIS PAGE MUST NEVER DO ═══
 *
 * It is a request, never a gate, and never selective:
 *
 *   - **Both buttons lead to the internet.** "Continue to internet" is the
 *     same size as the CTA, always visible, never delayed, never counted
 *     down. Free WiFi is a "free good and/or service" under Google's
 *     incentive clause, so nothing about the WiFi may depend on this page
 *     in either direction -- the footnote says so to the guest.
 *   - **No stars, no rating widget, nothing pre-filled, no sentiment
 *     question.** The page renders before the product holds any rating
 *     about this guest, so there is nothing to select on. The star icon is
 *     decoration, not a control.
 *   - **No adjective describing the review.** The copy is product-owned and
 *     identical for every guest (see the i18n comment on `reviewPage*`).
 *
 * The link is the venue's own, stored verbatim and checked by
 * `isSafeGoogleReviewUrl` before this ever renders.
 */
export function GoogleReviewPage({
  reviewUrl,
  onOpenReview,
  onContinue,
  constrained,
}: {
  reviewUrl: string;
  /** Resolves `true` once the link may be followed, `false` when Google is
   * not reachable yet (the gate has not opened) -- the page then says
   * "still connecting" and keeps both buttons. */
  onOpenReview: () => Promise<boolean>;
  onContinue: () => void;
  constrained?: boolean;
}) {
  const { t, config } = usePortalRuntime();
  const [busy, setBusy] = useState(false);
  const [stillConnecting, setStillConnecting] = useState(false);
  const venue = config?.name?.trim() || t("reviewPageVenueFallback");
  const title = t("reviewPageTitle").replace("{venue}", venue);

  const onTap = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setStillConnecting(false);
    try {
      const ok = await onOpenReview();
      if (!ok) setStillConnecting(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PortalShell constrained={constrained}>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <PortalCard className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--pr-primary,#6366f1)_8%,var(--pg-surface,#fff))] text-[var(--pr-primary,#6366f1)]">
            <Star className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="pg-title text-[var(--pg-ink)]" data-pg-script={scriptClassOf(title)}>
              {title}
            </h1>
            <p className="pg-body text-[var(--pg-ink-muted)]">
              {t("reviewPageBody").replace("{venue}", venue)}
            </p>
          </div>

          {/* Not an error banner: nothing failed, the gate is just a second
              or two behind. Both buttons stay. */}
          {stillConnecting && (
            <p role="status" className="pg-meta font-medium text-[var(--pg-ink-muted)]">
              {t("reviewPageStillConnecting")}
            </p>
          )}

          <div className="space-y-2.5">
            {/* Same tab, deliberately: on Android a Google review link is an
                App Link and opens the Maps app, where the guest is already
                signed in to Google. `noopener noreferrer` either way. */}
            <a
              href={reviewUrl}
              rel="noopener noreferrer"
              onClick={onTap}
              aria-busy={busy || undefined}
              className={`${PG_PRIMARY_BTN} flex items-center justify-center gap-2`}
              data-testid="review-page-cta"
            >
              {t("reviewPageCta")}
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={onContinue}
              className={`${PG_SECONDARY_BTN} w-full`}
              data-testid="review-page-continue"
            >
              {t("reviewPageContinue")}
            </button>
          </div>

          <p className="pg-meta text-[var(--pg-ink-faint)]">{t("reviewPageNote")}</p>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
