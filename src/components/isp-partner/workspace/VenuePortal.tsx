/**
 * The customer dashboard's OWN Portal page, inside the partner console.
 *
 * Founder (2026-10-23): the partner console's portal page must be the exact
 * customer page -- logo and background FILE uploads, colours, content picture,
 * texts, login methods and the phone-style live preview. So `PortalPage` is
 * mounted unchanged; nothing in `src/components/features/` is edited.
 *
 * `VenueScope` pins the customer + location for the request shim, which
 * rewrites every call the page makes (`/branding*`, `/captive-portal-configs*`,
 * `/captive-portal/review-stats`, `/organizations/{id}`, `/me/organizations`)
 * to its `/isp/venue/...` twin. `scripts/test-isp-partner-portal-shim.mjs`
 * fails if the page grows a call that is not twinned.
 *
 * Logo and background are organisation-level (the customer's), so they show on
 * every location's portal of that customer, exactly as on the customer host.
 * Uploading them needs the customer's plan to include white-label, as on the
 * customer host (the twin re-applies `RequireFeature(WHITE_LABEL)`).
 */
import { lazy, Suspense } from "react";

import { LoadingBlock } from "@/components/isp-partner/kit";
import { VenueScope } from "@/components/isp-partner/workspace/VenueScope";

const PortalPage = lazy(() =>
  import("@/components/features/PortalPage").then((m) => ({ default: m.PortalPage })),
);

export function VenuePortal({
  customerId,
  locationId,
  locationName,
}: {
  customerId: string;
  locationId: string;
  locationName?: string | null;
}) {
  return (
    <VenueScope
      key={`${customerId}:${locationId}`}
      customerId={customerId}
      locationId={locationId}
      locationName={locationName ?? null}
      organizationId={customerId}
    >
      <Suspense fallback={<LoadingBlock />}>
        <PortalPage locationId={locationId} />
      </Suspense>
    </VenueScope>
  );
}
