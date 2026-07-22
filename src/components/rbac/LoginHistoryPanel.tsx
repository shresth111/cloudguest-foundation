import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/common/ErrorState";
import { useLoginAttempts } from "@/hooks/useRbac";

const PAGE_SIZE = 25;

export function LoginHistoryPanel() {
  const [page, setPage] = useState(1);
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState<"all" | "true" | "false">("all");

  const { data, isLoading, isError, refetch } = useLoginAttempts({
    page,
    pageSize: PAGE_SIZE,
    email: email || undefined,
    success: success === "all" ? undefined : success === "true",
  });

  if (isError) return <ErrorState onRetry={refetch} />;

  const items = data?.items ?? [];

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="font-semibold">Login history</h3>
          <p className="text-xs text-muted-foreground">
            Real authentication attempts, platform-wide.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Filter by email…"
            className="max-w-xs"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={success}
            onValueChange={(v) => {
              setSuccess(v as typeof success);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="true">Success</SelectItem>
              <SelectItem value="false">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-start">Email</th>
                <th className="p-3 text-start">When</th>
                <th className="hidden p-3 text-start lg:table-cell">IP</th>
                <th className="hidden p-3 text-start lg:table-cell">User agent</th>
                <th className="p-3 text-start">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={5} className="p-3">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    No login attempts match your filters.
                  </td>
                </tr>
              ) : (
                items.map((e) => (
                  <tr key={e.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">{e.email}</td>
                    <td className="p-3 text-xs">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="hidden p-3 text-xs lg:table-cell">{e.ipAddress}</td>
                    <td className="hidden max-w-xs truncate p-3 text-xs text-muted-foreground lg:table-cell">
                      {e.userAgent ?? "—"}
                    </td>
                    <td className="p-3">
                      {e.success ? (
                        <Badge className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" /> {e.failureReason ?? "Failed"}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Page {data.page} of {data.totalPages} · {data.totalItems} attempts
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
