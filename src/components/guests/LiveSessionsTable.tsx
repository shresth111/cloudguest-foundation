import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  PowerOff,
  RefreshCw,
  Search,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import {
  useDisconnectSession,
  useExtendSession,
  usePauseSession,
  useResumeSession,
  useSessions,
  useTerminateSession,
} from "@/hooks/useGuests";
import { guestService } from "@/services/guest.service";
import type { GuestSession, GuestSessionStatus, SessionListQuery } from "@/types/guest";
import type { AppError } from "@/services/api";
import { GuestAuthMethodBadge, GuestSessionStatusBadge } from "./GuestBadges";

const PAGE_SIZES = [10, 20, 50];

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024).toFixed(0)} KB`;
}

function toCsv(rows: GuestSession[]): string {
  const headers = [
    "Guest",
    "Organization",
    "Location",
    "Router",
    "Auth method",
    "IP",
    "Started",
    "Last activity",
    "Bytes up",
    "Bytes down",
    "Status",
  ];
  const lines = rows.map((r) =>
    [
      r.guestId,
      r.organizationName,
      r.locationName,
      r.routerName,
      r.authMethod,
      r.ipAddress ?? "",
      r.startedAt,
      r.lastActivityAt,
      r.bytesUploaded,
      r.bytesDownloaded,
      r.status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function LiveSessionsTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<GuestSessionStatus | "all">("all");
  const [locationId, setLocationId] = useState<string | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);
  const [reasonDialog, setReasonDialog] = useState<null | {
    title: string;
    onConfirm: (reason: string) => void;
  }>(null);
  const [reason, setReason] = useState("");

  const query: SessionListQuery = useMemo(
    () => ({ search, status, locationId, page, pageSize }),
    [search, status, locationId, page, pageSize],
  );

  const { data, isLoading, isError, isFetching, refetch } = useSessions(query);
  const disconnect = useDisconnectSession();
  const terminate = useTerminateSession();
  const pause = usePauseSession();
  const resume = useResumeSession();
  const extend = useExtendSession();

  const { data: locations = [] } = useQuery({
    queryKey: ["guests", "location-options"],
    queryFn: () => guestService.locations(),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function exportCsv() {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `guest-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} sessions`);
  }

  async function withReasonToast(action: () => Promise<void>, ok: string, err: string) {
    try {
      await action();
      toast.success(ok);
    } catch (e) {
      toast.error((e as AppError).message || err);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search IP, location…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as GuestSessionStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="disconnected">Disconnected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={locationId}
            onValueChange={(v) => {
              setLocationId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} />
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load sessions" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No sessions found"
            description="Try clearing filters — sessions appear here once guests authenticate."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Guest</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Location / Router</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Down</TableHead>
                  <TableHead className="text-right">Up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const canPauseOrTerminate = r.status === "active";
                  const canResume = r.status === "paused";
                  return (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Link
                          to="/guests/$guestId"
                          params={{ guestId: r.guestId }}
                          className="group flex flex-col"
                        >
                          <span className="font-medium group-hover:text-primary">
                            {r.guestId.slice(0, 8)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.organizationName}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <GuestAuthMethodBadge method={r.authMethod} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-foreground">{r.locationName}</span>
                          <Link
                            to="/routers/$routerId"
                            params={{ routerId: r.routerId }}
                            className="text-muted-foreground hover:text-primary"
                          >
                            View router
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.ipAddress ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTimeAgo(r.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTimeAgo(r.lastActivityAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBytes(r.bytesDownloaded)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatBytes(r.bytesUploaded)}
                      </TableCell>
                      <TableCell>
                        <GuestSessionStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link to="/guests/$guestId" params={{ guestId: r.guestId }}>
                                View guest
                              </Link>
                            </DropdownMenuItem>
                            {canPauseOrTerminate && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    extend.mutate(
                                      { sessionId: r.id, additionalMinutes: 30 },
                                      {
                                        onSuccess: () =>
                                          toast.success("Session extended by 30 minutes"),
                                        onError: (e) =>
                                          toast.error(
                                            (e as unknown as AppError).message ||
                                              "Failed to extend",
                                          ),
                                      },
                                    )
                                  }
                                >
                                  <Clock className="h-4 w-4" />
                                  <span className="ml-2">Extend (+30m)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setReasonDialog({
                                      title: "Pause session",
                                      onConfirm: (reasonText) =>
                                        withReasonToast(
                                          () =>
                                            pause.mutateAsync({
                                              sessionId: r.id,
                                              reason: reasonText,
                                            }),
                                          "Session paused",
                                          "Failed to pause session",
                                        ),
                                    })
                                  }
                                >
                                  <Pause className="h-4 w-4" />
                                  <span className="ml-2">Pause</span>
                                </DropdownMenuItem>
                              </>
                            )}
                            {canResume && (
                              <DropdownMenuItem
                                onClick={() =>
                                  resume.mutate(r.id, {
                                    onSuccess: () => toast.success("Session resumed"),
                                    onError: (e) =>
                                      toast.error(
                                        (e as unknown as AppError).message || "Failed to resume",
                                      ),
                                  })
                                }
                              >
                                <Play className="h-4 w-4" />
                                <span className="ml-2">Resume</span>
                              </DropdownMenuItem>
                            )}
                            {(canPauseOrTerminate || canResume) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setReasonDialog({
                                      title: "Disconnect session",
                                      onConfirm: (reasonText) =>
                                        withReasonToast(
                                          () =>
                                            disconnect.mutateAsync({
                                              sessionId: r.id,
                                              reason: reasonText,
                                            }),
                                          "Session disconnected",
                                          "Failed to disconnect",
                                        ),
                                    })
                                  }
                                >
                                  <PowerOff className="h-4 w-4" />
                                  <span className="ml-2">Disconnect</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    setConfirm({
                                      title: "Terminate session?",
                                      description:
                                        "Punitive — imposes a 60-minute reconnect cooldown for this guest.",
                                      destructive: true,
                                      onConfirm: () =>
                                        withReasonToast(
                                          () => terminate.mutateAsync({ sessionId: r.id }),
                                          "Session terminated",
                                          "Failed to terminate",
                                        ),
                                    })
                                  }
                                >
                                  <Ban className="h-4 w-4" />
                                  <span className="ml-2">Terminate</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-sm">
            <div className="text-muted-foreground">
              Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
              <span className="text-foreground">{Math.min(page * pageSize, total)}</span> of{" "}
              <span className="text-foreground">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />

      <Dialog
        open={!!reasonDialog}
        onOpenChange={(o) => {
          if (!o) {
            setReasonDialog(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonDialog?.title}</DialogTitle>
            <DialogDescription>Optional — recorded on the session record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="session-reason">Reason (optional)</Label>
            <Input id="session-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                reasonDialog?.onConfirm(reason || "");
                setReasonDialog(null);
                setReason("");
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
