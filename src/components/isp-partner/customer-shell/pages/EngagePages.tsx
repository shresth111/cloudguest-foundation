/**
 * B3 (Engagement + location dashboard), PARITY-1.
 *
 * Login Page Offers, venue Vouchers and the venue report catalogue are the
 * customer dashboard's OWN pages, mounted unchanged inside the shell's
 * VenueScope (the shim rewrites their calls to `/isp/venue/...` twins;
 * `scripts/test-isp-partner-venue-pages.mjs` pins it). Dashboard, Vouchers and
 * Reports keep the shell's ISP-level view and add the venue one beside it.
 */
import { lazy, Suspense, useState } from "react";

import { MSeg } from "@/components/master/MasterKit";
import { LoadingBlock } from "@/components/isp-partner/kit";
import {
  Dashboard,
  ReportsPage as IspReports,
  Vouchers as IspCoupons,
} from "@/components/isp-partner/customer-shell/builtins";
import { LocationOverview } from "@/components/isp-partner/customer-shell/pages/LocationOverview";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import type { PartnerSlotProps } from "@/components/isp-partner/customer-shell/slots";

const CampaignsPage = lazy(() =>
  import("@/components/features/CampaignsPage").then((m) => ({ default: m.CampaignsPage })),
);
const VouchersPage = lazy(() =>
  import("@/components/features/VouchersPage").then((m) => ({ default: m.VouchersPage })),
);
const UserReports = lazy(() => import("@/components/features/UserReports"));

export function LoginPageOffersPage({ locationId }: PartnerSlotProps) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CampaignsPage locationId={locationId ?? undefined} />
    </Suspense>
  );
}

type VoucherView = "venue" | "coupons";

/** Two views of the same `vouchers` rows in the customer org (ADDENDUM_04):
 * front-desk passes for this venue, and the ISP's package-linked coupons. */
export function VenueVouchersPage(props: PartnerSlotProps) {
  const [view, setView] = useState<VoucherView>("venue");
  return (
    <div className="space-y-4">
      <MSeg<VoucherView>
        value={view}
        onChange={setView}
        options={[
          { value: "venue", label: "Front-desk vouchers" },
          { value: "coupons", label: "Package coupons" },
        ]}
      />
      {view === "venue" ? (
        <Suspense fallback={<LoadingBlock />}>
          <VouchersPage locationId={props.locationId ?? undefined} />
        </Suspense>
      ) : (
        <IspCoupons />
      )}
    </div>
  );
}

type ReportView = "customer" | "venue";

export function ReportsWithVenuePage(props: PartnerSlotProps) {
  const { can } = usePartner();
  // The venue catalogue reads guests, sessions, vouchers, campaigns and OTP
  // requests through isp_access.read twins. A role without it (isp-billing)
  // keeps the ISP's own reports only, instead of a page of 403s (QA P4).
  const venueAllowed = Boolean(props.locationId) && can("isp_access.read");
  const [view, setView] = useState<ReportView>(venueAllowed ? "venue" : "customer");
  return (
    <div className="space-y-4">
      {venueAllowed && (
        <MSeg<ReportView>
          value={view}
          onChange={setView}
          options={[
            { value: "venue", label: `${props.location?.name ?? "This location"} reports` },
            { value: "customer", label: "Across this customer" },
          ]}
        />
      )}
      {view === "venue" && venueAllowed ? (
        <Suspense fallback={<LoadingBlock />}>
          {/* F2: masked (the default) -- ISP staff never unmask in this phase. */}
          <UserReports masked />
        </Suspense>
      ) : (
        <IspReports {...props} />
      )}
    </div>
  );
}

export function DashboardWithLocationPage(props: PartnerSlotProps) {
  return (
    <div className="space-y-4">
      <Dashboard {...props} />
      {props.locationId && props.location && (
        <LocationOverview locationId={props.locationId} name={props.location.name} />
      )}
    </div>
  );
}
