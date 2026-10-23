import { createFileRoute } from "@tanstack/react-router";
import { PartnerForgotPasswordPage } from "@/components/isp-partner/auth/PartnerForgotPasswordPage";

/** Partner console forgot password. Rendered bare (no console chrome, no
 * session) by the `/partner` layout, like `/partner/login`. */
export const Route = createFileRoute("/partner/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Forgot password | ISP Partner Console | Wyfy Guest" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PartnerForgotPasswordPage,
});
