import { createFileRoute } from "@tanstack/react-router";
import { BellRing } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/operations/alerts")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Alerts"
        description="Router, portal and guest experience alerts with routing to email, SMS and webhooks."
        icon={BellRing}
        bullets={["Multi-channel routing","Escalation policies","Auto-suppression"]}
      />
    </PageShell>
  );
}
