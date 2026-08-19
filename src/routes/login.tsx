import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  head: () => ({
    meta: [
      { title: "Sign in | Wyfy Guest" },
      {
        name: "description",
        content:
          "Sign in to Wyfy Guest to manage guest WiFi, networks, and analytics across every location from one dashboard.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign in | Wyfy Guest" },
      { property: "og:description", content: "Access your Wyfy Guest network dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const { redirect } = Route.useSearch();
  return <LoginPage redirectTo={redirect} />;
}
