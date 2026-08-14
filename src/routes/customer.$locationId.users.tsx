import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { resolveCustomerLocationById } from "@/lib/customerLocationGuard";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * Backward-compat redirect for the old `/customer/$locationId/users` URL --
 * see `customer.$locationId.dashboard.tsx`'s identical doc comment for the
 * full rationale. Redirects to `customer.users.tsx`, the real page.
 */
export const Route = createFileRoute("/customer/$locationId/users")({
  // See customer.$locationId.dashboard.tsx's identical comment.
  ssr: false,
  beforeLoad: async ({ context, location, params }) => {
    requireCustomerSession(context.auth, location);
    const resolved = await resolveCustomerLocationById(context.queryClient, params.locationId);
    if (!resolved) {
      throw redirect({ to: "/switch-location" });
    }
    useCustomerStore.getState().setActiveLocation(resolved.id, resolved);
    throw redirect({ to: "/users" });
  },
});
