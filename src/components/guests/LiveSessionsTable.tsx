import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Ban,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MoreHorizontal,
  PowerOff,
  RefreshCw,
  Search,
  Users,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import {
  useBlockGuests,
  useDisconnectSessions,
  useExtendSession,
  useSessions,
} from "@/hooks/useGuests";
import { guestService } from "@/services/guest.service";
import type {
  DeviceType,
  GuestSession,
  GuestStatus,
  LoginMethod,
  SessionListQuery,
} from "@/types/guest";
import { DEVICE_TYPE_LABEL, LOGIN_METHOD_LABEL } from "@/types/guest";
import {
  DeviceTypeBadge,
  GuestStatusBadge,
  LoginMethodBadge,
  SignalIcon,
} from "./GuestBadges";

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

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}

function toCsv(rows: GuestSession[]): string {
  const headers = [
    "Guest",
    "Mobile",
    "Email",
    "Method",
    "Organization",
    "Location",
    "Router",
    "AP",
    "Device",
    "Type",
    "MAC",
    "IP",
    "Connected Since",
    "Duration (min)",
    "Download (MB)",
    "Upload (MB)",
    "Signal",
    "Status",
  ];
  const lines = rows.map((r) =>
    [
      r.guestName,
      r.mobile,
      r.email,
      r.loginMethod,
      r.organizationName,
      r.locationName,
      r.routerName,
      r.apName,
      r.deviceName,
      r.deviceType,
      r.macAddress,
      r.ipAddress,
      r.connectedSince,
      r.durationMinutes,
      r.downloadMb,
      r.uploadMb,
      r.signal,
      r.status,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function LiveSessionsTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<GuestStatus | "all">("all");
  const [loginMethod, setLoginMethod] = useState<LoginMethod | "all">("all");
  const [locationId, setLocationId] = useState<string | "all">("all");
  const [deviceType, setDeviceType] = useState<DeviceType | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<keyof GuestSession>("connectedSince");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    destructive?: boolean;
    onConfirm: () => void;
  }>(null);

  const query: SessionListQuery = useMemo(
    () => ({ search, status, loginMethod, locationId, deviceType, page, pageSize, sortBy, sortDir }),
    [search, status, loginMethod, locationId, deviceType, page, pageSize, sortBy, sortDir],
  );

  const { data, isLoading, isError, isFetching, refetch } = useSessions(query);
  const disconnect = useDisconnectSessions();
  const block = useBlockGuests();
  const extend = useExtendSession();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const locations = guestService.locations();

  function toggleSort(k: keyof GuestSession) {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("asc");
    }
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  function bulk(action: "disconnect" | "block") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "disconnect") {
      setConfirm({
        title: `Disconnect ${ids.length} session${ids.length > 1 ? "s" : ""}?`,
        description: "Selected users will be forced offline immediately.",
        destructive: true,
        onConfirm: async () => {
          await disconnect.mutateAsync(ids);
          toast.success("Sessions disconnected");
          setSelected(new Set());
        },
      });
      return;
    }
    const guestIds = Array.from(new Set(rows.filter((r) => ids.includes(r.id)).map((r) => r.guestId)));
    setConfirm({
      title: `Block ${guestIds.length} guest${guestIds.length > 1 ? "s" : ""}?`,
      description: "Selected guests will be added to the blacklist and disconnected.",
      destructive: true,
      onConfirm: async () => {
        await block.mutateAsync({ ids: guestIds, reason: "Bulk block from live sessions" });
        toast.success("Guests blocked");
        setSelected(new Set());
      },
    });
  }

  const selectedCount = selected.size;

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
              placeholder="Search guest, MAC, IP, email…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as GuestStatus | "all"); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={loginMethod} onValueChange={(v) => { setLoginMethod(v as LoginMethod | "all"); setPage(1); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {(Object.keys(LOGIN_METHOD_LABEL) as LoginMethod[]).map((m) => (
                <SelectItem key={m} value={m}>{LOGIN_METHOD_LABEL[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationId} onValueChange={(v) => { setLocationId(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={deviceType} onValueChange={(v) => { setDeviceType(v as DeviceType | "all"); setPage(1); }}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Device" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {(Object.keys(DEVICE_TYPE_LABEL) as DeviceType[]).map((d) => (
                <SelectItem key={d} value={d}>{DEVICE_TYPE_LABEL[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => bulk("disconnect")}>
                <PowerOff className="h-4 w-4" /><span className="ml-2">Disconnect</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulk("block")}>
                <Ban className="h-4 w-4" /><span className="ml-2">Block</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={8} /></div>
        ) : isError ? (
          <ErrorState title="Failed to load sessions" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No sessions found"
            description="Try clearing filters — live sessions will appear here as guests connect."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <SortableHead label="Guest" k="guestName" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <TableHead>Contact</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Location / Router</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>MAC / IP</TableHead>
                  <SortableHead label="Connected" k="connectedSince" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Duration" k="durationMinutes" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHead label="Down" k="downloadMb" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableHead label="Up" k="uploadMb" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <TableHead>Signal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                    </TableCell>
                    <TableCell>
                      <Link to="/guests/$guestId" params={{ guestId: r.guestId }} className="group flex flex-col">
                        <span className="font-medium group-hover:text-primary">{r.guestName}</span>
                        <span className="text-xs text-muted-foreground">{r.organizationName}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>{r.mobile}</span>
                        <span className="text-muted-foreground">{r.email}</span>
                      </div>
                    </TableCell>
                    <TableCell><LoginMethodBadge method={r.loginMethod} /></TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-medium text-foreground">{r.locationName}</span>
                        <span className="text-muted-foreground">{r.routerName} · {r.apName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{r.deviceName}</span>
                        <DeviceTypeBadge type={r.deviceType} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div>{r.macAddress}</div>
                      <div className="text-muted-foreground">{r.ipAddress}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTimeAgo(r.connectedSince)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDuration(r.durationMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMb(r.downloadMb)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMb(r.uploadMb)}</TableCell>
                    <TableCell><SignalIcon signal={r.signal} /></TableCell>
                    <TableCell><GuestStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        session={r}
                        onDisconnect={() =>
                          setConfirm({
                            title: `Disconnect ${r.guestName}?`,
                            description: "User will be forced offline immediately.",
                            destructive: true,
                            onConfirm: async () => {
                              await disconnect.mutateAsync([r.id]);
                              toast.success("Session disconnected");
                            },
                          })
                        }
                        onExtend={() =>
                          extend.mutate(
                            { id: r.id, minutes: 30 },
                            { onSuccess: () => toast.success("Session extended by 30 minutes") },
                          )
                        }
                        onBlock={() =>
                          setConfirm({
                            title: `Block ${r.guestName}?`,
                            description: "Guest will be added to the blacklist and disconnected.",
                            destructive: true,
                            onConfirm: async () => {
                              await block.mutateAsync({ ids: [r.guestId], reason: "Blocked from live sessions" });
                              toast.success("Guest blocked");
                            },
                          })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
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
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">Page {page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
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
    </div>
  );
}

function RowActions({
  session,
  onDisconnect,
  onExtend,
  onBlock,
}: {
  session: GuestSession;
  onDisconnect: () => void;
  onExtend: () => void;
  onBlock: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/guests/$guestId" params={{ guestId: session.guestId }}>View guest</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/guests/$guestId" params={{ guestId: session.guestId }} search={{ tab: "sessions" }}>
            View sessions
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExtend}>Extend session (+30m)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDisconnect}>
          <PowerOff className="h-4 w-4" /><span className="ml-2">Disconnect</span>
        </DropdownMenuItem>
        <DropdownMenuItem className={cn("text-destructive focus:text-destructive")} onClick={onBlock}>
          <Ban className="h-4 w-4" /><span className="ml-2">Block guest</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortableHead({
  label,
  k,
  sortBy,
  sortDir,
  onSort,
  align,
}: {
  label: string;
  k: keyof GuestSession;
  sortBy: keyof GuestSession;
  sortDir: "asc" | "desc";
  onSort: (k: keyof GuestSession) => void;
  align?: "right";
}) {
  const active = sortBy === k;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
      </button>
    </TableHead>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _users = Users;
