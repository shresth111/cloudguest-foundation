import { createFileRoute } from "@tanstack/react-router";
import { DashboardWidgets } from "@/components/workspace/DashboardWidgets";

export const Route = createFileRoute("/_authenticated/workspace/analytics")({
  component: () => (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Rolling insights across every location in scope.
        </p>
      </div>
      <DashboardWidgets />
    </div>
  ),
});
