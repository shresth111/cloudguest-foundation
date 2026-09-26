import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Marketing (paid add-on) -- wyfy-specs/guest-marketing-campaigns.md §8.1.
 *
 * `?tab=campaigns|templates|audience|deliveries|channels` picks the tab and
 * `?campaign=<uuid>` opens that campaign's detail sheet (see
 * `components/marketing/MarketingView.tsx`). Anything else, or nothing, is
 * dropped rather than rejected, so a mistyped link still opens the page --
 * same shape as `/blocking`.
 *
 * The route itself is not gated on the add-on: a locked organization opens
 * this page and gets the upsell (spec D5), which is decided by the backend's
 * own 402 on `/marketing/status`, not by anything the browser holds.
 */
export const Route = createFileRoute("/marketing")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["campaigns", "templates", "audience", "deliveries", "channels"]).optional().catch(undefined),
    campaign: z.string().uuid().optional().catch(undefined),
  }),
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="marketing" />,
});
