import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireCustomerSession } from "@/lib/authGuards";
import { resolveCustomerLocationById } from "@/lib/customerLocationGuard";
import { useCustomerStore } from "@/stores/customerStore";

/**
 * Backward-compat redirect for the old `/customer/$locationId/dashboard`
 * URL (bookmarks, shared links, anything already out in the wild before
 * location id moved out of the URL into `useCustomerStore` -- see
 * `customer.dashboard.tsx`, the real page this now redirects to).
 *
 * Resolves the id in the URL to a full `CustomerLocationSummary` (needed
 * by `setActiveLocation`, see `resolveCustomerLocationById`'s own doc
 * comment), writes it into the store the same way the location picker
 * does, then redirects to the short URL. A stale/invalid id that doesn't
 * resolve to a real location falls back to `/customer`, the picker,
 * rather than rendering a page with no real location behind it.
 */
export const Route = createFileRoute("/customer/$locationId/dashboard")({
  // setActiveLocation() below only has a real effect if it runs in the
  // visitor's actual browser -- useCustomerStore is a zustand `persist`
  // store backed by that browser's localStorage. Server-side, this would
  // mutate a throwaway server-only store instance with no relationship to
  // the browser at all, then redirect to /customer/dashboard, whose own
  // ssr:false guard would still see no active location and bounce right
  // back to /customer. Must stay client-only for the same reason
  // customer.dashboard.tsx's guard does.
  ssr: false,
  beforeLoad: async ({ context, location, params }) => {
    requireCustomerSession(context.auth, location);
    const resolved = await resolveCustomerLocationById(context.queryClient, params.locationId);
    if (!resolved) {
      throw redirect({ to: "/customer" });
    }
    useCustomerStore.getState().setActiveLocation(resolved.id, resolved);
    throw redirect({ to: "/customer/dashboard" });
  },
});
