/**
 * The one hook every customer screen uses to ask "may I offer this control
 * here, and if not, what do I tell them?".
 *
 * WHY A HOOK RATHER THAN A PROP DRILL
 * -----------------------------------
 * Four screens need the same answer -- Guests (Disconnect), Blocked Guests,
 * Guest WiFi Limits and Access Tiers -- and three of them are nested inside a
 * tab host (`PoliciesHub`) that has no business knowing about controllers.
 * Threading a venue capability through it would put vendor logic in a
 * component whose entire job is switching tabs.
 *
 * WHERE THE FACTS COME FROM
 * -------------------------
 * 1. Is this venue controller-managed, and what brand? Off the persisted
 *    active-venue summary, exactly as `CustomerFeaturePage` and
 *    `CustomerSidebar` already read it (`locationIsControllerManaged` /
 *    `locationControllerVendor`). No new request, and the same `every`-not-
 *    `some` gate, so a mixed venue and an unreadable venue both keep every
 *    control exactly as they have it today.
 * 2. What can we ask that controller to do? The backend, via
 *    `omada-client-controls.service.ts` -- which answers `null` without a
 *    request until the org-scoped routes land. See that file for why a
 *    speculative 404 on every page load would be worse than a null.
 *
 * A MIKROTIK VENUE NEVER FETCHES ANYTHING. `enabled` is false for it, so this
 * hook adds no request to any screen that does not have a controller, which is
 * every venue in production today bar one.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCustomerStore } from "@/stores/customerStore";
import { locationControllerVendor, locationIsControllerManaged } from "@/lib/location-liveness";
import {
  clientControlVerdict,
  type ClientControlId,
  type ClientControlVerdict,
  type ControllerVenueFacts,
} from "@/lib/omada-client-controls";
import {
  CUSTOMER_CLIENT_ROUTES_LANDED,
  omadaClientControlsService,
} from "@/services/omada-client-controls.service";

export interface ClientControls {
  /** True only when EVERY router at this venue is a vendor controller. */
  controllerManaged: boolean;
  /** Raw `routers.vendor`, or null. Only for copy that names a brand. */
  vendor: string | null;
  /** The verdict for one control. Stable identity per render. */
  verdict: (control: ClientControlId) => ClientControlVerdict;
}

export function useClientControls(): ClientControls {
  const liveness = useCustomerStore((s) => s.activeLocation)?.liveness;
  // The store's own id rather than one off the summary: `activeLocationId` is
  // what every other customer screen routes on, and the two are set together.
  const locationId = useCustomerStore((s) => s.activeLocationId);

  const controllerManaged = locationIsControllerManaged(liveness);
  const vendor = locationControllerVendor(liveness);

  const { data: writes } = useQuery({
    queryKey: ["controller-client-writes", locationId],
    queryFn: () => omadaClientControlsService.readClientWrites(locationId as string),
    enabled: CUSTOMER_CLIENT_ROUTES_LANDED && controllerManaged && !!locationId,
    // A venue's controller credentials do not change between two clicks on a
    // tab strip. One read for the whole dashboard, not one per screen.
    staleTime: 5 * 60_000,
  });

  const facts: ControllerVenueFacts = useMemo(
    // `?? null` and never `?? {}`: an undefined query result means we have not
    // asked, which the verdict ladder renders differently from a controller
    // that answered "no". Collapsing the two would blame the venue's hardware
    // for our own missing route.
    () => ({ controllerManaged, vendor, writes: writes ?? null }),
    [controllerManaged, vendor, writes],
  );

  return useMemo(
    () => ({
      controllerManaged,
      vendor,
      verdict: (control: ClientControlId) => clientControlVerdict(control, facts),
    }),
    [controllerManaged, vendor, facts],
  );
}
