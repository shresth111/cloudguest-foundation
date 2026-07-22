import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Network, ShieldCheck, ShieldOff } from "lucide-react";
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
  useVlans,
  useVlanKpis,
  useCreateVlan,
  useUpdateVlan,
  useDeleteVlan,
} from "@/hooks/useVlan";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { Vlan } from "@/types/vlan";

const PAGE_SIZE = 25;

const vlanSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  vlanId: z.coerce.number().int().min(1, "1-4094").max(4094, "1-4094"),
  name: z.string().trim().min(2, "Required").max(48),
  gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
  cidr: z.string().trim().optional().or(z.literal("")),
  interface: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type VlanFormValues = z.infer<typeof vlanSchema>;

export function VlanManagement() {
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
  });
  const { data: kpis } = useVlanKpis();
  const del = useDeleteVlan();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["vlan", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
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
      <SectionHeader
        eyebrow="Network"
        title="VLAN Management"
        description="Per-router VLAN inventory — a real 802.1Q tag, gateway, and CIDR record. Device push happens through a separate configuration pipeline."
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

      <Card className="border-border/60">
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
                <TableHead>Gateway / CIDR</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
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
                  <TableCell className="text-xs text-muted-foreground">
                    {v.interface ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={v.isEnabled ? "default" : "secondary"}>
                      {v.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(v)}>
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
        interface: vlan.interface ?? "",
        description: vlan.description ?? "",
        isEnabled: vlan.isEnabled,
      }
    : {
        routerId: "",
        vlanId: 100,
        name: "",
        gatewayIpAddress: "",
        cidr: "",
        interface: "",
        description: "",
        isEnabled: true,
      };

  const form = useForm<VlanFormValues>({
    resolver: zodResolver(vlanSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: VlanFormValues) {
    try {
      if (vlan) {
        await update.mutateAsync({
          id: vlan.id,
          payload: {
            vlanId: v.vlanId,
            name: v.name,
            gatewayIpAddress: v.gatewayIpAddress || null,
            cidr: v.cidr || null,
            interface: v.interface || null,
            description: v.description || null,
            isEnabled: v.isEnabled,
          },
        });
        toast.success("VLAN updated");
      } else {
        await create.mutateAsync({
          routerId: v.routerId,
          vlanId: v.vlanId,
          name: v.name,
          gatewayIpAddress: v.gatewayIpAddress || null,
          cidr: v.cidr || null,
          interface: v.interface || null,
          description: v.description || null,
          isEnabled: v.isEnabled,
        });
        toast.success("VLAN created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save VLAN");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
            <Label className="text-xs font-medium">Parent interface (optional)</Label>
            <Input {...form.register("interface")} placeholder="ether1" />
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
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input {...form.register("description")} placeholder="Public guest network…" />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
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
