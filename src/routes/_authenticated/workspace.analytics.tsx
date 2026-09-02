import { createFileRoute, redirect } from "@tanstack/react-router";

// This page rendered <DashboardWidgets /> -- byte for byte the same tiles and
// charts as /workspace, under a different heading. An owner who found both
// would reasonably assume one of them was broken. Redirected rather than
// kept, so an existing bookmark still lands somewhere real.
//
// If a genuine analytics view is wanted later it should show what the
// dashboard doesn't: busiest hours, repeat visitors, week on week.
export const Route = createFileRoute("/_authenticated/workspace/analytics")({
  beforeLoad: () => {
    throw redirect({ to: "/workspace" });
  },
});
