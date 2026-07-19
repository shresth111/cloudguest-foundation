import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Copy, Archive, Trash2, Pencil, Plus, GitCompareArrows, Shield, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRbacRoles, useInvalidateRbac } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";
import type { RbacRole } from "@/types/rbac";
import { RBAC_MODULES } from "@/types/rbac";

interface Props {
  onEdit: (role: RbacRole) => void;
  onCreate: () => void;
  onCompare: () => void;
}

export function RoleTable({ onEdit, onCreate, onCompare }: Props) {
  const { data: roles, isLoading, error } = useRbacRoles();
  const invalidate = useInvalidateRbac();
  const [confirm, setConfirm] = useState<RbacRole | null>(null);

  const permCount = (r: RbacRole) => {
    let count = 0;
    for (const mod of RBAC_MODULES) {
      const p = r.permissions[mod.key] ?? {};
      count += Object.values(p).filter(Boolean).length;
    }
    return count;
  };

  const action = async (kind: "duplicate" | "archive" | "delete", r: RbacRole) => {
    try {
      if (kind === "duplicate") { await rbacService.duplicateRole(r.id); toast.success("Role duplicated"); }
      else if (kind === "archive") { await rbacService.archiveRole(r.id); toast.success("Role archived"); }
      else if (kind === "delete") { await rbacService.deleteRole(r.id); toast.success("Role deleted"); }
      invalidate("roles");
    } catch { toast.error("Action failed"); }
  };

  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">Failed to load roles.</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Roles</h3>
          <p className="text-xs text-muted-foreground">Define reusable access profiles for your teams.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onCompare}><GitCompareArrows className="me-1.5 h-4 w-4" /> Compare</Button>
          <Button onClick={onCreate}><Plus className="me-1.5 h-4 w-4" /> New role</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {isLoading || !roles
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)
          : roles.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className="group h-full transition hover:border-primary/50">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        {r.isSystem ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.description || "—"}</p>
                      </div>
                    </div>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-muted-foreground">Users</p>
                      <p className="text-base font-semibold tabular-nums">{r.usersAssigned}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <p className="text-muted-foreground">Permissions</p>
                      <p className="text-base font-semibold tabular-nums">{permCount(r)}</p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(r)}><Pencil className="me-1 h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => action("duplicate", r)}><Copy className="me-1 h-3.5 w-3.5" /> Duplicate</Button>
                    {!r.isSystem && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => action("archive", r)}><Archive className="me-1 h-3.5 w-3.5" /> Archive</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm(r)}><Trash2 className="me-1 h-3.5 w-3.5" /> Delete</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>Users assigned to “{confirm?.name}” will lose their permissions. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) { action("delete", confirm); setConfirm(null); } }}>Delete role</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
