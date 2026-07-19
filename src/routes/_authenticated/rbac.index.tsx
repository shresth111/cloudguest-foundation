import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RbacKpiGrid } from "@/components/rbac/RbacKpiGrid";
import { UserTable } from "@/components/rbac/UserTable";
import { UserFormDialog } from "@/components/rbac/UserFormDialog";
import { RoleTable } from "@/components/rbac/RoleTable";
import { RoleFormDialog } from "@/components/rbac/RoleFormDialog";
import { CompareRolesPanel } from "@/components/rbac/CompareRolesPanel";
import { LocationAccessTree } from "@/components/rbac/LocationAccessTree";
import { DepartmentManager } from "@/components/rbac/DepartmentManager";
import { UserGroupsPanel } from "@/components/rbac/UserGroupsPanel";
import { InvitationsPanel } from "@/components/rbac/InvitationsPanel";
import { ActiveSessionsPanel } from "@/components/rbac/ActiveSessionsPanel";
import { LoginHistoryPanel } from "@/components/rbac/LoginHistoryPanel";
import { MfaPanel } from "@/components/rbac/MfaPanel";
import { PasswordPolicyPanel } from "@/components/rbac/PasswordPolicyPanel";
import { AccountSecurityPanel } from "@/components/rbac/AccountSecurityPanel";
import { ProfilePanel } from "@/components/rbac/ProfilePanel";
import { RbacQuickActions } from "@/components/rbac/RbacQuickActions";
import { GlobalUserSearch } from "@/components/rbac/GlobalUserSearch";
import type { RbacRole, RbacUser } from "@/types/rbac";
import { useRbacUsers } from "@/hooks/useRbac";

export const Route = createFileRoute("/_authenticated/rbac/")({
  component: RbacPage,
});

function RbacPage() {
  const [tab, setTab] = useState("users");
  const [userDialog, setUserDialog] = useState<{ open: boolean; user?: RbacUser | null }>({ open: false });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: RbacRole | null }>({ open: false });
  const { data: users } = useRbacUsers();

  const exportUsers = useMemo(() => () => {
    if (!users?.length) { toast.info("No users to export"); return; }
    const headers = ["ID", "Name", "Email", "Role", "Status"];
    const rows = users.map((u) => [u.id, `${u.firstName} ${u.lastName}`, u.email, u.roleName, u.status]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "users.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("Users exported");
  }, [users]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">Manage teammates, roles, permissions, and account security across CloudGuest.</p>
      </div>

      <RbacKpiGrid />

      <RbacQuickActions
        onAddUser={() => setUserDialog({ open: true, user: null })}
        onCreateRole={() => setRoleDialog({ open: true, role: null })}
        onInvite={() => setTab("invitations")}
        onExport={exportUsers}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex w-full flex-wrap gap-1 h-auto">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="history">Login history</TabsTrigger>
          <TabsTrigger value="mfa">MFA</TabsTrigger>
          <TabsTrigger value="policy">Password policy</TabsTrigger>
          <TabsTrigger value="security">Account security</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UserTable
            onCreate={() => setUserDialog({ open: true, user: null })}
            onEdit={(u) => setUserDialog({ open: true, user: u })}
          />
        </TabsContent>
        <TabsContent value="roles" className="mt-4 space-y-4">
          <RoleTable
            onCreate={() => setRoleDialog({ open: true, role: null })}
            onEdit={(r) => setRoleDialog({ open: true, role: r })}
            onCompare={() => setTab("permissions")}
          />
        </TabsContent>
        <TabsContent value="permissions" className="mt-4 space-y-4">
          <CompareRolesPanel />
        </TabsContent>
        <TabsContent value="locations" className="mt-4"><LocationAccessTree /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentManager /></TabsContent>
        <TabsContent value="groups" className="mt-4"><UserGroupsPanel /></TabsContent>
        <TabsContent value="invitations" className="mt-4"><InvitationsPanel /></TabsContent>
        <TabsContent value="sessions" className="mt-4"><ActiveSessionsPanel /></TabsContent>
        <TabsContent value="history" className="mt-4"><LoginHistoryPanel /></TabsContent>
        <TabsContent value="mfa" className="mt-4"><MfaPanel /></TabsContent>
        <TabsContent value="policy" className="mt-4"><PasswordPolicyPanel /></TabsContent>
        <TabsContent value="security" className="mt-4"><AccountSecurityPanel /></TabsContent>
        <TabsContent value="profile" className="mt-4"><ProfilePanel /></TabsContent>
        <TabsContent value="search" className="mt-4"><GlobalUserSearch /></TabsContent>
      </Tabs>

      <UserFormDialog
        open={userDialog.open}
        user={userDialog.user}
        onOpenChange={(open) => setUserDialog({ open, user: open ? userDialog.user : null })}
      />
      <RoleFormDialog
        open={roleDialog.open}
        role={roleDialog.role}
        onOpenChange={(open) => setRoleDialog({ open, role: open ? roleDialog.role : null })}
      />
    </div>
  );
}
