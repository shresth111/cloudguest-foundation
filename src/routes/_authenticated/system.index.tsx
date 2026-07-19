import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, AlertOctagon, Activity } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/system/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/common/LoadingSkeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useServices, useSystemMetrics } from "@/hooks/useSystem";
import type { HealthStatus } from "@/services/system.service";

export const Route = createFileRoute("/_authenticated/system/")({
  component: SystemPage,
});

const ICONS: Record<HealthStatus, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  warning: AlertTriangle,
  critical: AlertOctagon,
};
const TONE: Record<HealthStatus, string> = {
  healthy: "text-emerald-500 bg-emerald-500/10",
  warning: "text-amber-500 bg-amber-500/10",
  critical: "text-rose-500 bg-rose-500/10",
};

function SystemPage() {
  const services = useServices();
  const metrics = useSystemMetrics();

  if (services.isLoading || metrics.isLoading) return <PageSkeleton />;
  if (services.isError || !services.data) return <ErrorState onRetry={() => services.refetch()} />;

  const healthy = services.data.filter((s) => s.status === "healthy").length;
  const warn = services.data.filter((s) => s.status === "warning").length;
  const crit = services.data.filter((s) => s.status === "critical").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Live status for platform services, workers, and infrastructure."
        actions={
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            All regions
          </Badge>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Healthy" value={healthy} tone="text-emerald-500" />
        <Stat label="Warnings" value={warn} tone="text-amber-500" />
        <Stat label="Critical" value={crit} tone="text-rose-500" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Services</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {services.data.map((s) => {
            const Icon = ICONS[s.status];
            return (
              <div key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-4">
                <div className={`grid h-9 w-9 place-items-center rounded-lg ${TONE[s.status]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.region} · v{s.version}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted px-2 py-1">
                      <span className="text-muted-foreground">Response</span>
                      <p className="mt-0.5 font-medium text-foreground">{s.responseMs} ms</p>
                    </div>
                    <div className="rounded-md bg-muted px-2 py-1">
                      <span className="text-muted-foreground">Uptime</span>
                      <p className="mt-0.5 font-medium text-foreground">{s.uptime}%</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {metrics.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />CPU · RAM · Disk (24h)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="cpu" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="ram" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="disk" stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Traffic & queues</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="queue" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Messaging throughput</CardTitle></CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="emails" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sms" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Errors</CardTitle></CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
