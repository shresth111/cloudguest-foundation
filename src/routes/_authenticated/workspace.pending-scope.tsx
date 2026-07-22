import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { z } from "zod";
import { ComingSoonPanel, PageShell } from "@/components/ui-ext";

/**
 * Shared placeholder for workspace nav items that were found, in a
 * post-launch audit, to point at platform-console pages/services with no
 * real per-organization scoping (rbac.service.ts's listUsers, voucher.
 * service.ts, portal.service.ts, billing.service.ts, audit.service.ts --
 * each either fans out across every organization or omits X-Organization-Id
 * entirely, relying on a backend assumption that a caller with no org
 * header must be a Super Admin, which isn't actually enforced against the
 * caller's real role). Rather than leave a real cross-tenant data leak
 * live in the customer workspace, or silently remove nav items with no
 * explanation, every affected item routes here until each underlying
 * service gets real per-org scoping.
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
