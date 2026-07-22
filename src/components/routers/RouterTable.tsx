import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Search,
  Trash2,
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
  useRouters,
  useUpdateRouterStatus,
} from "@/hooks/useRouters";
import { routerService } from "@/services/router.service";
import type { RouterDevice, RouterListQuery, RouterStatus } from "@/types/router";
import { RouterStatusBadge, HealthStatusBadge } from "./RouterStatusBadge";
import { RouterWizard } from "./RouterWizard";
import type { AppError } from "@/services/api";

const PAGE_SIZES = [10, 20, 50];

function relative(iso: string | null) {
  if (!iso) return "Never";
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
  const headers = ["ID", "Name", "Organization", "Location", "Model", "Serial", "MAC", "RouterOS", "Management IP", "Public IP", "Status", "Health", "Last Seen"];
  const lines = rows.map((r) =>
    [r.id, r.name, r.organizationName, r.locationName, r.model, r.serialNumber, r.macAddress, r.routerOsVersion ?? "", r.managementIpAddress ?? "", r.publicIpAddress ?? "", r.status, r.healthStatus ?? "unknown", r.lastSeenAt ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

export function RouterTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RouterStatus | "all">("all");
  const [organizationId, setOrganizationId] = useState<string | "all">("all");
  const [locationId, setLocationId] = useState<string | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  const query: RouterListQuery = useMemo(
    () => ({ search, status, organizationId, locationId, page, pageSize }),
    [search, status, organizationId, locationId, page, pageSize],
  );

  const { data, isLoading, isError, refetch, isFetching } = useRouters(query);
  const updateStatus = useUpdateRouterStatus();
  const remove = useDeleteRouters();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const { data: orgs = [] } = useQuery({
    queryKey: ["routers", "org-options"],
    queryFn: () => routerService.organizations(),
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["routers", "location-options"],
    queryFn: () => routerService.locations(),
  });

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

  function bulk(action: "enable" | "disable" | "delete") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "delete") {
      setConfirm({
        title: `Decommission ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
        description: "This decommissions the selected routers.",
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Routers decommissioned");
          setSelected(new Set());
        },
      });
      return;
    }
    const newStatus: RouterStatus = action === "enable" ? "online" : "suspended";
    setConfirm({
      title: `${action === "enable" ? "Reinstate" : "Suspend"} ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, serial, IP, location…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as RouterStatus | "all"); setPage(1); }}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending_provisioning">Pending Provisioning</SelectItem>
              <SelectItem value="provisioning">Provisioning</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="decommissioned">Decommissioned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={organizationId} onValueChange={(v) => { setOrganizationId(v); setLocationId("all"); setPage(1); }}>
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
              {locations
                .filter((l) => organizationId === "all" || l.organizationId === organizationId)
                .map((l) => (<SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>))}
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
                <PlayCircle className="h-4 w-4" /><span className="ml-2">Reinstate</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("disable")}>
                <PauseCircle className="h-4 w-4" /><span className="ml-2">Suspend</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulk("delete")}>
                <Trash2 className="h-4 w-4" /><span className="ml-2">Decommission</span>
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
            description="Try clearing filters or register your first router."
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
                  <TableHead>Router</TableHead>
                  <TableHead>Organization / Location</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>RouterOS</TableHead>
                  <TableHead>IPs</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
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
                        <span className="text-xs text-muted-foreground">SN {r.serialNumber}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="text-foreground">{r.organizationName}</div>
                      <div className="text-muted-foreground">{r.locationName}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.model}</TableCell>
                    <TableCell className="text-xs tabular-nums">{r.routerOsVersion ?? "—"}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <div>{r.publicIpAddress ?? "—"}</div>
                      <div className="text-muted-foreground">{r.managementIpAddress ?? "—"}</div>
                    </TableCell>
                    <TableCell><RouterStatusBadge status={r.status} /></TableCell>
                    <TableCell><HealthStatusBadge status={r.healthStatus} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{relative(r.lastSeenAt)}</TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        router={r}
                        onAction={(a) => {
                          if (a === "enable" || a === "disable") {
                            updateStatus.mutate(
                              { ids: [r.id], status: a === "enable" ? "online" : "suspended" },
                              {
                                onSuccess: () => toast.success(`${r.name} ${a === "enable" ? "reinstated" : "suspended"}`),
                                onError: (err) => toast.error((err as unknown as AppError).message || `Failed to ${a}`),
                              },
                            );
                          } else if (a === "delete") {
                            setConfirm({
                              title: `Decommission ${r.name}?`,
                              description: "This decommissions the router.",
                              destructive: true,
                              onConfirm: async () => {
                                await remove.mutateAsync([r.id]);
                                toast.success("Decommissioned");
                              },
                            });
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

function RowActions({
  router: r,
  onAction,
}: {
  router: RouterDevice;
  onAction: (a: "enable" | "disable" | "delete") => void;
}) {
  const disabled = r.status === "suspended" || r.status === "offline" || r.status === "decommissioned";
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
        <DropdownMenuSeparator />
        {disabled ? (
          <DropdownMenuItem onClick={() => onAction("enable")}>
            <PlayCircle className="h-4 w-4" /><span className="ml-2">Reinstate</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("disable")}>
            <PauseCircle className="h-4 w-4" /><span className="ml-2">Suspend</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete")}>
          <Trash2 className="h-4 w-4" /><span className="ml-2">Decommission</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
