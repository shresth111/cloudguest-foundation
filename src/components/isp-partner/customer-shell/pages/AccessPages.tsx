/**
 * B2 (Access & Policy) + Internet Connection: the customer dashboard's OWN
 * pages, mounted unchanged in the partner customer workspace.
 *
 * The shell has already picked a location of this customer and wrapped the
 * page in `VenueScope`, so the request shim rewrites every call to its
 * `/isp/venue/...` twin. `scripts/test-isp-partner-venue-pages.mjs` fails if
 * one of these pages can reach a call that is not twinned.
 */
import { lazy, Suspense, type ComponentType } from "react";

import { LoadingBlock } from "@/components/isp-partner/kit";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";

type LocationPage = ComponentType<{ locationId?: string }>;

const PoliciesHub = lazy(() => import("@/components/features/PoliciesHub"));
const WhiteList = lazy(() => import("@/components/features/WhiteList"));
const ManageTeamsPage = lazy(() => import("@/components/features/ManageTeamsPage"));
const ops = () => import("@/components/features/OperationsFeatures");
const OpenHoursView = lazy(() => ops().then((m) => ({ default: m.OpenHoursView as LocationPage })));
const MacAuthView = lazy(() => ops().then((m) => ({ default: m.MacAuthView as LocationPage })));
const IspDetailsView = lazy(() =>
  ops().then((m) => ({ default: m.IspDetailsView as LocationPage })),
);

function Mount({ Page, locationId }: { Page: LocationPage; locationId: string | null }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Page locationId={locationId ?? undefined} />
    </Suspense>
  );
}

export function AccessRulesPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={PoliciesHub} locationId={locationId} />;
}

export function GuestAllowListPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={WhiteList} locationId={locationId} />;
}

export function TrustedDevicesPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={MacAuthView} locationId={locationId} />;
}

export function OpenHoursPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={OpenHoursView} locationId={locationId} />;
}

export function GuestGroupsPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={ManageTeamsPage} locationId={locationId} />;
}

export function InternetConnectionPage({ locationId }: PartnerSlotProps) {
  return <Mount Page={IspDetailsView} locationId={locationId} />;
}
