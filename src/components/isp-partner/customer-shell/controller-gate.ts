/**
 * The customer app's controller-venue gate, answered from the partner's own
 * router list.
 *
 * On the customer host `CustomerFeaturePage` does not MOUNT a RouterOS screen
 * when every router at the venue is controller-managed, and additionally
 * hides Guest Allow-list / Trusted Devices when every router is NAS-only
 * (Aruba Instant On) -- `featureAppliesToControllerVenue`. It reads that from
 * the customer store's location liveness, which the partner console does not
 * have, so this derives the same "every router" answer from
 * `GET /isp/routers?isp_location_id=...` (vendor per router): a venue with no
 * routers, or any MikroTik, is NOT controller-managed -- the same `every`, not
 * `some`, posture.
 */
import { useIspRouters } from "@/hooks/isp-partner/useIsp";
import { featureAppliesToControllerVenue, isControllerManaged } from "@/lib/router-vendors";

export interface ControllerGate {
  loading: boolean;
  gated: boolean;
  vendor: string | null;
}

export function controllerGateFor(
  featureId: string,
  vendors: readonly string[],
): { gated: boolean; vendor: string | null } {
  const managed = vendors.length > 0 && vendors.every((v) => isControllerManaged(v));
  const vendor = managed ? (vendors.find(Boolean) ?? null) : null;
  return { gated: managed && !featureAppliesToControllerVenue(featureId, vendor), vendor };
}

export function useControllerGate(featureId: string, locationId: string | null): ControllerGate {
  const q = useIspRouters(
    { isp_location_id: locationId ?? "", page_size: 100 },
    Boolean(locationId),
  );
  const vendors = (q.data?.items ?? []).map((r) => r.vendor);
  return { loading: q.isLoading, ...controllerGateFor(featureId, vendors) };
}
