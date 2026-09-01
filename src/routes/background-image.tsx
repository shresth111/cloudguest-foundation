import { createFileRoute, redirect } from "@tanstack/react-router";
import { customerFeatureHref } from "@/lib/customerNav";

/**
 * Compat redirect for the old standalone "Background Image" page. The
 * login-screen background is now a section of the Portal page's own
 * configuration card (see PortalBackgroundImage.tsx / PortalPage.tsx), so
 * this URL -- which owners may well have bookmarked, and which
 * `/customer/$locationId/background-image` still resolves to via
 * customerFeatureHref -- lands on the page that actually hosts the setting
 * now instead of a feature id nothing renders.
 *
 * Kept as a redirect rather than deleted so neither of those paths 404s;
 * `customerFeatureHref("portal")` is the same single source of truth every
 * other nav/redirect call site goes through (it resolves to /guest-portal
 * -- see RESERVED_FEATURE_HREFS for why the bare name is taken). The auth
 * and active-location guards this route used to run are left to the
 * destination route, same as the other compat redirects (c.$feature.tsx,
 * customer.$feature.tsx).
 */
export const Route = createFileRoute("/background-image")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: customerFeatureHref("portal") });
  },
});
