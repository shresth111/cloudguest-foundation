import { createFileRoute } from "@tanstack/react-router";
import { PartnerResetPasswordPage } from "@/components/isp-partner/auth/PartnerResetPasswordPage";

/** Partner console reset link target (`?token=` from the partner reset email,
 * cloud-guest #449). Rendered bare by the `/partner` layout. */
export const Route = createFileRoute("/partner/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Reset password | ISP Partner Console | Wyfy Guest" },
      { name: "robots", content: "noindex, nofollow" },
      // The token is in the URL: never send it on as a Referer.
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PartnerResetPasswordRoute,
});

function PartnerResetPasswordRoute() {
  const { token } = Route.useSearch();
  return <PartnerResetPasswordPage token={token} />;
}
