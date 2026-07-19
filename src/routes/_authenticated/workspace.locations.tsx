import { createFileRoute } from "@tanstack/react-router";
import { LocationGrid, LocationTree } from "@/components/workspace/LocationViews";

export const Route = createFileRoute("/_authenticated/workspace/locations")({
  component: WorkspaceLocationsPage,
});

function WorkspaceLocationsPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage every property tied to this customer.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <LocationTree />
        <LocationGrid />
      </div>
    </div>
  );
}
