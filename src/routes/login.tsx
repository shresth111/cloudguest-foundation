import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "@/components/auth/LoginPage";
import { captivePortalRedirect } from "@/lib/captive-portal-redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: s.redirect } : {},
  // Same guard as "/" -- see src/lib/captive-portal-redirect.ts. The bare
  // host is the landing an operator's mis-pasted controller URL actually
  // produces, but the guarantee is worth stating over the whole class
  // rather than over the one route it was observed on: no request carrying
  // a vendor captive-portal parameter resolves to a credential form,
  // whichever of the three sign-in routes it reaches.
  //
  // `?redirect=` is a single string value, so a legitimate
  // `/login?redirect=/portal?clientMac=...` carries no marker KEY of its
  // own and is untouched.
  beforeLoad: ({ location }) => {
    const target = captivePortalRedirect(location.search as Record<string, unknown>);
    if (target) throw redirect(target);
  },
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
