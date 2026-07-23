import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingKpiGrid } from "@/components/billing/BillingKpiGrid";
import { SubscriptionTable } from "@/components/billing/SubscriptionTable";
import { CreateSubscriptionDialog } from "@/components/billing/CreateSubscriptionDialog";
import { PlanManagement } from "@/components/billing/PlanManagement";
import { PaymentTable } from "@/components/billing/PaymentTable";
import { InvoiceManagement } from "@/components/billing/InvoiceManagement";
import { TaxRateManagement } from "@/components/billing/TaxRateManagement";
import { CouponManagement } from "@/components/billing/CouponManagement";
import { UsageBillingPanel } from "@/components/billing/UsageBillingPanel";
import { PaymentGatewaysPanel } from "@/components/billing/PaymentGatewaysPanel";
import { RevenueAnalyticsPanel } from "@/components/billing/RevenueAnalyticsPanel";
import { RemindersPanel } from "@/components/billing/RemindersPanel";
import { BillingQuickActions } from "@/components/billing/BillingQuickActions";
import { BillingReportCenter } from "@/components/billing/BillingReportCenter";
import { ScheduledBillingReportsPanel } from "@/components/billing/ScheduledBillingReportsPanel";
import { useBillingSnapshot, useGenerateBillingReport } from "@/hooks/useBilling";

export const Route = createFileRoute("/_authenticated/billing/")({
  component: BillingPage,
});

function BillingPage() {
  const [tab, setTab] = useState("overview");
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const snap = useBillingSnapshot();
  const genReport = useGenerateBillingReport();
  const state = { isLoading: snap.isLoading, isError: snap.isError, onRetry: () => snap.refetch() };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["billing"] });
    toast.success("Billing refreshed");
  };
  // Real Report Engine call (see billingService.generateReport) -- renders
  // and downloads an actual platform-wide revenue PDF via POST /reports.
  const exportAll = () => {
    genReport.mutate(
      { type: "revenue", format: "pdf" },
      {
        onSuccess: (res) => {
          if ("url" in res && res.url) {
            const a = document.createElement("a");
            a.href = res.url;
            a.download = res.fileName;
            a.click();
          }
          toast.success(`${res.fileName} downloaded`);
        },
        onError: () => toast.error("Failed to export the billing report"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing & subscriptions</h1>
          <p className="text-sm text-muted-foreground">
            Revenue, subscriptions, invoicing, coupons and payment gateways.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={exportAll} disabled={genReport.isPending}>
            <Download className="mr-2 h-4 w-4" /> {genReport.isPending ? "Exporting…" : "Export"}
          </Button>
        </div>
      </div>

      <BillingKpiGrid data={snap.data?.kpis} {...state} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="tax-rates">GST / Tax rates</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
          <TabsTrigger value="analytics">Revenue analytics</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <RevenueAnalyticsPanel data={snap.data?.revenue} {...state} />
            <div className="space-y-4">
              <BillingQuickActions
                onCreateSubscription={() => setCreating(true)}
                onGenerateInvoice={() => setTab("invoices")}
                onScheduleReport={() => setTab("scheduled")}
                onExport={exportAll}
                onRefresh={refresh}
              />
              <RemindersPanel data={snap.data?.reminders} {...state} />
            </div>
          </div>
          <SubscriptionTable
            data={snap.data?.subscriptions}
            {...state}
            onRefresh={refresh}
            onCreate={() => setCreating(true)}
          />
        </TabsContent>

        <TabsContent value="subscriptions" className="mt-4">
          <SubscriptionTable
            data={snap.data?.subscriptions}
            {...state}
            onRefresh={refresh}
            onCreate={() => setCreating(true)}
          />
        </TabsContent>

        <TabsContent value="plans" className="mt-4">
          <PlanManagement plans={snap.data?.plans ?? []} />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentTable data={snap.data?.payments} {...state} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4">
          <InvoiceManagement data={snap.data?.invoices} {...state} />
        </TabsContent>

        <TabsContent value="tax-rates" className="mt-4">
          <TaxRateManagement />
        </TabsContent>

        <TabsContent value="coupons" className="mt-4">
          <CouponManagement data={snap.data?.coupons} {...state} />
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <UsageBillingPanel data={snap.data?.usage} {...state} />
        </TabsContent>

        <TabsContent value="gateways" className="mt-4">
          <PaymentGatewaysPanel data={snap.data?.gateways} {...state} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <RevenueAnalyticsPanel data={snap.data?.revenue} {...state} />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <RemindersPanel data={snap.data?.reminders} {...state} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <BillingReportCenter />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <ScheduledBillingReportsPanel />
        </TabsContent>
      </Tabs>

      <CreateSubscriptionDialog open={creating} onOpenChange={setCreating} plans={snap.data?.plans ?? []} />
    </div>
  );
}
