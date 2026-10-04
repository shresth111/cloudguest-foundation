import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Access Rules. `?tab=location|group|guests` picks the tab (see
 * `components/features/PoliciesHub.tsx` and `lib/access-rules-tabs.ts`);
 * anything else, or nothing, is dropped rather than rejected, so a mistyped
 * link still opens the page. `guests` is Guests & devices -- the block list
 * that used to be a tab of Security -> Block Websites; `/blocking?tab=guests`
 * redirects here.
 */
export const Route = createFileRoute("/policies")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["location", "group", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="policies" />,
});
