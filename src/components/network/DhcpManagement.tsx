import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Share2,
  ShieldCheck,
  ShieldOff,
  Server,
  UploadCloud,
  Loader2,
} from "lucide-react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useDhcpPools,
  useCreateDhcpPool,
  useUpdateDhcpPool,
  useDeleteDhcpPool,
  usePushDhcpPool,
} from "@/hooks/useDhcp";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
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

function DhcpIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 84 52"
      className="hidden h-12 w-auto shrink-0 sm:block"
      fill="none"
    >
      <rect
        x="6"
        y="16"
        width="24"
        height="20"
        rx="4"
        fill="#2e2a5c"
        stroke="#a78bfa"
        strokeWidth="1.6"
      />
      <circle cx="18" cy="26" r="4.5" fill="#1e1b4b" stroke="#22d3ee" strokeWidth="1.4" />
      <path
        d="M18 23v3l2 2"
        stroke="#22d3ee"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <motion.path
        d="M30 26h12"
        stroke="#4f46e5"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="1 4"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <rect
        x="42"
        y="8"
        width="36"
        height="36"
        rx="6"
        fill="#1e1b4b"
        stroke="#f0abfc"
        strokeWidth="1.6"
      />
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={i}
          x={49}
          y={16 + i * 8}
          width={22 - i * 4}
          height="4"
          rx="2"
          fill={["#a78bfa", "#22d3ee", "#f0abfc"][i]}
          fillOpacity="0.7"
          initial={shouldReduceMotion ? false : { scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.12 * i, ease: "easeOut" }}
          style={{ transformOrigin: `49px ${18 + i * 8}px` }}
        />
      ))}
    </svg>
  );
}

const DEVICE_PUSH_LABEL: Record<DhcpDevicePushStatus, string> = {
  active: "Applied",
  pending: "Not yet applied",
  failed: "Couldn't apply",
};

const DEVICE_PUSH_STYLES: Record<DhcpDevicePushStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  pending: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  failed: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
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
  const badge = (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium", DEVICE_PUSH_STYLES[pool.devicePushStatus])}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {DEVICE_PUSH_LABEL[pool.devicePushStatus]}
    </Badge>
  );
  if (pool.devicePushStatus !== "failed" || !pool.devicePushError) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        Couldn&apos;t apply this pool to your router: {pool.devicePushError}
      </TooltipContent>
    </Tooltip>
  );
}

