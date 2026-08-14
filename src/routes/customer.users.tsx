import { createFileRoute, redirect } from "@tanstack/react-router";

/** Compat redirect for the old `/customer/users` URL -- see
 * `customer.index.tsx`'s identical comment for the full rationale. */
export const Route = createFileRoute("/customer/users")({
  beforeLoad: () => {
    throw redirect({ to: "/users" });
  },
});
