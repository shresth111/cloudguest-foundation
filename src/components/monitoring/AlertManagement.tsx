import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { SeverityBadge, AlertStatusBadge } from "./MonitoringBadges";
import {
  useAcknowledgeAlert,
  useAlerts,
  useOrgLocationLookup,
  useResolveAlert,
} from "@/hooks/useMonitoring";
import { ALERT_STATUS_TRANSITIONS, type AlertSeverity, type AlertStatus } from "@/types/monitoring";
import type { AppError } from "@/services/api";

const PAGE_SIZE = 25;

export function AlertManagement() {
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [status, setStatus] = useState<AlertStatus | "all">("all");
  const { orgName, locationName } = useOrgLocationLookup();

  const { data, isLoading, isError, refetch } = useAlerts({
    page,
    pageSize: PAGE_SIZE,
    severity: severity === "all" ? undefined : severity,
    status: status === "all" ? undefined : status,
  });
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();

  const alerts = data?.items ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Select
          value={severity}
          onValueChange={(v) => {
            setSeverity(v as AlertSeverity | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as AlertStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="triggered">Triggered</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {data ? `${data.totalItems} alert${data.totalItems === 1 ? "" : "s"}` : ""}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-6">
          <ErrorState onRetry={refetch} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-6">
          <EmptyState title="No alerts" description="All systems are operating within thresholds." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((a) => {
                const canAck = ALERT_STATUS_TRANSITIONS[a.status].includes("acknowledged");
                const canResolve = ALERT_STATUS_TRANSITIONS[a.status].includes("resolved");
                return (
                  <TableRow key={a.id}>
                    <TableCell className="max-w-xs">
                      <div className="truncate text-sm">{a.message}</div>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={a.severity} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {orgName(a.organizationId) ?? (a.organizationId ? a.organizationId.slice(0, 8) : "—")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {locationName(a.locationId) ?? (a.locationId ? a.locationId.slice(0, 8) : "—")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.triggeredAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <AlertStatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {canAck && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={acknowledge.isPending}
                            onClick={() =>
                              acknowledge.mutate(a.id, {
                                onSuccess: () => toast.success("Alert acknowledged"),
                                onError: (e) => toast.error((e as unknown as AppError).message),
                              })
                            }
                          >
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Acknowledge
                          </Button>
                        )}
                        {canResolve && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={resolve.isPending}
                            onClick={() =>
                              resolve.mutate(a.id, {
                                onSuccess: () => toast.success("Alert resolved"),
                                onError: (e) => toast.error((e as unknown as AppError).message),
                              })
                            }
                          >
                            <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Resolve
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {data && data.totalPages > 1 && (
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
  );
}
