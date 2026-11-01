import i18n from "@/lib/i18n";
import { Trans, useTranslation } from "react-i18next";
import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { z } from "zod";
import { useForm, Controller, type Control } from "react-hook-form";
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
  Callout,
  DataTable,
  FormField,
  FormSection,
  FormSwitchRow,
  PageHeader,
  Panel,
  StatTile,
  StatusBadge,
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
import { partialCountHint } from "@/components/network/list-kpis";
import {
  useVlans,
  useCreateVlan,
  useUpdateVlan,
  useDeleteVlan,
  usePushVlan,
  useVlanDeviceInterfaces,
} from "@/hooks/useVlan";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import type { AppError } from "@/services/api";
import type { Vlan, VlanDeviceInterface, VlanDevicePushStatus, VlanPortMode } from "@/types/vlan";

const PAGE_SIZE = 25;

/* The trunk parent and the access port are two form fields, not one
 * relabelled box, even though they share a single `interface` column on the
 * wire. They are filled from opposite halves of the router's interface table
 * (see `interfacesForMode`), so one box carried the other mode's answer
 * across a mode switch -- an `ether3` sitting in the trunk field is a push
 * failure waiting to happen. `submit` maps whichever one the mode uses back
 * onto `interface`. */
const vlanSchema = z
  .object({
    routerId: z.string().min(1, "common.selectRouter"),
    vlanId: z.coerce.number().int().min(1, "1-4094").max(4094, "1-4094"),
    name: z.string().trim().min(2, "common.required").max(48),
    gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
    cidr: z.string().trim().optional().or(z.literal("")),
    portMode: z.enum(["trunk", "access"]),
    confirmTakesPort: z.boolean(),
    trunkInterface: z.string().trim().optional().or(z.literal("")),
    accessPort: z.string().trim().optional().or(z.literal("")),
    enableHotspot: z.boolean(),
    natEnabled: z.boolean(),
    isEnabled: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.portMode === "trunk" && !v.trunkInterface) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trunkInterface"],
        message: "vlan.errTrunk",
      });
    }
    if (v.portMode === "access" && !v.accessPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accessPort"],
        message: "vlan.errAccess",
      });
    }
  });
type VlanFormValues = z.infer<typeof vlanSchema>;

/** The one blank form. Hoisted so `VlanDialog` can reset back to exactly
 *  this on close -- see the comment on its `close`. */
const BLANK_VLAN_FORM: VlanFormValues = {
  routerId: "",
  vlanId: 100,
  name: "",
  gatewayIpAddress: "",
  cidr: "",
  portMode: "trunk",
  confirmTakesPort: false,
  trunkInterface: "",
  accessPort: "",
  enableHotspot: false,
  natEnabled: true,
  isEnabled: true,
};

/** i18n keys (network namespace), rendered through `t`. */
const DEVICE_PUSH_LABEL: Record<VlanDevicePushStatus, string> = {
  active: "common.push.applied",
  provisioning: "common.push.applying",
  pending: "common.push.pending",
  failed: "common.push.failed",
};

/** The name this VLAN ends up carrying on the router.
 *
 * A trunk VLAN becomes a tagged sub-interface called `vlan<tag>`; an access
 * VLAN hands the whole physical port over untagged, so the port's own name
 * is the interface. It is in the row because it is the name every other
 * page has to be given -- an IP Addresses pool for this zone has to point
 * at it, and until now the customer had to work it out. */
function deviceInterfaceName(v: Pick<Vlan, "portMode" | "vlanId" | "interface">) {
  return v.portMode === "access" ? (v.interface ?? "—") : `vlan${v.vlanId}`;
}

/** The interfaces a VLAN in this port mode can legitimately sit on.
 *
 * Trunk and Access need opposite halves of the router's interface table, so
 * this is a filter split rather than one list with two labels. A trunk VLAN
 * is a tagged sub-interface, so its parent has to be something that carries
 * tagged traffic in its own right -- the bridge, a bond, or an ether that
 * is not already enslaved to a bridge, because on a bridge member it is the
 * bridge and not the port that owns the VLAN. An access port is the exact
 * opposite: it must already be a bridge port, since an untagged VLAN is
 * applied through the bridge's port table. Offering anything else as an
 * access port guarantees a failure at push time, so it is filtered out here
 * instead of being left for the device to reject. */
