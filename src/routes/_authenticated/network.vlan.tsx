import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/ui-ext";
import { VlanManagement } from "@/components/network/VlanManagement";

export const Route = createFileRoute("/_authenticated/network/vlan")({
  component: () => (
    <PageShell>
      <VlanManagement />
    </PageShell>
  ),
});
