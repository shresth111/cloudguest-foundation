import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";

/**
 * Retired surface, kept only as a redirect.
 *
 * The login-screen background image is now uploaded from Portal ->
 * Design (`PortalPage.tsx`), next to the logo and the headline it has to
 * stay legible against, and with the Live Preview alongside it. There is
 * exactly one background image per organization, so a standalone page
 * editing the same bytes read as a second, separate setting -- it was
 * dropped from the sidebar and the feature catalog.
 *
 * This file stays behind because the route was linkable and is very
 * likely bookmarked: without it those links would fall through to
 * `GenericFeatureView`'s placeholder (the render registry no longer has a
 * "background-image" case), which looks like the feature was deleted
 * rather than moved. The session/location guards run first so an expired
 * bookmark still lands on sign-in, not on the portal editor.
 */
export const Route = createFileRoute("/background-image")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    throw redirect({ to: "/guest-portal" });
  },
});
