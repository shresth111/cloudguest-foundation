import { createFileRoute, redirect } from "@tanstack/react-router";

// Empty "coming soon" placeholder -- no data fetching, no backend behind it,
// conceptually a duplicate of the real /audit page. Retired in favor of
// /audit; this redirect exists only so old bookmarks/links don't dead-end.
export const Route = createFileRoute("/_authenticated/operations/admin-logs")({
  beforeLoad: () => {
    throw redirect({ to: "/audit" });
  },
});
