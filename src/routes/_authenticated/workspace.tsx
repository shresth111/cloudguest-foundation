import { createFileRoute, Outlet } from "@tanstack/react-router";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/workspace")({
  component: WorkspaceLayout,
});

// There is deliberately no role gate here any more.
//
// This layout used to redirect anyone outside an ALLOWED list of
// LegacyRoleBucket values. That gate could never fire: legacyRoleBucket()
// returns one of exactly five buckets and falls through to "read_only" for
// any role it doesn't recognise, and all five were in the list. So it read
// as protection while denying nobody -- and its redirect target, /dashboard,
// is itself an operator-console path that the parent _authenticated guard
// bounces customers off, so had it ever fired the user would have been
// redirected twice and landed at "/".
//
// The real gating is elsewhere and unaffected: _authenticated.tsx keeps
// non-operators inside the customer-safe paths, and the backend enforces
// permissions per request. Removing dead code rather than leaving a guard
// that implies a check nobody performs.

function WorkspaceLayout() {
  return (
    <WorkspaceProvider>
      <WorkspaceLoaded />
    </WorkspaceProvider>
  );
}

function WorkspaceLoaded() {
  const { isLoading, isError, refetch, customer } = useWorkspace();
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  // A failed request used to fall through to the "no workspace" copy below,
  // telling the user their account was unprovisioned whenever the API
  // returned a 500 or the network dropped -- with no retry.
  if (isError) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm">Your workspace couldn&apos;t be loaded.</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
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
