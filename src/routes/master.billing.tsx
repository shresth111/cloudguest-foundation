import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { MasterShell } from "@/components/master/MasterShell";
import { MPageShell, MSectionHeader, MButton, MSeg } from "@/components/master/MasterKit";
import { BillingKpiGrid } from "@/components/billing/BillingKpiGrid";
import { SubscriptionTable } from "@/components/billing/SubscriptionTable";
import { CreateSubscriptionDialog } from "@/components/billing/CreateSubscriptionDialog";
import { PlanManagement } from "@/components/billing/PlanManagement";
import { PaymentTable } from "@/components/billing/PaymentTable";
import { InvoiceManagement } from "@/components/billing/InvoiceManagement";
import { TaxRateManagement } from "@/components/billing/TaxRateManagement";
import { CouponManagement } from "@/components/billing/CouponManagement";
import { UsageBillingPanel } from "@/components/billing/UsageBillingPanel";
import { RevenueAnalyticsPanel } from "@/components/billing/RevenueAnalyticsPanel";
import { RemindersPanel } from "@/components/billing/RemindersPanel";
import { useBillingSnapshot } from "@/hooks/useBilling";

/**
 * Same "Phase 2" treatment as master.analytics.tsx's own prior revision
 * (867d9c7): the earlier Phase 1 component swap here (a30ba70) left the
 * 10-tab flat wall untouched, with its own comment flagging that
 * "flattening these 10 tabs into something narrower is Phase 2 scope."
 * This is that pass, backed by a full read of every tab's component
 * (src/components/billing/*) and every call it makes into
 * billing.service.ts / backend/app/domains/billing.
 *
 * Unlike Global Analytics, this audit found the OPPOSITE result: billing
 * is overwhelmingly real. Every one of the 10 destinations is backed by a
 * real, DB-persisted model with a real fetch, and every mutating control
 * (Cancel/Upgrade/Downgrade/Auto-renew, New/Edit/Delete plan, New/Edit/
 * Delete coupon, Refund payment, New/Edit tax rate, Generate & send
 * invoice, Download invoice PDF, Create subscription incl. its coupon
 * "Apply" validation) submits to a real endpoint and is reflected on the
 * next refetch -- confirmed reading billing.service.ts's own request
 * bodies against backend/app/domains/billing/{router,service,schemas}.py.
 * Nothing here is the Settings-tab class of bug (inert Save button) found
 * on Analytics. Two narrow, pre-existing gaps are flagged, not cut, since
 * the tabs carrying them are otherwise real and useful:
 *   - RevenueAnalyticsPanel's "Payment success rate" chart is always empty
 *     on real data -- `paymentSuccessRate: []` in getSnapshot() -- no
 *     backend field feeds it (see billing.service.ts's own comment above
 *     the aggregate `return`). The other 5 charts on that panel are real.
 *   - RemindersPanel's "Send" button calls billingService.sendReminder(),
 *     which is intentionally mocked -- no reminder-dispatch endpoint
 *     exists in backend/app/domains/billing (already documented on that
 *     hook). The reminders themselves (expiring plans, failed payments,
 *     outstanding invoices) are real, computed from the real
 *     /billing/dashboard/super-admin composite.
 *
 * The one real cut: the old "Overview" tab. It rendered
 * RevenueAnalyticsPanel + RemindersPanel + SubscriptionTable with the
 * exact same data/props those three already carry on their own
 * destinations below -- no exclusive content of its own, purely a remix.
 * Cut as redundant, not fake, same evidence standard Analytics used for
 * its own "richer page already exists elsewhere" cuts.
 *
 * The remaining 9 real tabs are grouped by workflow instead of left as a
 * flat wall, same MSeg-group + secondary-MSeg-per-group vocabulary
 * Analytics established (Organizations / Reporting -> On-demand/
 * Scheduled):
 *   - Subscriptions: Subscriptions, Plans, Usage -- the org's subscription
 *     lifecycle plus what it's actually consuming against its plan's
 *     limits.
 *   - Payments & Revenue: Revenue analytics, Payments, Invoices,
 *     Reminders -- money in, money owed, and the documents for both.
 *   - Tax & Coupons: GST/Tax rates, Coupons -- the platform-wide rate and
 *     discount catalogs invoices are computed against.
 * The KPI grid stays a permanent header above the group switcher
 * (unchanged from the Phase 1 revision of this file) -- all 9 of its
 * tiles are real (billing.service.ts's getSnapshot()) and were never
 * exclusive to any one tab.
 *
 * Not touched: BillingQuickActions, BillingReportCenter,
 * ScheduledBillingReportsPanel, PaymentGatewaysPanel are real components
 * but were never imported into this route -- they back the separate,
 * ORGANIZATION-scoped billing.index.tsx (a different audience, see
 * billing.service.ts's own module comment on getMyBillingDashboard), out
 * of scope here. SubscriptionOverview.tsx / LicenseManagement.tsx /
 * UsageCharts.tsx under components/billing/ are unused by ANY route
 * (verified with a repo-wide grep) -- pre-existing dead code, noticed
 * during this audit but left alone since removing orphaned files nothing
 * here imports is a separate cleanup, not a presentation change to this
 * page.
 */
