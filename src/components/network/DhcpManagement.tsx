import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ControllerRoutersNote, RouterPickerItems } from "@/components/network/RouterPickerItems";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DataTable,
  FormField,
  FormSection,
  FormSwitchRow,
  PageHeader,
  Panel,
  StatTile,
  StatusDot,
  TablePager,
  Toolbar,
  ToolbarSearch,
  type DataTableColumn,
} from "@/components/customer/console";
import {
  DIALOG_CONSOLE,
  EnabledBadge,
  NameCell,
  PushStatusBadge,
  RowActions,
  SCREEN_ROOT,
  type PageScope,
} from "@/components/network/network-ui";
import {
  useDhcpPools,
  useCreateDhcpPool,
  useUpdateDhcpPool,
  useDeleteDhcpPool,
  usePushDhcpPool,
} from "@/hooks/useDhcp";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { partialCountHint } from "@/components/network/list-kpis";
import { CurrentRouterPools } from "@/components/network/CurrentRouterPools";
import { isControllerManagedRow, isNasOnlyVendor } from "@/lib/router-vendors";
import type { AppError } from "@/services/api";
import type { DhcpPool, DhcpDevicePushStatus } from "@/types/dhcp";

const PAGE_SIZE = 25;

const dhcpSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(48),
  addressRangeStart: z.string().trim().min(1, "Required"),
  addressRangeEnd: z.string().trim().min(1, "Required"),
  // Required, not optional -- see this component's own comment on the
  // "Interface" field below for why a pool with no interface never
  // actually starts a dhcp-server on the real device (silently creates a
  // bare /ip pool that hands out nothing).
  interface: z
    .string()
    .trim()
    .min(1, "Required — the DHCP server won't start on the router without it"),
  gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
  dnsPrimary: z.string().trim().optional().or(z.literal("")),
  dnsSecondary: z.string().trim().optional().or(z.literal("")),
  leaseTimeSeconds: z.coerce.number().int().min(1),
  isEnabled: z.boolean(),
});
type DhcpFormValues = z.infer<typeof dhcpSchema>;

/** The one blank form. Hoisted so `DhcpDialog` can reset back to exactly
 *  this on close -- see the comment on its `close`. */
const BLANK_DHCP_FORM: DhcpFormValues = {
  routerId: "",
  name: "",
  addressRangeStart: "",
  addressRangeEnd: "",
  interface: "",
  gatewayIpAddress: "",
  dnsPrimary: "",
  dnsSecondary: "",
  leaseTimeSeconds: 86_400,
  isEnabled: true,
};

const DEVICE_PUSH_LABEL: Record<DhcpDevicePushStatus, string> = {
  active: "Applied",
  pending: "Not yet applied",
  failed: "Couldn't apply",
};

/** Whether this pool actually exists on the router.
 *
 * Worth its own column rather than folding into "Status": `isEnabled` is
 * intent, this is fact, and until the domain had a device push every pool
 * ever created sat permanently unapplied while the UI said "Enabled" --
 * and a guest joining that network received no address at all, because no
 * `/ip dhcp-server` had ever been created to answer them.
 *
 * A failed push shows the router's own words rather than a generic
 * message: "already have such item" or a policy denial tells an operator
 * what to do, and summarising device errors is how the silence started.
 */
function DevicePushBadge({ pool }: { pool: DhcpPool }) {
  return (
    <PushStatusBadge
      status={pool.devicePushStatus}
      label={DEVICE_PUSH_LABEL[pool.devicePushStatus]}
      error={pool.devicePushError}
      errorPrefix="Couldn't apply this pool to your router:"
    />
  );
}

