import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
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
import {
  useAllLocations,
  useCloneLocation,
  useDeleteLocations,
  useLocations,
  useUpdateLocationStatus,
} from "@/hooks/useLocations";
import { locationService } from "@/services/location.service";
import type { Location, LocationListQuery, LocationStatus, SiteType } from "@/types/location";
import { SITE_TYPE_LABEL } from "@/types/location";
import {
  InternetStatusBadge,
  LocationStatusBadge,
  SiteTypeBadge,
  SubscriptionBadge,
} from "./LocationStatusBadge";
import { LocationWizard } from "./LocationWizard";
import { LocationCardView } from "./LocationCardView";
import { LocationMapView } from "./LocationMapView";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 20, 50];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toCsv(rows: Location[]) {
  const headers = [
    "ID", "Name", "Organization", "Site Type", "Country", "State", "City",
    "Address", "Timezone", "Routers", "Active Guests", "Internet Status",
    "Subscription Status", "Status", "Created",
  ];
  const lines = rows.map((r) =>
    [
      r.id, r.name, r.organizationName, r.siteType, r.country, r.state, r.city,
      r.address, r.timezone, r.routerCount, r.activeGuests, r.internetStatus,
      r.subscriptionStatus, r.status, r.createdAt,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

type ViewMode = "table" | "cards" | "map";

export function LocationTable() {
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LocationStatus | "all">("all");
  const [siteType, setSiteType] = useState<SiteType | "all">("all");
  const [organizationId, setOrganizationId] = useState<string | "all">("all");
  const [country, setCountry] = useState<string | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<keyof Location>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  const query: LocationListQuery = useMemo(
    () => ({ search, status, siteType, organizationId, country, page, pageSize, sortBy, sortDir }),
    [search, status, siteType, organizationId, country, page, pageSize, sortBy, sortDir],
  );

  const { data, isLoading, isError, refetch, isFetching } = useLocations(query);
  const { data: allRows } = useAllLocations();
  const updateStatus = useUpdateLocationStatus();
  const remove = useDeleteLocations();
  const clone = useCloneLocation();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const orgs = locationService.organizations();
  const countries = locationService.countries();

  function toggleSort(key: keyof Location) {
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
    a.download = `locations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  function bulk(action: "enable" | "disable" | "delete") {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (action === "delete") {
      setConfirm({
        title: `Delete ${ids.length} location${ids.length > 1 ? "s" : ""}?`,
        description: "This permanently removes the selected locations and their data.",
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Locations deleted");
          setSelected(new Set());
        },
      });
      return;
    }
    const newStatus: LocationStatus = action === "enable" ? "active" : "inactive";
    setConfirm({
      title: `${action === "enable" ? "Enable" : "Disable"} ${ids.length} location${ids.length > 1 ? "s" : ""}?`,
      description: `Selected locations will be marked as ${newStatus}.`,
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
              placeholder="Search by name, city, organization…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as LocationStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={siteType}
            onValueChange={(v) => {
              setSiteType(v as SiteType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Site type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(SITE_TYPE_LABEL) as SiteType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {SITE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={organizationId}
            onValueChange={(v) => {
              setOrganizationId(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={country}
            onValueChange={(v) => {
              setCountry(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5">
              <ViewToggle current={view} value="table" onClick={setView} icon={List} />
              <ViewToggle current={view} value="cards" onClick={setView} icon={LayoutGrid} />
              <ViewToggle current={view} value="map" onClick={setView} icon={MapIcon} />
            </div>
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
              <span className="ml-2">New location</span>
            </Button>
          </div>
        </div>

        {selectedCount > 0 && view === "table" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => bulk("enable")}>
                <PlayCircle className="h-4 w-4" />
                <span className="ml-2">Enable</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => bulk("disable")}>
                <PauseCircle className="h-4 w-4" />
                <span className="ml-2">Disable</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={() => bulk("delete")}>
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">Delete</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {view === "map" ? (
        isLoading ? (
          <Card className="p-4">
            <LoadingSkeleton rows={6} />
          </Card>
        ) : isError ? (
          <ErrorState title="Failed to load locations" onRetry={() => refetch()} />
        ) : (
          <LocationMapView rows={allRows ?? rows} />
        )
      ) : view === "cards" ? (
        isLoading ? (
          <Card className="p-4">
            <LoadingSkeleton rows={6} />
          </Card>
        ) : isError ? (
          <ErrorState title="Failed to load locations" onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No locations found"
            description="Try clearing filters or add your first location."
            action={{ label: "New location", onClick: () => setWizardOpen(true) }}
          />
        ) : (
          <>
            <LocationCardView rows={rows} />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              setPage={setPage}
              setPageSize={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </>
        )
      ) : (
        <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
          {isLoading ? (
            <div className="p-4">
              <LoadingSkeleton rows={8} />
            </div>
          ) : isError ? (
            <ErrorState title="Failed to load locations" onRetry={() => refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No locations found"
              description="Try clearing filters or add your first location."
              action={{ label: "New location", onClick: () => setWizardOpen(true) }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-10">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <SortableHead label="Location" k="name" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <TableHead>Owner / Customer</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Site type</TableHead>
                    <TableHead>City / Country</TableHead>
                    <TableHead>Timezone</TableHead>
                    <SortableHead label="Routers" k="routerCount" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableHead label="Guests" k="activeGuests" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <TableHead>Internet</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Status</TableHead>
                    <SortableHead label="Created" k="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <TableHead className="w-10 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleOne(r.id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/locations/$locationId"
                          params={{ locationId: r.id }}
                          className="group flex flex-col"
                        >
                          <span className="font-medium text-foreground group-hover:text-primary">{r.name}</span>
                          <span className="text-xs text-muted-foreground">{r.id}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.organizationName}</TableCell>
                      <TableCell>
                        <SiteTypeBadge type={r.siteType} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{r.city}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.state}, {r.country}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.timezone}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.routerCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.activeGuests.toLocaleString()}</TableCell>
                      <TableCell>
                        <InternetStatusBadge status={r.internetStatus} />
                      </TableCell>
                      <TableCell>
                        <SubscriptionBadge status={r.subscriptionStatus} />
                      </TableCell>
                      <TableCell>
                        <LocationStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <RowActions
                          location={r}
                          onAction={(a) => {
                            if (a === "enable" || a === "disable") {
                              updateStatus.mutate(
                                { ids: [r.id], status: a === "enable" ? "active" : "inactive" },
                                {
                                  onSuccess: () => toast.success(`${r.name} ${a}d`),
                                },
                              );
                            } else if (a === "delete") {
                              setConfirm({
                                title: `Delete ${r.name}?`,
                                description: "This action cannot be undone.",
                                destructive: true,
                                onConfirm: async () => {
                                  await remove.mutateAsync([r.id]);
                                  toast.success("Deleted");
                                },
                              });
                            } else if (a === "clone") {
                              clone.mutate(r.id, {
                                onSuccess: (loc) => toast.success(`Cloned as ${loc?.name}`),
                              });
                            } else if (a === "restart") {
                              toast.success("Restart command sent (placeholder)");
                            } else if (a === "download") {
                              toast.success("Configuration download queued (placeholder)");
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
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              setPage={setPage}
              setPageSize={(s) => {
                setPageSize(s);
                setPage(1);
              }}
              inline
            />
          )}
        </Card>
      )}

      <LocationWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel="Confirm"
        destructive={confirm?.destructive}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
      />
    </div>
  );
}

function ViewToggle({
  current,
  value,
  onClick,
  icon: Icon,
}: {
  current: ViewMode;
  value: ViewMode;
  onClick: (v: ViewMode) => void;
  icon: typeof List;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
      )}
      aria-label={`${value} view`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  setPage,
  setPageSize,
  inline,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  setPage: (p: number | ((p: number) => number)) => void;
  setPageSize: (s: number) => void;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-sm",
        inline ? "border-t border-border/70 px-4 py-3" : "rounded-2xl border border-border/70 bg-card px-4 py-3",
      )}
    >
      <div className="text-muted-foreground">
        Showing <span className="text-foreground">{(page - 1) * pageSize + 1}</span>–
        <span className="text-foreground">{Math.min(page * pageSize, total)}</span> of{" "}
        <span className="text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
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
  k: keyof Location;
  sortBy: keyof Location;
  sortDir: "asc" | "desc";
  onSort: (k: keyof Location) => void;
  align?: "right";
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
        {active && <span className="text-[10px]">{sortDir}</span>}
      </button>
    </TableHead>
  );
}

function RowActions({
  location,
  onAction,
}: {
  location: Location;
  onAction: (a: "enable" | "disable" | "delete" | "clone" | "restart" | "download") => void;
}) {
  const disabled =
    location.status === "inactive" || location.status === "suspended" || location.status === "offline";
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
          <Link to="/locations/$locationId" params={{ locationId: location.id }}>View details</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/locations/$locationId" params={{ locationId: location.id }} search={{ tab: "monitoring" }}>
            Open monitoring
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("clone")}>
          <Copy className="h-4 w-4" />
          <span className="ml-2">Clone location</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("restart")}>
          <Wrench className="h-4 w-4" />
          <span className="ml-2">Restart services</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction("download")}>
          <Download className="h-4 w-4" />
          <span className="ml-2">Download config</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {disabled ? (
          <DropdownMenuItem onClick={() => onAction("enable")}>
            <PlayCircle className="h-4 w-4" />
            <span className="ml-2">Enable</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("disable")}>
            <PauseCircle className="h-4 w-4" />
            <span className="ml-2">Disable</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete")}>
          <Trash2 className="h-4 w-4" />
          <span className="ml-2">Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
