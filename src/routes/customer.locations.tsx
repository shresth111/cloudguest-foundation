import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compat redirect for the old `/customer/locations` URL -- see
 * `customer.index.tsx`'s identical comment for the full rationale. */
export const Route = createFileRoute("/customer/locations")({
  beforeLoad: () => {
    throw redirect({ to: "/switch-location" });
  },
});
