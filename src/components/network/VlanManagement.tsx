import { useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Network,
  ShieldCheck,
  ShieldOff,
  Wifi,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useForm, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useVlans,
  useVlanKpis,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    routerId: z.string().min(1, "Select a router"),
    vlanId: z.coerce.number().int().min(1, "1-4094").max(4094, "1-4094"),
    name: z.string().trim().min(2, "Required").max(48),
    gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
    cidr: z.string().trim().optional().or(z.literal("")),
    portMode: z.enum(["trunk", "access"]),
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
        message: "Pick the interface this zone runs on — the router can't create it without one",
      });
    }
    if (v.portMode === "access" && !v.accessPort) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accessPort"],
        message: "Pick the port to hand over to this zone",
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
  trunkInterface: "",
  accessPort: "",
  enableHotspot: false,
  natEnabled: true,
  isEnabled: true,
};

const DEVICE_PUSH_LABEL: Record<VlanDevicePushStatus, string> = {
  active: "Applied",
  provisioning: "Applying…",
  pending: "Not yet applied",
  failed: "Couldn't apply",
};

const DEVICE_PUSH_STYLES: Record<VlanDevicePushStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  provisioning: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  pending: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  failed: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
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
  const badge = (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium", DEVICE_PUSH_STYLES[vlan.devicePushStatus])}
    >
      <span
        className={cn(
          "mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current",
          vlan.devicePushStatus === "provisioning" && "animate-pulse",
        )}
      />
      {DEVICE_PUSH_LABEL[vlan.devicePushStatus]}
    </Badge>
  );
  if (vlan.devicePushStatus !== "failed" || !vlan.devicePushError) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        Couldn&apos;t apply this VLAN to your router: {vlan.devicePushError}
      </TooltipContent>
    </Tooltip>
  );
}

