import { createFileRoute } from "@tanstack/react-router";
import { Cable } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/network/isp")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="ISP & Uplinks"
        description="Configure multi-WAN uplinks, failover priorities and per-ISP routing policies."
        icon={Cable}
        bullets={["Primary/secondary uplinks","Weighted load balancing","Real-time link quality"]}
      />
    </PageShell>
  );
}
