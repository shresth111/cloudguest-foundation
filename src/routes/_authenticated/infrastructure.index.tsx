import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Activity, Server, Database, Cloud, ShieldCheck, GaugeCircle } from "lucide-react";
import { PageShell, SectionHeader, StatCard } from "@/components/ui-ext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { nasService } from "@/services/nas.service";
import { locationService } from "@/services/location.service";

export const Route = createFileRoute("/_authenticated/infrastructure/")({
  component: InfrastructurePage,
});

interface Component { name: string; status: "operational" | "degraded" | "down"; latency: string; icon: React.ComponentType<{ className?: string }>; }

const COMPONENTS: Component[] = [
  { name: "API Gateway", status: "operational", latency: "42 ms", icon: Cloud },
  { name: "Postgres Cluster", status: "operational", latency: "8 ms", icon: Database },
  { name: "Redis Cache", status: "operational", latency: "1 ms", icon: GaugeCircle },
  { name: "RADIUS Cluster", status: "degraded", latency: "112 ms", icon: ShieldCheck },
  { name: "WireGuard Concentrator", status: "operational", latency: "18 ms", icon: Server },
  { name: "Metrics Pipeline", status: "operational", latency: "27 ms", icon: Activity },
];

function InfrastructurePage() {
  const locations = useQuery({ queryKey: ["locations", "all"], queryFn: () => locationService.listAll() });
  const seedIds = useMemo(() => (locations.data ?? []).slice(0, 20).map((l) => l.id), [locations.data]);
  const nas = useQuery({
    queryKey: ["nas", "all", seedIds],
    queryFn: () => nasService.listAllNas(seedIds),
    enabled: seedIds.length > 0,
  });

  const total = nas.data?.length ?? 0;
  const online = nas.data?.filter((n) => n.status === "online").length ?? 0;
  const degraded = nas.data?.filter((n) => n.status === "degraded").length ?? 0;
  const offline = nas.data?.filter((n) => n.status === "offline").length ?? 0;

  return (
    <PageShell mesh>
      <SectionHeader
        eyebrow="Platform"
        title="Infrastructure"
        description="Real-time health of every CloudGuest control-plane component and the NAS fleet."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="NAS Online" value={online} tone="success" icon={Server} />
        <StatCard label="NAS Degraded" value={degraded} tone="warning" icon={Activity} />
        <StatCard label="NAS Offline" value={offline} tone="danger" icon={Server} />
        <StatCard label="Fleet Total" value={total} tone="info" icon={Cloud} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Control plane</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {COMPONENTS.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.name}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-primary" /> {c.name}
                  </CardTitle>
                  <Badge
                    variant={c.status === "operational" ? "default" : c.status === "degraded" ? "secondary" : "destructive"}
                  >
                    {c.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">Latency: {c.latency}</div>
                  <Progress
                    value={c.status === "operational" ? 96 : c.status === "degraded" ? 72 : 20}
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Regions</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { name: "ap-south-1 (Mumbai)", load: 62 },
            { name: "ap-southeast-1 (Singapore)", load: 41 },
            { name: "eu-central-1 (Frankfurt)", load: 28 },
          ].map((r) => (
            <Card key={r.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{r.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Utilisation</span>
                  <span>{r.load}%</span>
                </div>
                <Progress value={r.load} className="mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
