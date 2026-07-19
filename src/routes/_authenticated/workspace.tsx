import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/_authenticated/workspace")({
  component: WorkspaceLayout,
});

const ALLOWED = ["super_admin", "org_admin", "location_manager", "read_only"] as const;

function WorkspaceLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !ALLOWED.includes(user.role as (typeof ALLOWED)[number])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, navigate]);

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
