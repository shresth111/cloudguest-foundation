import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { resolveCustomerLocationById } from "@/lib/customerLocationGuard";
import { customerFeatureHref } from "@/lib/customerNav";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * Backward-compat redirect for the old `/customer/$locationId/$feature`
 * URL -- see `customer.$locationId.dashboard.tsx`'s identical doc comment
 * for the full rationale. Redirects to `customer.$feature.tsx`, the real
 * page, preserving whichever feature the old URL pointed at via
 * `customerFeatureHref`.
 */
export const Route = createFileRoute("/customer/$locationId/$feature")({
  // See customer.$locationId.dashboard.tsx's identical comment.
  ssr: false,
  beforeLoad: async ({ context, location, params }) => {
    requireCustomerSession(context.auth, location);
    const resolved = await resolveCustomerLocationById(context.queryClient, params.locationId);
    if (!resolved) {
      throw redirect({ to: "/c/locations" });
    }
    useCustomerStore.getState().setActiveLocation(resolved.id, resolved);
    throw redirect({ to: customerFeatureHref(params.feature) });
  },
});
