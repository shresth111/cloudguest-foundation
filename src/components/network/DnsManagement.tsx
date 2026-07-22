import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Server, ShieldCheck, ShieldOff } from "lucide-react";
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
  useDnsRecords,
  useCreateDnsRecord,
  useUpdateDnsRecord,
  useDeleteDnsRecord,
} from "@/hooks/useDns";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { DnsRecord, DnsRecordType } from "@/types/dns";

const PAGE_SIZE = 25;
const RECORD_TYPES: DnsRecordType[] = ["a", "aaaa", "cname"];

const dnsSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(1, "Required").max(120),
  address: z.string().trim().min(1, "Required"),
  recordType: z.enum(["a", "aaaa", "cname"]),
  ttlSeconds: z.coerce.number().int().min(1),
  comment: z.string().trim().max(240).optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type DnsFormValues = z.infer<typeof dnsSchema>;

export function DnsManagement() {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<DnsRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DnsRecord | null>(null);

  const { data, isLoading } = useDnsRecords({
    page,
    pageSize: PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const del = useDeleteDnsRecord();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["dns", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = (data?.rows ?? []).filter((r) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(t) ||
      r.address.toLowerCase().includes(t) ||
      routerName(r.routerId).toLowerCase().includes(t)
    );
  });
  const enabledCount = rows.filter((r) => r.isEnabled).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="DNS Record Management"
        description="Per-router static DNS entries (A / AAAA / CNAME). Device push happens through a separate configuration pipeline."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Record
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Records" value={data?.total ?? 0} icon={Server} tone="primary" />
        <StatCard label="Enabled" value={enabledCount} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={rows.length - enabledCount} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All DNS Records</CardTitle>
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
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>TTL</TableHead>
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
                    No DNS records match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.comment && (
                        <div className="truncate text-xs text-muted-foreground">{r.comment}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase">
                      {r.recordType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{routerName(r.routerId)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.address}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Math.round(r.ttlSeconds / 60)}m
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
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {data.totalPages} · {data.total} records
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

      <DnsDialog
        open={creating || !!editing}
        record={editing}
        routers={routers.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record "{confirmDelete?.name}"?</AlertDialogTitle>
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
                  toast.success(`Record ${confirmDelete.name} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete record");
                }
                setConfirmDelete(null);
              }}
            >
              Delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DnsDialog({
  open,
  record,
  routers,
  onClose,
}: {
  open: boolean;
  record: DnsRecord | null;
  routers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateDnsRecord();
  const update = useUpdateDnsRecord();

  const defaults: DnsFormValues = record
    ? {
        routerId: record.routerId,
        name: record.name,
        address: record.address,
        recordType: record.recordType,
        ttlSeconds: record.ttlSeconds,
        comment: record.comment ?? "",
        isEnabled: record.isEnabled,
      }
    : {
        routerId: "",
        name: "",
        address: "",
        recordType: "a",
        ttlSeconds: 86_400,
        comment: "",
        isEnabled: true,
      };

  const form = useForm<DnsFormValues>({
    resolver: zodResolver(dnsSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: DnsFormValues) {
    try {
      const shared = {
        name: v.name,
        address: v.address,
        recordType: v.recordType,
        ttlSeconds: v.ttlSeconds,
        comment: v.comment || null,
        isEnabled: v.isEnabled,
      };
      if (record) {
        await update.mutateAsync({ id: record.id, payload: shared });
        toast.success("DNS record updated");
      } else {
        await create.mutateAsync({ routerId: v.routerId, ...shared });
        toast.success("DNS record created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save record");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? "Edit DNS record" : "New DNS record"}</DialogTitle>
          <DialogDescription>
            {record
              ? "The router this record belongs to cannot be changed — delete and recreate to move it."
              : "A DNS record belongs to exactly one router for its whole lifetime."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!record}>
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
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="portal.hotel.local" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <Controller
              control={form.control}
              name="recordType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="uppercase">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Address</Label>
            <Input {...form.register("address")} placeholder="10.0.0.5" className="font-mono" />
            {form.formState.errors.address && (
              <p className="text-[11px] text-destructive">{form.formState.errors.address.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">TTL (seconds)</Label>
            <Input type="number" min={1} {...form.register("ttlSeconds")} />
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
              {record ? "Save changes" : "Create record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
