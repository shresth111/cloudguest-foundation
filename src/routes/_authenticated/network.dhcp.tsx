import { createFileRoute } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/dhcp")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="DHCP"
        description="Manage DHCP scopes, static reservations and lease telemetry per VLAN."
        icon={Share2}
        bullets={["Scopes per VLAN","Static reservations","Lease telemetry"]}
      />
    </PageShell>
  );
}
