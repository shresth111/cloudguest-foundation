import { createFileRoute } from "@tanstack/react-router";
import { ReferralsPage } from "@/components/isp-partner/referrals/ReferralsPage";

/** `/partner/referrals` (REFERRAL-1). */
export const Route = createFileRoute("/partner/referrals")({
  ssr: false,
  component: ReferralsPage,
});
