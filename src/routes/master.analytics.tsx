import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MasterShell } from "@/components/master/MasterShell";
import { MPageShell, MSectionHeader, MButton, MSeg } from "@/components/master/MasterKit";
import { AnalyticsKpiGrid } from "@/components/analytics/AnalyticsKpiGrid";
import { OrganizationAnalyticsPanel } from "@/components/analytics/OrganizationAnalyticsPanel";
import { ReportCenter } from "@/components/analytics/ReportCenter";
import { ScheduledReportsPanel } from "@/components/analytics/ScheduledReportsPanel";
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
 * Phase 2 of the earlier Phase 1 component swap (see this file's prior
 * revision): the 12 flat tabs that swap left the same "flat wall of tabs"
 * anti-pattern flagged and fixed on Access Rules (212ece0) untouched. A
 * full data audit against the real backend (backend/app/domains/analytics,
 * see analytics.service.ts's own module comment) found that half of those
 * 12 destinations render zero real data, ever, on this specific
 * platform-wide page -- not "sparse", structurally incapable of showing
 * anything but hardcoded empty state, because `analyticsService.getSnapshot()`
 * (the one query this whole page reads from) returns hardcoded
 * `emptyGuestAnalytics()`/`emptyNetworkAnalytics()`/`emptyDeviceAnalytics()`/
 * `emptyAuthAnalytics()` and `locations: []` unconditionally -- there is no
 * platform-wide backend endpoint for guest/network/device/auth trends or a
 * locations rollup, only organization- or location-scoped ones
 * (`/analytics/{guests,network,authentication}`, `/dashboard/location`),
 * and this page selects neither. Two more tabs were real but fully
 * redundant with richer pages that already exist elsewhere in the Master
 * Console, and two more (Custom builder, Settings) were fake/broken UI with
 * no backend behind them at all. Cut, with evidence, in this pass:
 *
 * - Guests / Network / Devices / Authentication: always-empty charts (see
 *   above) -- kept as tabs, every single chart on every single one of them
 *   would forever render "No data". Wiring these for real needs an
 *   org/location selector added to this page, which is a frontend scope
 *   change (not a backend gap) left for a future pass -- see
 *   analytics.service.ts's own comment.
 * - Locations: same always-empty issue (`locations: []`, no platform-wide
 *   backend equivalent), and even if it weren't empty it would duplicate
 *   the Master Console's own real Locations directory
 *   (master.locations.tsx).
 * - Routers: of its 8 stat tiles only "Online"/"Offline" are real (routers_
 *   online/offline from the same `/dashboard/super-admin/unified` call the
 *   KPI grid below already surfaces as "Total routers"/"Active routers");
 *   CPU/memory/temperature/WAN/WireGuard/RADIUS are hardcoded 0 (no
 *   platform-wide aggregate exists) and all 4 of its charts are always
 *   empty for the same reason. The real, live, per-router version of this
 *   data already exists on Router Fleet (master.routers.tsx). Redundant on
 *   both counts.
 * - Custom builder: its Organization/Location/Router dropdowns are
 *   hardcoded fake string lists ("Aurora Hospitality", "GW-EDGE-01", etc,
 *   not from any real API) whose selected value is never actually sent to
 *   the backend -- the real export call underneath ignores them entirely
 *   and always resolves whichever org/location the account happens to
 *   default to. Its own Preview panel says outright "Preview generated
 *   from mock data." The one real thing it does (call the same
 *   `generateReport()` the Reports tab's per-type buttons already call) is
 *   fully covered there, honestly, without the fake scoping controls.
 * - Settings: `AnalyticsSettings` has no backing table anywhere in the
 *   analytics domain -- it's a plain in-memory module variable
 *   (analytics.service.ts's `let settings = {...}`) that resets on every
 *   page reload, and its own "Save preferences" button doesn't even submit
 *   the edited form (every field already writes on change; the button
 *   re-sends the unchanged `defaultDateRange`). Nothing here is real
 *   enough to relocate into Platform Settings either.
 *
 * Kept as real destinations: the KPI grid + Quick actions (now a
 * permanent header, not a tab -- they were never exclusive to "Overview",
 * the KPI grid rendered above the tab strip even in the old 12-tab layout),
 * Organizations (real per-org fan-out against `/dashboard/organization`;
 * revenue/growth columns are still hardcoded 0 -- no org-level billing
 * aggregate exists yet -- flagged as a known gap, not cut, since active
 * users/routers/locations per org are real and genuinely useful), Reports
 * (6 of 9 report types are real; the other 3 fail honestly with a toast,
 * never a fake success) and Scheduled (fully real CRUD against
 * `/reports/templates` + `/reports/schedule`).
 *
 * None of the shared panel components under components/analytics/ were
 * touched -- they're also used by the tenant-facing
 * /_authenticated/analytics route (analytics.index.tsx), which is out of
 * scope here and keeps all 12 destinations exactly as before.
 */
export const Route = createFileRoute("/master/analytics")({ component: AnalyticsScreen });

type AnalyticsGroup = "organizations" | "reporting";
type ReportingTab = "ondemand" | "scheduled";

const ANALYTICS_GROUPS: { value: AnalyticsGroup; label: string }[] = [
  { value: "organizations", label: "Organizations" },
  { value: "reporting", label: "Reporting" },
];

const REPORTING_TABS: { value: ReportingTab; label: string }[] = [
  { value: "ondemand", label: "On-demand reports" },
  { value: "scheduled", label: "Scheduled reports" },
];

function AnalyticsScreen() {
  const [range, setRange] = useState<DateRangePreset>("last30");
  const [group, setGroup] = useState<AnalyticsGroup>("organizations");
  const [reportingTab, setReportingTab] = useState<ReportingTab>("ondemand");
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
  // calls the same real POST /reports the Reports tab uses, via the exact
  // same generate-then-download flow as ReportCenter.tsx.
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

  const goToReports = () => {
    setGroup("reporting");
    setReportingTab("ondemand");
  };
  const goToSchedule = () => {
    setGroup("reporting");
    setReportingTab("scheduled");
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

        {/* Permanent header, not a tab -- these never had exclusive
            content of their own even in the old "Overview" tab, the KPI
            grid already rendered above the tab strip regardless of which
            tab was selected. */}
        <div className="grid gap-4 xl:grid-cols-[3fr_1fr]">
          <AnalyticsKpiGrid data={snap.data?.kpis} {...state} />
          <AnalyticsQuickActions
            onRefresh={refresh}
            onExportDashboard={exportDashboard}
            onGenerateReport={goToReports}
            onScheduleReport={goToSchedule}
          />
        </div>

        {/* Same MasterKit vocabulary (MSeg) every other master page's
            filter/tab control already uses. Only 2 groups: everything else
            the old 12-tab layout offered was either always-empty on this
            platform-wide page or fully redundant with a richer page
            elsewhere -- see this file's module comment for the
            tab-by-tab evidence. */}
        <MSeg value={group} onChange={setGroup} options={ANALYTICS_GROUPS} />

        {group === "organizations" && (
          <OrganizationAnalyticsPanel data={snap.data?.organizations} {...state} />
        )}

        {group === "reporting" && (
          <div className="space-y-4">
            <MSeg value={reportingTab} onChange={setReportingTab} options={REPORTING_TABS} />
            {reportingTab === "ondemand" && <ReportCenter range={range} />}
            {reportingTab === "scheduled" && <ScheduledReportsPanel />}
          </div>
        )}
      </MPageShell>
    </MasterShell>
  );
}
