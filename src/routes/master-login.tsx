import { createFileRoute } from "@tanstack/react-router";
import { MasterLoginPage } from "@/components/auth/MasterLoginPage";

export const Route = createFileRoute("/master-login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: MasterLoginRouteComponent,
});

// Still needed for direct links (bookmarks, explicit "/master-login"
// navigation) -- supplies redirectTo from this route's own ?redirect=
// search param, same wrapper role LoginRouteComponent plays for /login.
function MasterLoginRouteComponent() {
  const { redirect } = Route.useSearch();
  return <MasterLoginPage redirectTo={redirect} />;
}
