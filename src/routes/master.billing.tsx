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

export const Route = createFileRoute("/master/billing")({
  component: BillingScreen,
});

type BillingTab =
  | "overview"
  | "subscriptions"
  | "plans"
  | "payments"
  | "invoices"
  | "tax-rates"
  | "coupons"
  | "usage"
  | "analytics"
  | "reminders";

const BILLING_TABS: { value: BillingTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "plans", label: "Plans" },
  { value: "payments", label: "Payments" },
  { value: "invoices", label: "Invoices" },
  { value: "tax-rates", label: "GST / Tax rates" },
  { value: "coupons", label: "Coupons" },
  { value: "usage", label: "Usage" },
  { value: "analytics", label: "Revenue analytics" },
  { value: "reminders", label: "Reminders" },
];

function BillingScreen() {
  const [tab, setTab] = useState<BillingTab>("overview");
  const [creating, setCreating] = useState(false);
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

        <BillingKpiGrid data={snap.data?.kpis} {...state} />

        {/* Same MasterKit vocabulary (MSeg) every other master page's
            filter/tab control already uses, in place of shadcn's raw
            Tabs -- flattening these 10 tabs into something narrower is
            Phase 2 scope, this is just the component swap. */}
        <MSeg
          value={tab}
          onChange={setTab}
          options={BILLING_TABS}
          className="h-auto flex-wrap justify-start"
        />

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <RevenueAnalyticsPanel data={snap.data?.revenue} {...state} />
              <RemindersPanel data={snap.data?.reminders} {...state} />
            </div>
            <SubscriptionTable
              data={snap.data?.subscriptions}
              {...state}
              onRefresh={refresh}
              onCreate={() => setCreating(true)}
            />
          </div>
        )}

        {tab === "subscriptions" && (
          <SubscriptionTable
            data={snap.data?.subscriptions}
            {...state}
            onRefresh={refresh}
            onCreate={() => setCreating(true)}
          />
        )}

        {tab === "plans" && <PlanManagement plans={snap.data?.plans ?? []} />}

        {tab === "payments" && <PaymentTable data={snap.data?.payments} {...state} />}

        {tab === "invoices" && (
          <InvoiceManagement
            data={snap.data?.invoices}
            subscriptions={snap.data?.subscriptions}
            {...state}
          />
        )}

        {tab === "tax-rates" && <TaxRateManagement />}

        {tab === "coupons" && <CouponManagement data={snap.data?.coupons} {...state} />}

        {tab === "usage" && <UsageBillingPanel data={snap.data?.usage} {...state} />}

        {tab === "analytics" && <RevenueAnalyticsPanel data={snap.data?.revenue} {...state} />}

        {tab === "reminders" && <RemindersPanel data={snap.data?.reminders} {...state} />}

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
