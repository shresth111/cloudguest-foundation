import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { AuthnPolicyManagement } from "@/components/policies/AuthnPolicyManagement";

export const Route = createFileRoute("/_authenticated/policies/authentication")({
  component: () => (
    <PageShell>
      <AuthnPolicyManagement />
    </PageShell>
  ),
});
