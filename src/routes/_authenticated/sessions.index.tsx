import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/system/PageHeader";
import { LiveSessionExplorer } from "@/components/sessions/LiveSessionExplorer";

export const Route = createFileRoute("/_authenticated/sessions/")({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Live session explorer"
        description="Real-time view of all active guest sessions across locations."
      />
      <LiveSessionExplorer />
    </div>
  );
}
