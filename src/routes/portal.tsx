import { createFileRoute, Outlet, SearchParamError } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { z } from "zod";
import { PortalRuntimeProvider } from "@/context/PortalRuntimeContext";
import { ErrorComponent as RootErrorComponent } from "./__root";

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

/**
 * A real NAS/router redirect always supplies all three search params (see
 * `searchSchema` above) -- but this URL can also reach a browser with one
 * missing any other way a link can go wrong: a bookmark saved before a
 * redirect finished building its query string, a hand-typed URL, a QR code
 * that got cropped/mistyped when printed. `validateSearch` throwing on a
 * missing param is real and correct (this frontend has no router/NAS
 * identity to fall back to without it) -- it's the *display* of that
 * failure that used to be wrong: the app-wide root error boundary's generic
 * "This page didn't load / Something went wrong on our end" reads like a
 * server bug to a guest, giving them no idea this is about the link itself
 * or what to actually do about it. This route-level `errorComponent`
 * catches exactly that one case (a `SearchParamError`, TanStack Router's
 * own type for a `validateSearch` failure) and shows a plain, honest
 * explanation with a real next step instead -- any *other* error under
 * `/portal/*` (a genuine bug, a network failure, etc.) still falls through
 * to the same root error boundary every other route in the app uses.
 */
function IncompletePortalLinkError() {
  return (
    <div
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4"
      style={{
        fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif",
        background: "linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #e0e7ff 100%)",
      }}
    >
      <div
        className="relative z-10 w-full max-w-[400px] rounded-[24px] border border-indigo-100/80 bg-white p-7 text-center"
        style={{
          boxShadow: "0 24px 60px -20px rgba(79,70,229,0.28), 0 8px 24px -10px rgba(15,23,42,0.12)",
        }}
      >
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl shadow-lg shadow-indigo-500/25"
          style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}
        >
          <QrCode className="h-7 w-7 text-white" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">This WiFi link looks incomplete</h1>
        <p className="mt-2 text-sm text-slate-500">
          Please scan the venue's QR code or connect through its guest WiFi network again to get a
          fresh sign-in link.
        </p>
      </div>
    </div>
  );
}

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
  errorComponent: (props) =>
    props.error instanceof SearchParamError ? (
      <IncompletePortalLinkError />
    ) : (
      <RootErrorComponent {...props} />
    ),
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
