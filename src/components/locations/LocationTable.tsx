import { useMemo, useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
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
  useDeleteLocations,
  useLocations,
  useUpdateLocationStatus,
} from "@/hooks/useLocations";
import { locationService } from "@/services/location.service";
import type { Location, LocationListQuery, LocationStatus, PropertyType } from "@/types/location";
import { PROPERTY_TYPE_LABEL } from "@/types/location";
import { LocationStatusBadge, SiteTypeBadge } from "./LocationStatusBadge";
import { LocationWizard } from "./LocationWizard";
import { LocationCardView } from "./LocationCardView";
import { LocationMapView } from "./LocationMapView";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { Lock } from "lucide-react";
import type { AppError } from "@/services/api";

const PAGE_SIZES = [10, 20, 50];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toCsv(rows: Location[]) {
  const headers = ["ID", "Name", "Organization", "Property Type", "Country", "State", "City", "Address", "Timezone", "Status", "Created"];
  const lines = rows.map((r) =>
    [r.id, r.name, r.organizationName, r.propertyType ?? "", r.country, r.stateProvince, r.city, r.addressLine1, r.timezone, r.status, r.createdAt]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

type ViewMode = "table" | "cards" | "map";

export function LocationTable() {
  const { can } = usePermissions();
  const canDelete = can("location-master", "delete");
  const canExport = can("location-master", "export");
  const canEdit = can("location-master", "edit");
  const canCreate = can("location-master", "create");
  const [view, setView] = usePersistentState<ViewMode>("loc-master:view", "table");
  const [search, setSearch] = usePersistentState<string>("loc-master:search", "");
  const [status, setStatus] = usePersistentState<LocationStatus | "all">("loc-master:status", "all");
  const [propertyType, setPropertyType] = usePersistentState<PropertyType | "all">("loc-master:propertyType", "all");
  const [organizationId, setOrganizationId] = usePersistentState<string | "all">("loc-master:org", "all");
  const [country, setCountry] = usePersistentState<string | "all">("loc-master:country", "all");
  const [page, setPage] = usePersistentState<number>("loc-master:page", 1);
  const [pageSize, setPageSize] = usePersistentState<number>("loc-master:pageSize", 10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>(null);

  const query: LocationListQuery = useMemo(
    () => ({ search, status, propertyType, organizationId, country, page, pageSize }),
    [search, status, propertyType, organizationId, country, page, pageSize],
  );

  const { data, isLoading, isError, refetch, isFetching } = useLocations(query);
  const { data: allRows } = useAllLocations();
  const updateStatus = useUpdateLocationStatus();
  const remove = useDeleteLocations();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const { data: orgs = [] } = useQuery({
    queryKey: ["locations", "org-options"],
    queryFn: () => locationService.organizations(),
  });
  const countries = locationService.countries();

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
      if (!canDelete) {
        toast.error("Delete restricted. Contact your Administrator.");
        return;
      }
      setConfirm({
        title: `Archive ${ids.length} location${ids.length > 1 ? "s" : ""}?`,
        description: "This archives the selected locations.",
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Locations archived");
          setSelected(new Set());
        },
      });
      return;
    }
    if (!canEdit) {
      toast.error("Edit restricted. Contact your Administrator.");
      return;
    }
    const newStatus: LocationStatus = action === "enable" ? "active" : "suspended";
    setConfirm({
      title: `${action === "enable" ? "Activate" : "Suspend"} ${ids.length} location${ids.length > 1 ? "s" : ""}?`,
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
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={propertyType}
            onValueChange={(v) => {
              setPropertyType(v as PropertyType | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {PROPERTY_TYPE_LABEL[t]}
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
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!rows.length || !canExport}
              title={canExport ? undefined : "Export restricted. Contact your Administrator."}
            >
              {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Export</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setWizardOpen(true)}
              disabled={!canCreate}
              title={canCreate ? undefined : "Access restricted. Contact your Administrator."}
            >
              {canCreate ? <Plus className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span className="ml-2">New location</span>
            </Button>
          </div>
        </div>

        {selectedCount > 0 && view === "table" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-medium">{selectedCount} selected</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!canExport}
                title={canExport ? "Export selected rows" : "Export restricted. Contact your Administrator."}
              >
                {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="ml-2">Export</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulk("enable")}
                disabled={!canEdit}
                title={canEdit ? undefined : "Edit restricted. Contact your Administrator."}
              >
                {canEdit ? <PlayCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="ml-2">Activate</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulk("disable")}
                disabled={!canEdit}
                title={canEdit ? undefined : "Edit restricted. Contact your Administrator."}
              >
                {canEdit ? <PauseCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="ml-2">Suspend</span>
              </Button>
              <Button
                variant={canDelete ? "destructive" : "outline"}
                size="sm"
                onClick={() => bulk("delete")}
                disabled={!canDelete}
                title={canDelete ? undefined : "Delete restricted. Contact your Administrator."}
              >
                {canDelete ? <Trash2 className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="ml-2">Archive</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
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
                    <TableHead>Location</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Property type</TableHead>
                    <TableHead>City / Country</TableHead>
                    <TableHead>Timezone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
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
                          <span className="text-xs text-muted-foreground">{r.slug}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.organizationName}</TableCell>
                      <TableCell>
                        <SiteTypeBadge type={r.propertyType} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{r.city}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.stateProvince}, {r.country}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.timezone}</TableCell>
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
                                { ids: [r.id], status: a === "enable" ? "active" : "suspended" },
                                {
                                  onSuccess: () => toast.success(`${r.name} ${a === "enable" ? "activated" : "suspended"}`),
                                  onError: (err) => toast.error((err as unknown as AppError).message || `Failed to ${a}`),
                                },
                              );
                            } else if (a === "delete") {
                              setConfirm({
                                title: `Archive ${r.name}?`,
                                description: "This archives the location.",
                                destructive: true,
                                onConfirm: async () => {
                                  await remove.mutateAsync([r.id]);
                                  toast.success("Archived");
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

function RowActions({
  location,
  onAction,
}: {
  location: Location;
  onAction: (a: "enable" | "disable" | "delete") => void;
}) {
  const disabled = location.status === "suspended" || location.status === "inactive";
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
        <DropdownMenuSeparator />
        {disabled ? (
          <DropdownMenuItem onClick={() => onAction("enable")}>
            <PlayCircle className="h-4 w-4" />
            <span className="ml-2">Activate</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction("disable")}>
            <PauseCircle className="h-4 w-4" />
            <span className="ml-2">Suspend</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onAction("delete")}>
          <Trash2 className="h-4 w-4" />
          <span className="ml-2">Archive</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
