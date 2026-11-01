import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { isIspPartnerFeEnabled, isNetworkHost } from "@/lib/isp-partner/network-host";
import { PartnerLayout } from "@/components/isp-partner/PartnerLayout";
import { isPartnerPublicPath } from "@/lib/isp-partner/password-reset";
import { clearPartnerSessionEnded, partnerSessionEnded } from "@/lib/isp-partner/session-ended";
import { openSignOutGate } from "@/lib/isp-partner/sign-out";

/**
 * ISP partner console layout (network.wyfyguest.com, path prefix `/partner`;
 * PRD §3, TASKS FE-1).
 *
 * With `VITE_ISP_PARTNER_ENABLED` unset this whole tree is the existing
 * not-found page. With it set, the partner console renders only on a network
 * host: asked for on the customer app's or the Master console's address it is
 * the wrong surface, and the visitor is sent to the partner host with the
 * same path -- the same rule `master.tsx` applies the other way round.
 *
 * Client-only (auth lives in localStorage). Signed-out visitors go to
 * `/partner/login`; whether a signed-in account is an ISP account is decided
 * by `GET /isp/me` inside `PartnerLayout`.
 */
const PARTNER_HOST_FOR: Record<string, string> = {
  "app.wyfyguest.com": "network.wyfyguest.com",
  "master.wyfyguest.com": "network.wyfyguest.com",
  "staging.wyfyguest.com": "network-staging.wyfyguest.com",
};

export const Route = createFileRoute("/partner")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    if (!isIspPartnerFeEnabled()) throw notFound();
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    if (!isNetworkHost(hostname)) {
      const partnerHost = PARTNER_HOST_FOR[hostname];
      if (partnerHost) {
        window.location.href = `https://${partnerHost}${location.href}`;
        throw redirect({ to: "/" });
      }
      throw notFound();
    }
    // Sign in, forgot password and reset password render without a session.
    const isLogin = isPartnerPublicPath(location.pathname);
    if (isLogin) {
      clearPartnerSessionEnded();
      openSignOutGate();
    }
    // Not while the layout is showing why it just signed this account out.
    if (!isLogin && context.auth?.status === "anonymous" && !partnerSessionEnded()) {
      throw redirect({ to: "/partner/login", replace: true });
    }
  },
  component: PartnerLayout,
});
