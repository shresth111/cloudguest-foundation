import { useState } from "react";
import { AlertTriangle, History, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/common/ErrorState";
import { relativeTime } from "@/lib/friendly";
import { HealthBadge } from "./MonitoringBadges";
import { useHealthDashboard, useHealthHistory, useRunHealthChecks } from "@/hooks/useMonitoring";
import { HEALTH_COMPONENT_LABEL, type HealthComponent } from "@/types/monitoring";
import type { AppError } from "@/services/api";

/**
 * How old the newest recorded check may be before this board stops presenting
 * itself as a current picture.
 *
 * There is nothing arbitrary to tune here against a schedule, because there is
 * no schedule: `GET /monitoring/health` is a pure read of the stored
 * `service_health` table (MonitoringService.get_dashboard_summary), and the
 * ONLY thing that ever writes that table is `POST /monitoring/health/run` --
 * the "Run health checks now" button below. No Celery beat entry, no cron, no
 * sweep task calls run_all_health_checks. So every row is exactly as old as
 * the last time a human clicked that button, and an hour is already long
 * enough that "currently healthy" is a claim this page cannot support.
 */
const HEALTH_STALE_AFTER_MS = 60 * 60_000;

/** The newest `lastCheckedAt` across every component, or null if nothing has
 * ever been checked. The board's age is the freshest row's age -- a single
 * component checked recently does not make the others current, but it does
 * mean a run happened, and the per-card timestamps carry the rest. */
function newestCheck(components: { lastCheckedAt: string | null }[]): number | null {
  const times = components
    .map((c) => (c.lastCheckedAt ? new Date(c.lastCheckedAt).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  return times.length ? Math.max(...times) : null;
}

function HistoryDialog({
  component,
  onClose,
}: {
  component: HealthComponent;
  onClose: () => void;
}) {
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
      {/* The board is a stored table, not a live probe, so its age is part of
          its meaning: without this, a two-day-old "Healthy" reads exactly like
          a "Healthy" from thirty seconds ago. Only shown once the data really
          is old -- a board refreshed a minute ago does not need explaining. */}
      {(() => {
        const newest = newestCheck(data.components);
        if (data.components.length === 0) return null;
        if (newest !== null && Date.now() - newest < HEALTH_STALE_AFTER_MS) return null;
        return (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {newest === null
                  ? "These components have never been checked."
                  : `Last checked ${relativeTime(new Date(newest).toISOString())}.`}
              </span>{" "}
              Health checks only run when someone runs them -- nothing refreshes this board on a
              schedule -- so the statuses below describe that moment, not right now.
            </p>
          </div>
        );
      })()}
      {data.components.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No health checks have been recorded yet -- run one now to populate this board with real
          component status.
        </div>
      )}
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
              {/* Relative first: a bare "02/09/2026, 17:31:46" is read as a
                  timestamp of something that just happened, which is how a
                  two-day-old check passed for a current one. The absolute time
                  stays on the title attribute for anyone who needs it -- and
                  it renders in the VIEWER's timezone, another reason not to
                  lead with it. */}
              <p
                className="text-xs text-muted-foreground"
                title={c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : undefined}
              >
                {c.lastCheckedAt ? `Checked ${relativeTime(c.lastCheckedAt)}` : "Never checked"}
              </p>
              {c.consecutiveFailureCount > 0 && (
                <p className="text-xs text-red-500">
                  {c.consecutiveFailureCount} consecutive failure
                  {c.consecutiveFailureCount === 1 ? "" : "s"}
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
