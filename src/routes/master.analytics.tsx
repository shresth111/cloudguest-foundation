import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader, MStubPanel } from "@/components/master/MasterKit";

export const Route = createFileRoute("/master/analytics")({ component: AnalyticsScreen });

function AnalyticsScreen() {
  return (
    <MasterShell title="Global Analytics">
      <MSectionHeader eyebrow="Insights" title="Global Analytics" />
      <MStubPanel
        icon={LineChart}
        title="Global Analytics"
        blurb="Cross-tenant usage, growth and revenue trends."
        points={["Sessions & unique guests by tenant/region", "Cohort retention and return-rate", "Revenue and plan-mix trends", "Auth success vs. reject over time", "Exportable scheduled reports", "Drill-down to a single customer"]}
      />
    </MasterShell>
  );
}
