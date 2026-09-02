import { createFileRoute } from "@tanstack/react-router";
import { DashboardWidgets } from "@/components/workspace/DashboardWidgets";

export const Route = createFileRoute("/_authenticated/workspace/")({
  component: WorkspaceDashboardPage,
});

function WorkspaceDashboardPage() {
  // DashboardWidgets renders its own SectionHeader with the same description
  // string, so a second heading here just duplicated it.
  return <DashboardWidgets />;
}
