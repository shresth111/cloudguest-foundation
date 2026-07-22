import { createFileRoute, redirect } from "@tanstack/react-router";

// Dead-end scaffolding -- never wired to the real audit domain (no import
// from @/services/audit.service or @/components/audit/*), just a static
// 12-row hardcoded table. Retired in favor of /audit; this redirect exists
// only so old bookmarks/links don't dead-end on a blank page.
export const Route = createFileRoute("/_authenticated/workspace/audit")({
  beforeLoad: () => {
    throw redirect({ to: "/audit" });
  },
});
