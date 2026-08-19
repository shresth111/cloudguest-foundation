import { useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Gauge,
  Signal,
  ShieldCheck,
  ShieldOff,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import {
  useQosRules,
  useCreateQosRule,
  useUpdateQosRule,
  useDeleteQosRule,
  usePushQosRule,
} from "@/hooks/useQos";
import { routerService } from "@/services/router.service";
import { isDemo, resolveOrgId } from "@/services/customer.service";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import type { AppError } from "@/services/api";
import type { DevicePushStatus, QosTrafficRule } from "@/types/qos";

const PAGE_SIZE = 25;
const PROTOCOLS = ["tcp", "udp"] as const;
const MATCH_KINDS = ["port", "dscp"] as const;

// Mirrors app.domains.qos.validators.validate_traffic_match: exactly one
// match kind (a port range, both bounds present, or a DSCP value) is
// required per rule -- never both, never neither.
const ruleSchema = z
  .object({
    routerId: z.string().min(1, "Select a router"),
    name: z.string().trim().min(2, "Required").max(48),
    matchKind: z.enum(MATCH_KINDS),
    protocol: z.enum(PROTOCOLS),
    portRangeStart: z.coerce.number().int().min(1).max(65535).optional(),
    portRangeEnd: z.coerce.number().int().min(1).max(65535).optional(),
    dscpValue: z.coerce.number().int().min(0).max(63).optional(),
    priority: z.coerce.number().int().min(1).max(8),
    isEnabled: z.boolean(),
  })
  .refine(
    (v) =>
      v.matchKind !== "port" ||
      (v.portRangeStart != null && v.portRangeEnd != null && v.portRangeStart <= v.portRangeEnd),
    { message: "Enter a valid port range (start ≤ end)", path: ["portRangeEnd"] },
  )
  .refine((v) => v.matchKind !== "dscp" || v.dscpValue != null, {
    message: "Enter a DSCP value (0-63)",
    path: ["dscpValue"],
  });
type RuleFormValues = z.infer<typeof ruleSchema>;

function matchLabel(r: QosTrafficRule): string {
  if (r.dscpValue != null) return `DSCP ${r.dscpValue}`;
  if (r.portRangeStart != null && r.portRangeEnd != null) {
    const proto = r.protocol ? r.protocol.toUpperCase() : "";
    return r.portRangeStart === r.portRangeEnd
      ? `${proto} ${r.portRangeStart}`
      : `${proto} ${r.portRangeStart}-${r.portRangeEnd}`;
  }
  return "—";
}

// Plain-language labels for the real device-push state -- never surface the
// backend's own "queue tree"/"packet mark"/"device push" vocabulary here,
// this is what tells a customer whether a rule they created is actually
// doing anything on their real router or just sitting as a database row.
const DEVICE_PUSH_LABEL: Record<DevicePushStatus, string> = {
  active: "Applied to your router",
  pending: "Not yet applied",
  failed: "Couldn't apply",
};

const DEVICE_PUSH_STYLES: Record<DevicePushStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  pending: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400",
  failed: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400",
};

// The badge alone can't hold a full error message -- a failed push wraps it
// in a tooltip so the reason is one hover away instead of swallowed. Errors
// come straight from the backend/router, so wording isn't guaranteed to be
// customer-plain; showing it beats hiding it.
function DevicePushBadge({ rule }: { rule: QosTrafficRule }) {
  const badge = (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium", DEVICE_PUSH_STYLES[rule.devicePushStatus])}
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {DEVICE_PUSH_LABEL[rule.devicePushStatus]}
    </Badge>
  );
  if (rule.devicePushStatus !== "failed" || !rule.devicePushError) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        Couldn't apply this rule to your router: {rule.devicePushError}
      </TooltipContent>
    </Tooltip>
  );
}

