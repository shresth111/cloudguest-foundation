import { createFileRoute, redirect } from "@tanstack/react-router";

// A per-scope "Staff" roster never had a real backend endpoint -- RBAC role
// assignments are scoped per user, not queryable by location/org as a
// reverse index. Retired in favor of the real Users & Roles console; this
// redirect exists only so old bookmarks/links don't dead-end on a blank page.
export const Route = createFileRoute("/_authenticated/workspace/staff")({
  beforeLoad: () => {
    throw redirect({ to: "/rbac" });
  },
});
