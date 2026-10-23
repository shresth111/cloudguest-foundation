import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CustomerWorkspace } from "@/components/isp-partner/customer-shell/CustomerWorkspace";

/**
 * `/partner/customers/$ispCustomerId/$feature?location=<id>` (ADDENDUM_04):
 * one customer, with the customer dashboard's own nav. `$feature` is a nav id
 * from `customer-shell/nav.ts`; an unknown one falls back to the dashboard.
 * `location` is the venue the location-level rows act on.
 *
 * Not nested under `partner.customers.$ispCustomerId` (the `_`), so the
 * existing customer page stays a leaf and is not edited.
 */
const UUID = /^[0-9a-fA-F-]{36}$/;

export const Route = createFileRoute("/partner/customers/$ispCustomerId_/$feature")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { location?: string } =>
    typeof search.location === "string" && UUID.test(search.location)
      ? { location: search.location }
      : {},
  component: CustomerWorkspaceRoute,
});

function CustomerWorkspaceRoute() {
  const { ispCustomerId, feature } = Route.useParams();
  const { location } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <CustomerWorkspace
      key={ispCustomerId}
      customerId={ispCustomerId}
      feature={feature}
      locationId={location ?? null}
      onNavigate={(next, nextLocation) =>
        navigate({
          to: "/partner/customers/$ispCustomerId/$feature",
          params: { ispCustomerId, feature: next },
          search: nextLocation ? { location: nextLocation } : {},
        })
      }
      onLocation={(nextLocation) =>
        navigate({
          to: "/partner/customers/$ispCustomerId/$feature",
          params: { ispCustomerId, feature },
          search: nextLocation ? { location: nextLocation } : {},
          replace: true,
        })
      }
    />
  );
}
