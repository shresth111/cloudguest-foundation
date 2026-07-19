import { createFileRoute } from "@tanstack/react-router";
import { Cable } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/analytics/isp")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="ISP Analytics"
        description="Uplink quality, jitter, packet loss and SLA reporting per ISP and location."
        icon={Cable}
        bullets={["Jitter & loss","Uplink SLA","Cost per Mbps"]}
      />
    </PageShell>
  );
}