export function VlanManagement({ locationId }: { locationId?: string } = {}) {
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
  const { data: kpis } = useVlanKpis();
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
      onSuccess: () => toast.success(`VLAN ${vlan.vlanId} applied to the router`),
      onError: (err) =>
        toast.error(
          (err as unknown as AppError)?.message ||
            `Couldn't apply VLAN ${vlan.vlanId} to the router`,
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
      return routerService.list({ page: 1, pageSize: 100 });
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

  return (
    <div className="space-y-6">
      {/* Shared with the master console's own /network/vlan route (rendered
       * with no locationId there) -- that audience keeps the precise
       * technical title/description; only the customer portal (which
       * always passes a real locationId, via OperationsFeatures.tsx's
       * VlansView) gets the friendlier name. Same id/route/data either way. */}
      <SectionHeader
        icon={Network}
        eyebrow="Network"
        title={locationId ? "Network Zones" : "VLAN Management"}
        description={
          locationId
            ? "Split your network into separate zones — e.g. guest Wi-Fi kept apart from staff or office devices — each with its own address range."
            : "Per-router VLAN inventory — a real 802.1Q tag, gateway, and CIDR record. Device push happens through a separate configuration pipeline."
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New VLAN
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total VLANs" value={kpis?.total ?? 0} icon={Network} tone="primary" />
        <StatCard label="Enabled" value={kpis?.enabled ?? 0} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={kpis?.disabled ?? 0} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All VLANs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={routerFilter}
              onValueChange={(v) => {
                setRouterFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All routers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routers</SelectItem>
                {routers.rows.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, tag, CIDR, router…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>VLAN</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On router</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No VLANs match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((v) => (
                <TableRow key={v.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                        {v.vlanId}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{v.name}</div>
                        {v.description && (
                          <div className="truncate text-xs text-muted-foreground">
                            {v.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{routerName(v.routerId)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {locationName(v.locationId)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {v.gatewayIpAddress ?? "—"}
                    {v.cidr ? ` / ${v.cidr}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="font-mono">{deviceInterfaceName(v)}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="capitalize">
                        {v.portMode}
                      </Badge>
                      {v.portMode === "trunk"
                        ? v.interface
                          ? `on ${v.interface}`
                          : "no parent set"
                        : "dedicated port"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {v.enableHotspot ? (
                      <Badge variant="default" className="gap-1">
                        <Wifi className="h-3 w-3" /> On
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Off</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.isEnabled ? "default" : "secondary"}>
                      {v.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DevicePushBadge vlan={v} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Always visible, unlike the hover-revealed edit/delete
                          pair: this is the step that actually reaches the
                          hardware, and a VLAN sitting at "Not applied" is the
                          thing an operator most needs to notice. */}
                      <Button
                        size="sm"
                        variant={v.devicePushStatus === "active" ? "ghost" : "outline"}
                        disabled={push.isPending || v.devicePushStatus === "provisioning"}
                        onClick={() => handlePush(v)}
                      >
                        {(push.isPending && push.variables === v.id) ||
                        v.devicePushStatus === "provisioning" ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-1 h-3.5 w-3.5" />
                        )}
                        {v.devicePushStatus === "provisioning"
                          ? "Applying…"
                          : v.devicePushStatus === "active"
                            ? "Re-apply"
                            : "Apply"}
                      </Button>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(v)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(v)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {data.totalPages} · {data.total} VLANs
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VlanDialog
        open={creating || !!editing}
        vlan={editing}
        routers={routers.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete VLAN {confirmDelete?.vlanId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes "{confirmDelete?.name}" from{" "}
              {confirmDelete ? routerName(confirmDelete.routerId) : ""}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success(`VLAN ${confirmDelete.name} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete VLAN");
                }
                setConfirmDelete(null);
              }}
            >
              Delete VLAN
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VlanDialog({
  open,
  vlan,
  routers,
  onClose,
}: {
  open: boolean;
  vlan: Vlan | null;
  routers: { id: string; name: string }[];
  onClose: () => void;
}) {
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
  const selectedRouterId = form.watch("routerId");
  const watchedInterface = form.watch(portMode === "access" ? "accessPort" : "trunkInterface");

  const {
    data: deviceInterfaces,
    isLoading: interfacesLoading,
    isError: interfacesErrored,
  } = useVlanDeviceInterfaces(selectedRouterId);
  const allInterfaces = deviceInterfaces ?? [];
  const trunkOptions = interfacesForMode(allInterfaces, "trunk");
  const accessOptions = interfacesForMode(allInterfaces, "access");
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
      enableHotspot: v.enableHotspot,
      natEnabled: v.natEnabled,
      isEnabled: v.isEnabled,
    };
    try {
      if (vlan) {
        await update.mutateAsync({ id: vlan.id, payload: shared });
        toast.success("VLAN updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success("VLAN created");
      }
      close();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save VLAN");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{vlan ? "Edit VLAN" : "New VLAN"}</DialogTitle>
          <DialogDescription>
            {vlan
              ? "The router this VLAN belongs to cannot be changed — delete and recreate to move it."
              : "A VLAN belongs to exactly one router for its whole lifetime."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!vlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select router" />
                  </SelectTrigger>
                  <SelectContent>
                    {routers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.routerId && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.routerId.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="Guest-WiFi" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">802.1Q Tag</Label>
            <Input type="number" min={1} max={4094} {...form.register("vlanId")} />
            {form.formState.errors.vlanId && (
              <p className="text-[11px] text-destructive">{form.formState.errors.vlanId.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Gateway IP (optional)</Label>
            <Input
              {...form.register("gatewayIpAddress")}
              placeholder="10.0.0.1"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">CIDR (optional)</Label>
            <Input {...form.register("cidr")} placeholder="10.0.0.0/24" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Port mode</Label>
            <Controller
              control={form.control}
              name="portMode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trunk">Trunk (tagged)</SelectItem>
                    <SelectItem value="access">Access (dedicated port)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {portMode === "trunk" ? (
            <InterfacePicker
              control={form.control}
              name="trunkInterface"
              label="Trunk interface"
              hint="Read live off your router. The zone's tagged traffic rides on this interface — usually the LAN bridge."
              manualPlaceholder="bridge"
              emptyMessage={
                allInterfaces.length === 0
                  ? unreadable
                  : "Nothing on this router can carry a tagged zone. Type a name in if you know it."
              }
              options={trunkOptions}
              routerSelected={!!selectedRouterId}
              isLoading={interfacesLoading}
              isError={interfacesErrored}
              error={form.formState.errors.trunkInterface?.message}
            />
          ) : (
            <InterfacePicker
              control={form.control}
              name="accessPort"
              label="Access port"
              hint="Read live off your router. This port carries this zone only, untagged — anything plugged into it lands here."
              manualPlaceholder="ether3"
              emptyMessage={
                allInterfaces.length === 0
                  ? unreadable
                  : "None of this router's ports belong to a bridge, and an access port has to. Add the port to the bridge on the router first, or use Trunk instead."
              }
              options={accessOptions}
              routerSelected={!!selectedRouterId}
              isLoading={interfacesLoading}
              isError={interfacesErrored}
              error={form.formState.errors.accessPort?.message}
            />
          )}
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Captive portal</div>
              <div className="text-[11px] text-muted-foreground">
                Guests on this VLAN must log in through a hotspot page.
              </div>
            </div>
            <Controller
              control={form.control}
              name="enableHotspot"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Internet access (NAT)</div>
              <div className="text-[11px] text-muted-foreground">
                Let devices in this zone out to the internet. Turn it off for a zone that should
                only see your own network — cameras or card readers, say.
              </div>
            </div>
            <Controller
              control={form.control}
              name="natEnabled"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          {vlan && (
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <div className="text-sm font-medium">Enabled</div>
              <Controller
                control={form.control}
                name="isEnabled"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-2.5 text-[11px] text-muted-foreground">
            This creates the network only — no addresses are handed out automatically. To assign IPs
            to guests, create an{" "}
            <span className="font-medium text-foreground">IP address pool</span> afterward with
            Interface set to{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              {portMode === "access"
                ? watchedInterface || "the port you pick above"
                : `vlan${watchedVlanId || "<tag>"}`}
            </code>
            .
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {vlan ? "Save changes" : "Create VLAN"}
            </Button>
          </DialogFooter>
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
  const [manual, setManual] = useState(false);
  const nothingToOffer = routerSelected && !isLoading && (isError || options.length === 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setManual((m) => !m)}
        >
          {manual ? "Pick from the router" : "Type manually"}
        </button>
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) =>
          manual ? (
            <Input
              {...field}
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
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !routerSelected
                      ? "Choose a router first"
                      : isLoading
                        ? "Reading your router…"
                        : options.length === 0
                          ? "Nothing to choose from"
                          : "Select one"
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
                    {field.value} · not on this router right now
                  </SelectItem>
                )}
                {options.map((i) => (
                  <SelectItem key={i.name} value={i.name}>
                    {i.name}
                    {i.type ? ` · ${i.type}` : ""}
                    {i.bridge ? ` · in ${i.bridge}` : ""}
                    {i.running ? " · up" : " · down"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
      />
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : manual ? (
        <p className="text-[11px] text-amber-600 dark:text-amber-500">
          Typed by hand — if this doesn't match the router exactly, applying the zone will fail.
        </p>
      ) : nothingToOffer ? (
        <p className="text-[11px] text-muted-foreground">{emptyMessage}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
