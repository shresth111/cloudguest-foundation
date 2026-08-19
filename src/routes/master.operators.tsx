import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserPlus2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterShell } from "@/components/master/MasterShell";
import { MPageShell, MSectionHeader } from "@/components/master/MasterKit";
import { UserTable } from "@/components/rbac/UserTable";
import { UserFormDialog } from "@/components/rbac/UserFormDialog";
import { InviteUserPanel } from "@/components/rbac/InviteUserPanel";
import type { RbacUser } from "@/types/rbac";

export const Route = createFileRoute("/master/operators")({ component: OperatorsScreen });

/**
 * The Master Console had no UI anywhere for managing who holds internal
 * staff (GLOBAL-scope) access to it -- no roster of who has Super
 * Admin/Platform Admin/Platform Support/Billing Manager, no invite path for
 * a new hire, no way to change or revoke a departed employee's grant. See
 * docs/pm-master-console-roadmap.md Phase 2 #1 for the full audit; the
 * short version is this was a pure frontend gap, not a backend one --
 * `UserService.list_users()`'s own docstring already says "Platform-level
 * callers (no requesting_organization_id -- a GLOBAL-scoped role) see every
 * user", and `POST /users/{id}/roles` / `DELETE /users/{id}/roles/{id}`
 * already support `scope_type: "global"`. Every piece this needs already
 * exists and is already in production use, one scope over, on the
 * customer-dashboard's own `/_authenticated/rbac` page -- `UserTable` (list
 * + deactivate/activate/force-logout + its own "Manage roles" row action,
 * which opens `AssignRoleDialog`; that dialog's own `SCOPE_OPTIONS` already
 * include "global"), `UserFormDialog` (create), `InviteUserPanel` (invite).
 * Reused directly here, unscoped, rather than rebuilt -- identical
 * precedent to master.audit.tsx/master.tickets.tsx reusing the customer
 * Audit/Ticket components. None of `useRbacUsers`/`useCreateUser`/
 * `useInviteUser`/`useAssignRole`/`useRevokeRoleAssignment`/
 * `useActivateUser`/`useDeactivateUser` (see src/hooks/useRbac.ts) ever
 * resolve or attach an `X-Organization-Id` header -- unlike the sibling
 * role-CRUD hooks just below them in that same file (`useCreateRole` etc.),
 * which explicitly call `resolveOrgIdSafe()`. A Master Console session has
 * no organization membership of its own, so that header is never sent from
 * here, which is exactly what makes every one of these calls resolve
 * GLOBAL scope on the backend -- the same "absent header -> GLOBAL scope"
 * pattern already proven by master.audit.tsx/master.health.tsx/
 * master.analytics.tsx.
 *
 * Two honest scope notes, not hidden behind a nicer story:
 *
 * 1. `GET /users` has no `is_staff`/`user_type` flag to filter by -- an
 *    unscoped call (this page) returns literally every user account on the
 *    platform, customers included, not just internal operators. There is
 *    no backend concept of "internal staff" independent of "holds a
 *    GLOBAL-scope role assignment", so a true "staff-only" roster would
 *    need a backend change (a real product decision, not a wiring gap --
 *    out of scope here per this task's own backend-change guardrail). In
 *    the meantime, search by name/email narrows this fast, and the
 *    authoritative "does this person actually have platform access"
 *    question is answered by opening "Manage roles" and looking for a
 *    Global-scope assignment, not by this list's mere presence on it.
 * 2. `RbacKpiGrid` (used by the customer RBAC page) is deliberately not
 *    reused here -- its "Total/Active/Inactive Users" counters are derived
 *    from that same unscoped `GET /users` (see rbacService.getKpis()), so
 *    on this page they'd report the whole platform's user count, not this
 *    console's own operator headcount -- actively misleading on a page
 *    titled "Team & Access". No GLOBAL-scope-only KPI source exists to
 *    swap in instead, so it's left out rather than shown with numbers that
 *    would need a footnote to not be misread.
 *
 * Nav/capability wiring: gated behind the `operators` capability
 * (MasterShell.tsx's `CAP_PERMISSIONS`), which requires `users.manage` --
 * see that entry's own comment for why `users.read` alone (which
 * Platform Support also holds) was deliberately not used as the gate.
 */
function OperatorsScreen() {
  const [tab, setTab] = useState("directory");
  const [userDialog, setUserDialog] = useState<{ open: boolean; user?: RbacUser | null }>({
    open: false,
  });

  return (
    <MasterShell title="Team & Access">
      <MPageShell>
        <MSectionHeader
          eyebrow="Administration"
          title="Team & Access"
          actions={
            <p className="text-xs text-muted-foreground">
              Manage who has internal staff access to this console, invite new hires, and revoke
              access when someone leaves.
            </p>
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="invite">
              <UserPlus2 className="me-1.5 h-3.5 w-3.5" /> Invite operator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-4">
            <UserTable
              onCreate={() => setUserDialog({ open: true, user: null })}
              onEdit={(u) => setUserDialog({ open: true, user: u })}
            />
          </TabsContent>

          <TabsContent value="invite" className="mt-4">
            <InviteUserPanel />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          This directory lists every account on the platform (customers included) -- use "Manage
          roles" on a user to see or change their actual GLOBAL-scope (staff) access, and search by
          name or email to find someone fast.{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setTab("invite");
              toast.info("Fill in the form to create a new internal operator account.");
            }}
          >
            Inviting a new hire?
          </button>
        </p>
      </MPageShell>

      <UserFormDialog
        open={userDialog.open}
        user={userDialog.user}
        onOpenChange={(open) => setUserDialog({ open, user: open ? userDialog.user : null })}
      />
    </MasterShell>
  );
}
