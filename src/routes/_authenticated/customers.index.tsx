import { createFileRoute, redirect } from "@tanstack/react-router";

// The "Customers" concept never existed on the real backend -- it was a
// mock invention duplicating Organizations. Retired in favor of
// /organizations; this redirect exists only so old bookmarks/links don't
// dead-end on a blank page.
export const Route = createFileRoute("/_authenticated/customers/")({
  beforeLoad: () => {
    throw redirect({ to: "/organizations" });
  },
});
