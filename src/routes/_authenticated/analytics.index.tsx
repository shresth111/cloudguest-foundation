import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsKpiGrid } from "@/components/analytics/AnalyticsKpiGrid";
import { GuestAnalyticsPanel } from "@/components/analytics/GuestAnalyticsPanel";
import { NetworkAnalyticsPanel } from "@/components/analytics/NetworkAnalyticsPanel";
import { RouterAnalyticsPanel } from "@/components/analytics/RouterAnalyticsPanel";
import { LocationAnalyticsPanel } from "@/components/analytics/LocationAnalyticsPanel";
import { OrganizationAnalyticsPanel } from "@/components/analytics/OrganizationAnalyticsPanel";
import { DeviceAnalyticsPanel } from "@/components/analytics/DeviceAnalyticsPanel";
import { AuthAnalyticsPanel } from "@/components/analytics/AuthAnalyticsPanel";
import { ReportCenter } from "@/components/analytics/ReportCenter";
import { CustomReportBuilder } from "@/components/analytics/CustomReportBuilder";
import { ScheduledReportsPanel } from "@/components/analytics/ScheduledReportsPanel";
import { AnalyticsSettingsPanel } from "@/components/analytics/AnalyticsSettingsPanel";
import { AnalyticsQuickActions } from "@/components/analytics/AnalyticsQuickActions";
import { DateRangeFilter } from "@/components/analytics/DateRangeFilter";
import { useAnalyticsSnapshot } from "@/hooks/useAnalytics";
import type { DateRangePreset } from "@/types/analytics";

export const Route = createFileRoute("/_authenticated/analytics/")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [range, setRange] = useState<DateRangePreset>("last30");
  const [tab, setTab] = useState("overview");
  const qc = useQueryClient();
  const snap = useAnalyticsSnapshot(range);
  const state = { isLoading: snap.isLoading, isError: snap.isError, onRetry: () => snap.refetch() };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["analytics"] });
    toast.success("Analytics refreshed");
  };
  const exportDashboard = () => toast.success("Dashboard export started");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics & reports</h1>
          <p className="text-sm text-muted-foreground">
            Insights across guests, network, routers, revenue and authentication.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} />
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={exportDashboard}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <AnalyticsKpiGrid data={snap.data?.kpis} isLoading={snap.isLoading} isError={snap.isError} onRetry={() => snap.refetch()} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="routers">Routers</TabsTrigger>
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="builder">Custom builder</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <GuestAnalyticsPanel data={snap.data?.guests} {...state} />
            <AnalyticsQuickActions
              onRefresh={refresh}
              onExportDashboard={exportDashboard}
              onGenerateReport={() => setTab("reports")}
              onScheduleReport={() => setTab("scheduled")}
            />
          </div>
          <NetworkAnalyticsPanel data={snap.data?.network} {...state} />
        </TabsContent>

        <TabsContent value="guests" className="mt-4">
          <GuestAnalyticsPanel data={snap.data?.guests} {...state} />
        </TabsContent>
        <TabsContent value="network" className="mt-4">
          <NetworkAnalyticsPanel data={snap.data?.network} {...state} />
        </TabsContent>
        <TabsContent value="routers" className="mt-4">
          <RouterAnalyticsPanel data={snap.data?.routers} {...state} />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationAnalyticsPanel data={snap.data?.locations} {...state} />
        </TabsContent>
        <TabsContent value="organizations" className="mt-4">
          <OrganizationAnalyticsPanel data={snap.data?.organizations} {...state} />
        </TabsContent>
        <TabsContent value="devices" className="mt-4">
          <DeviceAnalyticsPanel data={snap.data?.devices} {...state} />
        </TabsContent>
        <TabsContent value="auth" className="mt-4">
          <AuthAnalyticsPanel data={snap.data?.auth} {...state} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportCenter range={range} />
        </TabsContent>
        <TabsContent value="builder" className="mt-4">
          <CustomReportBuilder />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          <ScheduledReportsPanel />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <AnalyticsSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
