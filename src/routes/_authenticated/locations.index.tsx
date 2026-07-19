import { createFileRoute } from "@tanstack/react-router";
import { LocationTable } from "@/components/locations/LocationTable";

export const Route = createFileRoute("/_authenticated/locations/")({
  component: LocationsListPage,
});

function LocationsListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="text-sm text-muted-foreground">
          Manage sites, network health and guest access across every venue.
        </p>
      </div>
      <LocationTable />
    </div>
  );
}
