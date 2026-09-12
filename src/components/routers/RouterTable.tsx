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
import { useDeleteRouters, useRouters, useUpdateRouterStatus } from "@/hooks/useRouters";
import { routerService } from "@/services/router.service";
import type { RouterDevice, RouterListQuery, RouterStatus } from "@/types/router";
import {
  RouterStatusBadge,
  HealthStatusBadge,
  MissingCredentialsBadge,
  ControllerManagedBadge,
} from "./RouterStatusBadge";
import { isControllerManaged, routerVendorLabel } from "@/lib/router-vendors";
import {
  canDecommissionRouter,
  canReinstateRouter,
  canSuspendRouter,
  routerToggleUnavailableReason,
  REINSTATE_TARGET_STATUS,
  SUSPEND_TARGET_STATUS,
} from "@/lib/router-actions";
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

/**
 * The export, and why it repeats the table's vendor substitutions instead
 * of dumping the wire values.
 *
 * Contract §11.5 was applied to the four cells below on screen -- RouterOS,
 * Status, Health, Last seen -- and not here, so the file an operator
 * downloads undid every one of them. A working Omada controller exported as
 * `pending_provisioning` / `unknown` / an empty Last Seen: the exact
 * "working venue described as a broken router" this table was fixed to stop
 * saying, in the artefact that outlives the screen and gets mailed to
 * people who never saw it.
 *
 * The four substitutions are the SAME strings the cells render, so a row
 * read off the screen and the same row read out of the file cannot
 * disagree. An agent-managed row's thirteen values are byte-for-byte what
 * they were before this function learned about vendors -- the only branch
 * is `isControllerManaged`, and a MikroTik never enters it.
 */
