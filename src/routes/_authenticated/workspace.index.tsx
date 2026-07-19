import { createFileRoute } from "@tanstack/react-router";
import { DashboardWidgets } from "@/components/workspace/DashboardWidgets";

export const Route = createFileRoute("/_authenticated/workspace/")({
  component: WorkspaceDashboardPage,
});

function WorkspaceDashboardPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace overview</h1>
        <p className="text-sm text-muted-foreground">
          Unified view of your locations, guests, routers, and revenue.
        </p>
      </div>
      <DashboardWidgets />
    </div>
  );
}
