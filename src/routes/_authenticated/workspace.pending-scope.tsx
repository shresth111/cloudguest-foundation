import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { ComingSoonPanel, PageShell } from "@/components/ui-ext";

/**
 * Shared placeholder for workspace nav items that a post-launch audit found
 * pointing at platform-console pages/services with no real per-organization
 * scoping. Twelve nav items route here (see permissions.service.ts).
 *
 * ⚠️ The original rationale is now partly stale, and the stale half is the
 * load-bearing one. It said these services "omit X-Organization-Id entirely,
 * relying on a backend assumption that a caller with no org header must be a
 * Super Admin". That is no longer possible: `attachOrganizationHeader`
 * (api.ts) is applied in the shared request interceptor and sets the header
 * on *every* request from a session without a global-scope role. A customer
 * session cannot reach these endpoints unscoped any more.
 *
 * Verified against the backend since:
 *  - GET /users        -- scopes to the caller's own org + children when the
 *                         header is present (user/service.py).
 *  - GET /organizations -- same (organization/service.py). So the
 *                         client-side "fan out across every organization"
 *                         pattern in voucher/portal/billing/audit services
 *                         degenerates to the caller's own org for a customer
 *                         session; it only genuinely fans out for a
 *                         global-scope operator, who is entitled to that.
 *
 * Not yet verified per service, which is why the gate stays up: each of the
 * remaining services needs its own read of the backend handler before its
 * nav items are unblocked. Note the current position is internally
 * inconsistent -- the workspace dashboard already renders
 * `rbacService.listUsers` data in its "Total users" KPI on exactly the
 * scoping this page says it doesn't trust. Either that KPI is a leak or
 * these items are blocked without cause; both cannot be right, and
 * resolving it is a deliberate per-service decision, not a drive-by one.
 */
export const Route = createFileRoute("/_authenticated/workspace/pending-scope")({
  validateSearch: z.object({ feature: z.string().optional() }),
  component: PendingScopePage,
});

function PendingScopePage() {
  const { feature } = Route.useSearch();
  return (
    <PageShell>
      <ComingSoonPanel
        icon={ShieldAlert}
        eyebrow="Data isolation in progress"
        title={feature ?? "This feature"}
        description="This page isn't shown here yet because the underlying data isn't scoped to your organization alone -- showing it as-is would risk exposing other customers' records. It'll appear once that scoping is added."
        bullets={[
          "Your data stays isolated to your own organization",
          "No action needed on your end",
          "Available from the Owner/Agent workspace once fixed",
        ]}
      />
    </PageShell>
  );
}
