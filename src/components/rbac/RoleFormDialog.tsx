import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useSaveRole, useRbacRoles } from "@/hooks/useRbac";
import { PERMISSION_ACTIONS, RBAC_MODULES, type PermissionAction, type RbacModule, type RbacPermissions, type RbacRole } from "@/types/rbac";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RbacRole | null;
}

const EMPTY_PERMS = (): RbacPermissions => Object.fromEntries(RBAC_MODULES.map((m) => [m.key, {}])) as RbacPermissions;

export function RoleFormDialog({ open, onOpenChange, role }: Props) {
  const { data: existing } = useRbacRoles();
  const save = useSaveRole();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [permissions, setPermissions] = useState<RbacPermissions>(EMPTY_PERMS());
  const [copyFrom, setCopyFrom] = useState<string>("");

  useEffect(() => {
    if (open) {
      setName(role?.name ?? "");
      setDescription(role?.description ?? "");
      setStatus(role?.status ?? "active");
      setPermissions(role?.permissions ?? EMPTY_PERMS());
      setCopyFrom("");
    }
  }, [open, role]);

  const toggle = (m: RbacModule, a: PermissionAction) => {
    setPermissions((prev) => ({ ...prev, [m]: { ...(prev[m] ?? {}), [a]: !prev[m]?.[a] } }));
  };
  const toggleModule = (m: RbacModule, on: boolean) => {
    setPermissions((prev) => ({ ...prev, [m]: Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, on])) as never }));
  };
  const toggleAction = (a: PermissionAction, on: boolean) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const m of RBAC_MODULES) next[m.key] = { ...(next[m.key] ?? {}), [a]: on };
      return next;
    });
  };
  const selectAll = (on: boolean) => {
    setPermissions(on ? Object.fromEntries(RBAC_MODULES.map((m) => [m.key, Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, true]))])) as never : EMPTY_PERMS());
  };
  const applyCopy = (id: string) => {
    const src = existing?.find((r) => r.id === id);
    if (src) { setPermissions(structuredClone(src.permissions)); setCopyFrom(id); toast.success(`Copied permissions from ${src.name}`); }
  };

  const totalOn = useMemo(() => Object.values(permissions).reduce((sum, mod) => sum + Object.values(mod ?? {}).filter(Boolean).length, 0), [permissions]);

  const submit = async () => {
    if (!name.trim()) { toast.error("Role name is required"); return; }
    const payload: RbacRole = {
      id: role?.id ?? "",
      name: name.trim(),
      description,
      isSystem: role?.isSystem ?? false,
      usersAssigned: role?.usersAssigned ?? 0,
      permissions,
      status,
      createdAt: role?.createdAt ?? Date.now(),
    };
    try { await save.mutateAsync(payload); toast.success(role ? "Role updated" : "Role created"); onOpenChange(false); }
    catch { toast.error("Could not save role"); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{role ? "Edit role" : "Create role"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_200px]">
            <div className="space-y-1.5">
              <Label>Role name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Support Lead" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Copy from</Label>
              <Select value={copyFrom} onValueChange={applyCopy}>
                <SelectTrigger><SelectValue placeholder="Choose role…" /></SelectTrigger>
                <SelectContent>
                  {existing?.filter((r) => r.id !== role?.id).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short summary shown across the platform." />
          </div>

          <div className="rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Permission matrix</p>
                <Badge variant="outline">{totalOn} granted</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => selectAll(true)}>Select all</Button>
                <Button size="sm" variant="outline" onClick={() => selectAll(false)}>Clear all</Button>
              </div>
            </div>
            <ScrollArea className="max-h-[420px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="p-2 text-start font-medium">Module</th>
                    {PERMISSION_ACTIONS.map((a) => (
                      <th key={a} className="p-2 text-center font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <span className="capitalize">{a}</span>
                          <Checkbox
                            checked={RBAC_MODULES.every((m) => !!permissions[m.key]?.[a])}
                            onCheckedChange={(v) => toggleAction(a, !!v)}
                            aria-label={`Toggle all ${a}`}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RBAC_MODULES.map((m) => {
                    const modAll = PERMISSION_ACTIONS.every((a) => !!permissions[m.key]?.[a]);
                    return (
                      <tr key={m.key} className="border-b hover:bg-muted/40">
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Switch checked={modAll} onCheckedChange={(v) => toggleModule(m.key, v)} aria-label={`Toggle all ${m.label}`} />
                            <span className="font-medium">{m.label}</span>
                          </div>
                        </td>
                        {PERMISSION_ACTIONS.map((a) => (
                          <td key={a} className="p-2 text-center">
                            <Checkbox checked={!!permissions[m.key]?.[a]} onCheckedChange={() => toggle(m.key, a)} aria-label={`${m.label} ${a}`} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : role ? "Save changes" : "Create role"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
