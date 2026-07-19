import { createFileRoute } from "@tanstack/react-router";
import { PieChart } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/analytics/executive")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Executive Dashboard"
        description="Board-level KPIs across revenue, uptime, guest satisfaction and network health."
        icon={PieChart}
        bullets={["Revenue vs. plan","Uptime SLA","NPS trend"]}
      />
    </PageShell>
  );
}
