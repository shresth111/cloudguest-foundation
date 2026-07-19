import { createFileRoute } from "@tanstack/react-router";
import { FileClock } from "lucide-react";
import { PageShell, ComingSoonPanel } from "@/components/ui-ext";

export const Route = createFileRoute("/_authenticated/operations/admin-logs")({
  component: Page,
});

function Page() {
  return (
    <PageShell>
      <ComingSoonPanel
        title="Admin Logs"
        description="Immutable ledger of every administrative action across the platform."
        icon={FileClock}
        bullets={["Immutable ledger","Actor & IP","Diff view"]}
      />
    </PageShell>
  );
}
