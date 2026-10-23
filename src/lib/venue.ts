/**
 * Which venue a screen is acting on (API_CONTRACT §10) — context and hook.
 *
 * The provider component lives in
 * `@/components/isp-partner/workspace/VenueScope`, because a file that exports
 * both components and hooks breaks React Fast Refresh.
 *
 * WHY THE INDIRECTION
 * -------------------
 * The customer app answers "which venue?" from `useCustomerStore` plus
 * `resolveActiveOrganizationId()`. Those are singletons: one active venue per
 * browser, chosen at `/switch-location`. Correct for a customer, whose whole
 * session is one organization.
 *
 * The partner console is not one organization: its workspace is scoped to a
 * (customer, location) pair that changes as the ISP moves between customers,
 * and several customer views read the store directly rather than taking a
 * `locationId` prop. Rewriting those to take a prop would edit files the
 * customer app depends on for no customer-visible benefit.
 *
 * So the default here IS today's behaviour: with no provider above it,
 * `useActiveVenue()` reads exactly what the view would have read itself. The
 * customer app is unchanged and the zero-impact rule holds.
 *
 * The hook calls the store hooks unconditionally (React's rules of hooks do
 * not allow skipping them) and prefers the context value when one exists.
 */
import { createContext, useContext } from "react";

import { resolveActiveOrganizationId } from "@/services/api";
import { useCustomerStore } from "@/stores/customerStore";

export interface ActiveVenue {
  locationId: string | null;
  locationName: string | null;
  organizationId: string | null;
}

export const VenueContext = createContext<ActiveVenue | null>(null);

/** The venue the current screen is acting on. */
export function useActiveVenue(): ActiveVenue {
  const activeLocationId = useCustomerStore((s) => s.activeLocationId);
  const activeLocation = useCustomerStore((s) => s.activeLocation);
  const fromContext = useContext(VenueContext);

  if (fromContext) return fromContext;
  return {
    locationId: activeLocationId,
    locationName: activeLocation?.name ?? null,
    organizationId: resolveActiveOrganizationId(),
  };
}