export function DhcpManagement({ locationId }: { locationId?: string } = {}) {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DhcpPool | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DhcpPool | null>(null);

  // useIsDemo(), not isDemo() directly, for anything that feeds a hook's
  // `enabled` (i.e. affects the very first render's query state): isDemo()
  // reads localStorage synchronously, so it resolves differently during
  // the server render pass (no window -> false) than during the client's
  // first hydration pass (real token -> true) -- react-query's isLoading
  // for that instant differs right along with it (a real "Hydration
  // failed" on this page's "Loading…"/"No pools match your filters" text,
  // not just a flash). useIsDemo() instead starts at the same value on
  // both sides and only flips post-mount, same fix as AlertsView/
  // BusinessHoursView elsewhere in this session.
  const demoFlag = useIsDemo();

  // `list_pools`/etc. resolve their tenant scope from CurrentOrganization
  // (X-Organization-Id) -- an ordinary org-owner session holds no
  // GLOBAL-scope fallback, so the location-scoped (customer dashboard) case
  // must resolve and thread its real org id. The master console's
  // unscoped view deliberately leaves it unset (spans every org).
  // Demo mode never needs a real org id (dhcpService.list()/DEMO_ROUTERS
  // below both short-circuit on isDemo() before touching it) -- resolving
  // it anyway meant the demo account's DHCP page always fired one real,
  // 401ing `/me/organizations` request on load for a value nothing used.
  const { data: scopedOrgId } = useQuery({
    queryKey: ["dhcp", "org-id"],
    queryFn: resolveOrgId,
    enabled: !!locationId && !demoFlag,
  });

  // The backend's `GET /dhcp-pools` only filters by `router_id`, not
  // location -- so a location-scoped view (the customer dashboard's DHCP
  // Pool page) fetches one full (up to max page_size) page and narrows +
  // paginates it client-side below, same tradeoff `routerService.list`
  // already makes for its own "all routers" case.
  const { data, isLoading } = useDhcpPools(
    {
      page: locationId ? 1 : page,
      pageSize: locationId ? 100 : PAGE_SIZE,
      routerId: routerFilter === "all" ? undefined : routerFilter,
      organizationId: locationId ? scopedOrgId : undefined,
    },
    { enabled: locationId ? demoFlag || !!scopedOrgId : true },
  );
  const del = useDeleteDhcpPool();
  const push = usePushDhcpPool();

  function handlePush(pool: DhcpPool) {
    push.mutate(
      { id: pool.id, organizationId: locationId ? scopedOrgId : undefined },
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
      return routerService.list({ page: 1, pageSize: 100 });
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
  const enabledCount = rows.filter((p) => p.isEnabled).length;

  return (
    <div className="space-y-6">
      {/* Shared with the master console's own /network/dhcp route (rendered
       * with no locationId there) -- that audience keeps the precise
       * technical title/description; only the customer portal (which
       * always passes a real locationId, via OperationsFeatures.tsx's
       * DhcpView) gets the friendlier name. Same id/route/data either way. */}
      <SectionHeader
        icon={Server}
        eyebrow="Network"
        title={locationId ? "IP Addresses" : "DHCP Pool Management"}
        description={
          locationId
            ? "The pool of IP addresses your router hands out to guest devices, plus their gateway, DNS and how long each address is held."
            : "Per-router DHCP address pools, gateway, DNS and lease time. Apply a pool to send it to the router."
        }
        illustration={<DhcpIllustration />}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Pool
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pools" value={total} icon={Share2} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard
          label="Disabled"
          value={rows.length - enabledCount}
          icon={ShieldOff}
          tone="warning"
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All DHCP Pools</CardTitle>
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
                placeholder="Search name, range, router…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pool</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Address range</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>DNS</TableHead>
                <TableHead>Lease</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On router</TableHead>
                <TableHead className="w-[160px]" />
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
                    No DHCP pools match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      {p.interface && (
                        <div className="truncate text-xs text-muted-foreground">{p.interface}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{routerName(p.routerId)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.addressRangeStart} – {p.addressRangeEnd}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.gatewayIpAddress ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {[p.dnsPrimary, p.dnsSecondary].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Math.round(p.leaseTimeSeconds / 3600)}h
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isEnabled ? "default" : "secondary"}>
                      {p.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DevicePushBadge pool={p} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {/* Always visible, unlike the hover-revealed edit/delete
                          pair: this is the step that actually reaches the
                          hardware, and a pool sitting at "Not yet applied" is
                          the thing an operator most needs to notice -- it is
                          the difference between a guest getting an address and
                          getting nothing. */}
                      <Button
                        size="sm"
                        variant={p.devicePushStatus === "active" ? "ghost" : "outline"}
                        disabled={push.isPending && push.variables?.id === p.id}
                        onClick={() => handlePush(p)}
                      >
                        {push.isPending && push.variables?.id === p.id ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-1 h-3.5 w-3.5" />
                        )}
                        {p.devicePushStatus === "active" ? "Re-apply" : "Apply"}
                      </Button>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(p)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} pools
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DhcpDialog
        open={creating || !!editing}
        pool={editing}
        routers={routers.rows}
        organizationId={locationId ? scopedOrgId : undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pool "{confirmDelete?.name}"?</AlertDialogTitle>
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
                  await del.mutateAsync({
                    id: confirmDelete.id,
                    organizationId: locationId ? scopedOrgId : undefined,
                  });
                  toast.success(`Pool ${confirmDelete.name} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete pool");
                }
                setConfirmDelete(null);
              }}
            >
              Delete pool
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DhcpDialog({
  open,
  pool,
  routers,
  organizationId,
  onClose,
}: {
  open: boolean;
  pool: DhcpPool | null;
  routers: { id: string; name: string }[];
  organizationId?: string;
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

  // Real interfaces read live off the device, not guessed -- excludes
  // whatever's already bound to a dhcp-server/dhcp-client on the router
  // itself (backend-filtered, see routerService.getDeviceInterfaces).
  const {
    data: deviceInterfaces,
    isLoading: interfacesLoading,
    isError: interfacesErrored,
  } = useQuery({
    queryKey: ["dhcp", "device-interfaces", selectedRouterId, organizationId],
    queryFn: () => routerService.getDeviceInterfaces(selectedRouterId, organizationId),
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
        await update.mutateAsync({ id: pool.id, payload: shared, organizationId });
        toast.success("DHCP pool updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared, organizationId });
        toast.success("DHCP pool created");
      }
      close();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save pool");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pool ? "Edit DHCP pool" : "New DHCP pool"}</DialogTitle>
          <DialogDescription>
            {pool
              ? "The router this pool belongs to cannot be changed — delete and recreate to move it."
              : "A DHCP pool belongs to exactly one router for its whole lifetime."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!pool}>
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
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="Guest pool" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Range start</Label>
            <Input
              {...form.register("addressRangeStart")}
              placeholder="10.0.0.10"
              className="font-mono"
            />
            {form.formState.errors.addressRangeStart && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.addressRangeStart.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Range end</Label>
            <Input
              {...form.register("addressRangeEnd")}
              placeholder="10.0.0.250"
              className="font-mono"
            />
            {form.formState.errors.addressRangeEnd && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.addressRangeEnd.message}
              </p>
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
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Interface</Label>
              {!manualInterface && (
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setManualInterface(true)}
                >
                  Type manually
                </button>
              )}
            </div>
            {manualInterface ? (
              <Input {...form.register("interface")} placeholder="bridgeLocal, ether3, vlan3…" />
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
                    <SelectTrigger>
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
            {form.formState.errors.interface ? (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.interface.message}
              </p>
            ) : interfacesErrored ? (
              <p className="text-[11px] text-destructive">
                Couldn't reach the router to list its interfaces — type the name manually.
              </p>
            ) : selectedRouterId && !interfacesLoading && deviceInterfaces?.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No available interfaces on this router (everything's already in use, or it's
                offline) — type one manually if you're sure.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Read live off the router — already-in-use interfaces are left out.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">DNS primary (optional)</Label>
            <Input {...form.register("dnsPrimary")} placeholder="8.8.8.8" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">DNS secondary (optional)</Label>
            <Input {...form.register("dnsSecondary")} placeholder="8.8.4.4" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Lease time (seconds)</Label>
            <Input type="number" min={1} {...form.register("leaseTimeSeconds")} />
            {form.formState.errors.leaseTimeSeconds && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.leaseTimeSeconds.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div className="text-sm font-medium">Enabled</div>
            <Controller
              control={form.control}
              name="isEnabled"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {pool ? "Save changes" : "Create pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
