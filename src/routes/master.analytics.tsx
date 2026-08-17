import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MasterShell } from "@/components/master/MasterShell";
import { MPageShell, MSectionHeader, MButton, MSeg } from "@/components/master/MasterKit";
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

type AnalyticsTab =
  | "overview"
  | "guests"
  | "network"
  | "routers"
  | "locations"
  | "organizations"
  | "devices"
  | "auth"
  | "reports"
  | "builder"
  | "scheduled"
  | "settings";

const ANALYTICS_TABS: { value: AnalyticsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "guests", label: "Guests" },
  { value: "network", label: "Network" },
  { value: "routers", label: "Routers" },
  { value: "locations", label: "Locations" },
  { value: "organizations", label: "Organizations" },
  { value: "devices", label: "Devices" },
  { value: "auth", label: "Authentication" },
  { value: "reports", label: "Reports" },
  { value: "builder", label: "Custom builder" },
  { value: "scheduled", label: "Scheduled" },
  { value: "settings", label: "Settings" },
];

function AnalyticsScreen() {
  const [range, setRange] = useState<DateRangePreset>("last30");
  const [tab, setTab] = useState<AnalyticsTab>("overview");
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
      <MPageShell>
        <MSectionHeader
          eyebrow="Insights"
          title="Global Analytics"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter value={range} onChange={setRange} />
              <MButton variant="outline" onClick={refresh}>
                <RefreshCw /> Refresh
              </MButton>
              <MButton variant="primary" onClick={exportDashboard}>
                <Download /> Export
              </MButton>
            </div>
          }
        />

        <AnalyticsKpiGrid
          data={snap.data?.kpis}
          isLoading={snap.isLoading}
          isError={snap.isError}
          onRetry={() => snap.refetch()}
        />

        {/* Same MasterKit vocabulary (MSeg) every other master page's
            filter/tab control already uses, in place of shadcn's raw
            Tabs -- flattening these 12 tabs into something narrower is
            Phase 2 scope, this is just the component swap. */}
        <MSeg
          value={tab}
          onChange={setTab}
          options={ANALYTICS_TABS}
          className="h-auto flex-wrap justify-start"
        />

        {tab === "overview" && (
          <div className="space-y-4">
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
          </div>
        )}

        {tab === "guests" && <GuestAnalyticsPanel data={snap.data?.guests} {...state} />}
        {tab === "network" && <NetworkAnalyticsPanel data={snap.data?.network} {...state} />}
        {tab === "routers" && <RouterAnalyticsPanel data={snap.data?.routers} {...state} />}
        {tab === "locations" && <LocationAnalyticsPanel data={snap.data?.locations} {...state} />}
        {tab === "organizations" && (
          <OrganizationAnalyticsPanel data={snap.data?.organizations} {...state} />
        )}
        {tab === "devices" && <DeviceAnalyticsPanel data={snap.data?.devices} {...state} />}
        {tab === "auth" && <AuthAnalyticsPanel data={snap.data?.auth} {...state} />}
        {tab === "reports" && <ReportCenter range={range} />}
        {tab === "builder" && <CustomReportBuilder />}
        {tab === "scheduled" && <ScheduledReportsPanel />}
        {tab === "settings" && <AnalyticsSettingsPanel />}
      </MPageShell>
    </MasterShell>
  );
}
