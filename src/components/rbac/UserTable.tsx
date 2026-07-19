import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Download, MoreHorizontal, Eye, Pencil, KeyRound, ShieldOff, Trash2, Ban, LogOut, CheckCircle2, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useRbacUsers, useRbacRoles, useInvalidateRbac } from "@/hooks/useRbac";
import { rbacService } from "@/services/rbac.service";
import { cn } from "@/lib/utils";
import type { RbacUser, RbacUserStatus } from "@/types/rbac";

const STATUS_META: Record<RbacUserStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; dot: string }> = {
  active: { label: "Active", variant: "default", dot: "bg-emerald-500" },
  disabled: { label: "Disabled", variant: "secondary", dot: "bg-slate-400" },
  invited: { label: "Invited", variant: "outline", dot: "bg-amber-500" },
  locked: { label: "Locked", variant: "destructive", dot: "bg-red-500" },
};

interface Props {
  onEdit: (user: RbacUser) => void;
  onCreate: () => void;
}

type SortKey = "name" | "lastLogin" | "role";

function exportCsv(users: RbacUser[]) {
  const headers = ["ID", "Name", "Email", "Mobile", "Organization", "Department", "Role", "Status", "MFA", "Last Login"];
  const rows = users.map((u) => [u.id, `${u.firstName} ${u.lastName}`, u.email, u.mobile, u.organizationName, u.departmentName, u.roleName, u.status, u.mfaEnabled ? "on" : "off", u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : ""]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "cloudguest-users.csv"; a.click(); URL.revokeObjectURL(url);
}

export function UserTable({ onEdit, onCreate }: Props) {
  const { data: users, isLoading, error } = useRbacUsers();
  const { data: roles } = useRbacRoles();
  const invalidate = useInvalidateRbac();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | RbacUserStatus>("all");
  const [roleId, setRoleId] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<RbacUser | null>(null);
  const pageSize = 10;

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    const arr = users.filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (roleId !== "all" && u.roleId !== roleId) return false;
      if (!q) return true;
      return [u.firstName, u.lastName, u.email, u.mobile, u.organizationName, u.roleName, u.departmentName].some((v) => v.toLowerCase().includes(q));
    });
    arr.sort((a, b) => {
      if (sort === "name") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sort === "role") return a.roleName.localeCompare(b.roleName);
      return (b.lastLoginAt ?? 0) - (a.lastLoginAt ?? 0);
    });
    return arr;
  }, [users, search, status, roleId, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allChecked = pageItems.length > 0 && pageItems.every((u) => selected.has(u.id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageItems.forEach((u) => next.delete(u.id));
    else pageItems.forEach((u) => next.add(u.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };

  const runBulk = async (kind: "disable" | "enable" | "delete") => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      if (kind === "delete") await Promise.all(ids.map((id) => rbacService.deleteUser(id)));
      else await rbacService.bulkUpdateStatus(ids, kind === "disable" ? "disabled" : "active");
      toast.success(`${ids.length} user${ids.length > 1 ? "s" : ""} updated`);
      setSelected(new Set());
      invalidate();
    } catch { toast.error("Bulk action failed"); }
  };

  const doAction = async (u: RbacUser, kind: "reset-pass" | "reset-mfa" | "disable" | "enable" | "delete") => {
    try {
      if (kind === "reset-pass") { await rbacService.resetPassword(u.id); toast.success("Password reset link sent"); }
      else if (kind === "reset-mfa") { await rbacService.resetMfa(u.id); toast.success("MFA reset"); }
      else if (kind === "disable") { await rbacService.setUserStatus(u.id, "disabled"); toast.success("User disabled"); }
      else if (kind === "enable") { await rbacService.setUserStatus(u.id, "active"); toast.success("User enabled"); }
      else if (kind === "delete") { await rbacService.deleteUser(u.id); toast.success("User deleted"); }
      invalidate();
    } catch { toast.error("Action failed"); }
  };

  if (error) return <Card><CardContent className="p-6 text-sm text-destructive">Failed to load users.</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, email, mobile, organization…" className="ps-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v as never); setPage(1); }}>
            <SelectTrigger className="min-w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleId} onValueChange={(v) => { setRoleId(v); setPage(1); }}>
            <SelectTrigger className="min-w-40"><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roles?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportCsv(filtered)}><Download className="me-1.5 h-4 w-4" /> Export</Button>
            <Button onClick={onCreate}>+ Add user</Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2 text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => runBulk("enable")}><CheckCircle2 className="me-1.5 h-3.5 w-3.5" /> Enable</Button>
            <Button size="sm" variant="outline" onClick={() => runBulk("disable")}><Ban className="me-1.5 h-3.5 w-3.5" /> Disable</Button>
            <Button size="sm" variant="destructive" onClick={() => runBulk("delete")}><Trash2 className="me-1.5 h-3.5 w-3.5" /> Delete</Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-10 p-3"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></th>
                <th className="p-3 text-start"><button className="inline-flex items-center gap-1" onClick={() => setSort("name")}>User <ChevronsUpDown className="h-3 w-3" /></button></th>
                <th className="p-3 text-start hidden md:table-cell">Organization</th>
                <th className="p-3 text-start hidden lg:table-cell">Department</th>
                <th className="p-3 text-start"><button className="inline-flex items-center gap-1" onClick={() => setSort("role")}>Role <ChevronsUpDown className="h-3 w-3" /></button></th>
                <th className="p-3 text-start">Status</th>
                <th className="p-3 text-start hidden md:table-cell"><button className="inline-flex items-center gap-1" onClick={() => setSort("lastLogin")}>Last login <ChevronsUpDown className="h-3 w-3" /></button></th>
                <th className="p-3 text-center hidden sm:table-cell">MFA</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading || !users ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t"><td colSpan={9} className="p-3"><Skeleton className="h-10 w-full" /></td></tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-muted-foreground">No users match your filters.</td></tr>
              ) : pageItems.map((u) => {
                const meta = STATUS_META[u.status];
                return (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="p-3"><Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggleOne(u.id)} /></td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ background: u.avatarColor }}>
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.firstName} {u.lastName}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell"><span className="truncate">{u.organizationName}</span></td>
                    <td className="p-3 hidden lg:table-cell">{u.departmentName}</td>
                    <td className="p-3"><Badge variant="outline">{u.roleName}</Badge></td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </span>
                    </td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                    <td className="p-3 hidden sm:table-cell text-center">
                      {u.mfaEnabled ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <ShieldOff className="mx-auto h-4 w-4 text-muted-foreground" />}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${u.firstName}`}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => onEdit(u)}><Eye className="me-2 h-4 w-4" /> View</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onEdit(u)}><Pencil className="me-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => doAction(u, "reset-pass")}><KeyRound className="me-2 h-4 w-4" /> Reset password</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => doAction(u, "reset-mfa")}><ShieldOff className="me-2 h-4 w-4" /> Reset MFA</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toast.info("Opening sessions…")}><LogOut className="me-2 h-4 w-4" /> View sessions</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.status === "disabled" ? (
                            <DropdownMenuItem onSelect={() => doAction(u, "enable")}><CheckCircle2 className="me-2 h-4 w-4" /> Enable</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => doAction(u, "disable")}><Ban className="me-2 h-4 w-4" /> Disable</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => setPendingDelete(u)} className="text-destructive focus:text-destructive"><Trash2 className="me-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Showing {pageItems.length} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {pendingDelete?.firstName} {pendingDelete?.lastName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDelete) { doAction(pendingDelete, "delete"); setPendingDelete(null); } }}>Delete user</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
