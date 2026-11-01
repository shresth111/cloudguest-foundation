/**
 * Traffic Lens (B6 add-on) in the customer workspace: the customer
 * dashboard's own `TrafficLensView`, mounted unchanged.
 *
 * The shell opens this only when the add-on is on for the customer, and the
 * page sits inside `VenueScope`. Its calls (`/traffic-flow/locations/{id}/
 * status|summary|destinations|services/destinations|geo|findings`) are
 * rewritten by the shim to the `/isp/venue` twins, which re-apply
 * `RequireFeature(TRAFFIC_FLOW)` on the customer. Per-connection flow records
 * and the CSV export have no twin (founder F2) and fail closed; with no
 * `/me/entitlements` answer the view stays on venue-level records.
 */
import { lazy, Suspense } from "react";

import { LoadingBlock } from "@/components/isp-partner/kit";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";

const TrafficLensView = lazy(() =>
  import("@/components/traffic-lens/TrafficLensView").then((m) => ({
    default: m.TrafficLensView,
  })),
);

export function TrafficLensPage({ locationId, location }: PartnerSlotProps) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <TrafficLensView locationId={locationId as string} timeZone={location?.timezone ?? null} />
    </Suspense>
  );
}
