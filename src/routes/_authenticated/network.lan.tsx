import { createFileRoute } from "@tanstack/react-router";
import { EthernetPort } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/lan")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="LAN Configuration"
        description="Manage LAN bridges, IP schemes, DHCP scopes and Layer-2 isolation policies."
        icon={EthernetPort}
        bullets={["Bridge & interface plans","Static leases","Client isolation"]}
      />
    </PageShell>
  );
}