function interfacesForMode(interfaces: VlanDeviceInterface[], mode: VlanPortMode) {
  const usable = interfaces.filter((i) => !i.disabled);
  return mode === "access"
    ? usable.filter((i) => i.isBridgePort)
    : // A VLAN on a VLAN is QinQ, which this form has no way to express.
      usable.filter((i) => !i.isBridgePort && i.type !== "vlan");
}

/** Whether this VLAN exists on the actual router.
 *
 * Worth its own column rather than folding into "Status": `isEnabled` is
 * intent, this is fact, and until the domain had a device push every VLAN
 * ever created sat permanently at "Not yet applied" while the UI said
 * "Enabled". Those two being visibly different is the point.
 *
 * A failed push shows the device's own error on hover -- unedited, because a
 * RouterOS message ("already have such item", a connection timeout) tells an
 * operator more than any summary of it would.
 */
function DevicePushBadge({ vlan }: { vlan: Vlan }) {
  const { t } = useTranslation("network", { i18n });
  return (
    <PushStatusBadge
      status={vlan.devicePushStatus}
      label={t(DEVICE_PUSH_LABEL[vlan.devicePushStatus])}
      error={vlan.devicePushError}
      errorPrefix={t("vlan.couldnTApplyThisVlan")}
    />
  );
}

