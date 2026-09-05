import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/system/PageHeader";
import { LiveSessionExplorer } from "@/components/sessions/LiveSessionExplorer";

export const Route = createFileRoute("/_authenticated/sessions/")({
  component: SessionsPage,
});

function SessionsPage() {
  return (
    <div className="space-y-6">
      {/* The old description -- "Real-time view of all active guest sessions
          across locations" -- described 45 rows this page invented in the
          browser. See LiveSessionExplorer's own docstring. */}
      <PageHeader
        title="Live session explorer"
        description="Not wired to a data source yet. Active guest sessions live on the Guests page."
      />
      <LiveSessionExplorer />
    </div>
  );
}
