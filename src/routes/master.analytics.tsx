import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasterShell } from "@/components/master/MasterShell";
import { MSectionHeader } from "@/components/master/MasterKit";
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
import { useAnalyticsSnapshot, useGenerateReport } from "@/hooks/useAnalytics";
import type { AppError } from "@/services/api";
import type { DateRangePreset } from "@/types/analytics";

/** Mirrors ReportCenter.tsx's/workspace.reports.tsx's own identical
 * helper -- there is no shared download util in this codebase yet. */
function downloadBlobUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * This used to be an `MStubPanel` -- a "coming soon" placeholder with no
 * data at all -- despite a fully real, already-built Analytics page
 * (KPIs + guest/network/router/location/organization/device/auth panels,
 * reports, scheduling) existing at /_authenticated/analytics, wired to the
 * real platform-wide GET /dashboard/super-admin/unified (see
 * analytics.service.ts's own module comment for exactly what is and isn't
 * real there). It was simply never reachable from the Master Console's own
 * "Global Analytics" nav item. Reuses that same real hook + those same
 * panel components here, inside MasterShell instead of the regular
 * workspace layout, rather than rebuilding it.
 */
export const Route = createFileRoute("/master/analytics")({ component: AnalyticsScreen });

function AnalyticsScreen() {
  const [range, setRange] = useState<DateRangePreset>("last30");
  const [tab, setTab] = useState("overview");
  const qc = useQueryClient();
  const snap = useAnalyticsSnapshot(range);
  const generateReport = useGenerateReport();
  const state = { isLoading: snap.isLoading, isError: snap.isError, onRetry: () => snap.refetch() };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["analytics"] });
    toast.success("Analytics refreshed");
  };
  // Used to be `() => toast.success("Dashboard export started")` -- a fake
  // success with zero API call, no file ever produced. The backend Report
  // Engine already composes exactly this (ReportType.DASHBOARD ->
  // DashboardService.get_super_admin_dashboard, see
  // analytics.service.ts's REPORT_TYPE_TO_BACKEND comment), so this now
  // calls the same real POST /reports the rest of the Reports tab uses,
  // via the exact same generate-then-download flow as ReportCenter.tsx.
  const exportDashboard = async () => {
    try {
      const res = await generateReport.mutateAsync({ type: "dashboard", format: "pdf", range });
      if (res.url.startsWith("#unavailable/")) {
        toast.error("Dashboard export isn't available yet");
        return;
      }
      downloadBlobUrl(res.url, res.filename);
      toast.success(`${res.filename} downloaded`);
    } catch (err) {
      toast.error((err as AppError).message || "Dashboard export failed");
    }
  };

  return (
    <MasterShell title="Global Analytics">
      <MSectionHeader
        eyebrow="Insights"
        title="Global Analytics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} />
            <Button size="sm" variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
            <Button size="sm" onClick={exportDashboard}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
          </div>
        }
      />

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
    </MasterShell>
  );
}
