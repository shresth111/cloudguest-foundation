import { PortalErrorScreen } from "@/components/portal-runtime/PortalErrorScreen";
import { createFileRoute } from "@tanstack/react-router";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { GlyphClosed } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { scriptClassOf } from "@/lib/portal-script";

export const Route = createFileRoute("/portal/closed")({
  errorComponent: PortalErrorScreen,
  component: ClosedPage,
});

/**
 * Real business-hours enforcement (backend/app/domains/captive_portal --
 * business_hours_enabled/timezone/schedule, computed live into
 * `config.isOpenNow` on every GET /captive-portal/resolve): a guest
 * reaching the portal outside the configured schedule sees this instead
 * of the sign-in card. Previously the "Business Hours" admin toggle
 * (renamed "Open Hours" -- same id/route/data, display-only rename) had
 * no guest-facing effect at all -- see that page's own comment.
 *
 * v4 UX §6.6 (checked, not shipped): the brief asks for "opens again at
 * [time]" alongside the admin's free-text message when the venue's real
 * schedule is available. `RuntimePortalConfig` (`src/types/portal-
 * runtime.ts`) exposes only `isOpenNow` (a computed boolean) and
 * `businessHoursClosedMessage` (free text) from `/captive-portal/resolve`
 * today -- no actual schedule/next-open-time field a guest screen could
 * read. Per this codebase's own standing rule against inventing
 * guest-facing claims not backed by real data (see `BrandPanel`'s own
 * comment on dropping a fabricated "~15 seconds" claim), this stays the
 * admin's free-text message only, rather than a guessed/computed time --
 * flagged here as a real backend follow-up (expose the resolved
 * next-open datetime on `RuntimePortalConfig`) rather than shipped as a
 * client-side approximation.
 */
function ClosedPage() {
  const { config, t } = usePortalRuntime();
  const title = config?.name
    ? `${config.name} ${t("closedTitleDefault")}`
    : t("closedTitleDefault");
  const message = config?.businessHoursClosedMessage?.trim() || t("closedSubtitle");

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1). The plate is
         * `PortalTextPlate` -- the one seam that owns "is there a photo",
         * the bounded `w-fit` sizing that is deliberately NOT a wash over
         * the whole content column (§0.1 item 1's twice-shipped mistake),
         * and §1.4 C5's refusal rule. Its own doc comment carries the
         * reasoning this used to copy per route.
         *
         * The wrapper `<div>` is this route's layout box, not the plate,
         * and has to stay: with no photo the plate renders its children
         * bare, so without this box they would drop straight into the
         * column's `gap-5` and lose `text-center`. */}
        <div className="mx-auto w-fit max-w-full text-center">
          <PortalTextPlate>
            {/* Icon disc: the shared state-screen recipe (redesign spec
             * §1.3/§4.5) in its muted variant -- closed is a calm state,
             * not a brand moment, so the tint is ink-on-surface rather
             * than the venue color. GlyphClosed is the hand-drawn brand
             * set's crescent (currentColor, so it follows the polarity
             * flip and forced-colors for free). */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] text-[var(--pg-ink-muted)]">
              <GlyphClosed className="h-8 w-8" />
            </div>
            {/* `data-pg-script`: the h1 carries the venue's own (never
             * translated) name -- a Devanagari/Tamil venue name needs the
             * tall-script leading fix or its matras collide across lines
             * (see portal-script.ts). */}
            <h1
              className="pg-subtitle mt-5 text-[var(--pg-ink)]"
              data-pg-script={scriptClassOf(title)}
            >
              {title}
            </h1>
          </PortalTextPlate>
        </div>
        {/* Admin free text can be long and in any script -- it keeps the
         * opaque card (not a plate line), on the token ramp instead of the
         * pre-#108 `text-sm text-slate-500` literals. */}
        <PortalCard className="text-center">
          <p className="pg-body text-[var(--pg-ink-muted)]" data-pg-script={scriptClassOf(message)}>
            {message}
          </p>
        </PortalCard>
      </div>
    </PortalShell>
  );
}
