import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { rbacService } from "@/services/rbac.service";

/** Real admin login-attempt history, via the same
 * `GET /controller-logs/authentication/admin` endpoint the RBAC console
 * already uses -- cross-linked here rather than rebuilt. */
export function LoginHistoryPanel() {
  const [email, setEmail] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const q = useQuery({
    queryKey: ["audit", "login-history", email, page],
    queryFn: () => rbacService.listLoginAttempts({ email: email || undefined, page, pageSize }),
  });

  const rows = q.data?.items ?? [];
  const totalPages = q.data ? Math.max(1, q.data.totalPages) : 1;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Filter by email…"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setPage(1);
        }}
        className="h-9 max-w-xs"
      />

      <div className="rounded-xl border border-border/60 bg-card/40">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Failure reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-4">
                    <LoadingSkeleton rows={pageSize} />
                  </TableCell>
                </TableRow>
              ) : q.isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6">
                    <ErrorState onRetry={() => q.refetch()} />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-6">
                    <EmptyState
                      title="No login attempts"
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
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell className="font-mono text-xs">{r.ipAddress}</TableCell>
                    <TableCell>
                      <Badge variant={r.success ? "default" : "destructive"}>
                        {r.success ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.failureReason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
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
