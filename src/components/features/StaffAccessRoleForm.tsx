/**
 * Staff Access role form + the edit/delete dialogs built on it.
 *
 * `RoleForm` is the one form for a role's name, scope and permissions: the
 * inline "Add New Role" card and the Edit dialog both render it, so the two
 * can't drift into offering different fields.
 *
 * Built-in roles (`organizationId === null`) are shared by every
 * organization. The backend never edits or deletes that shared row from a
 * customer's session: saving an edit gives this organization its own copy
 * (and moves its staff onto it), and deleting removes the role from this
 * organization only. The dialog copy says so, because the role's id changes
 * after an edit and a customer should not be surprised by it.
 */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Permission, PermissionGroup, Role, ScopeType } from "@/types/rbac";
import { SCOPE_TYPE_LABEL } from "@/types/rbac";
import { isBuiltInRole } from "@/lib/staffAccessRoles";

export interface RoleFormValue {
  name: string;
  scopeType: ScopeType;
  permissionKeys: Set<string>;
}

const inputCls =
  "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60";
const labelCls = "mb-1.5 block text-sm font-medium text-foreground";

export function RoleForm({
  value,
  onChange,
  permissionGroups,
  permissions,
  locationId,
  scopeLocked = false,
}: {
  value: RoleFormValue;
  onChange: (next: RoleFormValue) => void;
  permissionGroups: PermissionGroup[];
  permissions: Permission[];
  locationId?: string;
  /** A role's scope is fixed once it exists. */
  scopeLocked?: boolean;
}) {
  function togglePermission(key: string) {
    const next = new Set(value.permissionKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...value, permissionKeys: next });
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="Role name"
        aria-label="Role name"
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        className="h-9"
      />
      <div>
        <label className={labelCls}>Scope</label>
        <select
          value={value.scopeType}
          disabled={scopeLocked}
          onChange={(e) => onChange({ ...value, scopeType: e.target.value as ScopeType })}
          className={inputCls}
        >
          <option value="organization">
            {SCOPE_TYPE_LABEL.organization} — assignable anywhere in your organization
          </option>
          <option value="location" disabled={!locationId && !scopeLocked}>
            {SCOPE_TYPE_LABEL.location} — assignable at this location only
            {!locationId && !scopeLocked ? " (open from a location)" : ""}
          </option>
        </select>
        {scopeLocked && (
          <p className="mt-1 text-xs text-muted-foreground">
            A role's scope can't be changed after it's created.
          </p>
        )}
      </div>
      {permissionGroups.length > 0 && (
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border p-2.5">
          {permissionGroups.map((g) => {
            const items = permissions.filter((p) => p.permissionGroupId === g.id);
            if (items.length === 0) return null;
            return (
              <div key={g.id}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.name}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {items.map((p) => {
                    const on = value.permissionKeys.has(p.key);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        title={p.description ?? p.key}
                        onClick={() => togglePermission(p.key)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs",
                          on ? "border-primary/50 bg-primary/5" : "hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 shrink-0 place-items-center rounded border",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border",
                          )}
                        >
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EditRoleDialog({
  role,
  onClose,
  onSave,
  permissionGroups,
  permissions,
  locationId,
}: {
  role: Role | null;
  onClose: () => void;
  /** Resolves on success; throws the backend error otherwise so the dialog
   * stays open with the user's edits intact. */
  onSave: (role: Role, value: RoleFormValue) => Promise<void>;
  permissionGroups: PermissionGroup[];
  permissions: Permission[];
  locationId?: string;
}) {
  const [value, setValue] = useState<RoleFormValue | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue(
      role
        ? {
            name: role.name,
            scopeType: role.scopeType,
            permissionKeys: new Set(role.permissions),
          }
        : null,
    );
  }, [role]);

  const builtIn = !!role && isBuiltInRole(role);

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
          <DialogDescription>
            {builtIn
              ? "This is a built-in role. Saving creates your organization's own copy with these changes, and moves your staff on it to the copy. Other organizations aren't affected."
              : "Changes apply to every staff member with this role as soon as you save."}
          </DialogDescription>
        </DialogHeader>
        {role && value && (
          <RoleForm
            value={value}
            onChange={setValue}
            permissionGroups={permissionGroups}
            permissions={permissions}
            locationId={locationId}
            scopeLocked
          />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy || !value || !value.name.trim()}
            onClick={async () => {
              if (!role || !value) return;
              setBusy(true);
              try {
                await onSave(role, value);
              } catch {
                // onSave already surfaced the backend's reason.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteRoleDialog({
  role,
  onClose,
  onConfirm,
}: {
  role: Role | null;
  onClose: () => void;
  onConfirm: (role: Role) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const builtIn = !!role && isBuiltInRole(role);

  return (
    <AlertDialog open={!!role} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{role?.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {builtIn
              ? "This built-in role will be removed from your organization only. "
              : "This role will be deleted. "}
            A role that is still assigned to staff can't be deleted — reassign them to another role
            first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: Action closes the dialog
              on click, before the request can fail and explain why. */}
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!role) return;
              setBusy(true);
              try {
                await onConfirm(role);
              } catch {
                // onConfirm already surfaced the backend's reason.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete role"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
