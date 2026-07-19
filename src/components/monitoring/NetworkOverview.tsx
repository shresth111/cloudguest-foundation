import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { HealthBadge } from "./MonitoringBadges";
import { useNetworkOverview } from "@/hooks/useMonitoring";

export function NetworkOverview() {
  const { data, isLoading, isError, refetch } = useNetworkOverview();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((n) => {
        const pct = Math.round((n.healthy / Math.max(1, n.total)) * 100);
        return (
          <Card key={n.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>{n.label}</span>
                <HealthBadge status={n.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold">{n.healthy}</span>
                <span className="text-sm text-muted-foreground">/ {n.total}</span>
              </div>
              <Progress value={pct} className="h-1.5" />
              <p className="text-xs text-muted-foreground">{n.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
