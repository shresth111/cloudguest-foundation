import { createFileRoute } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/policies/network")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Network Policies"
        description="Firewall, VLAN membership and application filtering combined into one deployable bundle."
        icon={Network}
        bullets={["Firewall templates", "VLAN membership", "App filtering"]}
      />
    </PageShell>
  );
}
