import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { BandwidthPolicyManagement } from "@/components/policies/BandwidthPolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/bandwidth")({
  component: () => (
    <PageShell>
      <BandwidthPolicyManagement />
    </PageShell>
  ),
});
