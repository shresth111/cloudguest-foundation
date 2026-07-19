import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { PolicyManagement } from "@/components/policies/PolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/location")({
  component: () => (
    <PageShell>
      <PolicyManagement
        scope="location"
        title="Location Policies"
        description="Bandwidth, quota and auth policies scoped to specific locations."
        targetLabel="Locations"
        targetHelp="Comma-separated location IDs this policy applies to (loc_1, loc_2)."
      />
    </PageShell>
  ),
});
