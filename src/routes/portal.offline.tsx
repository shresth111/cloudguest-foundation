import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PortalShell, PortalTextPlate } from "@/components/portal-runtime/PortalShell";
import { PG_PRIMARY_BTN } from "@/components/portal-runtime/PortalGuestUi";
import { GlyphOffline } from "@/components/portal-runtime/PortalGlyphs";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/offline")({
  component: OfflinePage,
});

/**
 * Same light shell/card/button language as the rest of the redesigned
 * flow (see portal.expired.tsx) -- previously the old dark shell, the
 * class of leftover page portal.terms.tsx's own comment describes.
 */
function OfflinePage() {
  const { t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/offline" });
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
            {/* Muted disc (same neutral recipe as portal.closed.tsx);
             * GlyphOffline redraws the brand mark's own dot+arcs signal
             * motif with a slash -- "our signal, interrupted" -- instead
             * of the generic lucide WifiOff, and slate-400 (2.56:1, an SC
             * 1.4.11 failure) moves to `--pg-ink-muted`. */}
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--pg-ink,#1E1B4B)_6%,var(--pg-surface,#fff))] text-[var(--pg-ink-muted)]">
              <GlyphOffline className="h-8 w-8" />
            </div>
            <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("offlineTitle")}</h1>
            {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
             * §1.5 retuned that token #64748B -> #475569, and a slate class does
             * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
             * composite (`--pg-surface` at 85% over a near-black photo region);
             * full derivation in styles.css's own `--pg-ink-muted` note. Backing
             * the block and leaving its subtitle at 3.36:1 would only have half-
             * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
            <p className="mt-1 pg-meta text-[var(--pg-ink-muted)]">{t("offlineSubtitle")}</p>
            {/* Folded out of a one-sentence filler PortalCard and into the
             * plate -- see portal.expired.tsx for the reasoning. */}
            <p className="mt-3 pg-meta text-[var(--pg-ink-faint)]">{t("offlineHelp")}</p>
          </PortalTextPlate>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/portal", replace: true, search: (prev) => prev })}
          className={PG_PRIMARY_BTN}
        >
          {t("retry")}
        </button>
      </div>
    </PortalShell>
  );
}
