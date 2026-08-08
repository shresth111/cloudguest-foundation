import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

// "campaigns" (bare) already belongs to _authenticated/campaigns.index.tsx
// (the legacy operator shell) -- see customerNav.ts's RESERVED_FEATURE_HREFS
// comment for the full rationale on this URL, feature id "campaigns" unchanged.
export const Route = createFileRoute("/guest-campaigns")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="campaigns" />,
});
