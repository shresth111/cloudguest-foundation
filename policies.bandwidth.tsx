import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/policies/bandwidth")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Bandwidth Policies"
        description="Reusable bandwidth templates: cap, burst, DSCP marks and per-VLAN queue shaping."
        icon={Gauge}
        bullets={["Cap & burst","DSCP mapping","Per-VLAN queues"]}
      />
    </PageShell>
  );
}
