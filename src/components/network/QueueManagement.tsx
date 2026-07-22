import { useState } from "react";
import { Plus, Trash2, Pencil, ListOrdered, Activity, Clock, PlayCircle, StopCircle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import {
  useQueueProfiles, useQueueAssignments, useQueueKpis,
  useCreateQueueProfile, useUpdateQueueProfile, useDeleteQueueProfile,
  useCreateQueueAssignment, useExpireQueueAssignment, useApplyQueue, useRemoveQueue,
} from "@/hooks/useQueue";
import { routerService } from "@/services/router.service";
import type { AppError } from "@/services/api";
import type { QueueAssignment, QueueProfile, QueueTargetType } from "@/types/queue";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Required").max(48),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  downloadRateKbps: z.coerce.number().int().min(0),
  uploadRateKbps: z.coerce.number().int().min(0),
  priority: z.coerce.number().int().min(1).max(8),
  isActive: z.boolean(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const TARGET_TYPES: QueueTargetType[] = ["organization", "location", "router"];

const STATUS_TONE: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  pending: "secondary",
  disabled: "outline",
  suspended: "outline",
  error: "destructive",
  expired: "outline",
};

export function QueueManagement() {
  const { data: profiles, isLoading: profilesLoading } = useQueueProfiles();
  const { data: assignments, isLoading: assignmentsLoading } = useQueueAssignments();
  const { data: kpis } = useQueueKpis();

  const [creatingProfile, setCreatingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState<QueueProfile | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<QueueProfile | null>(null);
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  const deleteProfile = useDeleteQueueProfile();
  const expireAssignment = useExpireQueueAssignment();
  const applyQueue = useApplyQueue();
  const removeQueue = useRemoveQueue();

  const profileName = (id: string | null) => profiles?.rows.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Network"
        title="Queue Management"
        description="Bandwidth-shaping profiles and their live assignments to organizations, locations, or routers."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Profiles" value={kpis?.totalProfiles ?? 0} icon={ListOrdered} tone="primary" />
        <StatCard label="Active assignments" value={kpis?.activeAssignments ?? 0} icon={Activity} tone="success" />
        <StatCard label="Pending assignments" value={kpis?.pendingAssignments ?? 0} icon={Clock} tone="warning" />
      </div>

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Bandwidth Profiles</CardTitle>
              <Button size="sm" onClick={() => setCreatingProfile(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> New Profile
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilesLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!profilesLoading && (profiles?.rows.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No queue profiles yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {profiles?.rows.map((p) => (
                    <TableRow key={p.id} className="group">
                      <TableCell>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          {p.description && (
                            <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.downloadRateKbps.toLocaleString()} kbps</TableCell>
                      <TableCell className="text-sm">{p.uploadRateKbps.toLocaleString()} kbps</TableCell>
                      <TableCell className="text-sm">{p.priority}</TableCell>
                      <TableCell>
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button size="icon" variant="ghost" onClick={() => setEditingProfile(p)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={p.isSystemProfile}
                            onClick={() => setDeletingProfile(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold">Assignments</CardTitle>
              <Button size="sm" onClick={() => setCreatingAssignment(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> New Assignment
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="w-[140px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentsLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  )}
                  {!assignmentsLoading && (assignments?.rows.length ?? 0) === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No queue assignments yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {assignments?.rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">
                        <span className="font-medium capitalize">{a.targetType.replace(/_/g, " ")}</span>
                        {a.routerId && <span className="ml-1 text-xs text-muted-foreground">{a.routerId.slice(0, 8)}</span>}
                      </TableCell>
                      <TableCell className="text-sm">{profileName(a.queueProfileId)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONE[a.status] ?? "outline"} className="capitalize">
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.appliedAt ? new Date(a.appliedAt).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Apply"
                            disabled={applyQueue.isPending}
                            onClick={async () => {
                              try {
                                await applyQueue.mutateAsync(a.id);
                                toast.success("Queue applied");
                              } catch (err) {
                                toast.error((err as AppError).message || "Failed to apply queue");
                              }
                            }}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remove"
                            disabled={removeQueue.isPending}
                            onClick={async () => {
                              try {
                                await removeQueue.mutateAsync(a.id);
                                toast.success("Queue removed");
                              } catch (err) {
                                toast.error((err as AppError).message || "Failed to remove queue");
                              }
                            }}
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Expire"
                            onClick={async () => {
                              try {
                                await expireAssignment.mutateAsync(a.id);
                                toast.success("Assignment expired");
                              } catch (err) {
                                toast.error((err as AppError).message || "Failed to expire assignment");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProfileDialog
        open={creatingProfile || !!editingProfile}
        profile={editingProfile}
        onClose={() => {
          setCreatingProfile(false);
          setEditingProfile(null);
        }}
      />

      <AssignmentDialog open={creatingAssignment} profiles={profiles?.rows ?? []} onClose={() => setCreatingAssignment(false)} />

      <AlertDialog open={!!deletingProfile} onOpenChange={(o) => !o && setDeletingProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete profile "{deletingProfile?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingProfile) return;
                try {
                  await deleteProfile.mutateAsync(deletingProfile.id);
                  toast.success("Profile deleted");
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete profile");
                }
                setDeletingProfile(null);
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

function ProfileDialog({
  open,
  profile,
  onClose,
}: {
  open: boolean;
  profile: QueueProfile | null;
  onClose: () => void;
}) {
  const create = useCreateQueueProfile();
  const update = useUpdateQueueProfile();

  const defaults: ProfileFormValues = profile
    ? {
        name: profile.name,
        description: profile.description ?? "",
        downloadRateKbps: profile.downloadRateKbps,
        uploadRateKbps: profile.uploadRateKbps,
        priority: profile.priority,
        isActive: profile.isActive,
      }
    : { name: "", description: "", downloadRateKbps: 10_000, uploadRateKbps: 5_000, priority: 8, isActive: true };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
    values: defaults,
  });

  async function submit(v: ProfileFormValues) {
    try {
      if (profile) {
        await update.mutateAsync({
          id: profile.id,
          payload: {
            name: v.name,
            description: v.description || null,
            downloadRateKbps: v.downloadRateKbps,
            uploadRateKbps: v.uploadRateKbps,
            priority: v.priority,
            isActive: v.isActive,
          },
        });
        toast.success("Profile updated");
      } else {
        await create.mutateAsync({
          name: v.name,
          description: v.description || null,
          downloadRateKbps: v.downloadRateKbps,
          uploadRateKbps: v.uploadRateKbps,
          priority: v.priority,
          isActive: v.isActive,
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
          <DialogTitle>{profile ? "Edit profile" : "New profile"}</DialogTitle>
          <DialogDescription>Rate limits apply in kbps. Priority 1 is highest, 8 is lowest.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Name</Label>
            <Input {...form.register("name")} placeholder="Guest Standard" />
            {form.formState.errors.name && (
              <p className="text-[11px] text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Download rate (kbps)</Label>
            <Input type="number" min={0} {...form.register("downloadRateKbps")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Upload rate (kbps)</Label>
            <Input type="number" min={0} {...form.register("uploadRateKbps")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Priority (1-8)</Label>
            <Input type="number" min={1} max={8} {...form.register("priority")} />
          </div>
          <div className="flex items-end justify-between rounded-lg border p-3">
            <Label className="text-xs font-medium">Active</Label>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-medium">Description (optional)</Label>
            <Input {...form.register("description")} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
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

function AssignmentDialog({
  open,
  profiles,
  onClose,
}: {
  open: boolean;
  profiles: QueueProfile[];
  onClose: () => void;
}) {
  const create = useCreateQueueAssignment();
  const [targetType, setTargetType] = useState<QueueTargetType>("router");
  const [routerId, setRouterId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [queueProfileId, setQueueProfileId] = useState("");

  const { data: routers = { rows: [] } } = useQuery({
    queryKey: ["queue", "router-options"],
    queryFn: () => routerService.list({ page: 1, pageSize: 100 }),
    enabled: open,
  });

  async function submit() {
    try {
      await create.mutateAsync({
        targetType,
        routerId: targetType === "router" ? routerId : undefined,
        locationId: targetType === "location" ? locationId : undefined,
        queueProfileId: queueProfileId || undefined,
      });
      toast.success("Assignment created");
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create assignment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New assignment</DialogTitle>
          <DialogDescription>Attach a bandwidth profile to an organization, location, or router.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target type</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as QueueTargetType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetType === "router" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Router</Label>
              <Select value={routerId} onValueChange={setRouterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select router" />
                </SelectTrigger>
                <SelectContent>
                  {routers.rows.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {targetType === "location" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location ID</Label>
              <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Location UUID" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Bandwidth profile</Label>
            <Select value={queueProfileId} onValueChange={setQueueProfileId}>
              <SelectTrigger>
                <SelectValue placeholder="Select profile" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={create.isPending || !queueProfileId || (targetType === "router" && !routerId)}
          >
            Create assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
