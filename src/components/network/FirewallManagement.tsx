import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Shield, ShieldCheck, ShieldOff } from "lucide-react";
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
  useFirewallRules,
  useCreateFirewallRule,
  useUpdateFirewallRule,
  useDeleteFirewallRule,
} from "@/hooks/useFirewall";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { FirewallAction, FirewallChain, FirewallProtocol, FirewallRule } from "@/types/firewall";

const PAGE_SIZE = 25;
const CHAINS: FirewallChain[] = ["input", "forward", "output"];
const ACTIONS: FirewallAction[] = ["accept", "drop", "reject"];
const PROTOCOLS: FirewallProtocol[] = ["all", "tcp", "udp", "icmp"];

const firewallSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(64),
  chain: z.enum(["input", "forward", "output"]),
  action: z.enum(["accept", "drop", "reject"]),
  protocol: z.enum(["all", "tcp", "udp", "icmp"]),
  sourceAddress: z.string().trim().optional().or(z.literal("")),
  destinationAddress: z.string().trim().optional().or(z.literal("")),
  sourcePort: z.coerce.number().int().min(1).max(65535).optional().or(z.nan()),
  destinationPort: z.coerce.number().int().min(1).max(65535).optional().or(z.nan()),
  inInterface: z.string().trim().optional().or(z.literal("")),
  priority: z.coerce.number().int().min(0),
  comment: z.string().trim().max(240).optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type FirewallFormValues = z.infer<typeof firewallSchema>;

function actionTone(a: FirewallAction): "default" | "destructive" | "secondary" {
  if (a === "accept") return "default";
  if (a === "drop" || a === "reject") return "destructive";
  return "secondary";
}

export function FirewallManagement() {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FirewallRule | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<FirewallRule | null>(null);

  const { data, isLoading } = useFirewallRules({
    page,
    pageSize: PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const del = useDeleteFirewallRule();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["firewall", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = (data?.rows ?? []).filter((r) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(t) ||
      (r.sourceAddress ?? "").includes(t) ||
      (r.destinationAddress ?? "").includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
    );
  });
  const enabledCount = rows.filter((r) => r.isEnabled).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="Firewall Rule Management"
        description="Per-router filter rules (chain / action / protocol / source-destination match). Device push happens through a separate configuration pipeline."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Rule
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Rules" value={data?.total ?? 0} icon={Shield} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={rows.length - enabledCount} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All Firewall Rules</CardTitle>
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
                placeholder="Search name, address, router…"
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
                <TableHead>Chain</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Source → Dest</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    No firewall rules match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{routerName(r.routerId)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">{r.chain}</TableCell>
                  <TableCell>
                    <Badge variant={actionTone(r.action)} className="uppercase">
                      {r.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs uppercase text-muted-foreground">{r.protocol}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.sourceAddress ?? "any"}
                    {r.sourcePort ? `:${r.sourcePort}` : ""} → {r.destinationAddress ?? "any"}
                    {r.destinationPort ? `:${r.destinationPort}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.priority}</TableCell>
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
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {data.totalPages} · {data.total} rules
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!data.hasPrevious} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={!data.hasNext} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <FirewallDialog
        open={creating || !!editing}
        rule={editing}
        routers={routers.rows}
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
              This permanently removes it from {confirmDelete ? routerName(confirmDelete.routerId) : ""}.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success(`Rule ${confirmDelete.name} deleted`);
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

function FirewallDialog({
  open,
  rule,
  routers,
  onClose,
}: {
  open: boolean;
  rule: FirewallRule | null;
  routers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateFirewallRule();
  const update = useUpdateFirewallRule();

  const defaults: FirewallFormValues = rule
    ? {
        routerId: rule.routerId,
        name: rule.name,
        chain: rule.chain,
        action: rule.action,
        protocol: rule.protocol,
        sourceAddress: rule.sourceAddress ?? "",
        destinationAddress: rule.destinationAddress ?? "",
        sourcePort: rule.sourcePort ?? Number.NaN,
        destinationPort: rule.destinationPort ?? Number.NaN,
        inInterface: rule.inInterface ?? "",
        priority: rule.priority,
        comment: rule.comment ?? "",
        isEnabled: rule.isEnabled,
      }
    : {
        routerId: "",
        name: "",
        chain: "forward",
        action: "accept",
        protocol: "all",
        sourceAddress: "",
        destinationAddress: "",
        sourcePort: Number.NaN,
        destinationPort: Number.NaN,
        inInterface: "",
        priority: 100,
        comment: "",
        isEnabled: true,
      };

  const form = useForm<FirewallFormValues>({
    resolver: zodResolver(firewallSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: FirewallFormValues) {
    try {
      const shared = {
        name: v.name,
        chain: v.chain,
        action: v.action,
        protocol: v.protocol,
        sourceAddress: v.sourceAddress || null,
        destinationAddress: v.destinationAddress || null,
        sourcePort: Number.isNaN(v.sourcePort) ? null : v.sourcePort,
        destinationPort: Number.isNaN(v.destinationPort) ? null : v.destinationPort,
        inInterface: v.inInterface || null,
        priority: v.priority,
        comment: v.comment || null,
        isEnabled: v.isEnabled,
      };
      if (rule) {
        await update.mutateAsync({ id: rule.id, payload: shared });
        toast.success("Firewall rule updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success("Firewall rule created");
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
          <DialogTitle>{rule ? "Edit firewall rule" : "New firewall rule"}</DialogTitle>
          <DialogDescription>
            {rule
              ? "The router this rule belongs to cannot be changed — delete and recreate to move it."
              : "A rule belongs to exactly one router for its whole lifetime."}
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
            <Input {...form.register("name")} placeholder="Block guest VLAN to management" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Chain</Label>
            <Controller
              control={form.control}
              name="chain"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHAINS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Action</Label>
            <Controller
              control={form.control}
              name="action"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Protocol</Label>
            <Controller
              control={form.control}
              name="protocol"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROTOCOLS.map((p) => (
                      <SelectItem key={p} value={p} className="uppercase">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority</Label>
            <Input type="number" min={0} {...form.register("priority")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Source address (optional)</Label>
            <Input {...form.register("sourceAddress")} placeholder="10.0.10.0/24" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Destination address (optional)</Label>
            <Input {...form.register("destinationAddress")} placeholder="10.0.0.0/24" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Source port (optional)</Label>
            <Input type="number" min={1} max={65535} {...form.register("sourcePort")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Destination port (optional)</Label>
            <Input type="number" min={1} max={65535} {...form.register("destinationPort")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Inbound interface (optional)</Label>
            <Input {...form.register("inInterface")} placeholder="ether1" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5">
            <div className="text-sm font-medium">Enabled</div>
            <Controller
              control={form.control}
              name="isEnabled"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Comment (optional)</Label>
            <Input {...form.register("comment")} placeholder="Notes…" />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
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
