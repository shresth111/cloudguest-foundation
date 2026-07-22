import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, Trash2, Pencil, Plus, GitCompareArrows, Shield, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ErrorState } from "@/components/common/ErrorState";
import { useCloneRole, useDeleteRole, useRbacRoles, useSetRoleActive } from "@/hooks/useRbac";
import { cloneRoleSchema, type CloneRoleFormValues } from "@/lib/rbac-schemas";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SCOPE_TYPE_LABEL, type Role } from "@/types/rbac";
import type { AppError } from "@/services/api";

interface Props {
  onEdit: (role: Role) => void;
  onCreate: () => void;
  onCompare: () => void;
}

export function RoleTable({ onEdit, onCreate, onCompare }: Props) {
  const { data: roles, isLoading, isError, refetch } = useRbacRoles();
  const deleteRole = useDeleteRole();
  const setActive = useSetRoleActive();
  const [confirmDelete, setConfirmDelete] = useState<Role | null>(null);
  const [cloneTarget, setCloneTarget] = useState<Role | null>(null);

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Roles</h3>
          <p className="text-xs text-muted-foreground">
            Reusable, scoped permission bundles assignable to users.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCompare}>
            <GitCompareArrows className="me-1.5 h-4 w-4" /> Compare
          </Button>
          <Button onClick={onCreate}>
            <Plus className="me-1.5 h-4 w-4" /> New role
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading || !roles
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))
          : roles.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card className="group h-full transition hover:border-primary/50">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          {r.isSystemRole ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.description || "—"}
                          </p>
                        </div>
                      </div>
                      <Badge variant={r.isActive ? "default" : "secondary"}>
                        {r.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground">Scope</p>
                        <p className="text-base font-semibold">{SCOPE_TYPE_LABEL[r.scopeType]}</p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2">
                        <p className="text-muted-foreground">Permissions</p>
                        <p className="text-base font-semibold tabular-nums">
                          {r.permissions.length}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => onEdit(r)}>
                        <Pencil className="me-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCloneTarget(r)}>
                        <Copy className="me-1 h-3.5 w-3.5" /> Clone
                      </Button>
                      {!r.isSystemRole && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setActive.mutate(
                                { id: r.id, active: !r.isActive },
                                {
                                  onSuccess: () =>
                                    toast.success(
                                      r.isActive ? "Role deactivated" : "Role activated",
                                    ),
                                  onError: (e) => toast.error((e as unknown as AppError).message),
                                },
                              )
                            }
                          >
                            {r.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete(r)}
                          >
                            <Trash2 className="me-1 h-3.5 w-3.5" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              Users assigned to "{confirmDelete?.name}" will lose the permissions it grants. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await deleteRole.mutateAsync(confirmDelete.id);
                  toast.success("Role deleted");
                } catch (err) {
                  toast.error((err as AppError).message || "Failed to delete role");
                }
                setConfirmDelete(null);
              }}
            >
              Delete role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cloneTarget && <CloneRoleDialog role={cloneTarget} onClose={() => setCloneTarget(null)} />}
    </div>
  );
}

function CloneRoleDialog({ role, onClose }: { role: Role; onClose: () => void }) {
  const clone = useCloneRole();
  const form = useForm<CloneRoleFormValues>({
    resolver: zodResolver(cloneRoleSchema),
    defaultValues: {
      newName: `${role.name} (Copy)`,
      newSlug: `${role.slug}-copy`,
      targetOrganizationId: role.organizationId ?? "",
    },
  });

  async function submit(v: CloneRoleFormValues) {
    try {
      await clone.mutateAsync({
        id: role.id,
        payload: {
          newName: v.newName,
          newSlug: v.newSlug,
          targetOrganizationId: v.targetOrganizationId || null,
        },
      });
      toast.success("Role cloned");
      onClose();
    } catch (err) {
      toast.error((err as AppError).message || "Failed to clone role");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clone "{role.name}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>New name</Label>
            <Input {...form.register("newName")} />
            {form.formState.errors.newName && (
              <p className="text-xs text-destructive">{form.formState.errors.newName.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>New slug</Label>
            <Input {...form.register("newSlug")} />
            {form.formState.errors.newSlug && (
              <p className="text-xs text-destructive">{form.formState.errors.newSlug.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={clone.isPending}>
              {clone.isPending ? "Cloning…" : "Clone role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
