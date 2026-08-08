import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useCustomerStore } from "@/stores/customerStore";
import { customerService, type CustomerLocationSummary } from "@/services/customer.service";
import { customerKeys } from "@/hooks/useCustomerDashboard";

/**
 * `beforeLoad` guard for the short, location-id-free customer routes
 * (`/c`, `/c/users`, `/c/$feature`) -- mirrors `requireCustomerSession`'s
 * (`src/lib/authGuards.ts`) "throw redirect() from beforeLoad" shape, but
 * for location context instead of auth. `activeLocationId` lives in
 * `useCustomerStore`, a plain Zustand store (persisted to localStorage),
 * not router context, so it's read via the store's own static
 * `.getState()` rather than a hook -- `beforeLoad` runs outside a
 * component, before anything renders.
 *
 * A visitor with no active location (first login before the picker has
 * ever run, or a cleared/expired store) gets bounced to `/c/locations`,
 * the location picker, instead of rendering a page with no location to
 * scope its data to.
 */
export function requireActiveLocationId(): string {
  const { activeLocationId } = useCustomerStore.getState();
  if (!activeLocationId) {
    throw redirect({ to: "/c/locations" });
  }
  return activeLocationId;
}

/**
 * Resolves a location id to its full `CustomerLocationSummary` for the old
 * `/customer/...`/`/customer/$locationId/...` routes' backward-compat
 * redirect (an existing bookmark or shared link) -- `setActiveLocation`
 * needs the full summary object, not just the id (the picker at
 * `/c/locations` stores both, see `c.locations.tsx`'s own `handleSelect`),
 * so a direct-hit on a long URL has to fetch the same location list the
 * picker already fetches, rather than trusting only the id fragment out
 * of the URL.
 *
 * Goes through `queryClient.ensureQueryData` with the exact same query key
 * `useCustomerLocations()` uses (`customerKeys.locations`), so a redirect
 * immediately after visiting the picker hits react-query's cache instead of
 * an extra network round trip.
 */
export async function resolveCustomerLocationById(
  queryClient: QueryClient,
  locationId: string,
): Promise<CustomerLocationSummary | null> {
  const locations = await queryClient.ensureQueryData({
    queryKey: customerKeys.locations,
    queryFn: () => customerService.listLocations(),
  });
  return locations.find((l) => l.id === locationId) ?? null;
}
