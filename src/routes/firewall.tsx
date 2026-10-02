import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Security -> Firewall (see `components/security/FirewallView.tsx`). At a
 * venue whose only router is a controller the shell renders the controller
 * notice instead -- "firewall" is in `CONTROLLER_UNSUPPORTED_FEATURE_IDS`.
 */
export const Route = createFileRoute("/firewall")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="firewall" />,
});
