import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { PortForwardingManagement } from "@/components/network/PortForwardingManagement";

export const Route = createFileRoute("/_authenticated/network/port-forwarding")({
  component: () => (
    <PageShell>
      <PortForwardingManagement />
    </PageShell>
  ),
});
