import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/redirect")({
  component: RedirectPage,
});

function RedirectPage() {
  const { config, t } = usePortalRuntime();
  const navigate = useNavigate({ from: "/portal/redirect" });
  const [remaining, setRemaining] = useState(5);
  const url = config?.redirectUrl;

  useEffect(() => {
    if (!url) {
      navigate({ to: "/portal/success", replace: true, search: (prev) => prev });
    }
  }, [url, navigate]);

  useEffect(() => {
    if (!url || remaining <= 0) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [url, remaining]);

  useEffect(() => {
    if (url && remaining <= 0) {
      window.location.href = url;
    }
  }, [url, remaining]);

  if (!url) return null;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col justify-center gap-5">
        <div className="text-center">
          <div
            className="mx-auto grid h-20 w-20 place-items-center rounded-full text-white shadow-xl"
            style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          >
            <ExternalLink className="h-9 w-9" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("redirecting")}</h1>
          <p className="mt-1 text-sm text-white/60">
            You'll be sent to <span className="text-white">{url}</span> shortly.
          </p>
        </div>
        <PortalCard className="text-center">
          <p className="text-4xl font-bold tabular-nums">{remaining}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-white/50">seconds</p>
        </PortalCard>
        <Button
          className="h-11 w-full font-semibold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, var(--pr-primary), var(--pr-accent))` }}
          asChild
        >
          <a href={url} target="_blank" rel="noreferrer">
            Continue now
          </a>
        </Button>
      </div>
    </PortalShell>
  );
}
