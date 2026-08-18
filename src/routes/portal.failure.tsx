import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { XCircle, RotateCcw } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
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
  const { t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/failure" });
  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-50 text-red-500">
            <XCircle className="h-10 w-10" />
          </div>
          <h1 className="pg-subtitle mt-5 text-[var(--pg-ink)]">{t("authFailed")}</h1>
          <p className="mt-1 text-sm text-slate-500">Please check your details and try again.</p>
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
