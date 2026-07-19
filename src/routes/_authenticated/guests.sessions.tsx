import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/guests/sessions")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Guest Sessions"
        description="Historic session records with filters for auth method, device and location."
        icon={Clock}
        bullets={["Rolling 90-day history","Export to CSV/PDF","Session forensics"]}
      />
    </PageShell>
  );
}
