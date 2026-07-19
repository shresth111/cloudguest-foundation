import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { PolicyManagement } from "@/components/policies/PolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/group")({
  component: () => (
    <PageShell>
      <PolicyManagement
        scope="group"
        title="Group Policies"
        description="Policies applied to named groups — staff, contractors, VIP tiers."
        targetLabel="Groups"
        targetHelp="Comma-separated group IDs (grp_staff, grp_vip)."
      />
    </PageShell>
  ),
});
