import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/guests/whitelist")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Whitelist"
        description="MAC and IP whitelists that bypass the captive portal for staff and IoT."
        icon={ListChecks}
        bullets={["MAC & IP allow","Time-boxed","Location scoped"]}
      />
    </PageShell>
  );
}
