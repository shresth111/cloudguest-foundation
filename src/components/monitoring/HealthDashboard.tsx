import { useState } from "react";
import { History, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/common/ErrorState";
import { HealthBadge } from "./MonitoringBadges";
import { useHealthDashboard, useHealthHistory, useRunHealthChecks } from "@/hooks/useMonitoring";
import { HEALTH_COMPONENT_LABEL, type HealthComponent } from "@/types/monitoring";
import type { AppError } from "@/services/api";

function HistoryDialog({ component, onClose }: { component: HealthComponent; onClose: () => void }) {
  const { data, isLoading } = useHealthHistory({ component, page: 1, pageSize: 25 });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{HEALTH_COMPONENT_LABEL[component]} check history</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checked at</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response time</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((h, i) => (
                  <TableRow key={`${h.checkedAt}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(h.checkedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <HealthBadge status={h.status} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {h.responseTimeMs !== null ? `${h.responseTimeMs.toFixed(0)} ms` : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {h.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.items ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No check history yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function HealthDashboard() {
  const { data, isLoading, isError, refetch } = useHealthDashboard();
  const runHealthChecks = useRunHealthChecks();
  const [historyFor, setHistoryFor] = useState<HealthComponent | null>(null);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Overall status</span>
          <HealthBadge status={data.overallStatus} />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={runHealthChecks.isPending}
          onClick={() =>
            runHealthChecks.mutate(undefined, {
              onSuccess: () => toast.success("Health checks executed"),
              onError: (e) => toast.error((e as unknown as AppError).message),
            })
          }
        >
          {runHealthChecks.isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="mr-2 h-3.5 w-3.5" />
          )}
          Run health checks now
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.components.map((c) => (
          <Card key={c.component}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>{HEALTH_COMPONENT_LABEL[c.component as HealthComponent] ?? c.component}</span>
                <HealthBadge status={c.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : "Never checked"}
              </p>
              {c.consecutiveFailureCount > 0 && (
                <p className="text-xs text-red-500">
                  {c.consecutiveFailureCount} consecutive failure{c.consecutiveFailureCount === 1 ? "" : "s"}
                </p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setHistoryFor(c.component as HealthComponent)}
              >
                <History className="mr-1.5 h-3 w-3" />
                View history
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {historyFor && <HistoryDialog component={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}
