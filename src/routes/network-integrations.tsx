import { createFileRoute } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { requireActiveLocationId } from "@/lib/customerLocationGuard";
import { CustomerFeaturePage } from "@/components/customer/CustomerFeaturePage";

/** `/network-integrations` -- the bare feature id, which
 * `customerFeatureHref()` hands out for anything not in
 * `RESERVED_FEATURE_HREFS`. Nothing else in the route table owns this name.
 *
 * Thin by design, exactly like every sibling here (isp-details.tsx,
 * mac-auth.tsx, ...): the whole implementation lives in
 * `CustomerFeaturePage`'s shared shell so a new feature route cannot drift
 * away from the sidebar, header, palette and scope line every other customer
 * page renders. */
export const Route = createFileRoute("/network-integrations")({
  // See index.tsx's identical comment: activeLocationId only hydrates from
  // localStorage client-side, so this guard must not run during SSR.
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireCustomerSession(context.auth, location);
    requireActiveLocationId();
  },
  component: () => <CustomerFeaturePage feature="network-integrations" />,
});
