import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/analytics/network")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Network Analytics"
        description="Throughput, retransmits and airtime utilization across every radio and uplink."
        icon={Activity}
        bullets={["Airtime utilization","Retransmits","Per-uplink throughput"]}
      />
    </PageShell>
  );
}
