import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { PolicyManagement } from "@/components/policies/PolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/user")({
  component: () => (
    <PageShell>
      <PolicyManagement
        scope="user"
        title="User Policies"
        description="Per-identity policies — VIP guests, blocked identities and role-based overrides."
        targetLabel="Users"
        targetHelp="Comma-separated user IDs (u_1, u_2)."
      />
    </PageShell>
  ),
});
