import { createFileRoute } from "@tanstack/react-router";
import { KeyRound } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/policies/authentication")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Authentication Policies"
        description="Central rules for OTP retries, SMS gateway routing, social provider preference and MFA enforcement."
        icon={KeyRound}
        bullets={["OTP retry budgets","Provider preference","MFA enforcement"]}
      />
    </PageShell>
  );
}
