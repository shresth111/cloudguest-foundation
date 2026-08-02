import { useState } from "react";
import { Plus, Search, Trash2, Pencil, ArrowRightLeft, ShieldCheck, ShieldOff, Share2 } from "lucide-react";
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
import {
  usePortForwardingRules,
  usePortForwardingKpis,
  useCreatePortForwardingRule,
  useUpdatePortForwardingRule,
  useDeletePortForwardingRule,
} from "@/hooks/usePortForwarding";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import type { AppError } from "@/services/api";
import type { PortForwardingRule } from "@/types/port-forwarding";

const PAGE_SIZE = 25;
const PROTOCOLS = ["tcp", "udp", "both"] as const;

const ruleSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(48),
  protocol: z.enum(PROTOCOLS),
  sourceAddress: z.string().trim().optional().or(z.literal("")),
  destinationAddress: z.string().trim().optional().or(z.literal("")),
  destinationPort: z.coerce.number().int().min(1).max(65535),
  internalAddress: z.string().trim().min(1, "Required"),
  internalPort: z.coerce.number().int().min(1).max(65535),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

export function PortForwardingManagement({ locationId }: { locationId?: string } = {}) {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PortForwardingRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PortForwardingRule | null>(null);

  // useIsDemo(), not isDemo() directly, for anything that feeds a hook's
  // `enabled` -- see DhcpManagement's identical comment: isDemo() resolves
  // differently between the server render pass and the client's first
  // hydration pass, which threw a real "Hydration failed" on this page's
  // loading/empty-state text. useIsDemo() starts at the same value on
  // both sides and only flips post-mount.
  const demoFlag = useIsDemo();

  // `list_port_forwarding_rules`/etc. resolve their tenant scope from
  // CurrentOrganization (X-Organization-Id) -- an ordinary org-owner session
  // holds no GLOBAL-scope fallback, so the location-scoped (customer
  // dashboard) case must resolve and thread its real org id. The master
  // console's unscoped view deliberately leaves it unset (spans every org).
  // Demo mode never needs a real org id (portForwardingService's list/kpis
  // and DEMO_ROUTERS below both short-circuit on isDemo() before touching
  // it) -- resolving it anyway meant the demo account's Port Forwarding
  // page always fired one real, 401ing `/me/organizations` request on load
  // for a value nothing used.
  const { data: scopedOrgId } = useQuery({
    queryKey: ["port-forwarding", "org-id"],
    queryFn: resolveOrgId,
    enabled: !!locationId && !demoFlag,
  });

  // The backend's `GET /port-forwarding/rules` only filters by `router_id`,
  // not location -- so a location-scoped view (the customer dashboard's Port
  // Forwarding page) fetches one full (up to max page_size) page and narrows
  // + paginates it client-side below, same tradeoff DhcpManagement makes.
  const { data, isLoading } = usePortForwardingRules(
    {
      page: locationId ? 1 : page,
      pageSize: locationId ? 100 : PAGE_SIZE,
      routerId: routerFilter === "all" ? undefined : routerFilter,
      organizationId: locationId ? scopedOrgId : undefined,
    },
    { enabled: locationId ? (demoFlag || !!scopedOrgId) : true },
  );
  const { data: kpis } = usePortForwardingKpis(locationId ? scopedOrgId : undefined, {
    enabled: locationId ? (demoFlag || !!scopedOrgId) : true,
  });
  const del = useDeletePortForwardingRule();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["port-forwarding", "router-options", locationId],
    queryFn: async () => {
      // Location-scoped: use the location-scoped router endpoint directly
      // (mirrors DhcpManagement/VlanManagement) -- `routerService.list()`'s
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

  const filteredRows = (data?.rows ?? []).filter((r) => {
    if (locationId && r.locationId !== locationId) return false;
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(t) ||
      String(r.destinationPort).includes(t) ||
      r.internalAddress.includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
    );
  });

  const rows = locationId ? filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : filteredRows;
  const total = locationId ? filteredRows.length : data?.total ?? 0;
  const totalPages = locationId ? Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)) : data?.totalPages ?? 1;
  const hasNext = locationId ? page < totalPages : !!data?.hasNext;
  const hasPrevious = locationId ? page > 1 : !!data?.hasPrevious;
  // The dedicated KPI endpoint isn't location-scoped (same backend gap as
  // the list endpoint), so a location-scoped view derives its stat tiles
  // from the already-narrowed filteredRows instead of the org-wide kpis
  // query -- same tradeoff DhcpManagement makes.
  const scopedEnabled = filteredRows.filter((r) => r.isEnabled).length;
  const statTotal = locationId ? total : kpis?.total ?? 0;
  const statEnabled = locationId ? scopedEnabled : kpis?.enabled ?? 0;
  const statDisabled = locationId ? total - scopedEnabled : kpis?.disabled ?? 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Share2}
        eyebrow="Network"
        title="Port Forwarding"
        description="Per-router NAT rules mapping a public destination port to an internal address/port."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Rule
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Rules" value={statTotal} icon={ArrowRightLeft} tone="primary" />
        <StatCard label="Enabled" value={statEnabled} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={statDisabled} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All Rules</CardTitle>
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
                placeholder="Search name, port, address, router…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Internal target</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No port forwarding rules match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.description && (
                        <div className="truncate text-xs text-muted-foreground">{r.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{routerName(r.routerId)}</TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">{r.protocol}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.destinationAddress ?? "any"}:{r.destinationPort}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.internalAddress}:{r.internalPort}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.isEnabled ? "default" : "secondary"}>
                      {r.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} rules
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!hasPrevious} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <RuleDialog
        open={creating || !!editing}
        rule={editing}
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
            <AlertDialogTitle>Delete rule "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes this port forwarding rule from{" "}
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
                  toast.success(`Rule "${confirmDelete.name}" deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete rule");
                }
                setConfirmDelete(null);
              }}
            >
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleDialog({
  open,
  rule,
  routers,
  organizationId,
  onClose,
}: {
  open: boolean;
  rule: PortForwardingRule | null;
  routers: { id: string; name: string }[];
  organizationId?: string;
  onClose: () => void;
}) {
  const create = useCreatePortForwardingRule();
  const update = useUpdatePortForwardingRule();

  const defaults: RuleFormValues = rule
    ? {
        routerId: rule.routerId,
        name: rule.name,
        protocol: (rule.protocol as (typeof PROTOCOLS)[number]) ?? "both",
        sourceAddress: rule.sourceAddress ?? "",
        destinationAddress: rule.destinationAddress ?? "",
        destinationPort: rule.destinationPort,
        internalAddress: rule.internalAddress,
        internalPort: rule.internalPort,
        description: rule.description ?? "",
        isEnabled: rule.isEnabled,
      }
    : {
        routerId: "",
        name: "",
        protocol: "both",
        sourceAddress: "",
        destinationAddress: "",
        destinationPort: 8080,
        internalAddress: "",
        internalPort: 80,
        description: "",
        isEnabled: true,
      };

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: RuleFormValues) {
    try {
      if (rule) {
        await update.mutateAsync({
          id: rule.id,
          payload: {
            name: v.name,
            protocol: v.protocol,
            sourceAddress: v.sourceAddress || null,
            destinationAddress: v.destinationAddress || null,
            destinationPort: v.destinationPort,
            internalAddress: v.internalAddress,
            internalPort: v.internalPort,
            description: v.description || null,
            isEnabled: v.isEnabled,
          },
          organizationId,
        });
        toast.success("Rule updated");
      } else {
        await create.mutateAsync({
          routerId: v.routerId,
          name: v.name,
          protocol: v.protocol,
          sourceAddress: v.sourceAddress || null,
          destinationAddress: v.destinationAddress || null,
          destinationPort: v.destinationPort,
          internalAddress: v.internalAddress,
          internalPort: v.internalPort,
          description: v.description || null,
          isEnabled: v.isEnabled,
          organizationId,
        });
        toast.success("Rule created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save rule");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New rule"}</DialogTitle>
          <DialogDescription>
            {rule
              ? "The router this rule belongs to cannot be changed — delete and recreate to move it."
              : "A port forwarding rule belongs to exactly one router."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!rule}>
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
              <p className="text-[11px] text-destructive">{form.formState.errors.routerId.message}</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="Web server" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Protocol</Label>
            <Controller
              control={form.control}
              name="protocol"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOLS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Destination port</Label>
            <Input type="number" min={1} max={65535} {...form.register("destinationPort")} />
            {form.formState.errors.destinationPort && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.destinationPort.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Source address (optional)</Label>
            <Input {...form.register("sourceAddress")} placeholder="0.0.0.0/0" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Destination address (optional)</Label>
            <Input {...form.register("destinationAddress")} placeholder="WAN IP" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Internal address</Label>
            <Input {...form.register("internalAddress")} placeholder="10.0.0.10" />
            {form.formState.errors.internalAddress && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.internalAddress.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Internal port</Label>
            <Input type="number" min={1} max={65535} {...form.register("internalPort")} />
            {form.formState.errors.internalPort && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.internalPort.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input {...form.register("description")} placeholder="Internal purpose of this rule" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border p-3">
            <Label className="text-xs font-medium">Enabled</Label>
            <Controller
              control={form.control}
              name="isEnabled"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {rule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
