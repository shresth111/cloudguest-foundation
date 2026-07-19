import { Link } from "@tanstack/react-router";
import { Activity, Cpu, HardDrive, Plus, Router as RouterIcon, Signal, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { useLocationNas } from "@/hooks/useNas";
import { useAuth } from "@/context/AuthContext";

interface Props {
  locationId: string;
}

const STATUS_TONE: Record<string, string> = {
  online: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  degraded: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  offline: "border-rose-500/30 text-rose-600 dark:text-rose-400",
};

export function NasDevicesPanel({ locationId }: Props) {
  const { data, isLoading } = useLocationNas(locationId);
  const { role } = useAuth();
  const canRegister = role === "super_admin";

  if (isLoading) return <LoadingSkeleton rows={3} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={RouterIcon}
        title="No NAS registered"
        description="Register a NAS (MikroTik router) to start onboarding guests at this location."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">NAS devices</h3>
          <p className="text-sm text-muted-foreground">
            {data.length} device{data.length === 1 ? "" : "s"} registered at this location.
          </p>
        </div>
        {canRegister && (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            <span className="ml-2">Register NAS</span>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((n) => (
          <Card key={n.id} className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base leading-tight">{n.id}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.routerIdentity} · {n.model}</p>
                </div>
                <Badge variant="outline" className={STATUS_TONE[n.status] ?? ""}>{n.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Metric icon={Signal} label="Traffic" value={`${n.trafficMbps} Mbps`} />
                <Metric icon={Users} label="Guests" value={n.guestsOnline.toLocaleString()} />
                <Metric icon={Activity} label="Uptime" value={`${n.uptimePct}%`} />
              </div>
              <div className="space-y-2">
                <UsageRow icon={Cpu} label="CPU" value={n.cpuPct} />
                <UsageRow icon={HardDrive} label="RAM" value={n.ramPct} />
              </div>
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <span className="font-mono text-[11px] text-muted-foreground">RouterOS {n.routerOsVersion}</span>
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to="/locations/$locationId/nas/$nasId"
                    params={{ locationId, nasId: n.id }}
                  >
                    Open
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Signal; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function UsageRow({ icon: Icon, label, value }: { icon: typeof Cpu; label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" /> {label}
        </span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}