// Was a page of decorative ToggleRows / a plain useState switch -- "Enable /
// Disable VOIP Priority" and the prioritization rule toggles only ever fired
// a toast, nothing was ever read from or written to a backend, and a reload
// silently discarded every change (the KPI tiles above them -- "Active
// calls", "Jitter", "Packet loss" -- were hardcoded display values too, with
// no live source to back them; dropped here rather than faked). The real
// domain already exists end-to-end (app.domains.qos, the `qos_traffic_rules`
// table) -- unlike VLAN/DHCP/Port Forwarding/Hotspot/ISP Routing, no
// frontend component existed yet to reuse, so this one is new, following
// PortForwardingManagement's own structure/conventions (including its
// orgHeaders/scopedOrgId pattern) so it doesn't repeat this session's most
// common bug on day one.
export function QosManagement({ locationId }: { locationId?: string } = {}) {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<QosTrafficRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<QosTrafficRule | null>(null);

  // useIsDemo(), not isDemo() directly, for anything that feeds a hook's
  // `enabled` -- see DhcpManagement's identical comment: isDemo() resolves
  // differently between the server render pass and the client's first
  // hydration pass, which threw a real "Hydration failed" on this page's
  // loading/empty-state text. useIsDemo() starts at the same value on
  // both sides and only flips post-mount.
  const demoFlag = useIsDemo();

  // Demo mode never needs a real org id (qosService.list() and
  // DEMO_ROUTERS below both short-circuit on isDemo() before touching
  // it) -- resolving it anyway meant the demo account's VOIP Priority
  // page always fired one real, 401ing `/me/organizations` request on
  // load for a value nothing used.
  const { data: scopedOrgId } = useQuery({
    queryKey: ["qos", "org-id"],
    queryFn: resolveOrgId,
    enabled: !!locationId && !demoFlag,
  });

  // The backend's `GET /qos-rules` only filters by `router_id`, not
  // location -- so a location-scoped view (the customer dashboard's VOIP
  // Priority page) fetches one full (up to max page_size) page and narrows +
  // paginates it client-side below, same tradeoff PortForwardingManagement/
  // DhcpManagement make.
  const { data, isLoading } = useQosRules(
    {
      page: locationId ? 1 : page,
      pageSize: locationId ? 100 : PAGE_SIZE,
      routerId: routerFilter === "all" ? undefined : routerFilter,
      organizationId: locationId ? scopedOrgId : undefined,
    },
    { enabled: locationId ? demoFlag || !!scopedOrgId : true },
  );
  const del = useDeleteQosRule();
  const push = usePushQosRule();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["qos", "router-options", locationId],
    queryFn: async () => {
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
      matchLabel(r).toLowerCase().includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
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
  const enabledCount = filteredRows.filter((r) => r.isEnabled).length;
  const voiceCount = filteredRows.filter(
    (r) => r.protocol && [5060, 5061].includes(r.portRangeStart ?? -1),
  ).length;

  async function handlePush(rule: QosTrafficRule) {
    try {
      await push.mutateAsync({ id: rule.id, organizationId: locationId ? scopedOrgId : undefined });
      toast.success(`"${rule.name}" applied to your router`);
    } catch (err) {
      toast.error((err as AppError).message || `Couldn't apply "${rule.name}" to your router`);
    }
  }

  return (
    <div className="space-y-6">
      {/* No master-console route renders QosManagement today (grep confirms
       * OperationsFeatures.tsx's VoipView, always with a real locationId,
       * is the only caller) -- guarded the same locationId-aware way as
       * DhcpManagement/VlanManagement anyway, so an internal/no-locationId
       * caller added later keeps the precise technical title by default
       * instead of silently inheriting the customer-friendly one. */}
      <SectionHeader
        icon={Signal}
        eyebrow="Network"
        title={locationId ? "Call Priority" : "VOIP Priority"}
        description={
          locationId
            ? "Give voice and video calls priority over other guest traffic, so calls stay clear even on a busy network."
            : "Traffic-classification rules -- match voice signaling/media (or a raw DSCP value) and assign a real RouterOS queue priority."
        }
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Rule
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Rules" value={total} icon={Gauge} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard label="SIP rules (5060/5061)" value={voiceCount} icon={Signal} tone="info" />
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
                placeholder="Search name, match, router…"
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
                <TableHead>Match</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>On your router</TableHead>
                <TableHead className="w-[110px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No QoS rules match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => {
                const isPushing = push.isPending && push.variables?.id === r.id;
                return (
                  <TableRow key={r.id} className="group">
                    <TableCell className="min-w-0 truncate font-medium">{r.name}</TableCell>
                    <TableCell className="text-sm">{routerName(r.routerId)}</TableCell>
                    <TableCell className="font-mono text-xs">{matchLabel(r)}</TableCell>
                    <TableCell className="text-sm">{r.priority}</TableCell>
                    <TableCell>
                      <Badge variant={r.isEnabled ? "default" : "secondary"}>
                        {r.isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DevicePushBadge rule={r} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={isPushing}
                              onClick={() => handlePush(r)}
                            >
                              {isPushing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <UploadCloud className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Apply to your router</TooltipContent>
                        </Tooltip>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(r)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages} · {total} rules
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
              This permanently removes this QoS rule from{" "}
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
  rule: QosTrafficRule | null;
  routers: { id: string; name: string }[];
  organizationId?: string;
  onClose: () => void;
}) {
  const create = useCreateQosRule();
  const update = useUpdateQosRule();

  const defaults: RuleFormValues = rule
    ? {
        routerId: rule.routerId,
        name: rule.name,
        matchKind: rule.dscpValue != null ? "dscp" : "port",
        protocol: (rule.protocol as (typeof PROTOCOLS)[number]) ?? "udp",
        portRangeStart: rule.portRangeStart ?? undefined,
        portRangeEnd: rule.portRangeEnd ?? undefined,
        dscpValue: rule.dscpValue ?? undefined,
        priority: rule.priority,
        isEnabled: rule.isEnabled,
      }
    : {
        routerId: "",
        name: "",
        matchKind: "port",
        protocol: "udp",
        portRangeStart: 5060,
        portRangeEnd: 5061,
        dscpValue: undefined,
        priority: 1,
        isEnabled: true,
      };

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: defaults,
    values: defaults,
  });
  const matchKind = form.watch("matchKind");

  async function submit(v: RuleFormValues) {
    const payload = {
      name: v.name,
      protocol: v.matchKind === "port" ? v.protocol : null,
      portRangeStart: v.matchKind === "port" ? v.portRangeStart! : null,
      portRangeEnd: v.matchKind === "port" ? v.portRangeEnd! : null,
      dscpValue: v.matchKind === "dscp" ? v.dscpValue! : null,
      priority: v.priority,
      isEnabled: v.isEnabled,
    };
    try {
      if (rule) {
        await update.mutateAsync({ id: rule.id, payload, organizationId });
        toast.success("Rule updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...payload, organizationId });
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
              : "Match traffic by a port range (e.g. SIP 5060/5061) or by a raw DSCP value — never both."}
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
              <p className="text-[11px] text-destructive">
                {form.formState.errors.routerId.message}
              </p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="SIP signaling" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Match by</Label>
            <Controller
              control={form.control}
              name="matchKind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="port">Protocol / port range</SelectItem>
                    <SelectItem value="dscp">DSCP value</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {matchKind === "port" ? (
            <>
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
              <div />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Port range start</Label>
                <Input type="number" min={1} max={65535} {...form.register("portRangeStart")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Port range end</Label>
                <Input type="number" min={1} max={65535} {...form.register("portRangeEnd")} />
                {form.formState.errors.portRangeEnd && (
                  <p className="text-[11px] text-destructive">
                    {form.formState.errors.portRangeEnd.message}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">DSCP value (0-63)</Label>
              <Input
                type="number"
                min={0}
                max={63}
                {...form.register("dscpValue")}
                placeholder="46 (EF, voice)"
              />
              {form.formState.errors.dscpValue && (
                <p className="text-[11px] text-destructive">
                  {form.formState.errors.dscpValue.message}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority (1 = highest)</Label>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-xs font-medium">Enabled</Label>
            <Controller
              control={form.control}
              name="isEnabled"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
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
