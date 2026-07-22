import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { FirewallManagement } from "@/components/network/FirewallManagement";

export const Route = createFileRoute("/_authenticated/network/firewall")({
  component: () => (
    <PageShell>
      <FirewallManagement />
    </PageShell>
  ),
});
