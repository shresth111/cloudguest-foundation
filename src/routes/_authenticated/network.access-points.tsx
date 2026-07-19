import { createFileRoute } from "@tanstack/react-router";
import { Wifi } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/access-points")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Access Points"
        description="Manage wireless access points across every location — SSID, radios, power levels and firmware."
        icon={Wifi}
        bullets={["Radio & channel planning","Per-AP client analytics","Bulk firmware rollouts"]}
      />
    </PageShell>
  );
}
