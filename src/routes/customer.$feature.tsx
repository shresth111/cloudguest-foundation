import { createFileRoute, redirect } from "@tanstack/react-router";
import { customerFeatureHref } from "@/lib/customerNav";

/** Compat redirect for the old `/customer/$feature` URL -- see
 * `customer.index.tsx`'s identical comment for the full rationale.
 * customerFeatureHref() is the single source of truth for where a given
 * feature id actually lives now. */
export const Route = createFileRoute("/customer/$feature")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: customerFeatureHref(params.feature) });
  },
});
