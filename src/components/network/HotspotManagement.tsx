import { useState } from "react";
import { Plus, Search, Trash2, Pencil, Wifi, ShieldCheck, ShieldOff } from "lucide-react";
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
  useHotspotProfiles,
  useHotspotKpis,
  useCreateHotspotProfile,
  useUpdateHotspotProfile,
  useDeleteHotspotProfile,
} from "@/hooks/useHotspot";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { HotspotProfile } from "@/types/hotspot";

const PAGE_SIZE = 25;

const hotspotSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  name: z.string().trim().min(2, "Required").max(80),
  sessionTimeoutMinutes: z.coerce.number().int().min(1).max(1_440).optional().or(z.nan()),
  idleTimeoutMinutes: z.coerce.number().int().min(1).max(1_440).optional().or(z.nan()),
  uploadLimitKbps: z.coerce.number().int().min(1).max(1_000_000).optional().or(z.nan()),
  downloadLimitKbps: z.coerce.number().int().min(1).max(1_000_000).optional().or(z.nan()),
  walledGardenHosts: z.string().trim().optional().or(z.literal("")),
  isEnabled: z.boolean(),
});
type HotspotFormValues = z.infer<typeof hotspotSchema>;

function numOrNull(v: number | undefined): number | null {
  return v === undefined || Number.isNaN(v) ? null : v;
}

export function HotspotManagement() {
  const [page, setPage] = useState(1);
  const [routerFilter, setRouterFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HotspotProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<HotspotProfile | null>(null);

  const { data, isLoading } = useHotspotProfiles({
    page,
    pageSize: PAGE_SIZE,
    routerId: routerFilter === "all" ? undefined : routerFilter,
  });
  const { data: kpis } = useHotspotKpis();
  const del = useDeleteHotspotProfile();
  const { data: routers = { rows: [], total: 0 } } = useQuery({
    queryKey: ["hotspot", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
  });

  const routerName = (id: string) => routers.rows.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  const rows = (data?.rows ?? []).filter((p) => {
    if (!search.trim()) return true;
    const t = search.trim().toLowerCase();
    return p.name.toLowerCase().includes(t) || routerName(p.routerId).toLowerCase().includes(t);
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="Hotspot Profiles"
        description="Per-router hotspot session limits, bandwidth caps, and walled-garden allowlists."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New profile
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total profiles" value={kpis?.total ?? 0} icon={Wifi} tone="primary" />
        <StatCard label="Enabled" value={kpis?.enabled ?? 0} icon={ShieldCheck} tone="success" />
        <StatCard label="Disabled" value={kpis?.disabled ?? 0} icon={ShieldOff} tone="warning" />
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold">All profiles</CardTitle>
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
                placeholder="Search name, router…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profile</TableHead>
                <TableHead>Router</TableHead>
                <TableHead>Session / Idle</TableHead>
                <TableHead>Up / Down limit</TableHead>
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
                    No hotspot profiles match your filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.walledGardenHosts.length > 0 && (
                      <div className="truncate text-xs text-muted-foreground">
                        {p.walledGardenHosts.length} walled-garden host
                        {p.walledGardenHosts.length === 1 ? "" : "s"}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{routerName(p.routerId)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.sessionTimeoutMinutes ?? "—"}m / {p.idleTimeoutMinutes ?? "—"}m
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.uploadLimitKbps ?? "—"} / {p.downloadLimitKbps ?? "—"} kbps
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
                Page {page} of {data.totalPages} · {data.total} profiles
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

      <HotspotDialog
        open={creating || !!editing}
        profile={editing}
        routers={routers.rows}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile "{confirmDelete?.name}"?</AlertDialogTitle>
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
                  toast.success(`Profile ${confirmDelete.name} deleted`);
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete profile");
                }
                setConfirmDelete(null);
              }}
            >
              Delete profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HotspotDialog({
  open,
  profile,
  routers,
  onClose,
}: {
  open: boolean;
  profile: HotspotProfile | null;
  routers: { id: string; name: string }[];
  onClose: () => void;
}) {
  const create = useCreateHotspotProfile();
  const update = useUpdateHotspotProfile();

  const defaults: HotspotFormValues = profile
    ? {
        routerId: profile.routerId,
        name: profile.name,
        sessionTimeoutMinutes: profile.sessionTimeoutMinutes ?? undefined,
        idleTimeoutMinutes: profile.idleTimeoutMinutes ?? undefined,
        uploadLimitKbps: profile.uploadLimitKbps ?? undefined,
        downloadLimitKbps: profile.downloadLimitKbps ?? undefined,
        walledGardenHosts: profile.walledGardenHosts.join(", "),
        isEnabled: profile.isEnabled,
      }
    : {
        routerId: "",
        name: "",
        sessionTimeoutMinutes: undefined,
        idleTimeoutMinutes: undefined,
        uploadLimitKbps: undefined,
        downloadLimitKbps: undefined,
        walledGardenHosts: "",
        isEnabled: true,
      };

  const form = useForm<HotspotFormValues>({
    resolver: zodResolver(hotspotSchema),
    defaultValues: defaults,
    values: defaults,
  });

  function hostsFromInput(v: string | undefined): string[] {
    return (v ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
  }

  async function submit(v: HotspotFormValues) {
    try {
      if (profile) {
        await update.mutateAsync({
          id: profile.id,
          payload: {
            name: v.name,
            sessionTimeoutMinutes: numOrNull(v.sessionTimeoutMinutes),
            idleTimeoutMinutes: numOrNull(v.idleTimeoutMinutes),
            uploadLimitKbps: numOrNull(v.uploadLimitKbps),
            downloadLimitKbps: numOrNull(v.downloadLimitKbps),
            walledGardenHosts: hostsFromInput(v.walledGardenHosts),
            isEnabled: v.isEnabled,
          },
        });
        toast.success("Profile updated");
      } else {
        await create.mutateAsync({
          routerId: v.routerId,
          name: v.name,
          sessionTimeoutMinutes: numOrNull(v.sessionTimeoutMinutes),
          idleTimeoutMinutes: numOrNull(v.idleTimeoutMinutes),
          uploadLimitKbps: numOrNull(v.uploadLimitKbps),
          downloadLimitKbps: numOrNull(v.downloadLimitKbps),
          walledGardenHosts: hostsFromInput(v.walledGardenHosts),
          isEnabled: v.isEnabled,
        });
        toast.success("Profile created");
      }
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to save profile");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit profile" : "New hotspot profile"}</DialogTitle>
          <DialogDescription>
            {profile
              ? "The router this profile belongs to cannot be changed — delete and recreate to move it."
              : "A hotspot profile belongs to exactly one router for its whole lifetime."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Router</Label>
            <Controller
              control={form.control}
              name="routerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!!profile}>
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
            <Input {...form.register("name")} placeholder="Lobby hotspot" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Session timeout (min, optional)</Label>
            <Input type="number" min={1} {...form.register("sessionTimeoutMinutes")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Idle timeout (min, optional)</Label>
            <Input type="number" min={1} {...form.register("idleTimeoutMinutes")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Upload limit (kbps, optional)</Label>
            <Input type="number" min={1} {...form.register("uploadLimitKbps")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Download limit (kbps, optional)</Label>
            <Input type="number" min={1} {...form.register("downloadLimitKbps")} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Walled-garden hosts (comma-separated, optional)</Label>
            <Input {...form.register("walledGardenHosts")} placeholder="example.com, cdn.example.com" />
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
              {profile ? "Save changes" : "Create profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
