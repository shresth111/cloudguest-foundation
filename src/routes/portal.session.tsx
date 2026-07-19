import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Laptop, LogOut } from "lucide-react";
import { PortalShell, PortalCard } from "@/components/portal-runtime/PortalShell";
import { Button } from "@/components/ui/button";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export const Route = createFileRoute("/portal/session")({
  component: SessionPage,
});

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function SessionPage() {
  const { t, session, setSession } = usePortalRuntime();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!session) {
      navigate({ to: "/portal/expired", replace: true });
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session, navigate]);

  if (!session) return null;
  const remainingMs = Math.max(0, session.expiresAt - now);
  const h = Math.floor(remainingMs / 3_600_000);
  const m = Math.floor((remainingMs % 3_600_000) / 60_000);
  const s = Math.floor((remainingMs % 60_000) / 1000);
  const usagePct = (session.bytesUsed / session.bytesLimit) * 100;

  return (
    <PortalShell>
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold">Session</h1>
          <p className="mt-1 text-sm text-white/60">Live usage for this device.</p>
        </div>
        <PortalCard className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50">{t("sessionRemaining")}</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">
              {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">{t("dataUsage")}</span>
              <span className="font-semibold">
                {formatBytes(session.bytesUsed)} / {formatBytes(session.bytesLimit)}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, usagePct)}%`,
                  background: `linear-gradient(90deg, var(--pr-primary), var(--pr-accent))`,
                }}
              />
            </div>
          </div>
        </PortalCard>
        <PortalCard>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <Laptop className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{session.device}</p>
              <p className="truncate text-xs text-white/60">
                {session.ipAddress} · {session.macAddress}
              </p>
            </div>
          </div>
        </PortalCard>
        <Button
          variant="outline"
          className="h-11 w-full border-white/15 bg-white/[0.06] text-white hover:bg-white/10 hover:text-white"
          onClick={() => { setSession(undefined); navigate({ to: "/portal/expired" }); }}
        >
          <LogOut className="me-2 h-4 w-4" /> {t("logout")}
        </Button>
      </div>
    </PortalShell>
  );
}
