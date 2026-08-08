import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

// "portal" (bare) already belongs to portal.tsx, the actual guest-facing
// captive portal -- see customerNav.ts's RESERVED_FEATURE_HREFS comment
// for the full rationale on this URL, feature id "portal" unchanged.
export const Route = createFileRoute("/guest-portal")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="portal" />,
});
