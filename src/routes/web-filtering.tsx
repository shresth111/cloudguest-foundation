import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Web Filtering (see `components/security/WebFilteringView.tsx`).
 * At a venue whose only router is a controller the shell renders the
 * controller notice instead -- "web-filtering" is in
 * `CONTROLLER_UNSUPPORTED_FEATURE_IDS`.
 */
export const Route = createFileRoute("/web-filtering")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="web-filtering" />,
});