export const Route = createFileRoute("/master/billing")({ component: BillingScreen });

type BillingGroup = "subscriptions" | "revenue" | "pricing";
type SubscriptionsTab = "subscriptions" | "plans" | "usage";
type RevenueTab = "analytics" | "payments" | "invoices" | "reminders";
type PricingTab = "tax-rates" | "coupons";

const BILLING_GROUPS: { value: BillingGroup; label: string }[] = [
  { value: "subscriptions", label: "Subscriptions" },
  { value: "revenue", label: "Payments & Revenue" },
  { value: "pricing", label: "Tax & Coupons" },
];

const SUBSCRIPTIONS_TABS: { value: SubscriptionsTab; label: string }[] = [
  { value: "subscriptions", label: "Subscriptions" },
  { value: "plans", label: "Plans" },
  { value: "usage", label: "Usage" },
];

const REVENUE_TABS: { value: RevenueTab; label: string }[] = [
  { value: "analytics", label: "Revenue analytics" },
  { value: "payments", label: "Payments" },
  { value: "invoices", label: "Invoices" },
  { value: "reminders", label: "Reminders" },
];

const PRICING_TABS: { value: PricingTab; label: string }[] = [
  { value: "tax-rates", label: "GST / Tax rates" },
  { value: "coupons", label: "Coupons" },
];

function BillingScreen() {
  const [creating, setCreating] = useState(false);
  const [group, setGroup] = useState<BillingGroup>("subscriptions");
  const [subscriptionsTab, setSubscriptionsTab] = useState<SubscriptionsTab>("subscriptions");
  const [revenueTab, setRevenueTab] = useState<RevenueTab>("analytics");
  const [pricingTab, setPricingTab] = useState<PricingTab>("tax-rates");
  const qc = useQueryClient();
  const snap = useBillingSnapshot();
  const state = { isLoading: snap.isLoading, isError: snap.isError, onRetry: () => snap.refetch() };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["billing"] });
    toast.success("Billing refreshed");
  };

  return (
    <MasterShell title="Subscriptions & Billing">
      <MPageShell>
        <MSectionHeader
          eyebrow="Revenue"
          title="Subscriptions & Billing"
          actions={
            <MButton variant="outline" onClick={refresh}>
              <RefreshCw /> Refresh
            </MButton>
          }
        />

        {/* Permanent header, not a tab -- unchanged from the Phase 1
            revision of this file. All 9 tiles are real (getSnapshot()'s
            kpis) and were never exclusive to the now-removed Overview
            tab; see this file's module comment for the full audit. */}
        <BillingKpiGrid data={snap.data?.kpis} {...state} />

        {/* Same MasterKit vocabulary (MSeg for the group, a secondary
            MSeg per group) master.analytics.tsx established -- 3 groups
            here (not 2) because the audit found 9 of the old 10 tabs
            genuinely real and load-bearing, not the mostly-fake result
            Analytics had. See this file's module comment for the
            tab-by-tab evidence. */}
        <MSeg value={group} onChange={setGroup} options={BILLING_GROUPS} />

        {group === "subscriptions" && (
          <div className="space-y-4">
            <MSeg
              value={subscriptionsTab}
              onChange={setSubscriptionsTab}
              options={SUBSCRIPTIONS_TABS}
            />
            {subscriptionsTab === "subscriptions" && (
              <SubscriptionTable
                data={snap.data?.subscriptions}
                {...state}
                onRefresh={refresh}
                onCreate={() => setCreating(true)}
              />
            )}
            {subscriptionsTab === "plans" && <PlanManagement plans={snap.data?.plans ?? []} />}
            {subscriptionsTab === "usage" && (
              <UsageBillingPanel data={snap.data?.usage} {...state} />
            )}
          </div>
        )}

        {group === "revenue" && (
          <div className="space-y-4">
            <MSeg value={revenueTab} onChange={setRevenueTab} options={REVENUE_TABS} />
            {revenueTab === "analytics" && (
              <RevenueAnalyticsPanel data={snap.data?.revenue} {...state} />
            )}
            {revenueTab === "payments" && <PaymentTable data={snap.data?.payments} {...state} />}
            {revenueTab === "invoices" && (
              <InvoiceManagement
                data={snap.data?.invoices}
                subscriptions={snap.data?.subscriptions}
                {...state}
              />
            )}
            {revenueTab === "reminders" && (
              <RemindersPanel data={snap.data?.reminders} {...state} />
            )}
          </div>
        )}

        {group === "pricing" && (
          <div className="space-y-4">
            <MSeg value={pricingTab} onChange={setPricingTab} options={PRICING_TABS} />
            {pricingTab === "tax-rates" && <TaxRateManagement />}
            {pricingTab === "coupons" && <CouponManagement data={snap.data?.coupons} {...state} />}
          </div>
        )}

        <CreateSubscriptionDialog
          open={creating}
          onOpenChange={setCreating}
          plans={snap.data?.plans ?? []}
          coupons={snap.data?.coupons ?? []}
        />
      </MPageShell>
    </MasterShell>
  );
}
