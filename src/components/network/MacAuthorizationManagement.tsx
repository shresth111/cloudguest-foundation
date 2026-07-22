import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";
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
  useMacAuthorizationEntries,
  useMacAuthorizationKpis,
  useCreateMacAuthorizationEntry,
  useUpdateMacAuthorizationEntry,
  useDeleteMacAuthorizationEntry,
} from "@/hooks/useMacAuthorization";
import { locationService } from "@/services/location.service";
import type { AppError } from "@/services/api";
import type { MacAuthorizationEntry } from "@/types/mac-authorization";

const PAGE_SIZE = 25;

const entrySchema = z
  .object({
    macAddress: z
      .string()
      .trim()
      .regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Format: AA:BB:CC:DD:EE:FF"),
    authorizationType: z.enum(["permanent", "temporary"]),
    locationId: z.string().optional().or(z.literal("")),
    expiresAt: z.string().optional().or(z.literal("")),
    comment: z.string().trim().max(240).optional().or(z.literal("")),
    isEnabled: z.boolean(),
  })
  .refine((v) => v.authorizationType !== "temporary" || !!v.expiresAt, {
    message: "Expiry required for temporary entries",
    path: ["expiresAt"],
  });
type EntryFormValues = z.infer<typeof entrySchema>;

export function MacAuthorizationManagement() {
  const [page, setPage] = useState(1);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MacAuthorizationEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MacAuthorizationEntry | null>(null);

  const { data, isLoading } = useMacAuthorizationEntries({
    page,
    pageSize: PAGE_SIZE,
    locationId: locationFilter === "all" ? undefined : locationFilter,
  });
  const { data: kpis } = useMacAuthorizationKpis();
  const del = useDeleteMacAuthorizationEntry();
  const { data: locations = { rows: [], total: 0 } } = useQuery({
    queryKey: ["mac-authorization", "location-options"],
    queryFn: () => locationService.list({ page: 1, pageSize: 100 }),
  });

  const locationName = (id: string | null) =>
    id ? (locations.rows.find((l) => l.id === id)?.name ?? id.slice(0, 8)) : "All locations";

  const rows = (data?.rows ?? []).filter((e) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return (
      e.macAddress.toLowerCase().includes(t) || (e.comment ?? "").toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="MAC Authorization"
        description="Organization-wide MAC address allowlist — permanent or time-boxed device entries."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New entry
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total entries" value={kpis?.total ?? 0} icon={Fingerprint} tone="primary" />
        <StatCard label="Enabled" value={kpis?.enabled ?? 0} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={kpis?.disabled ?? 0} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All entries</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={locationFilter}
              onValueChange={(v) => {
                setLocationFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.rows.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search MAC, comment…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC address</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No entries match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((e) => (
                <TableRow key={e.id} className="group">
                  <TableCell>
                    <div className="font-mono text-sm">{e.macAddress}</div>
                    {e.comment && (
                      <div className="truncate text-xs text-muted-foreground">{e.comment}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {e.authorizationType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {locationName(e.locationId)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.expiresAt ? new Date(e.expiresAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.isEnabled ? "default" : "secondary"}>
                      {e.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(e)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDelete(e)}>
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
                Page {page} of {data.totalPages} · {data.total} entries
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

      <EntryDialog
        open={creating || !!editing}
        entry={editing}
        locations={locations.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entry {confirmDelete?.macAddress}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await del.mutateAsync(confirmDelete.id);
                  toast.success(`Entry ${confirmDelete.macAddress} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete entry");
                }
                setConfirmDelete(null);
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EntryDialog({
  open,
  entry,
  locations,
  onClose,
}: {
  open: boolean;
  entry: MacAuthorizationEntry | null;
  locations: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateMacAuthorizationEntry();
  const update = useUpdateMacAuthorizationEntry();

  const defaults: EntryFormValues = entry
    ? {
        macAddress: entry.macAddress,
        authorizationType: entry.authorizationType,
        locationId: entry.locationId ?? "",
        expiresAt: entry.expiresAt ? entry.expiresAt.slice(0, 16) : "",
        comment: entry.comment ?? "",
        isEnabled: entry.isEnabled,
      }
    : {
        macAddress: "",
        authorizationType: "permanent",
        locationId: "",
        expiresAt: "",
        comment: "",
        isEnabled: true,
      };

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: defaults,
    values: defaults,
  });
  const authType = form.watch("authorizationType");

  async function submit(v: EntryFormValues) {
    const expiresAt = v.expiresAt ? new Date(v.expiresAt).toISOString() : null;
    try {
      if (entry) {
        await update.mutateAsync({
          id: entry.id,
          payload: {
            macAddress: v.macAddress,
            authorizationType: v.authorizationType,
            locationId: v.locationId || null,
            expiresAt: v.authorizationType === "temporary" ? expiresAt : null,
            comment: v.comment || null,
            isEnabled: v.isEnabled,
          },
        });
        toast.success("Entry updated");
      } else {
        await create.mutateAsync({
          macAddress: v.macAddress,
          authorizationType: v.authorizationType,
          locationId: v.locationId || null,
          expiresAt: v.authorizationType === "temporary" ? expiresAt : null,
          comment: v.comment || null,
          isEnabled: v.isEnabled,
        });
        toast.success("Entry created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save entry");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit entry" : "New MAC authorization entry"}</DialogTitle>
          <DialogDescription>
            Permanent entries never expire. Temporary entries require an expiry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">MAC address</Label>
            <Input {...form.register("macAddress")} placeholder="AA:BB:CC:DD:EE:FF" className="font-mono" />
            {form.formState.errors.macAddress && (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.macAddress.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Type</Label>
            <Controller
              control={form.control}
              name="authorizationType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="temporary">Temporary</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Location (optional)</Label>
            <Controller
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No specific location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific location</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {authType === "temporary" && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">Expires at</Label>
              <Input type="datetime-local" {...form.register("expiresAt")} />
              {form.formState.errors.expiresAt && (
                <p className="text-[11px] text-destructive">
                  {form.formState.errors.expiresAt.message}
                </p>
              )}
            </div>
          )}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Comment (optional)</Label>
            <Input {...form.register("comment")} placeholder="Front desk tablet…" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5 sm:col-span-2">
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
              {entry ? "Save changes" : "Create entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
