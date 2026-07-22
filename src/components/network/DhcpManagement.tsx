import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Share2, ShieldCheck, ShieldOff } from "lucide-react";
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
  useDhcpPools,
  useCreateDhcpPool,
  useUpdateDhcpPool,
  useDeleteDhcpPool,
} from "@/hooks/useDhcp";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { DhcpPool } from "@/types/dhcp";

const PAGE_SIZE = 25;

const dhcpSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(48),
  addressRangeStart: z.string().trim().min(1, "Required"),
  addressRangeEnd: z.string().trim().min(1, "Required"),
  interface: z.string().trim().optional().or(z.literal("")),
  gatewayIpAddress: z.string().trim().optional().or(z.literal("")),
  dnsPrimary: z.string().trim().optional().or(z.literal("")),
  dnsSecondary: z.string().trim().optional().or(z.literal("")),
  leaseTimeSeconds: z.coerce.number().int().min(1),
  isEnabled: z.boolean(),
});
type DhcpFormValues = z.infer<typeof dhcpSchema>;

export function DhcpManagement() {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DhcpPool | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DhcpPool | null>(null);

  const { data, isLoading } = useDhcpPools({
    page,
    pageSize: PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const del = useDeleteDhcpPool();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["dhcp", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = (data?.rows ?? []).filter((p) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(t) ||
      p.addressRangeStart.includes(t) ||
      p.addressRangeEnd.includes(t) ||
      routerName(p.routerId).toLowerCase().includes(t)
    );
  });
  const enabledCount = rows.filter((p) => p.isEnabled).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="DHCP Pool Management"
        description="Per-router DHCP address pools, gateway, DNS and lease time. Device push happens through a separate configuration pipeline."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Pool
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pools" value={data?.total ?? 0} icon={Share2} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={rows.length - enabledCount} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
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
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(p)}>
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
                Page {page} of {data.totalPages} · {data.total} pools
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

      <DhcpDialog
        open={creating || !!editing}
        pool={editing}
        routers={routers.rows}
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
  onClose,
}: {
  open: boolean;
  pool: DhcpPool | null;
  routers: { id: string; name: string }[];
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
    : {
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

  const form = useForm<DhcpFormValues>({
    resolver: zodResolver(dhcpSchema),
    defaultValues: defaults,
    values: defaults,
  });

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
        toast.success("DHCP pool updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success("DHCP pool created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save pool");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
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
              <p className="text-[11px] text-destructive">{form.formState.errors.routerId.message}</p>
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
            <Input {...form.register("addressRangeStart")} placeholder="10.0.0.10" className="font-mono" />
            {form.formState.errors.addressRangeStart && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.addressRangeStart.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Range end</Label>
            <Input {...form.register("addressRangeEnd")} placeholder="10.0.0.250" className="font-mono" />
            {form.formState.errors.addressRangeEnd && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.addressRangeEnd.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Gateway IP (optional)</Label>
            <Input {...form.register("gatewayIpAddress")} placeholder="10.0.0.1" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Interface (optional)</Label>
            <Input {...form.register("interface")} placeholder="ether1" />
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
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
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
