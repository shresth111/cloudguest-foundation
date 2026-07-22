import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { useAuth } from "@/context/AuthContext";
import { legacyRoleBucket, type LegacyRoleBucket } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/workspace")({
  component: WorkspaceLayout,
});

// support_engineer covers helpdesk/network-engineer/network-administrator --
// exactly the kind of operational role an Owner would assign as an "Agent"
// (see workspace.agent.tsx) -- without it here, those users get bounced to
// /dashboard before ever reaching the workspace at all.
const ALLOWED: LegacyRoleBucket[] = [
  "super_admin",
  "org_admin",
  "location_manager",
  "support_engineer",
  "read_only",
];

function WorkspaceLayout() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !ALLOWED.includes(legacyRoleBucket(roles))) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, roles, navigate]);

  return (
    <WorkspaceProvider>
      <WorkspaceLoaded />
    </WorkspaceProvider>
  );
}

function WorkspaceLoaded() {
  const { isLoading, customer } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No customer workspace is associated with your account yet.
      </div>
    );
  }
  return (
    <div>
      <WorkspaceHeader />
      <Outlet />
    </div>
  );
}
