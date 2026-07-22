import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  useAttachRolePermission,
  useCreateRole,
  useDetachRolePermission,
  useRbacOrganizations,
  useRbacPermissionGroups,
  useRbacPermissions,
  useUpdateRole,
} from "@/hooks/useRbac";
import { roleSchema, type RoleFormValues } from "@/lib/rbac-schemas";
import { SCOPE_TYPE_LABEL, type Role, type ScopeType } from "@/types/rbac";
import type { AppError } from "@/services/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role | null;
}

const DEFAULTS: RoleFormValues = {
  name: "",
  slug: "",
  description: "",
  scopeType: "organization",
  organizationId: "",
  isTemplate: false,
  permissionKeys: [],
};

const SCOPE_OPTIONS: ScopeType[] = ["global", "organization", "location", "router", "device"];

export function RoleFormDialog({ open, onOpenChange, role }: Props) {
  const { data: organizations = [] } = useRbacOrganizations();
  const { data: permissionGroups = [] } = useRbacPermissionGroups();
  const { data: permissions = [] } = useRbacPermissions();
  const create = useCreateRole();
  const update = useUpdateRole();
  const attach = useAttachRolePermission();
  const detach = useDetachRolePermission();

  const defaults: RoleFormValues = role
    ? {
        name: role.name,
        slug: role.slug,
        description: role.description ?? "",
        scopeType: role.scopeType,
        organizationId: role.organizationId ?? "",
        isTemplate: role.isTemplate,
        permissionKeys: role.permissions,
      }
    : DEFAULTS;

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: defaults,
    values: defaults,
    mode: "onBlur",
  });

  const selected = new Set(form.watch("permissionKeys"));
  const locked = !!role?.isSystemRole;

  const groupedPermissions = useMemo(() => {
    const byGroup = new Map<string, typeof permissions>();
    for (const p of permissions) {
      const list = byGroup.get(p.permissionGroupId) ?? [];
      list.push(p);
      byGroup.set(p.permissionGroupId, list);
    }
    return permissionGroups
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({ group: g, items: byGroup.get(g.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [permissions, permissionGroups]);

  const togglePermission = (key: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(key);
    else next.delete(key);
    form.setValue("permissionKeys", [...next]);
  };
  const toggleGroup = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
    form.setValue("permissionKeys", [...next]);
  };

  async function submit(v: RoleFormValues) {
    try {
      if (role) {
        await update.mutateAsync({
          id: role.id,
          payload: {
            name: v.name,
            description: v.description || null,
            isTemplate: v.isTemplate,
          },
        });
        const before = new Set(role.permissions);
        const after = new Set(v.permissionKeys);
        const toAdd = v.permissionKeys.filter((k) => !before.has(k));
        const toRemove = role.permissions.filter((k) => !after.has(k));
        for (const key of toAdd) await attach.mutateAsync({ roleId: role.id, permissionKey: key });
        for (const key of toRemove)
          await detach.mutateAsync({ roleId: role.id, permissionKey: key });
        toast.success("Role updated");
      } else {
        await create.mutateAsync({
          name: v.name,
          slug: v.slug,
          description: v.description || null,
          scopeType: v.scopeType,
          organizationId: v.organizationId || null,
          isTemplate: v.isTemplate,
          permissionKeys: v.permissionKeys,
        });
        toast.success("Role created");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as AppError).message || "Could not save role");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "Create role"}</DialogTitle>
        </DialogHeader>

        {locked && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600">
            This is a system role — its name, scope, and permissions are immutable. Clone it from
            the Roles list to create a customizable copy.
          </p>
        )}

        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-1.5">
              <Label>Role name</Label>
              <Input
                {...form.register("name")}
                disabled={locked}
                placeholder="e.g. Regional Support Lead"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            {!role && (
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input {...form.register("slug")} placeholder="regional-support-lead" />
                {form.formState.errors.slug && (
                  <p className="text-xs text-destructive">{form.formState.errors.slug.message}</p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...form.register("description")} disabled={locked} rows={2} />
          </div>

          {!role && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Scope type</Label>
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
              <div className="space-y-1.5">
                <Label>Owning organization (optional — global if blank)</Label>
                <Controller
                  control={form.control}
                  name="organizationId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Global" />
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
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Template</p>
              <p className="text-xs text-muted-foreground">
                Allow this role to be cloned by others as a starting point.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isTemplate"
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={locked} />
              )}
            />
          </div>

          <div className="rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Permissions</p>
                <Badge variant="outline">{selected.size} granted</Badge>
              </div>
            </div>
            <ScrollArea className="max-h-[380px]">
              <div className="divide-y">
                {groupedPermissions.map(({ group, items }) => {
                  const keys = items.map((p) => p.key);
                  const allOn = keys.every((k) => selected.has(k));
                  return (
                    <div key={group.id} className="p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Switch
                          checked={allOn}
                          onCheckedChange={(v) => toggleGroup(keys, v)}
                          disabled={locked}
                          aria-label={`Toggle all ${group.name}`}
                        />
                        <span className="text-sm font-medium">{group.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                        {items.map((p) => (
                          <label key={p.key} className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={selected.has(p.key)}
                              onCheckedChange={(v) => togglePermission(p.key, !!v)}
                              disabled={locked}
                            />
                            <span className="capitalize">{p.action}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={locked || create.isPending || update.isPending}>
              {create.isPending || update.isPending
                ? "Saving…"
                : role
                  ? "Save changes"
                  : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
