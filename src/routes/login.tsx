import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const { redirect } = Route.useSearch();
  return <LoginPage redirectTo={redirect} />;
}
