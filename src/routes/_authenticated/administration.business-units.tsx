import { createFileRoute } from "@tanstack/react-router";
import { Building } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/administration/business-units")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Business Units"
        description="Group locations into regions or brands and scope regional admins."
        icon={Building}
        bullets={["Region / brand groups","Scoped access","Rollup reporting"]}
      />
    </PageShell>
  );
}
