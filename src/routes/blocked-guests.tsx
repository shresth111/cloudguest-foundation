import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/**
 * Guests -> Guests & devices: the guests, numbers, emails and devices this
 * venue has blocked. It was the "Guests & devices" tab of Security ->
 * Blocking until 2026-11-12; `/blocking?tab=guests` redirects here.
 */
export const Route = createFileRoute("/blocked-guests")({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="blocked-guests" />,
});
