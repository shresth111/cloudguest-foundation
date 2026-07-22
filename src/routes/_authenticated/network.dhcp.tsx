import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { DhcpManagement } from "@/components/network/DhcpManagement";

export const Route = createFileRoute("/_authenticated/network/dhcp")({
  component: () => (
    <PageShell>
      <DhcpManagement />
    </PageShell>
  ),
});
