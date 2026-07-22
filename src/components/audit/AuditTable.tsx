import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { useOrgLocationLookup } from "@/hooks/useMonitoring";
import { useAuditList, downloadAuditCsv } from "@/hooks/useAudit";
import type { AuditListQuery } from "@/types/audit";

type Filters = Omit<AuditListQuery, "page" | "pageSize">;

interface Props {
  filters: Filters;
}

export function AuditTable({ filters }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const q = useAuditList({ ...filters, page, pageSize });
  const { locationName } = useOrgLocationLookup();
  const [exporting, setExporting] = useState(false);

  const totalPages = q.data ? Math.max(1, q.data.totalPages) : 1;
  const rows = q.data?.rows ?? [];

  const doExport = async () => {
    setExporting(true);
    try {
      const { truncated } = await downloadAuditCsv(filters);
      toast.success(truncated ? "Export downloaded (capped at 10,000 rows)" : "Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {q.data ? (
            <>
              Showing{" "}
              <span className="font-medium text-foreground">{(page - 1) * pageSize + 1}</span>–
              <span className="font-medium text-foreground">
                {Math.min(page * pageSize, q.data.total)}
              </span>{" "}
              of
              <span className="ml-1 font-medium text-foreground">
                {q.data.total.toLocaleString()}
              </span>{" "}
              entries
            </>
          ) : (
            "Loading…"
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={doExport} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-4">
                    <LoadingSkeleton rows={pageSize} />
                  </TableCell>
                </TableRow>
              ) : q.isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-6">
                    <ErrorState onRetry={() => q.refetch()} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="p-6">
                    <EmptyState
                      title="No matching entries"
                      description="Adjust filters to see more results."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {r.action.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.entityType}
                      {r.entityId && <span className="font-mono"> · {r.entityId.slice(0, 8)}</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.actorUserId ? r.actorUserId.slice(0, 8) : "system"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {locationName(r.locationId) ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                      {r.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Page <span className="text-foreground">{page}</span> / {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
