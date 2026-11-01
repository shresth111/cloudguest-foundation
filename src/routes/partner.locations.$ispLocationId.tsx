import { createFileRoute } from "@tanstack/react-router";
import { LocationDetailPage } from "@/components/isp-partner/locations/LocationDetailPage";

export const Route = createFileRoute("/partner/locations/$ispLocationId")({
  ssr: false,
  component: LocationDetailRoute,
});

function LocationDetailRoute() {
  const { ispLocationId } = Route.useParams();
  return <LocationDetailPage key={ispLocationId} locationId={ispLocationId} />;
}
