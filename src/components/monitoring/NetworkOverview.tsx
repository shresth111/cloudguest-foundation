import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { HealthBadge } from "./MonitoringBadges";
import { useHealthDashboard } from "@/hooks/useMonitoring";
import { HEALTH_COMPONENT_LABEL, type HealthComponent } from "@/types/monitoring";

export function NetworkOverview() {
  const { data, isLoading, isError, refetch } = useHealthDashboard();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.components.map((c) => (
        <Card key={c.component}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span>{HEALTH_COMPONENT_LABEL[c.component as HealthComponent] ?? c.component}</span>
              <HealthBadge status={c.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {c.lastCheckedAt ? `Checked ${new Date(c.lastCheckedAt).toLocaleString()}` : "Never checked"}
            </p>
            {c.consecutiveFailureCount > 0 && (
              <p className="text-xs text-red-500">
                {c.consecutiveFailureCount} consecutive failure{c.consecutiveFailureCount === 1 ? "" : "s"}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
