import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RbacKpiGrid } from "@/components/rbac/RbacKpiGrid";
import { UserTable } from "@/components/rbac/UserTable";
import { UserFormDialog } from "@/components/rbac/UserFormDialog";
import { RoleTable } from "@/components/rbac/RoleTable";
import { RoleFormDialog } from "@/components/rbac/RoleFormDialog";
import { CompareRolesPanel } from "@/components/rbac/CompareRolesPanel";
import { InviteUserPanel } from "@/components/rbac/InviteUserPanel";
import { LoginHistoryPanel } from "@/components/rbac/LoginHistoryPanel";
import { PasswordPolicyInfo } from "@/components/rbac/PasswordPolicyInfo";
import { RbacQuickActions } from "@/components/rbac/RbacQuickActions";
import { GlobalUserSearch } from "@/components/rbac/GlobalUserSearch";
import type { Role, RbacUser } from "@/types/rbac";

export const Route = createFileRoute("/_authenticated/rbac/")({
  component: RbacPage,
});

function RbacPage() {
  const [tab, setTab] = useState("users");
  const [userDialog, setUserDialog] = useState<{ open: boolean; user?: RbacUser | null }>({
    open: false,
  });
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role | null }>({
    open: false,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users & Roles</h1>
        <p className="text-sm text-muted-foreground">
          Manage teammates, roles, scoped permissions, and invitations across CloudGuest.
        </p>
      </div>

      <RbacKpiGrid />

      <RbacQuickActions
        onAddUser={() => setUserDialog({ open: true, user: null })}
        onCreateRole={() => setRoleDialog({ open: true, role: null })}
        onInvite={() => setTab("invitations")}
        onExport={() => {
          setTab("users");
          toast.info("Use the Export button on the Users tab.");
        }}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Compare permissions</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="history">Login history</TabsTrigger>
          <TabsTrigger value="policy">Password policy</TabsTrigger>
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
        <TabsContent value="invitations" className="mt-4">
          <InviteUserPanel />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <LoginHistoryPanel />
        </TabsContent>
        <TabsContent value="policy" className="mt-4">
          <PasswordPolicyInfo />
        </TabsContent>
        <TabsContent value="search" className="mt-4">
          <GlobalUserSearch />
        </TabsContent>
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
