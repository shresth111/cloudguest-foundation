import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";

// A real captive-portal redirect from a NAS/router would encode equivalent
// identity (MAC/AP/NAS-ID query params in a vendor-specific format) -- there
// is no live NAS in this environment to generate one, so these three are
// taken as explicit, required search params instead.
const searchSchema = z.object({
  organizationId: z.string().min(1),
  locationId: z.string().min(1),
  routerId: z.string().min(1),
});

export const Route = createFileRoute("/portal")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Guest WiFi — Sign in" },
      { name: "description", content: "Connect to complimentary guest WiFi." },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0F172A" },
    ],
  }),
  component: PortalRuntimeLayout,
});

function PortalRuntimeLayout() {
  const { organizationId, locationId, routerId } = Route.useSearch();
  return (
    <PortalRuntimeProvider
      organizationId={organizationId}
      locationId={locationId}
      routerId={routerId}
    >
      <Outlet />
    </PortalRuntimeProvider>
  );
}
