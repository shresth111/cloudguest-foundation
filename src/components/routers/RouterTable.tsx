import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  PowerOff,
  RefreshCw,
  RotateCw,
  Router as RouterIcon,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  useDeleteRouters,
  useRebootRouters,
  useRouters,
  useUpdateRouterStatus,
  useUpgradeRouters,
} from "@/hooks/useRouters";
import { routerService } from "@/services/router.service";
import type { RouterDevice, RouterListQuery, RouterStatus } from "@/types/router";
import { RouterStatusBadge, ServiceStatusBadge, TunnelStatusBadge } from "./RouterStatusBadge";
import { RouterWizard } from "./RouterWizard";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50];

function formatUptime(hours: number) {
  if (!hours) return "—";
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return `${d}d ${h}h`;
}

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function toCsv(rows: RouterDevice[]) {
  const headers = [
    "ID", "Name", "MikroTik ID", "NAS ID", "Organization", "Location", "Model",
    "Serial", "RouterOS", "Public IP", "Private IP", "WireGuard", "RADIUS",
    "Internet", "Uptime (h)", "CPU %", "RAM %", "Guests", "Status", "Last Seen",
  ];
  const lines = rows.map((r) =>
    [
      r.id, r.name, r.mikrotikIdentity, r.nasId, r.organizationName, r.locationName,
      r.model, r.serialNumber, r.routerOsVersion, r.publicIp, r.privateIp,
      r.wireguardStatus, r.radiusStatus, r.internetStatus, r.uptimeHours,
      r.cpuPct, r.ramPct, r.activeGuests, r.status, r.lastSeen,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function UsageBar({ pct, tone }: { pct: number; tone?: "cpu" | "ram" }) {
  const color = pct > 85 ? "bg-rose-500" : pct > 65 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function RouterTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RouterStatus | "all">("all");
  const [organizationId, setOrganizationId] = useState<string | "all">("all");
  const [locationId, setLocationId] = useState<string | "all">("all");
  const [model, setModel] = useState<string | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<keyof RouterDevice>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  const query: RouterListQuery = useMemo(
    () => ({ search, status, organizationId, locationId, model, page, pageSize, sortBy, sortDir }),
    [search, status, organizationId, locationId, model, page, pageSize, sortBy, sortDir],
  );

  const { data, isLoading, isError, refetch, isFetching } = useRouters(query);
  const updateStatus = useUpdateRouterStatus();
  const remove = useDeleteRouters();
  const reboot = useRebootRouters();
  const upgrade = useUpgradeRouters();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const orgs = routerService.organizations();
  const locations = routerService.locations();
  const models = routerService.models();

  function toggleSort(key: keyof RouterDevice) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
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
    a.download = `routers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  function bulk(action: "enable" | "disable" | "delete" | "reboot" | "upgrade") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "delete") {
      setConfirm({
        title: `Delete ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
        description: "This permanently removes the selected routers and their configuration.",
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Routers deleted");
          setSelected(new Set());
        },
      });
      return;
    }
    if (action === "reboot") {
      setConfirm({
        title: `Reboot ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
        description: "Routers will be unreachable for ~2 minutes.",
        onConfirm: async () => {
          await reboot.mutateAsync(ids);
          toast.success("Reboot commands sent");
          setSelected(new Set());
        },
      });
      return;
    }
    if (action === "upgrade") {
      setConfirm({
        title: `Upgrade firmware on ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
        description: "Selected routers will be upgraded to the latest RouterOS release.",
        onConfirm: async () => {
          await upgrade.mutateAsync(ids);
          toast.success("Firmware upgrade queued");
          setSelected(new Set());
        },
      });
      return;
    }
    const newStatus: RouterStatus = action === "enable" ? "online" : "suspended";
    setConfirm({
      title: `${action === "enable" ? "Enable" : "Disable"} ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
      description: `Selected routers will be marked as ${newStatus}.`,
      onConfirm: async () => {
        await updateStatus.mutateAsync({ ids, status: newStatus });
        toast.success(`Marked as ${newStatus}`);
        setSelected(new Set());
      },
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, ID, IP, MikroTik identity…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as RouterStatus | "all"); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="provisioning">Provisioning</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={organizationId} onValueChange={(v) => { setOrganizationId(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Organization" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={locationId} onValueChange={(v) => { setLocationId(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={model} onValueChange={(v) => { setModel(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {models.map((m) => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
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
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-2">Add router</span>
            </Button>
          </div>
        </div>

        {selectedCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => bulk("enable")}>
                <PlayCircle className="h-4 w-4" /><span className="ml-2">Enable</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("disable")}>
                <PauseCircle className="h-4 w-4" /><span className="ml-2">Suspend</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("reboot")}>
                <RotateCw className="h-4 w-4" /><span className="ml-2">Reboot</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("upgrade")}>
                <UploadCloud className="h-4 w-4" /><span className="ml-2">Upgrade</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulk("delete")}>
                <Trash2 className="h-4 w-4" /><span className="ml-2">Delete</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4"><LoadingSkeleton rows={8} /></div>
        ) : isError ? (
          <ErrorState title="Failed to load routers" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={RouterIcon}
            title="No routers found"
            description="Try clearing filters or provision your first router."
            action={{ label: "Add router", onClick: () => setWizardOpen(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                  </TableHead>
                  <SortableHead label="Router" k="name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <TableHead>MikroTik / NAS</TableHead>
                  <TableHead>Organization / Location</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>RouterOS</TableHead>
                  <TableHead>IPs</TableHead>
                  <TableHead>WireGuard</TableHead>
                  <TableHead>RADIUS</TableHead>
                  <SortableHead label="Uptime" k="uptimeHours" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="CPU" k="cpuPct" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="RAM" k="ramPct" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableHead label="Guests" k="activeGuests" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="w-10 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} aria-label={`Select ${r.name}`} />
                    </TableCell>
                    <TableCell>
                      <Link to="/routers/$routerId" params={{ routerId: r.id }} className="group flex flex-col">
                        <span className="font-medium text-foreground group-hover:text-primary">{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.id} · SN {r.serialNumber}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium text-foreground">{r.mikrotikIdentity}</div>
                      <div className="text-muted-foreground">{r.nasId}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="text-foreground">{r.organizationName}</div>
                      <div className="text-muted-foreground">{r.locationName}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.model}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <div>{r.routerOsVersion}</div>
                      {r.routerOsVersion !== r.latestOsVersion && (
                        <div className="text-[10px] text-amber-500">→ {r.latestOsVersion}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <div>{r.publicIp}</div>
                      <div className="text-muted-foreground">{r.privateIp}</div>
                    </TableCell>
                    <TableCell><TunnelStatusBadge status={r.wireguardStatus} /></TableCell>
                    <TableCell><ServiceStatusBadge status={r.radiusStatus} /></TableCell>
                    <TableCell className="text-xs tabular-nums">{formatUptime(r.uptimeHours)}</TableCell>
                    <TableCell><UsageBar pct={r.cpuPct} /></TableCell>
                    <TableCell><UsageBar pct={r.ramPct} /></TableCell>
                    <TableCell className="text-right tabular-nums">{r.activeGuests}</TableCell>
                    <TableCell><RouterStatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relative(r.lastSeen)}</TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        router={r}
                        onAction={(a) => {
                          if (a === "enable" || a === "disable") {
                            updateStatus.mutate(
                              { ids: [r.id], status: a === "enable" ? "online" : "suspended" },
                              { onSuccess: () => toast.success(`${r.name} ${a}d`) },
                            );
                          } else if (a === "delete") {
                            setConfirm({
                              title: `Delete ${r.name}?`,
                              description: "This action cannot be undone.",
                              destructive: true,
                              onConfirm: async () => {
                                await remove.mutateAsync([r.id]);
                                toast.success("Router deleted");
                              },
                            });
                          } else if (a === "reboot") {
                            setConfirm({
                              title: `Reboot ${r.name}?`,
                              description: "Router will be unreachable for ~2 minutes.",
                              onConfirm: async () => {
                                await reboot.mutateAsync([r.id]);
                                toast.success("Reboot command sent");
                              },
                            });
                          } else if (a === "upgrade") {
                            upgrade.mutate([r.id], { onSuccess: () => toast.success("Firmware upgrade queued") });
                          } else if (a === "backup") {
                            toast.success("Configuration backup queued (placeholder)");
                          } else if (a === "sync") {
                            toast.success("Configuration sync started (placeholder)");
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {rows.length > 0 && (
          <Pagination
            page={page} pageSize={pageSize} total={total} totalPages={totalPages}
            setPage={setPage}
            setPageSize={(s) => { setPageSize(s); setPage(1); }}
          />
        )}
      </Card>

      <RouterWizard open={wizardOpen} onOpenChange={setWizardOpen} />
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

function Pagination({
  page, pageSize, total, totalPages, setPage, setPageSize,
}: {
  page: number; pageSize: number; total: number; totalPages: number;
  setPage: (p: number | ((p: number) => number)) => void;
  setPageSize: (s: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-sm">
      <div className="text-muted-foreground">
        Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
        <span className="text-foreground">{Math.min(page * pageSize, total)}</span> of{" "}
        <span className="text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (<SelectItem key={s} value={String(s)}>{s}</SelectItem>))}
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
  );
}

function SortableHead({
  label, k, sortBy, sortDir, onSort, align,
}: {
  label: string; k: keyof RouterDevice;
  sortBy: keyof RouterDevice; sortDir: "asc" | "desc";
  onSort: (k: keyof RouterDevice) => void; align?: "right";
}) {
  const active = sortBy === k;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
      </button>
    </TableHead>
  );
}

function RowActions({
  router: r,
  onAction,
}: {
  router: RouterDevice;
  onAction: (a: "enable" | "disable" | "delete" | "reboot" | "upgrade" | "backup" | "sync") => void;
}) {
  const disabled = r.status === "suspended" || r.status === "offline" || r.status === "error";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/routers/$routerId" params={{ routerId: r.id }}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/routers/$routerId" params={{ routerId: r.id }} search={{ tab: "monitoring" }}>
            Open monitoring
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("reboot")}>
          <RotateCw className="h-4 w-4" /><span className="ml-2">Reboot</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("sync")}>
          <RefreshCw className="h-4 w-4" /><span className="ml-2">Sync configuration</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("backup")}>
          <Download className="h-4 w-4" /><span className="ml-2">Backup configuration</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("upgrade")}>
          <UploadCloud className="h-4 w-4" /><span className="ml-2">Upgrade firmware</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {disabled ? (
          <DropdownMenuItem onClick={() => onAction("enable")}>
            <PlayCircle className="h-4 w-4" /><span className="ml-2">Enable</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("disable")}>
            <PowerOff className="h-4 w-4" /><span className="ml-2">Suspend</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete")}>
          <Trash2 className="h-4 w-4" /><span className="ml-2">Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
