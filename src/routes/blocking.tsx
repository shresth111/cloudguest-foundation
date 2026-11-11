import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Blocking. `?tab=websites` picks the tab (see
 * `components/security/BlockingView.tsx`); anything else, or nothing, is
 * dropped rather than rejected, so a mistyped link still opens the page.
 *
 * `?tab=guests` is still accepted, only to redirect: "Guests & devices" was
 * a tab here and moved to the Guests section (`/blocked-guests`, see
 * `lib/blocking.ts`). Old bookmarks, and links in emails and help articles,
 * land on the same screen at its new address. The session and venue guards
 * run first, as in `website-blocking.tsx`, so an expired bookmark still
 * lands on sign-in.
 */
export const Route = createFileRoute("/blocking")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["websites", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location, search }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
    if (search.tab === "guests") throw redirect({ to: "/blocked-guests" });
  },
  component: () => <CustomerFeaturePage feature="blocking" />,
});
