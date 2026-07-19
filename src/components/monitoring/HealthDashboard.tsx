import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useServiceHealth } from "@/hooks/useMonitoring";
import { HealthBadge } from "./MonitoringBadges";

export function HealthDashboard() {
  const { data, isLoading, isError, refetch } = useServiceHealth();
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((s) => (
        <Card key={s.key}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>{s.label}</span>
              <HealthBadge status={s.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold">{s.uptime.toFixed(2)}%</span>
              <span className="text-xs text-muted-foreground">uptime</span>
            </div>
            <Progress value={s.uptime} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Latency</span>
              <span className="tabular-nums">{s.latencyMs} ms</span>
            </div>
            <p className="text-xs text-muted-foreground">{s.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
