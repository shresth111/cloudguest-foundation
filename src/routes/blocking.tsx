import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Blocking. `?tab=websites|guests` picks the tab (see
 * `components/security/BlockingView.tsx`); anything else, or nothing, is
 * dropped rather than rejected, so a mistyped link still opens the page.
 */
export const Route = createFileRoute("/blocking")({
  ssr: false,
  validateSearch: z.object({
    tab: z.enum(["websites", "guests"]).optional().catch(undefined),
  }),
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="blocking" />,
});
