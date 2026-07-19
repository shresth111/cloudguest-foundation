import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cpu, Gauge, HardDrive, Signal, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComingSoonPanel } from "@/components/ui-ext/ComingSoonPanel";
import { ErrorState } from "@/components/common/ErrorState";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { useNas, useRunNasOperation } from "@/hooks/useNas";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_authenticated/locations/$locationId/nas/$nasId")({
  component: NasDetailPage,
});

const TABS: Array<[string, string]> = [
  ["overview", "Overview"],
  ["interfaces", "Interfaces"],
  ["hotspot", "Hotspot"],
  ["radius", "FreeRADIUS"],
  ["wireguard", "WireGuard"],
  ["queues", "Queues"],
  ["firewall", "Firewall"],
  ["dhcp", "DHCP"],
  ["traffic", "Traffic"],
  ["logs", "Logs"],
  ["backup", "Backup"],
  ["terminal", "Terminal"],
  ["monitoring", "Monitoring"],
];

const OPS: Array<{ id: string; label: string; destructive?: boolean }> = [
  { id: "restart", label: "Restart" },
  { id: "backup", label: "Backup" },
  { id: "restore", label: "Restore" },
  { id: "export", label: "Export config" },
  { id: "push", label: "Push config" },
  { id: "terminal", label: "Open terminal" },
  { id: "upgrade", label: "Upgrade RouterOS" },
  { id: "factory_reset", label: "Factory reset", destructive: true },
  { id: "delete", label: "Delete", destructive: true },
];

const TONE: Record<string, string> = {
  online: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  degraded: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  offline: "border-rose-500/30 text-rose-600 dark:text-rose-400",
};

function NasDetailPage() {
  const { locationId, nasId } = Route.useParams();
  const navigate = useNavigate();
  const { data: nas, isLoading, isError, refetch } = useNas(locationId, nasId);
  const runOp = useRunNasOperation(locationId);
  const { role } = useAuth();
  const { routerActions } = usePermissions();
  const canWrite = role === "super_admin" || role === "org_admin";

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (!nas) return <ErrorState title="NAS not found" description="This device may have been removed." />;

  const opEnabled = (id: string) =>
    canWrite &&
    (routerActions?.[id as keyof typeof routerActions] ?? true);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/locations/$locationId"
          params={{ locationId }}
          search={{ tab: "nas" }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to location
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{nas.id}</h1>
          <Badge variant="outline" className={TONE[nas.status] ?? ""}>{nas.status}</Badge>
          <Badge variant="outline">{nas.model}</Badge>
          <Badge variant="outline" className="font-mono text-xs">RouterOS {nas.routerOsVersion}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {nas.routerIdentity} · Public {nas.publicIp} · Private {nas.privateIp}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
            {TABS.map(([k, l]) => (
              <TabsTrigger
                key={k}
                value={k}
                className="rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Signal} label="Traffic" value={`${nas.trafficMbps} Mbps`} />
            <StatCard icon={Users} label="Guests online" value={nas.guestsOnline.toLocaleString()} />
            <StatCard icon={Cpu} label="CPU" value={`${nas.cpuPct}%`} progress={nas.cpuPct} />
            <StatCard icon={HardDrive} label="RAM" value={`${nas.ramPct}%`} progress={nas.ramPct} />
            <StatCard icon={Gauge} label="Temp" value={`${nas.temperatureC}°C`} />
            <StatCard icon={Signal} label="Uptime" value={`${nas.uptimePct}%`} />
          </div>

          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4" /> Router operations
              </CardTitle>
              {!canWrite && <span className="text-xs text-muted-foreground">Read-only for your role</span>}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {OPS.map((op) => (
                <Button
                  key={op.id}
                  size="sm"
                  variant={op.destructive ? "destructive" : "outline"}
                  disabled={!opEnabled(op.id)}
                  onClick={async () => {
                    await runOp.mutateAsync({ nasId: nas.id, op: op.id });
                    toast.success(`${op.label} queued`);
                    if (op.id === "delete") navigate({ to: "/locations/$locationId", params: { locationId } });
                  }}
                >
                  {op.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {TABS.filter(([k]) => k !== "overview").map(([k, l]) => (
          <TabsContent key={k} value={k}>
            <ComingSoonPanel
              title={`${l} — ${nas.id}`}
              description={`${l} configuration for this NAS. Wiring to the live MikroTik feed will land next.`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  progress,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  progress?: number;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
        </div>
        {typeof progress === "number" && <Progress value={progress} className="h-1.5" />}
      </CardContent>
    </Card>
  );
}