export function VlanManagement({
  locationId,
  scope,
}: {
  locationId?: string;
  /** Title + venue from the customer shell, which then draws no header of its own. */
  scope?: PageScope;
} = {}) {
  const { t } = useTranslation("network", { i18n });
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Vlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Vlan | null>(null);

  const { data, isLoading } = useVlans({
    page,
    pageSize: PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
    locationId,
  });
  const del = useDeleteVlan();
  const push = usePushVlan();

  /** Applies one VLAN to its router.
   *
   * A failure arrives as a real non-2xx carrying the device's own error
   * text, so it is worth showing verbatim -- "already have such item" or a
   * connection timeout tells an operator far more than a generic message
   * would. The backend never returns a 2xx for a failed push, precisely so
   * this catch is reachable. */
  function handlePush(vlan: Vlan) {
    push.mutate(vlan.id, {
      onSuccess: () => toast.success(t("vlan.vlanAppliedToTheRouter", { vlanId: vlan.vlanId })),
      onError: (err) =>
        toast.error(
          (err as unknown as AppError)?.message ||
            t("vlan.couldnTApplyVlanTo", { vlanId: vlan.vlanId }),
        ),
    });
  }
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["vlan", "router-options", locationId],
    queryFn: async () => {
      // Location-scoped (the customer dashboard's VLANs page): use the
      // location-scoped router endpoint directly (mirrors
      // IspDetailsView/MacAuthView/DhcpManagement) -- `routerService.list()`'s
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
  const locationName = (id: string) =>
    routers.rows.find((r) => r.locationId === id)?.locationName ?? id.slice(0, 8);

  const rows = (data?.rows ?? []).filter((v) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      v.name.toLowerCase().includes(t) ||
      String(v.vlanId).includes(t) ||
      (v.cidr ?? "").includes(t) ||
      routerName(v.routerId).toLowerCase().includes(t)
    );
  });

  // Tiles come from the list query above rather than a second request, which
  // also puts them on the same `locationId` the table is scoped to: the old
  // KPI call passed no location at all, so on a multi-location org "Total
  // VLANs" counted the whole organization while the rows below it showed one
  // location. `data.total` is the server's own count for this location and is
  // exact; enabled/disabled are counted over the page in hand and say so.
  // See components/network/list-kpis.ts.
  const enabledCount = rows.filter((v) => v.isEnabled).length;
  const statHint = partialCountHint(rows.length, data?.total ?? 0);

  const plain = !!locationId;
  const columns: DataTableColumn<Vlan>[] = [
    {
      id: "name",
      header: plain ? t("vlan.zone") : "VLAN",
      mobile: "title",
      cell: (v) => (
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-1.5 font-[family-name:var(--wy-font-mono)] text-xs font-semibold tabular-nums">
            {v.vlanId}
          </span>
          <NameCell name={v.name} sub={v.description} />
        </div>
      ),
    },
    { id: "router", header: t("dhcp.router"), cell: (v) => routerName(v.routerId) },
    {
      id: "location",
      header: t("vlan.location"),
      className: "text-[var(--wy-text-muted)]",
      cell: (v) => locationName(v.locationId),
    },
    {
      id: "network",
      header: t("vlan.network"),
      mono: true,
      cell: (v) => `${v.gatewayIpAddress ?? "—"}${v.cidr ? ` / ${v.cidr}` : ""}`,
    },
    {
      id: "interface",
      header: t("vlan.interface"),
      cell: (v) => (
        <div className="space-y-0.5">
          <div className="font-[family-name:var(--wy-font-mono)] text-xs">
            {deviceInterfaceName(v)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--wy-text-muted)]">
            <span className="rounded border border-[var(--wy-border-strong)] px-1 capitalize leading-4">
              {v.portMode}
            </span>
            {v.portMode === "trunk"
              ? v.interface
                ? t("vlan.on", { interface: v.interface })
                : t("vlan.noParentSet")
              : t("vlan.dedicatedPort")}
          </div>
        </div>
      ),
    },
    {
      id: "portal",
      header: t("vlan.portal"),
      cell: (v) => (
        <StatusBadge status={v.enableHotspot ? "info" : "offline"} dot={false}>
          {v.enableHotspot ? t("vlan.on2") : t("vlan.off")}
        </StatusBadge>
      ),
    },
    { id: "status", header: t("dhcp.status"), cell: (v) => <EnabledBadge enabled={v.isEnabled} /> },
    { id: "push", header: t("dhcp.onRouter"), cell: (v) => <DevicePushBadge vlan={v} /> },
  ];

  return (
    <div className={SCREEN_ROOT}>
      {/* Shared with the master console's own /network/vlan route (rendered
       * with no locationId there) -- that audience keeps the precise
       * technical title/description; only the customer portal (which
       * always passes a real locationId, via OperationsFeatures.tsx's
       * VlansView) gets the friendlier name. Same id/route/data either way.
       * Under the customer shell this is the page's only header (`scope`). */}
      <PageHeader
        title={scope?.title ?? (plain ? t("vlan.networkZones") : t("vlan.vlanManagement"))}
        venue={scope?.venue}
        description={
          plain ? t("vlan.splitYourNetworkIntoSeparate") : t("vlan.perRouterVlanInventoryA")
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden className="mr-1.5 h-4 w-4" />{" "}
            {plain ? t("vlan.newZone") : t("vlan.newVlan")}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label={t("vlan.totalVlans")} value={data?.total ?? 0} loading={isLoading} />
        <StatTile
          label={t("dhcp.enabled")}
          value={enabledCount}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="ok" label={t("dhcp.enabled")} size="sm" />}
        />
        <StatTile
          label={t("dhcp.disabled")}
          value={rows.length - enabledCount}
          hint={statHint}
          loading={isLoading}
          leading={<StatusDot status="offline" label={t("dhcp.disabled")} size="sm" />}
        />
      </div>

      <Panel flush title={plain ? t("vlan.allZones") : t("vlan.allVlans")}>
        <Toolbar divided>
          <Select
            value={routerFilter}
            onValueChange={(v) => {
              setRouterFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label={t("dhcp.router")}>
              <SelectValue placeholder={t("dhcp.allRouters")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dhcp.allRouters")}</SelectItem>
              {/* Contract §11.5: the two kinds of device are listed
                  apart, and only the ones this platform configures are
                  selectable. See RouterPickerItems. */}
              <RouterPickerItems rows={routers.rows} />
            </SelectContent>
          </Select>
          <ToolbarSearch
            value={search}
            onValueChange={setSearch}
            placeholder={
              plain ? t("vlan.searchNameAddressRangeRouter") : t("vlan.searchNameTagCidrRouter")
            }
          />
        </Toolbar>
        <DataTable
          ariaLabel={plain ? t("vlan.allZones") : t("vlan.allVlans")}
          columns={columns}
          rows={rows}
          rowKey={(v) => v.id}
          loading={isLoading}
          loadingLabel={t("dhcp.loading")}
          empty={plain ? t("vlan.noZonesMatchYourFilters") : t("vlan.noVlansMatchYourFilters")}
          maxHeight="70vh"
          rowActions={(v) => {
            const pushing =
              (push.isPending && push.variables === v.id) || v.devicePushStatus === "provisioning";
            /* Apply is always visible, unlike the revealed edit/delete
               pair: this is the step that actually reaches the hardware,
               and a VLAN sitting at "Not applied" is the thing an operator
               most needs to notice. */
            return (
              <RowActions
                name={v.name}
                apply={{
                  label:
                    v.devicePushStatus === "provisioning"
                      ? t("vlan.applying")
                      : v.devicePushStatus === "active"
                        ? t("dhcp.reApply")
                        : t("dhcp.apply"),
                  pending: pushing,
                  quiet: v.devicePushStatus === "active",
                  onClick: () => handlePush(v),
                }}
                onEdit={() => setEditing(v)}
                onDelete={() => setConfirmDelete(v)}
              />
            );
          }}
          footer={
            data && data.totalPages > 1 ? (
              <TablePager
                summary={t("vlan.pageOfVlans", {
                  page,
                  totalPages: data.totalPages,
                  total: data.total,
                })}
                previousLabel={t("common.previous")}
                nextLabel={t("common.next")}
                hasPrevious={data.hasPrevious}
                hasNext={data.hasNext}
                onPrevious={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            ) : undefined
          }
        />
      </Panel>

      <VlanDialog
        open={creating || !!editing}
        vlan={editing}
        routers={routers.rows}
        plain={!!locationId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className={DIALOG_CONSOLE}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locationId
                ? t("vlan.deleteZoneTitle", { id: confirmDelete?.vlanId })
                : t("vlan.deleteVlanTitle", { id: confirmDelete?.vlanId })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("vlan.removeBody", {
                name: confirmDelete?.name,
                router: confirmDelete ? routerName(confirmDelete.routerId) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dhcp.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success(t("vlan.vlanDeleted", { name: confirmDelete.name }));
                } catch (err) {
                  toast.error((err as AppError).message || t("vlan.failedToDeleteVlan"));
                }
                setConfirmDelete(null);
              }}
            >
              {locationId ? t("vlan.deleteZone") : t("vlan.deleteVlan")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** `plain` = the venue-owner wording. The master console's own
 * /network/vlan route renders this with no locationId and keeps the precise
 * RouterOS vocabulary its audience works in; the customer portal always
 * passes one. Same id/route/data either way -- only these strings differ.
 *
 * The header of this page was renamed to "Network Zones" and the port-mode
 * options were rewritten by outcome (see the SelectContent below, which got
 * this right first). Everything between them was missed, so an owner clicked
 * "Network Zones" and was asked for an "802.1Q Tag" and a "CIDR". A rename
 * that stops at the title teaches the owner the rename was cosmetic. */
function VlanDialog({
  open,
  vlan,
  routers,
  plain,
  onClose,
}: {
  open: boolean;
  vlan: Vlan | null;
  routers: { id: string; name: string }[];
  plain: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("network", { i18n });
  const create = useCreateVlan();
  const update = useUpdateVlan();

  const defaults: VlanFormValues = vlan
    ? {
        routerId: vlan.routerId,
        vlanId: vlan.vlanId,
        name: vlan.name,
        gatewayIpAddress: vlan.gatewayIpAddress ?? "",
        cidr: vlan.cidr ?? "",
        portMode: vlan.portMode,
        // Never pre-ticked from a saved row: consent is for the change
        // being made now, and a box that arrives already ticked is not
        // consent to anything.
        confirmTakesPort: false,
        // One `interface` column on the wire, two fields in the form: load
        // it into whichever one this VLAN's mode actually uses.
        trunkInterface: vlan.portMode === "trunk" ? (vlan.interface ?? "") : "",
        accessPort: vlan.portMode === "access" ? (vlan.interface ?? "") : "",
        enableHotspot: vlan.enableHotspot,
        natEnabled: vlan.natEnabled,
        isEnabled: vlan.isEnabled,
      }
    : BLANK_VLAN_FORM;

  const form = useForm<VlanFormValues>({
    resolver: zodResolver(vlanSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const portMode = form.watch("portMode");
  const watchedVlanId = form.watch("vlanId");
  const watchedHotspot = form.watch("enableHotspot");
  const selectedRouterId = form.watch("routerId");
  const watchedInterface = form.watch(portMode === "access" ? "accessPort" : "trunkInterface");
  const id = useId();

  const {
    data: deviceInterfaces,
    isLoading: interfacesLoading,
    isError: interfacesErrored,
  } = useVlanDeviceInterfaces(selectedRouterId);
  const allInterfaces = deviceInterfaces ?? [];
  const trunkOptions = interfacesForMode(allInterfaces, "trunk");
  const accessOptions = interfacesForMode(allInterfaces, "access");
  // Access mode only ever offers bridge ports (see interfacesForMode), so a
  // chosen access port is ALWAYS being taken out of a bridge. The bridge
  // name comes off the same live interface read the picker is built from.
  const accessPortBridge =
    portMode === "access" && watchedInterface
      ? (allInterfaces.find((i) => i.name === watchedInterface)?.bridge ?? null)
      : null;
  // An unreadable router and a router with nothing suitable on it look the
  // same in the dropdown -- both are empty -- so the two are told apart here
  // and named, rather than leaving the customer with a dropdown that opens
  // onto nothing.
  const unreadable =
    "We couldn't read this router's interfaces. It may be offline, or we may not have its sign-in details yet — check the router, or type the name in yourself.";

  /** Resets the form on the way out, so the next open starts clean.
   *
   * `useForm`'s `values` prop only resyncs when the object it is handed
   * deep-changes, and two consecutive opens of the same target hand it the
   * same object: "New VLAN" straight after creating one gets the identical
   * blank defaults both times, so no reset fires. React Hook Form then
   * repopulates every input from the form state it kept as each field
   * re-registers, and the dialog reopens showing the last attempt's name,
   * gateway and CIDR. That is what the live dashboard was showing --
   * retained form state, not browser autofill. Resetting on close is the
   * convention NasDevicesPanel and SlaPanel already use. */
  function close() {
    form.reset(BLANK_VLAN_FORM);
    onClose();
  }

  async function submit(v: VlanFormValues) {
    // The mode decides which of the two interface fields is the answer; the
    // other one is deliberately dropped rather than sent.
    const shared = {
      vlanId: v.vlanId,
      name: v.name,
      gatewayIpAddress: v.gatewayIpAddress || null,
      cidr: v.cidr || null,
      interface: (v.portMode === "access" ? v.accessPort : v.trunkInterface) || null,
      portMode: v.portMode,
      // Only meaningful for access mode; harmless and false otherwise.
      confirmTakesPort: v.portMode === "access" ? v.confirmTakesPort : false,
      enableHotspot: v.enableHotspot,
      natEnabled: v.natEnabled,
      isEnabled: v.isEnabled,
    };
    try {
      if (vlan) {
        await update.mutateAsync({ id: vlan.id, payload: shared });
        toast.success(plain ? t("vlan.zoneUpdated") : t("vlan.vlanUpdated"));
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success(plain ? t("vlan.zoneCreated") : t("vlan.vlanCreated"));
      }
      close();
    } catch (err) {
      toast.error(
        (err as AppError).message ||
          (plain ? t("vlan.couldnTSaveThatZone") : t("vlan.failedToSaveVlan")),
      );
    }
  }

  const errors = form.formState.errors;
  const switchControl = (name: "enableHotspot" | "natEnabled" | "isEnabled") => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
    />
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={`${DIALOG_CONSOLE} max-w-lg`}>
        <DialogHeader>
          <DialogTitle>
            {plain
              ? vlan
                ? t("vlan.editZone")
                : t("vlan.newZone")
              : vlan
                ? t("vlan.editVlan")
                : t("vlan.newVlan")}
          </DialogTitle>
          <DialogDescription>
            {vlan ? t("vlan.theRouterThisVlanBelongs") : t("vlan.aVlanBelongsToExactly")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)}>
          <FormSection
            variant="plain"
            footer={
              <>
                <Button type="button" variant="ghost" onClick={close}>
                  {t("dhcp.cancel")}
                </Button>
                <Button type="submit" disabled={create.isPending || update.isPending}>
                  {vlan ? t("dhcp.saveChanges") : t("vlan.createVlan")}
                </Button>
              </>
            }
          >
            <FormField
              wide
              label={t("dhcp.router")}
              htmlFor={`${id}-router`}
              error={errors.routerId?.message && t(errors.routerId.message)}
            >
              <Controller
                control={form.control}
                name="routerId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!!vlan}>
                    <SelectTrigger id={`${id}-router`}>
                      <SelectValue placeholder={t("dhcp.selectRouter")} />
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
            <FormField
              label={t("dhcp.name")}
              htmlFor={`${id}-name`}
              error={errors.name?.message && t(errors.name.message)}
            >
              <Input
                id={`${id}-name`}
                {...form.register("name")}
                placeholder={t("vlan.guestWifi")}
              />
            </FormField>
            <FormField
              label={plain ? t("vlan.zoneId") : t("vlan.8021qTag")}
              htmlFor={`${id}-tag`}
              error={errors.vlanId?.message && t(errors.vlanId.message)}
            >
              <Input
                id={`${id}-tag`}
                type="number"
                min={1}
                max={4094}
                {...form.register("vlanId")}
              />
            </FormField>
            <FormField
              label={plain ? t("dhcp.routerAddressOptional") : t("dhcp.gatewayIpOptional")}
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
              label={plain ? t("vlan.addressRangeOptional") : t("vlan.cidrOptional")}
              htmlFor={`${id}-cidr`}
            >
              <Input
                id={`${id}-cidr`}
                {...form.register("cidr")}
                placeholder="10.0.0.0/24"
                className="font-mono"
              />
            </FormField>
            <FormField label={t("vlan.portMode")} htmlFor={`${id}-mode`}>
              <Controller
                control={form.control}
                name="portMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${id}-mode`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Named by outcome, not by network jargon. A customer
                        picked "Access" because their access point was on that
                        port, and the VLAN took the whole port and cut the AP
                        off the guest network. "Trunk" and "access port" are
                        correct RouterOS terms and meant nothing to them; the
                        stored values are unchanged, only these labels. */}
                      <SelectItem value="trunk">{t("vlan.shareTheExistingCableTagged")}</SelectItem>
                      <SelectItem value="access">{t("vlan.takeAWholePortFor")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            {portMode === "trunk" ? (
              <InterfacePicker
                control={form.control}
                name="trunkInterface"
                inputId={`${id}-iface`}
                label={plain ? t("vlan.whichCableDoesItUse") : t("vlan.trunkInterface")}
                hint={t("vlan.readLiveOffYourRouter")}
                manualPlaceholder="bridge"
                emptyMessage={
                  allInterfaces.length === 0 ? unreadable : t("vlan.nothingOnThisRouterCan")
                }
                options={trunkOptions}
                routerSelected={!!selectedRouterId}
                isLoading={interfacesLoading}
                isError={interfacesErrored}
                error={errors.trunkInterface?.message && t(errors.trunkInterface.message)}
              />
            ) : (
              <InterfacePicker
                control={form.control}
                name="accessPort"
                inputId={`${id}-iface`}
                label={plain ? t("vlan.whichPortDoesItTake") : t("vlan.accessPort")}
                hint={t("vlan.readLiveOffYourRouter2")}
                manualPlaceholder="ether3"
                emptyMessage={allInterfaces.length === 0 ? unreadable : t("vlan.noneOfThisRouterS")}
                options={accessOptions}
                routerSelected={!!selectedRouterId}
                isLoading={interfacesLoading}
                isError={interfacesErrored}
                error={errors.accessPort?.message && t(errors.accessPort.message)}
              />
            )}
            <FormSwitchRow
              wide
              label={plain ? t("vlan.guestsMustSignIn") : t("vlan.captivePortal")}
              description={
                plain ? t("vlan.anyoneJoiningThisZoneSees") : t("vlan.guestsOnThisVlanMust")
              }
              control={switchControl("enableHotspot")}
            />
            <FormSwitchRow
              wide
              label={t("vlan.internetAccessNat")}
              description={t("vlan.letDevicesInThisZone")}
              control={switchControl("natEnabled")}
            />
            {vlan && (
              <FormSwitchRow wide label={t("dhcp.enabled")} control={switchControl("isEnabled")} />
            )}
            {accessPortBridge && (
              <Callout
                tone="warn"
                className="sm:col-span-2"
                title={t("vlan.willBeRemovedFrom", { watchedInterface, accessPortBridge })}
                action={
                  <Controller
                    control={form.control}
                    name="confirmTakesPort"
                    render={({ field }) => (
                      <label className="flex min-h-10 cursor-pointer items-start gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--wy-warn)]"
                        />
                        <span>
                          <Trans
                            t={t}
                            i18nKey="vlan.takePortConfirm"
                            values={{ port: watchedInterface, bridge: accessPortBridge }}
                            components={{ b: <span /> }}
                          />
                        </span>
                      </label>
                    )}
                  />
                }
              >
                <Trans
                  t={t}
                  i18nKey="vlan.takePortWarning"
                  values={{ trunk: t("vlan.shareTheExistingCable") }}
                  components={{ b: <span className="font-medium" /> }}
                />
              </Callout>
            )}
            <Callout tone="info" className="sm:col-span-2">
              {watchedHotspot ? (
                <Trans
                  t={t}
                  i18nKey="vlan.portalCreatesDhcp"
                  values={{ what: t("vlan.ipAddressPoolAndDhcp") }}
                  components={{ b: <span className="font-medium" /> }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="vlan.networkOnly"
                  values={{
                    what: t("vlan.noAddressesAreHandedOut"),
                    pool: t("vlan.ipAddressPool"),
                    iface:
                      portMode === "access"
                        ? watchedInterface || t("vlan.thePortYouPickAbove")
                        : // ‹tag›, not <tag>: Trans would read an angle-bracket value as markup.
                          t("vlan.vlan", { tag: watchedVlanId || "‹tag›" }),
                  }}
                  components={{ b: <span className="font-medium" /> }}
                />
              )}
            </Callout>
          </FormSection>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The interface field, filled from what is really on the router.
 *
 * It replaced a free-text box whose placeholder was `bridgeLocal`, while the
 * bridge on the router a customer was actually configuring is called
 * `bridge`. That is a name nobody can guess, and a wrong guess only surfaced
 * at push time as a device error.
 *
 * Manual entry stays, because the read legitimately comes back empty for a
 * router that is offline or has no stored credentials, and a customer who
 * knows the name should not be stuck. It is deliberately the second choice:
 * behind a link, flagged while it is in use, and never the thing shown when
 * the picker has something to offer.
 */
function InterfacePicker({
  control,
  name,
  inputId,
  label,
  hint,
  manualPlaceholder,
  emptyMessage,
  options,
  routerSelected,
  isLoading,
  isError,
  error,
}: {
  control: Control<VlanFormValues>;
  name: "trunkInterface" | "accessPort";
  inputId: string;
  label: string;
  hint: string;
  manualPlaceholder: string;
  emptyMessage: string;
  options: VlanDeviceInterface[];
  routerSelected: boolean;
  isLoading: boolean;
  isError: boolean;
  error?: string;
}) {
  const { t } = useTranslation("network", { i18n });
  const [manual, setManual] = useState(false);
  const nothingToOffer = routerSelected && !isLoading && (isError || options.length === 0);

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      error={error}
      hint={manual ? t("vlan.typedByHandIfThis") : nothingToOffer ? emptyMessage : hint}
      hintTone={manual ? "warn" : "muted"}
      labelAction={
        <button
          type="button"
          className="rounded text-xs text-[var(--wy-text-muted)] underline underline-offset-2 hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
          onClick={() => setManual((m) => !m)}
        >
          {manual ? t("vlan.pickFromTheRouter") : t("dhcp.typeManually")}
        </button>
      }
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) =>
          manual ? (
            <Input
              {...field}
              id={inputId}
              value={field.value ?? ""}
              placeholder={manualPlaceholder}
              className="font-mono"
            />
          ) : (
            <Select
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={!routerSelected || isLoading || options.length === 0}
            >
              <SelectTrigger id={inputId}>
                <SelectValue
                  placeholder={
                    !routerSelected
                      ? t("vlan.chooseARouterFirst")
                      : isLoading
                        ? t("vlan.readingYourRouter")
                        : options.length === 0
                          ? t("vlan.nothingToChooseFrom")
                          : t("vlan.selectOne")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {/* A saved zone can point at a name the router no longer
                    reports — a renamed port, or a router that answered only
                    partially. Keeping it in the list stops an unrelated edit
                    from silently blanking a setting that works. */}
                {field.value && !options.some((i) => i.name === field.value) && (
                  <SelectItem value={field.value}>
                    {field.value} {t("vlan.notOnRouter")}
                  </SelectItem>
                )}
                {options.map((i) => (
                  <SelectItem key={i.name} value={i.name}>
                    {i.name}
                    {i.type ? ` · ${i.type}` : ""}
                    {i.bridge ? t("vlan.in", { bridge: i.bridge }) : ""}
                    {i.running ? t("vlan.up") : t("vlan.down")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
    </FormField>
  );
}
