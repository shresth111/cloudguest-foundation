import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { RoutingPolicyManagement } from "@/components/policies/RoutingPolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/network")({
  component: () => (
    <PageShell>
      <RoutingPolicyManagement />
    </PageShell>
  ),
});
