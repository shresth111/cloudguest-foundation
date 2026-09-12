import { createFileRoute, redirect } from "@tanstack/react-router";
import { MasterLoginPage } from "@/components/auth/MasterLoginPage";
import { captivePortalRedirect } from "@/lib/captive-portal-redirect";

export const Route = createFileRoute("/master-login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  // Same guard as "/" and "/login" -- see
  // src/lib/captive-portal-redirect.ts. This one is the least likely to be
  // reached by a guest and the worst if it ever is: the form here signs in
  // to the PLATFORM console, not to one venue's dashboard.
  beforeLoad: ({ location }) => {
    const target = captivePortalRedirect(location.search as Record<string, unknown>);
    if (target) throw redirect(target);
  },
  component: MasterLoginRouteComponent,
});

// Still needed for direct links (bookmarks, explicit "/master-login"
// navigation) -- supplies redirectTo from this route's own ?redirect=
// search param, same wrapper role LoginRouteComponent plays for /login.
function MasterLoginRouteComponent() {
  const { redirect } = Route.useSearch();
  return <MasterLoginPage redirectTo={redirect} />;
}