export function DhcpManagement({
  locationId,
  scope,
}: {
  locationId?: string;
  /** Title + venue from the customer shell, which then draws no header of its own. */
  scope?: PageScope;
} = {}) {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DhcpPool | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DhcpPool | null>(null);

  // No org id is resolved or threaded here, and this query has no `enabled`
  // gate. The endpoint still scopes on X-Organization-Id, but
  // `attachOrganizationScope` (services/api.ts) attaches it to every request
  // an organization-scoped session makes, and attaches nothing for a
  // GLOBAL-scope one -- so the unscoped /network view still spans every org.
  //
  // This used to gate on a `scopedOrgId` query whose result went into the
  // React Query key, which cost every read on the page a second request: the
  // gate was already open on the first render (useIsDemo starts true, by
  // design, for hydration), so the query fired with `organizationId:
  // undefined`; the id then resolved, the key changed, and it all refetched.
  //
  // The backend's `GET /dhcp-pools` only filters by `router_id`, not
  // location -- so a location-scoped view (the customer dashboard's DHCP
  // Pool page) fetches one full (up to max page_size) page and narrows +
  // paginates it client-side below, same tradeoff `routerService.list`
  // already makes for its own "all routers" case.
  const { data, isLoading } = useDhcpPools({
    page: locationId ? 1 : page,
    pageSize: locationId ? 100 : PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const del = useDeleteDhcpPool();
  const push = usePushDhcpPool();

  function handlePush(pool: DhcpPool) {
    push.mutate(
      { id: pool.id },
      {
        onSuccess: () => toast.success(`${pool.name} applied to the router`),
        onError: (err) =>
          toast.error(
            (err as unknown as AppError)?.message || `Couldn't apply ${pool.name} to the router`,
          ),
      },
    );
  }
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["dhcp", "router-options", locationId],
    queryFn: async () => {
      // Location-scoped: use the location-scoped router endpoint directly
      // (mirrors IspDetailsView/MacAuthView) -- `routerService.list()`'s
      // "all routers" path fans out through the platform-wide
      // `GET /organizations`, which an ordinary org-owner session 403s on.
      if (locationId) {
        // Demo mode: routerService.listForLocation() already ignores this
        // arg (returns DEMO_ROUTERS), so skip resolving a real org id for
        // it -- resolveOrgId() itself has no demo guard and would still
        // fire a real (401ing) request even though its result goes unused.
        const orgId = isDemo() ? "" : await resolveOrgId();
        const rows = await routerService.listForLocation(locationId, orgId);
        return { rows, total: rows.length };
      }
      return routerService.listAll();
    },
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const filteredRows = (data?.rows ?? []).filter((p) => {
    if (locationId && p.locationId !== locationId) return false;
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(t) ||
      p.addressRangeStart.includes(t) ||
      p.addressRangeEnd.includes(t) ||
      routerName(p.routerId).toLowerCase().includes(t)
    );
  });

  const rows = locationId
    ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : filteredRows;
  const total = locationId ? filteredRows.length : (data?.total ?? 0);
  const totalPages = locationId
    ? Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    : (data?.totalPages ?? 1);
  const hasNext = locationId ? page < totalPages : !!data?.hasNext;
  const hasPrevious = locationId ? page > 1 : !!data?.hasPrevious;
  // Tiles come from the list response above, never a second request -- and
  // they count every row this page holds, not just the 25 currently on
  // screen, which is what "Enabled" used to do while "Total Pools" counted
  // all of them. See components/network/list-kpis.ts for the hint.
  const enabledCount = filteredRows.filter((p) => p.isEnabled).length;
  // Routers whose live pools to read for "Current on router": every
  // configurable router at this venue, or -- on the platform-wide view --
  // only the one picked in the filter, never a fan-out over the fleet.
  const livePoolRouters = routers.rows
    .filter((r) => !isControllerManagedRow(r) && !isNasOnlyVendor(r.vendor))
    .filter((r) => (locationId ? true : routerFilter !== "all" && r.id === routerFilter))
    .map((r) => ({ id: r.id, name: r.name }));
  const statHint = partialCountHint(data?.rows.length ?? 0, data?.total ?? 0);
  const totalHint = locationId ? statHint : undefined;

  const plain = !!locationId;
  const columns: DataTableColumn<DhcpPool>[] = [
    {
      id: "name",
      header: plain ? "Range" : "Pool",
      mobile: "title",
      cell: (p) => <NameCell name={p.name} sub={p.interface} />,
    },
    { id: "router", header: "Router", cell: (p) => routerName(p.routerId) },
    {
      id: "range",
      header: "Address range",
      mono: true,
      cell: (p) => `${p.addressRangeStart} – ${p.addressRangeEnd}`,
    },
    {
      id: "gateway",
      header: plain ? "Router address" : "Gateway",
      mono: true,
      cell: (p) => p.gatewayIpAddress ?? "—",
    },
    {
      id: "dns",
      header: "DNS",
      mono: true,
      cell: (p) => [p.dnsPrimary, p.dnsSecondary].filter(Boolean).join(", ") || "—",
    },
    {
      id: "lease",
      header: plain ? "Held for" : "Lease",
      className: "tabular-nums text-[var(--wy-text-muted)]",
      cell: (p) => `${Math.round(p.leaseTimeSeconds / 3600)}h`,
    },
    { id: "status", header: "Status", cell: (p) => <EnabledBadge enabled={p.isEnabled} /> },
    { id: "push", header: "On router", cell: (p) => <DevicePushBadge pool={p} /> },
  ];

  return (
    <div className={SCREEN_ROOT}>
      {/* Shared with the master console's own /network/dhcp route (rendered
       * with no locationId there) -- that audience keeps the precise
       * technical title/description; only the customer portal (which
       * always passes a real locationId, via OperationsFeatures.tsx's
       * DhcpView) gets the friendlier name. Same id/route/data either way.
       * Under the customer shell this is the page's only header: the shell
       * hands over the tab name and venue (`scope`) and draws none itself. */}
      <PageHeader
        title={scope?.title ?? (plain ? "IP Addresses" : "DHCP Pool Management")}
        venue={scope?.venue}
        description={
          plain
            ? "The pool of IP addresses your router hands out to guest devices, plus their gateway, DNS and how long each address is held."
            : "Per-router DHCP address pools, gateway, DNS and lease time. Apply a pool to send it to the router."
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden className="mr-1.5 h-4 w-4" />{" "}
            {plain ? "New address range" : "New Pool"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Total Pools" value={total} hint={totalHint} loading={isLoading} />
        <StatTile
          label="Enabled"
          value={enabledCount}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="ok" label="Enabled" size="sm" />}
        />
        <StatTile
          label="Disabled"
          value={filteredRows.length - enabledCount}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="offline" label="Disabled" size="sm" />}
        />
      </div>

      <CurrentRouterPools routers={livePoolRouters} />

      <Panel flush title={plain ? "All address ranges" : "All DHCP Pools"}>
        <Toolbar divided>
          <Select
            value={routerFilter}
            onValueChange={(v) => {
              setRouterFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Router">
              <SelectValue placeholder="All routers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routers</SelectItem>
              {/* Contract §11.5: the two kinds of device are listed
                  apart, and only the ones this platform configures are
                  selectable. See RouterPickerItems. */}
              <RouterPickerItems rows={routers.rows} />
            </SelectContent>
          </Select>
          <ToolbarSearch
            value={search}
            onValueChange={setSearch}
            placeholder="Search name, range, router…"
          />
        </Toolbar>
        <DataTable
          ariaLabel={plain ? "All address ranges" : "All DHCP Pools"}
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          loading={isLoading}
          loadingLabel="Loading…"
          empty={
            plain ? "No address ranges match your filters." : "No DHCP pools match your filters."
          }
          maxHeight="70vh"
          rowActions={(p) => (
            /* Apply is always visible, unlike the revealed edit/delete
               pair: this is the step that actually reaches the hardware,
               and a pool sitting at "Not yet applied" is the thing an
               operator most needs to notice -- it is the difference
               between a guest getting an address and getting nothing. */
            <RowActions
              name={p.name}
              apply={{
                label: p.devicePushStatus === "active" ? "Re-apply" : "Apply",
                pending: push.isPending && push.variables?.id === p.id,
                quiet: p.devicePushStatus === "active",
                onClick: () => handlePush(p),
              }}
              onEdit={() => setEditing(p)}
              onDelete={() => setConfirmDelete(p)}
            />
          )}
          footer={
            totalPages > 1 ? (
              <TablePager
                summary={`Page ${page} of ${totalPages} · ${total} pools`}
                previousLabel="Previous"
                nextLabel="Next"
                hasPrevious={hasPrevious}
                hasNext={hasNext}
                onPrevious={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : undefined
          }
        />
      </Panel>

      <DhcpDialog
        plain={!!locationId}
        open={creating || !!editing}
        pool={editing}
        routers={routers.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className={DIALOG_CONSOLE}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locationId ? "Delete address range" : "Delete pool"} "{confirmDelete?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it from{" "}
              {confirmDelete ? routerName(confirmDelete.routerId) : ""}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync({ id: confirmDelete.id });
                  toast.success(`Pool ${confirmDelete.name} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete pool");
                }
                setConfirmDelete(null);
              }}
            >
              {locationId ? "Delete range" : "Delete pool"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** `plain` = the venue-owner wording, same split as VlanManagement's own
 * VlanDialog: the master console keeps "DHCP pool", the customer portal --
 * whose sidebar and page title already say "IP Addresses" -- gets words that
 * match the door they came through. An owner clicking "IP Addresses" and
 * being handed a "New DHCP pool" button learns that the rename was paint. */
function DhcpDialog({
  open,
  pool,
  routers,
  plain,
  onClose,
}: {
  open: boolean;
  pool: DhcpPool | null;
  routers: { id: string; name: string }[];
  plain: boolean;
  onClose: () => void;
}) {
  const create = useCreateDhcpPool();
  const update = useUpdateDhcpPool();

  const defaults: DhcpFormValues = pool
    ? {
        routerId: pool.routerId,
        name: pool.name,
        addressRangeStart: pool.addressRangeStart,
        addressRangeEnd: pool.addressRangeEnd,
        interface: pool.interface ?? "",
        gatewayIpAddress: pool.gatewayIpAddress ?? "",
        dnsPrimary: pool.dnsPrimary ?? "",
        dnsSecondary: pool.dnsSecondary ?? "",
        leaseTimeSeconds: pool.leaseTimeSeconds,
        isEnabled: pool.isEnabled,
      }
    : BLANK_DHCP_FORM;

  const form = useForm<DhcpFormValues>({
    resolver: zodResolver(dhcpSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const selectedRouterId = form.watch("routerId");
  const [manualInterface, setManualInterface] = useState(false);
  const id = useId();

  // Real interfaces read live off the device, not guessed -- excludes
  // whatever's already bound to a dhcp-server/dhcp-client on the router
  // itself (backend-filtered, see routerService.getDeviceInterfaces).
  const {
    data: deviceInterfaces,
    isLoading: interfacesLoading,
    isError: interfacesErrored,
  } = useQuery({
    queryKey: ["dhcp", "device-interfaces", selectedRouterId],
    queryFn: () => routerService.getDeviceInterfaces(selectedRouterId),
    enabled: !!selectedRouterId,
    staleTime: 15_000,
  });

  /** Resets the form on the way out, so the next open starts clean.
   *
   * `useForm`'s `values` prop only resyncs when the object it is handed
   * deep-changes, and this dialog is never unmounted -- two consecutive
   * opens of the same target hand it the identical object ("New DHCP pool"
   * straight after creating one gets the same blank defaults both times),
   * so no reset fires. React Hook Form then repopulates every input from
   * the form state it kept as each field re-registers, and the dialog
   * reopens showing the last attempt's values. `manualInterface` leaked the
   * same way: it lives out here rather than inside `DialogContent`, so it
   * survived the close too and a reopened dialog stayed stuck in
   * type-it-yourself mode. Same fix and same convention as
   * NasDevicesPanel and SlaPanel. */
  function close() {
    form.reset(BLANK_DHCP_FORM);
    setManualInterface(false);
    onClose();
  }

  async function submit(v: DhcpFormValues) {
    try {
      const shared = {
        name: v.name,
        addressRangeStart: v.addressRangeStart,
        addressRangeEnd: v.addressRangeEnd,
        interface: v.interface || null,
        gatewayIpAddress: v.gatewayIpAddress || null,
        dnsPrimary: v.dnsPrimary || null,
        dnsSecondary: v.dnsSecondary || null,
        leaseTimeSeconds: v.leaseTimeSeconds,
        isEnabled: v.isEnabled,
      };
      if (pool) {
        await update.mutateAsync({ id: pool.id, payload: shared });
        toast.success(plain ? "Address range updated" : "DHCP pool updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success(plain ? "Address range created" : "DHCP pool created");
      }
      close();
    } catch (err) {
      toast.error(
        (err as AppError).message ||
          (plain ? "Couldn't save that address range" : "Failed to save pool"),
      );
    }
  }

  const errors = form.formState.errors;
  const interfaceHint = interfacesErrored
    ? "Couldn't reach the router to list its interfaces — type the name manually."
    : selectedRouterId && !interfacesLoading && deviceInterfaces?.length === 0
      ? "No available interfaces on this router (everything's already in use, or it's offline) — type one manually if you're sure."
      : "Read live off the router — already-in-use interfaces are left out.";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={`${DIALOG_CONSOLE} max-w-lg`}>
        <DialogHeader>
          <DialogTitle>
            {plain
              ? pool
                ? "Edit address range"
                : "New address range"
              : pool
                ? "Edit DHCP pool"
                : "New DHCP pool"}
          </DialogTitle>
          <DialogDescription>
            {pool
              ? plain
                ? "The router this range belongs to cannot be changed — delete it and make a new one to move it."
                : "The router this pool belongs to cannot be changed — delete and recreate to move it."
              : plain
                ? "An address range belongs to exactly one router for its whole life."
                : "A DHCP pool belongs to exactly one router for its whole lifetime."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)}>
          <FormSection
            variant="plain"
            footer={
              <>
                <Button type="button" variant="ghost" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {pool ? "Save changes" : "Create pool"}
                </Button>
              </>
            }
          >
            <FormField
              wide
              label="Router"
              htmlFor={`${id}-router`}
              error={errors.routerId?.message}
            >
              <Controller
                control={form.control}
                name="routerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!pool}>
                    <SelectTrigger id={`${id}-router`}>
                      <SelectValue placeholder="Select router" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Contract §11.5. A controller is listed here but not
                          selectable: the backend refuses this write by vendor,
                          and meeting that refusal after the form is filled in
                          is the defect this closes. */}
                      <RouterPickerItems rows={routers} />
                    </SelectContent>
                  </Select>
                )}
              />
              {/* Names what was greyed out and why. Renders nothing at a venue
                  with no controller. */}
              <ControllerRoutersNote rows={routers} />
            </FormField>
            <FormField wide label="Name" htmlFor={`${id}-name`} error={errors.name?.message}>
              <Input id={`${id}-name`} {...form.register("name")} placeholder="Guest pool" />
            </FormField>
            <FormField
              label="Range start"
              htmlFor={`${id}-start`}
              error={errors.addressRangeStart?.message}
            >
              <Input
                id={`${id}-start`}
                {...form.register("addressRangeStart")}
                placeholder="10.0.0.10"
                className="font-mono"
              />
            </FormField>
            <FormField
              label="Range end"
              htmlFor={`${id}-end`}
              error={errors.addressRangeEnd?.message}
            >
              <Input
                id={`${id}-end`}
                {...form.register("addressRangeEnd")}
                placeholder="10.0.0.250"
                className="font-mono"
              />
            </FormField>
            <FormField
              label={plain ? "Router address (optional)" : "Gateway IP (optional)"}
              htmlFor={`${id}-gateway`}
            >
              <Input
                id={`${id}-gateway`}
                {...form.register("gatewayIpAddress")}
                placeholder="10.0.0.1"
                className="font-mono"
              />
            </FormField>
            <FormField
              label={plain ? "Which cable or zone" : "Interface"}
              htmlFor={`${id}-interface`}
              error={errors.interface?.message}
              hint={interfaceHint}
              hintTone={interfacesErrored ? "crit" : "muted"}
              labelAction={
                !manualInterface ? (
                  <button
                    type="button"
                    className="rounded text-xs text-[var(--wy-text-muted)] underline underline-offset-2 hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                    onClick={() => setManualInterface(true)}
                  >
                    Type manually
                  </button>
                ) : null
              }
            >
              {manualInterface ? (
                <Input
                  id={`${id}-interface`}
                  {...form.register("interface")}
                  placeholder="bridgeLocal, ether3, vlan3…"
                />
              ) : (
                <Controller
                  control={form.control}
                  name="interface"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedRouterId || interfacesLoading}
                    >
                      <SelectTrigger id={`${id}-interface`}>
                        <SelectValue
                          placeholder={
                            !selectedRouterId
                              ? "Select a router first"
                              : interfacesLoading
                                ? "Checking router…"
                                : "Select interface"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(deviceInterfaces ?? []).map((i) => (
                          <SelectItem key={i.name} value={i.name}>
                            {i.name}
                            {i.bridge ? ` (in ${i.bridge})` : ""}
                            {i.running ? " · link up" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            <FormField label="DNS primary (optional)" htmlFor={`${id}-dns1`}>
              <Input
                id={`${id}-dns1`}
                {...form.register("dnsPrimary")}
                placeholder="8.8.8.8"
                className="font-mono"
              />
            </FormField>
            <FormField label="DNS secondary (optional)" htmlFor={`${id}-dns2`}>
              <Input
                id={`${id}-dns2`}
                {...form.register("dnsSecondary")}
                placeholder="8.8.4.4"
                className="font-mono"
              />
            </FormField>
            <FormField
              label={plain ? "Hold each address for (seconds)" : "Lease time (seconds)"}
              htmlFor={`${id}-lease`}
              error={errors.leaseTimeSeconds?.message}
            >
              <Input
                id={`${id}-lease`}
                type="number"
                min={1}
                {...form.register("leaseTimeSeconds")}
              />
            </FormField>
            <FormSwitchRow
              className="self-end"
              label="Enabled"
              control={
                <Controller
                  control={form.control}
                  name="isEnabled"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              }
            />
          </FormSection>
        </form>
      </DialogContent>
    </Dialog>
  );
}
