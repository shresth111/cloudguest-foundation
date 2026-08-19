import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { XCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PortalShell,
  PortalCard,
  GUEST_LEGIBILITY_CARD_CLASS,
} from "@/components/portal-runtime/PortalShell";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/failure")({
  component: FailurePage,
});

/**
 * Same light shell/card/button language as the rest of the redesigned
 * flow (see portal.expired.tsx) -- previously the old dark shell, the
 * class of leftover page portal.terms.tsx's own comment describes. Retry
 * goes to `/portal/auth`, which itself now redirects straight to the one
 * real sign-in card (`/portal/welcome`) rather than a standalone menu --
 * see portal.auth.index.tsx's own docstring.
 */
function FailurePage() {
  const { config, t } = usePortalRuntime();
  const hasPhoto = !!config?.backgroundImageUrl;
  const navigate = useNavigate({ from: "/portal/failure" });
  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        {/* captive-portal-v7-design-spec.md §1.1 (L1): this heading block
         * used to render straight onto the venue's photo, inside the
         * page scrim's deliberately fully-transparent 24-78% band, so
         * `--pg-ink` had no guaranteed contrast ratio against it at all.
         * It now carries the same bounded `GUEST_LEGIBILITY_CARD_CLASS`
         * plate `BrandPanel` and the shell footer already use, sized to
         * its own text (`w-fit` only reaches full column width when the
         * text genuinely fills it) -- deliberately NOT a wash over the
         * whole content column, which is §0.1 item 1's twice-shipped
         * mistake. Photo-only: on the flat `--pg-canvas` there is no
         * contrast problem to solve and no plate is drawn. */}
        <div
          className={cn(
            "mx-auto w-fit max-w-full text-center",
            hasPhoto && cn("p-5", GUEST_LEGIBILITY_CARD_CLASS),
          )}
        >
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("authFailed")}</h1>
          {/* `--pg-ink-muted`, not the hardcoded `text-slate-500` it replaces: v7
           * §1.5 retuned that token #64748B -> #475569, and a slate class does
           * not follow it. 3.36:1 -> 5.36:1 against this plate's own worst
           * composite (`--pg-surface` at 85% over a near-black photo region);
           * full derivation in styles.css's own `--pg-ink-muted` note. Backing
           * the block and leaving its subtitle at 3.36:1 would only have half-
           * fixed L1, whose own wording is "an unbacked <h1> *and subtitle*". */}
          <p className="mt-1 text-sm text-[var(--pg-ink-muted)]">
            Please check your details and try again.
          </p>
        </div>
        <PortalCard className="text-center text-sm text-slate-500">
          If the issue continues, please ask venue staff for assistance.
        </PortalCard>
        <button
          type="button"
          onClick={() => navigate({ to: "/portal/auth", search: (prev) => prev })}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--pr-primary,#6366f1)] to-[var(--pr-accent,#4f46e5)] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] transition-all duration-200 hover:brightness-105 active:translate-y-px"
        >
          <RotateCcw className="h-4 w-4" /> {t("retry")}
        </button>
      </div>
    </PortalShell>
  );
}