function toCsv(rows: RouterDevice[]) {
  const headers = [
    "ID",
    "Name",
    "Organization",
    "Location",
    "Model",
    "Serial",
    "MAC",
    "RouterOS",
    "Management IP",
    "Public IP",
    "Status",
    "Health",
    "Last Seen",
  ];
  const lines = rows.map((r) => {
    const controller = isControllerManaged(r.vendor);
    return [
      r.id,
      r.name,
      r.organizationName,
      r.locationName,
      r.model,
      r.serialNumber,
      r.macAddress,
      // Matches the RouterOS cell: a controller does not run it at all,
      // which is a different fact from "no version on file".
      controller ? "Not applicable" : (r.routerOsVersion ?? ""),
      r.managementIpAddress ?? "",
      r.publicIpAddress ?? "",
      // Matches the Status cell, which renders `ControllerManagedBadge`
      // (the vendor label) in place of the stored enum. A controller sits
      // at `pending_provisioning` forever because nothing provisions it.
      controller ? routerVendorLabel(r.vendor) : r.status,
      // Matches the Health cell. `healthStatus` is written by the health
      // checker, which talks to the agent; even "unknown" implies somebody
      // looked.
      controller ? "Not measured here" : (r.healthStatus ?? "unknown"),
      // Matches the Last seen cell. An empty cell reads as "never seen",
      // which is a measurement claim nobody made.
      controller ? "Not measured here" : (r.lastSeenAt ?? ""),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
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

  /**
   * The selected routers that can actually accept `action`.
   *
   * The bulk bar had the same defect as the row menu, and it mattered more:
   * it applied to whatever was ticked, with no status check at all, so one
   * checkbox on a `pending_provisioning` router was enough to post a
   * transition the backend refuses -- and `updateStatus` is a single call
   * for every id, so the rejection took the whole batch with it. Selecting
   * "all" on a page with one un-provisioned router meant nothing happened,
   * with an error that named none of them.
   */
  function eligibleFor(action: "enable" | "disable" | "delete"): string[] {
    const permits =
      action === "enable"
        ? canReinstateRouter
        : action === "disable"
          ? canSuspendRouter
          : canDecommissionRouter;
    return rows.filter((r) => selected.has(r.id) && permits(r.status)).map((r) => r.id);
  }

  function bulk(action: "enable" | "disable" | "delete") {
    if (!selected.size) return;
    const ids = eligibleFor(action);
    const skipped = selected.size - ids.length;
    if (!ids.length) return;
    // Name the skipped rows rather than silently narrowing the batch. An
    // operator who ticked twelve and suspended nine needs to know which
    // number is the real one.
    const skippedNote = skipped
      ? ` ${skipped} of the ${selected.size} selected cannot accept this and will be left alone.`
      : "";
    if (action === "delete") {
      setConfirm({
        title: `Decommission ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
        description: `This decommissions the selected routers.${skippedNote}`,
        destructive: true,
        onConfirm: async () => {
          await remove.mutateAsync(ids);
          toast.success("Routers decommissioned");
          setSelected(new Set());
        },
      });
      return;
    }
    // `REINSTATE_TARGET_STATUS`, not "online". Reinstating used to post
    // `online`, which is not an edge out of `suspended` and is a claim only
    // a device heartbeat may make.
    const newStatus: RouterStatus =
      action === "enable" ? REINSTATE_TARGET_STATUS : SUSPEND_TARGET_STATUS;
    setConfirm({
      title: `${action === "enable" ? "Reinstate" : "Suspend"} ${ids.length} router${ids.length > 1 ? "s" : ""}?`,
      description: `Selected routers will be marked as ${newStatus}.${skippedNote}`,
      onConfirm: async () => {
        await updateStatus.mutateAsync({ ids, status: newStatus });
        toast.success(`Marked as ${newStatus}`);
        setSelected(new Set());
      },
    });
  }

  const selectedCount = selected.size;
  const eligibleCounts = {
    enable: eligibleFor("enable").length,
    disable: eligibleFor("disable").length,
    delete: eligibleFor("delete").length,
  };

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
              placeholder="Search by name, serial, IP, location…"
              className="pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as RouterStatus | "all");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
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
          <Select
            value={organizationId}
            onValueChange={(v) => {
              setOrganizationId(v);
              setLocationId("all");
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
              {locations
                .filter((l) => organizationId === "all" || l.organizationId === organizationId)
                .map((l) => (
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
              {/* Muted-and-inert rather than `disabled`, for the reason
                  #258 documented: a `disabled` button takes no pointer
                  events, so the `title` explaining itself can never fire.
                  These keep pointer events and explain on hover, and the
                  count in the label ("Suspend 9 of 12") means the common
                  case needs no hover at all. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => eligibleCounts.enable && bulk("enable")}
                aria-disabled={!eligibleCounts.enable}
                className={!eligibleCounts.enable ? "opacity-40" : undefined}
                title={
                  eligibleCounts.enable
                    ? undefined
                    : "None of the selected routers is suspended, so there is nothing to reinstate."
                }
              >
                <PlayCircle className="h-4 w-4" />
                <span className="ml-2">
                  Reinstate
                  {eligibleCounts.enable && eligibleCounts.enable !== selectedCount
                    ? ` ${eligibleCounts.enable} of ${selectedCount}`
                    : ""}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => eligibleCounts.disable && bulk("disable")}
                aria-disabled={!eligibleCounts.disable}
                className={!eligibleCounts.disable ? "opacity-40" : undefined}
                title={
                  eligibleCounts.disable
                    ? undefined
                    : "Only routers that have come online can be suspended. None of the selected ones has."
                }
              >
                <PauseCircle className="h-4 w-4" />
                <span className="ml-2">
                  Suspend
                  {eligibleCounts.disable && eligibleCounts.disable !== selectedCount
                    ? ` ${eligibleCounts.disable} of ${selectedCount}`
                    : ""}
                </span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => eligibleCounts.delete && bulk("delete")}
                aria-disabled={!eligibleCounts.delete}
                className={!eligibleCounts.delete ? "opacity-40" : undefined}
                title={
                  eligibleCounts.delete
                    ? undefined
                    : "Every selected router is already decommissioned."
                }
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2">
                  Decommission
                  {eligibleCounts.delete && eligibleCounts.delete !== selectedCount
                    ? ` ${eligibleCounts.delete} of ${selectedCount}`
                    : ""}
                </span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
        {isLoading ? (
          <div className="p-4">
            <LoadingSkeleton rows={8} />
          </div>
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
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
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
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggleOne(r.id)}
                        aria-label={`Select ${r.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/routers/$routerId"
                        params={{ routerId: r.id }}
                        className="group flex flex-col"
                      >
                        <span className="font-medium text-foreground group-hover:text-primary">
                          {r.name}
                        </span>
                        <span className="text-xs text-muted-foreground">SN {r.serialNumber}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="text-foreground">{r.organizationName}</div>
                      <div className="text-muted-foreground">{r.locationName}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {r.model}
                    </TableCell>
                    {/* A controller does not run RouterOS. "—" is this
                        column's "no version on file", which is a different
                        fact from "this device has no such version at all" --
                        the detail drawer this row links to drops the field
                        entirely rather than conflate them
                        (`RouterDetailTabs`), and a list that disagrees with
                        its own detail view is the defect §11.5 exists for. */}
                    <TableCell className="text-xs tabular-nums">
                      {isControllerManaged(r.vendor) ? (
                        <span
                          className="text-muted-foreground"
                          title="A controller does not run RouterOS. Its software version lives on the controller itself."
                        >
                          Not applicable
                        </span>
                      ) : (
                        (r.routerOsVersion ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <div>{r.publicIpAddress ?? "—"}</div>
                      <div className="text-muted-foreground">{r.managementIpAddress ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {/* A controller sits at `pending_provisioning`
                            forever -- nothing provisions it, so nothing ever
                            moves it on -- and `RouterStatusBadge` renders
                            that as "Pending provisioning": a device somebody
                            forgot to finish. This is the venue owner's OWN
                            list, so that badge told a hotel whose guest WiFi
                            is working that its network was half-installed.
                            `ControllerManagedBadge` was already rendered
                            beside it; it now stands in place of the status
                            word rather than next to a contradiction of
                            itself. Same substitution `RouterDetailTabs`
                            makes on the Status tile of the drawer this row
                            links to. */}
                        {isControllerManaged(r.vendor) ? (
                          <ControllerManagedBadge vendor={r.vendor} />
                        ) : (
                          <RouterStatusBadge status={r.status} />
                        )}
                        <MissingCredentialsBadge
                          hasApiCredentials={r.hasApiCredentials}
                          status={r.status}
                          vendor={r.vendor}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* `healthStatus` is written by the health checker,
                          which talks to the router agent. On a controller it
                          is null forever, and even `HealthStatusBadge`'s
                          honest "Unknown" is a word too confident: unknown
                          implies somebody looked. */}
                      {isControllerManaged(r.vendor) ? (
                        <span className="text-xs text-muted-foreground">Not measured here</span>
                      ) : (
                        <HealthStatusBadge status={r.healthStatus} />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {/* `relative(null)` is "Never" -- a measurement claim,
                          and the wrong one. Nothing here ever checks a
                          controller, so there is no "never" to report. */}
                      {isControllerManaged(r.vendor) ? "Not measured here" : relative(r.lastSeenAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowActions
                        router={r}
                        onAction={(a) => {
                          if (a === "enable" || a === "disable") {
                            updateStatus.mutate(
                              {
                                ids: [r.id],
                                // Was `"online"`. `suspended -> online` is
                                // not an edge the backend has, and `online`
                                // is a claim only a device heartbeat may
                                // make -- the detail page has always sent
                                // `offline` here.
                                status:
                                  a === "enable" ? REINSTATE_TARGET_STATUS : SUSPEND_TARGET_STATUS,
                              },
                              {
                                onSuccess: () =>
                                  toast.success(
                                    `${r.name} ${a === "enable" ? "reinstated" : "suspended"}`,
                                  ),
                                onError: (err) =>
                                  toast.error(
                                    (err as unknown as AppError).message || `Failed to ${a}`,
                                  ),
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
  page,
  pageSize,
  total,
  totalPages,
  setPage,
  setPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  router: r,
  onAction,
}: {
  router: RouterDevice;
  onAction: (a: "enable" | "disable" | "delete") => void;
}) {
  // Was: `suspended || offline || decommissioned ? Reinstate : Suspend`,
  // which asked "does this look inactive?" instead of "does the backend
  // accept this edge?" -- so a `pending_provisioning` router was offered
  // Suspend, a terminal `decommissioned` one was offered Reinstate, and
  // `offline` got Reinstate where the detail page correctly offers Suspend.
  // See `@/lib/router-actions` for the transition graph this now mirrors.
  const canSuspend = canSuspendRouter(r.status);
  const canReinstate = canReinstateRouter(r.status);
  // Vendor, not just status: a controller sits at `pending_provisioning`
  // forever, and the status-only answer told the operator to run a setup
  // script that does not exist for it. See `routerToggleUnavailableReason`.
  const unavailableReason = routerToggleUnavailableReason(r.status, r.vendor);
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
          <Link to="/routers/$routerId" params={{ routerId: r.id }}>
            View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canReinstate && (
          <DropdownMenuItem onClick={() => onAction("enable")}>
            <PlayCircle className="h-4 w-4" />
            <span className="ml-2">Reinstate</span>
          </DropdownMenuItem>
        )}
        {canSuspend && (
          <DropdownMenuItem onClick={() => onAction("disable")}>
            <PauseCircle className="h-4 w-4" />
            <span className="ml-2">Suspend</span>
          </DropdownMenuItem>
        )}
        {/* NOT a disabled <DropdownMenuItem>, and not simply omitted.
            A disabled Radix item takes no pointer events, so neither a
            `title` nor a tooltip on it can ever fire (#258 hit exactly this
            and settled for muted styling plus `title`). An operator would be
            left with a dead grey row and no way to find out why -- which is
            the same unanswered question as hiding it, only noisier.
            Rendering the reason as ordinary text sidesteps the whole problem:
            a menu is already open when it is read, so nothing needs to be
            hovered for the explanation to arrive. */}
        {unavailableReason && (
          <div className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
            {unavailableReason}
          </div>
        )}
        {canDecommissionRouter(r.status) && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onAction("delete")}
          >
            <Trash2 className="h-4 w-4" />
            <span className="ml-2">Decommission</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
