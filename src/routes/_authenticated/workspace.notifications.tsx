import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useWorkspace } from "@/context/WorkspaceContext";
import { monitoringService } from "@/services/monitoring.service";
import type { AlertSeverity } from "@/types/monitoring";

export const Route = createFileRoute("/_authenticated/workspace/notifications")({
  component: NotificationsPage,
});

const SEVERITY_ICON: Record<AlertSeverity, typeof Info> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  critical: "text-destructive",
  warning: "text-amber-600",
  info: "text-blue-600",
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function NotificationsPage() {
  const { customer, activeLocationId } = useWorkspace();
  const organizationId = customer?.organizationId;

  const alertsQ = useQuery({
    queryKey: ["workspace", "notifications", organizationId],
    queryFn: () => monitoringService.listAlerts({ organizationId, page: 1, pageSize: 100 }),
    enabled: !!organizationId,
  });

  const alerts = (alertsQ.data?.items ?? [])
    .filter((a) => activeLocationId === "all" || a.locationId === activeLocationId)
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Alerts raised for your locations, most recent first.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {alertsQ.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))
          ) : alertsQ.isError ? (
            <ErrorState onRetry={() => alertsQ.refetch()} />
          ) : alerts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing to report — no alerts have been raised for your locations.
            </p>
          ) : (
            alerts.map((a) => {
              const Icon = SEVERITY_ICON[a.severity] ?? Info;
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-md border p-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${SEVERITY_TONE[a.severity] ?? ""}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.message}</p>
                    <p className="text-xs text-muted-foreground">{relativeTime(a.triggeredAt)}</p>
                  </div>
                  <Badge variant={a.status === "resolved" ? "outline" : "secondary"}>
                    {a.status === "triggered"
                      ? "Open"
                      : a.status === "acknowledged"
                        ? "Acknowledged"
                        : "Resolved"}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
