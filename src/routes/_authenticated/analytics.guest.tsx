import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/analytics/guest")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Guest Analytics"
        description="Guest behavior, repeat visit rate, dwell time and demographic segmentation."
        icon={Users}
        bullets={["Repeat vs new","Dwell heatmaps","Segments"]}
      />
    </PageShell>
  );
}
