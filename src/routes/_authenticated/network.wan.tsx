import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/wan")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="WAN Configuration"
        description="PPPoE, DHCP and static WAN configuration with health probes and MTU tuning."
        icon={Globe}
        bullets={["Static / DHCP / PPPoE","MTU & MSS clamping","Uplink health probes"]}
      />
    </PageShell>
  );
}
