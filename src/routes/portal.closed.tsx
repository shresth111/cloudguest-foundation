import { createFileRoute } from "@tanstack/react-router";
import { Moon } from "lucide-react";
import { PortalShell, PortalCard, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/closed")({
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
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Moon className="h-10 w-10" />
            </div>
            <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">
              {config?.name ? `${config.name} ${t("closedTitleDefault")}` : t("closedTitleDefault")}
            </h1>
          </PortalTextPlate>
        </div>
        <PortalCard className="text-center text-sm text-slate-500">
          {config?.businessHoursClosedMessage?.trim() || t("closedSubtitle")}
        </PortalCard>
      </div>
    </PortalShell>
  );
}
