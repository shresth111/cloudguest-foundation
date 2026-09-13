import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Search, Wifi } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { NumberedPagination } from "@/components/ui-ext";
import { useLiveSessions } from "@/hooks/useLiveSessions";
import { formatBytes } from "@/lib/analytics-format";
import { formatDuration } from "@/lib/device-liveness";

/**
 * Live session explorer — the real "who is online right now" feed.
 *
 * WHAT THIS USED TO DO
 * --------------------
 * It rendered 45 sessions built entirely in the browser: `ssid`, `router`,
 * `device`, `signal`, `sessionTime`, `download`, `upload`, `username`, `mac`
 * and `ip` were all `Math.random()`/index arithmetic under a heading that
 * read "Real-time view of all active guest sessions". Not one field came
 * from a request, and an operator reading a made-up SSID to a venue owner
 * on the phone was the reason it was caught.
 *
 * WHAT IT DOES NOW
 * ----------------
 * Calls the real `GET /sessions/live` (backend `app.domains.live_sessions`)
 * via `useLiveSessions`, org-scoped by the shared request interceptor.
 *
 * Columns are only the fields this fleet can honestly fill. Deliberately
 * ABSENT, per the backend schema's own docstring
 * (`live_sessions/schemas.py`) — none of these can be populated on the
 * session path here, so they are not shown rather than shown empty:
 *
 *   - SSID / signal   never observable on this wired-MikroTik fleet (no
 *                     radio); only ever seen per-device for wireless APs.
 *   - NAS             a RADIUS wire identifier, Master-console/backend-only,
 *                     never customer-facing.
 *   - Router name     only `router_id` is carried; name resolution is a
 *                     join owned by another branch.
 *   - Username        intentionally not the guest's phone/email (PII) — the
 *                     "Guest" column links to the guest record instead.
 */

const PAGE_SIZE = 25;

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : status === "paused" || status === "idle"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={tone}>
      {status}
    </Badge>
  );
}

export function LiveSessionExplorer() {
  const [status, setStatus] = useState<"active" | "all">("active");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const query = useLiveSessions({
    status,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = query.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/70 p-0.5">
            {(["active", "all"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "secondary" : "ghost"}
                className="h-8 px-3 capitalize"
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
              >
                {s === "active" ? "Active" : "All"}
              </Button>
            ))}
          </div>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Search by IP, MAC or identifier"
              className="pl-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={applySearch}>
            Search
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {data ? (
            <span className="ml-auto text-sm text-muted-foreground">
              {data.total.toLocaleString()} {status === "active" ? "active" : ""} session
              {data.total === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {query.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No sessions online right now"
            description={
              search
                ? "No active session matches your search."
                : "When guests are connected, their live sessions appear here."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>MAC</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Downloaded</TableHead>
                    <TableHead className="text-right">Uploaded</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        {s.guestId ? (
                          <Link
                            to="/guests/$guestId"
                            params={{ guestId: s.guestId }}
                            className="text-primary hover:underline"
                          >
                            View guest
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ip ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{s.mac ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatDuration(s.sessionTimeSeconds)}
                      </TableCell>
                      <TableCell className="text-right">{formatBytes(s.downloadBytes)}</TableCell>
                      <TableCell className="text-right">{formatBytes(s.uploadBytes)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.startedAt ? new Date(s.startedAt).toLocaleString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <NumberedPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
