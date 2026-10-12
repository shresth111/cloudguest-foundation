import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Network -> Traffic Lens (paid add-on) -- see
 * `components/traffic-lens/TrafficLensView.tsx`. Follows the selected venue.
 *
 * The route itself is not gated on the add-on: a locked organisation opens
 * this page and gets the lock screen, which is decided by the backend's own
 * 402 (and `/me/entitlements`), not by anything the browser holds. Same
 * shape as `/marketing`.
 */
export const Route = createFileRoute("/traffic-lens")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="traffic-lens" />,
});
