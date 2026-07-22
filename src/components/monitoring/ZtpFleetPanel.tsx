import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { EmptyState } from "@/components/common/EmptyState";
import { LifecycleStageBadge } from "./MonitoringBadges";
import { useOrgLocationLookup, useZtpAnalytics, useZtpDashboard } from "@/hooks/useMonitoring";
import type { RouterLifecycleStage } from "@/types/monitoring";
import { Router as RouterIcon } from "lucide-react";

export function ZtpFleetPanel() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useZtpDashboard({ page, pageSize: 25 });
  const { data: analytics } = useZtpAnalytics({});
  const { orgName, locationName } = useOrgLocationLookup();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  const stages = Object.entries(data.stageCounts) as Array<[RouterLifecycleStage, number]>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {stages.map(([stage, count]) => (
          <div key={stage} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <LifecycleStageBadge stage={stage} />
            <span className="text-sm font-semibold tabular-nums">{count}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="text-xs text-muted-foreground">Pending enrollment</span>
          <span className="text-sm font-semibold tabular-nums">{data.pendingEnrollmentCount}</span>
        </div>
      </div>

      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Success rate</div>
              <div className="mt-1 text-2xl font-semibold">
                {analytics.successRatePercentage !== null
                  ? `${analytics.successRatePercentage.toFixed(1)}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {analytics.succeededJobCount}/{analytics.terminalJobCount} succeeded
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Avg activation time</div>
              <div className="mt-1 text-2xl font-semibold">
                {analytics.averageActivationSeconds !== null
                  ? `${Math.round(analytics.averageActivationSeconds / 60)}m`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                n={analytics.activationSampleSize}
              </div>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Failure breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {analytics.failureBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">No failures in range.</p>
              ) : (
                analytics.failureBreakdown.map((f) => (
                  <div key={f.jobType} className="flex items-center justify-between text-xs">
                    <span>{f.jobType}</span>
                    <span className="font-medium">{f.failureCount}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b p-3">
          <h4 className="text-sm font-semibold">Device fleet</h4>
        </div>
        {data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={RouterIcon} title="No devices" description="No routers enrolled yet." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.enrollmentId ?? r.routerId ?? r.serialNumber}>
                    <TableCell>
                      <div className="font-medium">{r.name ?? r.serialNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.model} · {r.serialNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LifecycleStageBadge stage={r.lifecycleStage} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {orgName(r.organizationId) ?? (r.organizationId ? r.organizationId.slice(0, 8) : "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {locationName(r.locationId) ?? (r.locationId ? r.locationId.slice(0, 8) : "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
                <span>
                  Page {data.page} of {data.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!data.hasPrevious} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={!data.hasNext} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
