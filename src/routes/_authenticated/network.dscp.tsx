import { createFileRoute } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/dscp")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="DSCP & QoS"
        description="Quality-of-service marking, per-application prioritization and queue policies."
        icon={Gauge}
        bullets={["DSCP mark & trust","Application QoS","Per-queue counters"]}
      />
    </PageShell>
  );
}
