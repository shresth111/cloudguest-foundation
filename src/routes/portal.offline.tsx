import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
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
    <PortalShell variant="light" showHeader={false}>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-slate-400">
            <WifiOff className="h-10 w-10" />
          </div>
          <h1 className="font-display mt-5 text-2xl font-bold tracking-tight text-slate-900">
            {t("offlineTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("offlineSubtitle")}</p>
        </div>
        <PortalCard variant="light" className="text-center text-sm text-slate-500">
          Make sure you're connected to the venue's guest network, then retry.
        </PortalCard>
        <button
          type="button"
          onClick={() => navigate({ to: "/portal", replace: true, search: (prev) => prev })}
          className="h-[52px] w-full rounded-2xl bg-gradient-to-r from-[var(--pr-primary,#6366f1)] to-[var(--pr-accent,#4f46e5)] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(79,70,229,0.55)] transition-all duration-200 hover:brightness-105 active:translate-y-px"
        >
          {t("retry")}
        </button>
      </div>
    </PortalShell>
  );
}
