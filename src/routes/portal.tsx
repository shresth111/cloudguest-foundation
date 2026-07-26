import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";

// A real captive-portal redirect from a NAS/router would encode equivalent
// identity (MAC/AP/NAS-ID query params in a vendor-specific format) -- there
// is no live NAS in this environment to generate one, so these three are
// taken as explicit, required search params instead.
//
// There used to be a fourth, optional `mac` param here, read by
// src/routes/portal.index.tsx to attempt a "MAC-whitelist bypass" login by
// POSTing it straight to the backend's `/guest/login/mac`. That was a real
// authentication bypass: an unauthenticated browser claiming any MAC string
// in a query param got a full guest session for it, with no server-side
// proof the caller was ever near the real device. It has been removed on
// both sides -- the backend endpoint no longer exists at all. A
// pre-whitelisted device's auto-connect is now granted the only place a
// MAC address can genuinely be trusted: RADIUS's own Authorize call, which
// only ever runs behind the NAS's shared secret and carries the NAS's own
// asserted `Calling-Station-Id`, never a browser's claim (see
// `app.domains.guest.service.RadiusService.authorize`'s docstring on the
// backend). A whitelisted device is granted access before it ever reaches
// this captive portal at all -- there is nothing left for this frontend to
// do for that case.
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
