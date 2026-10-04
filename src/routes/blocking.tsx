import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Block Websites. `?tab=websites` is the only tab now (see
 * `components/security/BlockingView.tsx`); anything else, or nothing, is
 * dropped rather than rejected, so a mistyped link still opens the page.
 *
 * `?tab=guests` is still ACCEPTED, only to redirect it: Guests & devices
 * moved to Access Rules (owner instruction 2026-10-04, see
 * `lib/access-rules-tabs.ts`), and the old address was linked from the
 * Security Score and Firewall and is very likely bookmarked. Without the
 * redirect it would quietly open Block Websites, which reads as the feature
 * having been deleted. The session and venue guards run first -- the same
 * order as `website-blocking.tsx` -- so an expired bookmark still lands on
 * sign-in.
 */
export const Route = createFileRoute("/blocking")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["websites", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location, search }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    if (search.tab === "guests") {
      throw redirect({ to: "/policies", search: { tab: "guests" } });
    }
  },
  component: () => <CustomerFeaturePage feature="blocking" />,
});
