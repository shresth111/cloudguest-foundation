import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Download,
  MoreHorizontal,
  Pencil,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle2,
  UserCog,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorState } from "@/components/common/ErrorState";
import { useActivateUser, useDeactivateUser, useRbacUsers } from "@/hooks/useRbac";
import { authService } from "@/services/auth.service";
import type { AppError } from "@/services/api";
import type { RbacUser } from "@/types/rbac";
import { AssignRoleDialog } from "./AssignRoleDialog";

const PAGE_SIZE = 25;

interface Props {
  onEdit: (user: RbacUser) => void;
  onCreate: () => void;
}

function exportCsv(users: RbacUser[]) {
  const headers = ["ID", "Name", "Email", "Username", "Status", "Last Login"];
  const rows = users.map((u) => [
    u.id,
    u.fullName,
    u.email,
    u.username,
    u.isActive ? "active" : "inactive",
    u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cloudguest-users.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function initials(u: RbacUser) {
  return `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
}

export function UserTable({ onEdit, onCreate }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<"all" | "true" | "false">("all");
  const [rolesUser, setRolesUser] = useState<RbacUser | null>(null);

  const { data, isLoading, isError, refetch } = useRbacUsers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    isActive: isActive === "all" ? undefined : isActive === "true",
  });
  const activate = useActivateUser();
  const deactivate = useDeactivateUser();

  const users = data?.items ?? [];

  const resetPassword = async (u: RbacUser) => {
    try {
      await authService.forgotPassword(u.email);
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to send reset email");
    }
  };

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, username…"
              className="ps-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={isActive}
            onValueChange={(v) => {
              setIsActive(v as typeof isActive);
              setPage(1);
            }}
          >
            <SelectTrigger className="min-w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportCsv(users)}>
              <Download className="me-1.5 h-4 w-4" /> Export page
            </Button>
            <Button onClick={onCreate}>+ Add user</Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-start">User</th>
                <th className="hidden p-3 text-start md:table-cell">Designation</th>
                <th className="p-3 text-start">Status</th>
                <th className="hidden p-3 text-start md:table-cell">Last login</th>
                <th className="w-10 p-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading || !data ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t">
                    <td colSpan={5} className="p-3">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-muted-foreground">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          {u.profilePhoto && <AvatarImage src={u.profilePhoto} alt={u.fullName} />}
                          <AvatarFallback>{initials(u)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden p-3 md:table-cell">{u.designation ?? "—"}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Badge variant={u.isActive ? "default" : "secondary"}>
                          {u.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {u.isVerified ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </span>
                    </td>
                    <td className="hidden p-3 text-xs text-muted-foreground md:table-cell">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${u.fullName}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => onEdit(u)}>
                            <Pencil className="me-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setRolesUser(u)}>
                            <UserCog className="me-2 h-4 w-4" /> Manage roles
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => resetPassword(u)}>
                            <KeyRound className="me-2 h-4 w-4" /> Send password reset
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.isActive ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                deactivate.mutate(u.id, {
                                  onSuccess: () => toast.success("User deactivated"),
                                  onError: (e) => toast.error((e as unknown as AppError).message),
                                })
                              }
                            >
                              <Ban className="me-2 h-4 w-4" /> Deactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={() =>
                                activate.mutate(u.id, {
                                  onSuccess: () => toast.success("User activated"),
                                  onError: (e) => toast.error((e as unknown as AppError).message),
                                })
                              }
                            >
                              <CheckCircle2 className="me-2 h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              Page {data.page} of {data.totalPages} · {data.totalItems} users
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {rolesUser && (
        <AssignRoleDialog
          userId={rolesUser.id}
          userName={rolesUser.fullName}
          onClose={() => setRolesUser(null)}
        />
      )}
    </Card>
  );
}
