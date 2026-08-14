import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

// "vouchers" (bare) already belongs to _authenticated/vouchers.index.tsx
// (the legacy operator shell) -- see customerNav.ts's RESERVED_FEATURE_HREFS
// comment for the full rationale on this URL, feature id "vouchers" unchanged.
export const Route = createFileRoute("/guest-vouchers")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="vouchers" />,
});
