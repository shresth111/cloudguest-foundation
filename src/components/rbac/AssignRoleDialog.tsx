import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useAssignRole,
  useRbacLocations,
  useRbacOrganizations,
  useRbacRoles,
  useRevokeRoleAssignment,
  useUserRoleAssignments,
} from "@/hooks/useRbac";
import { assignRoleSchema, type AssignRoleFormValues } from "@/lib/rbac-schemas";
import { SCOPE_TYPE_LABEL, type ScopeType } from "@/types/rbac";
import type { AppError } from "@/services/api";

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

const SCOPE_OPTIONS: ScopeType[] = ["global", "organization", "location", "router", "device"];

const DEFAULTS: AssignRoleFormValues = {
  roleId: "",
  scopeType: "organization",
  organizationId: "",
  locationId: "",
  routerId: "",
  expiresAt: "",
};

export function AssignRoleDialog({ userId, userName, onClose }: Props) {
  const { data: assignments, isLoading, isError, refetch } = useUserRoleAssignments(userId);
  const { data: roles = [] } = useRbacRoles();
  const { data: organizations = [] } = useRbacOrganizations();
  const { data: locations = [] } = useRbacLocations();
  const assign = useAssignRole();
  const revoke = useRevokeRoleAssignment();

  const form = useForm<AssignRoleFormValues>({
    resolver: zodResolver(assignRoleSchema),
    defaultValues: DEFAULTS,
  });
  const scopeType = form.watch("scopeType");
  const organizationId = form.watch("organizationId");
  const orgLocations = locations.filter((l) => l.organizationId === organizationId);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const orgName = (id: string | null) =>
    organizations.find((o) => o.id === id)?.name ?? id?.slice(0, 8) ?? "—";
  const locationName = (id: string | null) =>
    locations.find((l) => l.id === id)?.name ?? id?.slice(0, 8) ?? "—";

  async function submit(v: AssignRoleFormValues) {
    try {
      await assign.mutateAsync({
        userId,
        payload: {
          roleId: v.roleId,
          scopeType: v.scopeType,
          organizationId: v.organizationId || null,
          locationId: v.locationId || null,
          routerId: v.routerId || null,
          expiresAt: v.expiresAt ? new Date(v.expiresAt).toISOString() : null,
        },
      });
      toast.success("Role assigned");
      form.reset(DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to assign role");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage roles — {userName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Current assignments</p>
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (assignments ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No active role assignments.
            </p>
          ) : (
            <div className="space-y-1.5">
              {assignments!.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{roleName(a.roleId)}</span>
                      <Badge variant="outline">{SCOPE_TYPE_LABEL[a.scopeType]}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.scopeType === "organization" && orgName(a.organizationId)}
                      {a.scopeType === "location" && locationName(a.locationId)}
                      {a.scopeType === "router" && (a.routerId ?? "—")}
                      {a.expiresAt && ` · expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate(
                        { userId, assignmentId: a.id },
                        {
                          onSuccess: () => toast.success("Role revoked"),
                          onError: (e) => toast.error((e as unknown as AppError).message),
                        },
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={form.handleSubmit(submit)} className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Assign a new role</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((r) => r.isActive)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.roleId && (
                <p className="text-xs text-destructive">{form.formState.errors.roleId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Scope</Label>
              <Controller
                control={form.control}
                name="scopeType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SCOPE_TYPE_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {scopeType === "organization" && (
            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Controller
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.organizationId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.organizationId.message}
                </p>
              )}
            </div>
          )}

          {scopeType === "location" && (
            <>
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <Controller
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Controller
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgLocations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.locationId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.locationId.message}
                  </p>
                )}
              </div>
            </>
          )}

          {scopeType === "router" && (
            <div className="space-y-1.5">
              <Label>Router ID</Label>
              <Input {...form.register("routerId")} placeholder="UUID" />
              {form.formState.errors.routerId && (
                <p className="text-xs text-destructive">{form.formState.errors.routerId.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Expires at (optional)</Label>
            <Input type="datetime-local" {...form.register("expiresAt")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={assign.isPending}>
              {assign.isPending ? "Assigning…" : "Assign role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
