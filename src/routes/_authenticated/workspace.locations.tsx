import { createFileRoute } from "@tanstack/react-router";
import { SectionHeader } from "@/components/ui-ext";
import { LocationGrid, LocationTree } from "@/components/workspace/LocationViews";

export const Route = createFileRoute("/_authenticated/workspace/locations")({
  component: WorkspaceLocationsPage,
});

function WorkspaceLocationsPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Workspace"
        title="Locations"
        description="Manage every property tied to this customer."
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <LocationTree />
        <div className="min-w-0">
          <LocationGrid />
        </div>
      </div>
    </div>
  );
}
