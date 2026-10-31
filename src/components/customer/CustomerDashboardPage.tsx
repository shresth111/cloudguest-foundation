import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, Clock, Laptop, Network, Users, Wifi, Wrench } from "lucide-react";
import { CustomerSidebar } from "@/components/customer/CustomerSidebar";
import {
  CustomerCommandPalette,
  useCustomerCommandPalette,
} from "@/components/customer/CustomerCommandPalette";
import { SidebarProvider } from "@/components/ui/sidebar";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { ChangePasswordDialog } from "@/components/features/ChangePasswordDialog";
import { TwoFactorDialog } from "@/components/features/TwoFactorDialog";
import AssistantWidget from "@/components/features/AssistantWidget";
import { maskEmail, DEMO_PLAN_RENEWAL_ISO } from "@/components/features/HeaderControls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import i18n from "@/lib/i18n";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import {
  useCustomerDashboard,
  useDashboardSeries,
  useIsDemo,
  useDataMasking,
} from "@/hooks/useCustomerDashboard";
import { useMonitoredHardware } from "@/hooks/useMonitoredHardware";
import { useControllerDevices } from "@/hooks/useControllerDevices";
import {
  livenessTone,
  locationIsControllerManaged,
  locationIsNasOnly,
  CHECKING_LIVENESS,
  UNKNOWN_LIVENESS,
} from "@/lib/location-liveness";
import { ArubaInstantOnVenueCard } from "@/components/customer/ArubaInstantOnVenueCard";
import { controllerDeviceMetricsReason } from "@/lib/router-vendors";
import type { LocationLiveness } from "@/lib/location-liveness";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { customerFeatureHref } from "@/lib/customerNav";
import { formatUptimePercent } from "@/lib/uptime-format";
import { DASHBOARD_RANGES } from "@/lib/dashboard-range";
import type { DashboardRange } from "@/lib/dashboard-range";
import {
  ChartEmptyState,
  BandwidthUtilizationCard,
  NeedsAttentionCardView,
  useNeedsAttention,
  useWanSummary,
} from "@/components/customer/dashboard";
import { useVenueIssuesStore } from "@/components/customer/venueIssues";
import { WanStatusCardView } from "@/components/customer/dashboard/WanStatusCard";
import { DeviceStatusCardView } from "@/components/customer/dashboard/DeviceStatusCard";
import {
  PeakHoursHeatmapCard,
  GuestMixCard,
  LoginFunnelCard,
  LocationComparisonCard,
} from "@/components/customer/dashboard/insights";
import { EmptyState, Panel, SegmentedControl, StatTile } from "@/components/customer/console";
import {
  PANEL,
  PanelLink,
  PanelTitle,
  SectionBoundary,
  SectionFailed,
  StatusDot,
  type OverviewStatus,
} from "@/components/customer/dashboard/overview/console-ui";
import { buildTopology } from "@/components/customer/dashboard/overview/topology-model";
import { TopologyMap } from "@/components/customer/dashboard/overview/TopologyMap";
import {
  SeriesChart,
  toActivityPoints,
} from "@/components/customer/dashboard/overview/ActivityChart";
import { RecentGuestsTable } from "@/components/customer/dashboard/overview/RecentGuestsTable";

// This component lives in a plain component file, not a route file, on
// purpose: routeTree.gen.ts statically imports every route file into the
// entry chunk, so dashboard JSX + recharts in a route file ship to every
// guest on the captive portal. index.tsx imports it through its own
// code-split `component`.
//
// EVERY NUMBER ON THIS PAGE IS REAL. Two sources:
//  - `useDashboardSeries` -- guests, avg session, the two charts and the OS
//    split for the selected range, aggregated server-side by
//    `/guest-analytics/dashboard-series`.
//  - `useCustomerDashboard` -- what is true right now: online guests,
//    router/ISP liveness, uptime, recent guests and alerts.
// When a source has nothing, the card says so. A failed read renders as an
// error, never as a zero or a sample figure. (A static copy of the design
// reference with its sample numbers shipped once as 2cdc6c1 and had to be
// reverted.)

const OS_COLORS = [
  "var(--wy-series-1)",
  "var(--wy-series-2)",
  "var(--wy-series-3)",
  "var(--wy-series-4)",
  "var(--wy-series-5)",
  "var(--wy-series-6)",
];

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-1.5 px-2 pb-2" aria-hidden="true">
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="w-full animate-pulse rounded-t bg-[var(--wy-surface-2)]"
          style={{ height: `${25 + (i % 5) * 12}%` }}
        />
      ))}
    </div>
  );
}

function SeriesError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("dashboard", { i18n });
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 text-center"
      role="alert"
    >
      <p className="text-xs text-[var(--wy-text-muted)]">
        {t("seriesError", "Couldn't load guest analytics.")}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry", "Retry")}
      </Button>
    </div>
  );
}

/** The page's one range control, in the header. The Guests Online card used
 * to carry a second copy bound to the same state; it was removed because two
 * controls for one setting read as two settings. Every range-bound panel
 * names the range it shows. */
function RangeSelect({
  value,
  onChange,
}: {
  value: DashboardRange;
  onChange: (r: DashboardRange) => void;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      ariaLabel={t("rangeLabel", "Date range")}
      options={DASHBOARD_RANGES.map((r) => ({
        value: r.value,
        label: t(`rangeShort.${r.value}`, r.value),
      }))}
    />
  );
}

/** The customer dashboard, rendered at "/" (index.tsx) for the venue picked
 * in `useCustomerStore`. */
export function CustomerDashboardPage() {
  const { t } = useTranslation("dashboard", { i18n });
  const navigate = useNavigate();
  const { user, roles, logout } = useAuth();
  const { activeLocation, activeLocationId } = useCustomerStore();
  // index.tsx only renders this once a venue is picked.
  const locationId = activeLocationId!;
  const [range, setRange] = useState<DashboardRange>("24h");
  const { data: d, isLoading, isError, refetch } = useCustomerDashboard(locationId);
  const series = useDashboardSeries(locationId, range);
  const demoFlag = useIsDemo();
  const billing = useMyBillingDashboard(
    demoFlag ? undefined : activeLocation?.organizationId,
    activeLocation?.organizationName,
  );
  const planExpiryIso = demoFlag ? DEMO_PLAN_RENEWAL_ISO : billing.data?.renewalDate;
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCustomerCommandPalette();
  const dataMasking = useDataMasking();
  const masked = dataMasking.masked;
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [tfaOpen, setTfaOpen] = useState(false);

  // Loading is "checking", and a missing liveness is "can't tell" -- never
  // a red dot picked by an else-branch.
  const liveness: LocationLiveness =
    d?.liveness ?? activeLocation?.liveness ?? (isLoading ? CHECKING_LIVENESS : UNKNOWN_LIVENESS);
  const tone = livenessTone(liveness.state);
  // An Aruba Instant On venue (NAS-only): nothing here measures its access
  // points or its uplink traffic, so the hardware and bandwidth cards give
  // way to the venue card (our own guest records) and copy U6. Every other
  // venue renders exactly as before.
  const nasOnlyVenue = locationIsNasOnly(liveness);

  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };

  // Read ONCE here and handed to every widget that needs them: both hooks
  // are plain component state, so a second call is a second set of
  // requests. The topology map, the health strip and the two detail cards
  // all draw from these same reads.
  const wan = useWanSummary(locationId);
  const hardware = useMonitoredHardware(nasOnlyVenue ? "" : locationId);
  // An Omada venue's access points live in its controller, not in the
  // monitored-hardware list. Asked only at a controller venue (a MikroTik
  // venue makes no request), never at a NAS-only one -- same gate as the
  // Devices page.
  const controllerVenue = locationIsControllerManaged(liveness) && !nasOnlyVenue;
  // The map sits behind a toggle; its one extra read (a controller venue's
  // AP inventory) waits until the map is actually opened.
  const [networkView, setNetworkView] = useState<"cards" | "map">("cards");
  const controller = useControllerDevices(
    controllerVenue && networkView === "map" ? locationId : undefined,
  );

  // THE venue issue list, computed once from reads this page already makes
  // (the WAN read above is handed in, not repeated). The Needs-attention card
  // renders it, and it is published for the top bar's health pill and bell,
  // so all three show the same issues and the same count. This replaced the
  // status bar's own verdict sentence, which was a fourth, router-only answer.
  const attention = useNeedsAttention(locationId, { wan });
  const publishIssues = useVenueIssuesStore((st) => st.publish);
  useEffect(() => {
    publishIssues(locationId, attention);
  }, [publishIssues, locationId, attention]);

  const s = series.data;
  // Mid-sentence form ("Unique guests, last 24 hours"); its own key because
  // Hindi has no lowercase to derive it from the menu label.
  const rangeLabel = t(
    `rangeInline.${range}`,
    DASHBOARD_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "",
  );
  const byHour = s?.bucket !== "day";
  const points = toActivityPoints(s);
  const noGuestActivity = points.every((b) => b.online === 0 && b.arrivals === 0);
  const osTotal = (s?.osBreakdown ?? []).reduce((a, o) => a + o.value, 0);
  const osMax = Math.max(1, ...(s?.osBreakdown ?? []).map((o) => o.value));
  const isOwner = roles.some(
    (r) =>
      r.roleSlug === "owner" ||
      r.roleSlug === "organization-owner" ||
      r.roleName?.toLowerCase().includes("owner") ||
      r.scopeType === "global",
  );

  const topology = useMemo(
    () =>
      buildTopology({
        wan,
        liveness,
        livenessLoading: isLoading && !d,
        hardware: nasOnlyVenue ? [] : hardware.devices,
        hardwareLoading: !nasOnlyVenue && hardware.loading,
        controller: controllerVenue ? controller : null,
        onlineGuests: d ? d.kpis.onlineUsers : null,
        nasOnly: nasOnlyVenue,
        maxDownstream: 6,
      }),
    [
      wan,
      liveness,
      isLoading,
      d,
      nasOnlyVenue,
      hardware.devices,
      hardware.loading,
      controllerVenue,
      controller,
    ],
  );

  // Range and venue stats for the activity panel's header rail.
  const kpis = [
    {
      label: t("kpi.guests", "Guests"),
      icon: <Users className="h-3.5 w-3.5" />,
      value: s ? s.guests.toLocaleString() : null,
      loading: series.isLoading,
      footer: series.isError ? (
        <span>{t("couldNotLoad", "Couldn't load")}</span>
      ) : (
        <span>{t("kpi.guestsFooter", "Unique guests, {{range}}", { range: rangeLabel })}</span>
      ),
    },
    {
      label: t("kpi.online", "Currently online"),
      icon: <Wifi className="h-3.5 w-3.5" />,
      value: d ? d.kpis.onlineUsers.toLocaleString() : null,
      loading: isLoading,
      live: !!d && d.kpis.onlineUsers > 0,
      footer: s ? (
        <span>
          {t("kpi.onlineFooter", "Peak {{range}}: {{peak}}", {
            range: rangeLabel,
            peak: s.peakOnline.toLocaleString(),
          })}
        </span>
      ) : isError ? (
        <span>{t("couldNotLoad", "Couldn't load")}</span>
      ) : null,
    },
    {
      label: t("kpi.avgSession", "Avg. session time"),
      icon: <Clock className="h-3.5 w-3.5" />,
      value:
        s?.avgSessionMinutes != null
          ? t("kpi.avgSessionValue", "{{minutes}} min", { minutes: s.avgSessionMinutes })
          : null,
      loading: series.isLoading,
      footer: s ? (
        <span>
          {s.avgSessionMinutes == null
            ? t("kpi.noSessions", "No sessions {{range}}", { range: rangeLabel })
            : t("kpi.acrossSessions", "Across {{formatted}} sessions", {
                count: s.sessions,
                formatted: s.sessions.toLocaleString(),
              })}
        </span>
      ) : null,
    },
    {
      label: t("kpi.uptime", "Uptime"),
      icon: <Activity className="h-3.5 w-3.5" />,
      value: d?.kpis.slaUptime != null ? formatUptimePercent(d.kpis.slaUptime) : null,
      loading: isLoading,
      // What the number measures, not a verdict: the health verdict is the
      // top bar's pill alone (it used to be repeated here as "All systems
      // healthy", beside an open critical alert).
      footer: d ? <span>{t("kpi.uptimeFooter", "Main internet line, last 24 hours")}</span> : null,
    },
  ];

  const sectionFallback = (
    <SectionFailed
      title={t("sectionError.title", "This section couldn't be shown")}
      body={t("sectionError.body", "The rest of the page still works. Try refreshing.")}
    />
  );
  const chartBody = (empty: string, chart: ReactNode) =>
    series.isLoading ? (
      <ChartSkeleton />
    ) : series.isError ? (
      <SeriesError onRetry={() => series.refetch()} />
    ) : noGuestActivity ? (
      <ChartEmptyState label={empty} />
    ) : (
      chart
    );

  return (
    <SidebarProvider className="wy-console bg-[var(--wy-bg)]">
      <CustomerSidebar activeFeatureId="dashboard" dataMasking={dataMasking} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          locationId={locationId}
          planExpiryIso={planExpiryIso}
          onOpenSearch={() => setPaletteOpen(true)}
          onRefresh={() => {
            refetch();
            series.refetch();
          }}
          user={user}
          onSwitchLocation={() => navigate({ to: "/switch-location" })}
          onChangePassword={() => setChangePwOpen(true)}
          onTfaSettings={() => setTfaOpen(true)}
          onLogout={handleLogout}
        />

        <main className="mx-auto w-full max-w-[1480px] flex-1 space-y-4 px-3 py-4 text-[var(--wy-text)] sm:px-5 lg:px-6">
          {/* 1. Page header. There is no status bar above it any more: the
              venue's one health verdict is the top bar's pill, and what is
              wrong is the Needs-attention list below (which also names the
              silent routers -- it replaced the "Partly live" explainer). */}
          <div className="flex flex-col gap-3 border-b border-[var(--wy-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--wy-accent)]">
                {t("header.eyebrow", "Location overview")}
              </p>
              <h1 className="text-xl font-semibold tracking-[-0.02em]">
                {t("header.title", "Dashboard")}
              </h1>
              <p className="text-sm text-[var(--wy-text-muted)]">
                {t("header.subtitle", "Here's what's happening at {{name}}.", {
                  name: activeLocation?.name ?? t("header.yourVenue", "your venue"),
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* A not-live venue with no way forward leaves the owner stuck:
                  this goes straight to Fix a Problem. Hidden when live and
                  while still checking. */}
              {!isLoading && tone !== "live" && (
                <button
                  type="button"
                  onClick={() => handleNav("debugging")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--wy-radius)] bg-[var(--wy-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--wy-accent-fg)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] focus-visible:ring-offset-2"
                >
                  <Wrench aria-hidden className="h-3.5 w-3.5" />
                  {t("status.fixProblem", "Fix a problem")}
                </button>
              )}
              {d?.kpis.failedLogins != null && d.kpis.failedLogins > 0 && (
                <button
                  type="button"
                  onClick={() => handleNav("admin-logs")}
                  className="inline-flex items-center gap-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                >
                  <StatusDot status="crit" />
                  {t("header.failedLogins", "{{count}} failed logins today", {
                    count: d.kpis.failedLogins,
                  })}
                </button>
              )}
              {d && d.kpis.failedLogins === null && isOwner && (
                <span
                  title={t(
                    "header.loginCheckUnavailableHint",
                    "The failed-login check could not read this venue's login audit log.",
                  )}
                  className="inline-flex items-center gap-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2.5 py-1 text-xs text-[var(--wy-text-muted)]"
                >
                  <StatusDot status="warn" />
                  {t("header.loginCheckUnavailable", "Login check unavailable")}
                </span>
              )}
              <RangeSelect value={range} onChange={setRange} />
            </div>
          </div>

          {/* 2. What to do right now, one row per problem with the page that
              fixes it -- ahead of the KPIs because an owner opening this
              screen with something broken should not have to read charts
              first. Every row is a real read; see useNeedsAttention. */}
          <NeedsAttentionCardView state={attention} />

          {isError && !d && (
            <div className={cn(PANEL, "flex flex-col items-center gap-3 py-8 text-center")}>
              <p className="text-sm font-medium">
                {t("liveError.title", "Couldn't load this venue's live status")}
              </p>
              <p className="text-xs text-[var(--wy-text-muted)]">
                {t(
                  "liveError.body",
                  "Online guests, uptime, recent guests and alerts are unavailable right now.",
                )}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t("retry", "Retry")}
              </Button>
            </div>
          )}

          {/* 4. KPI row */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpis.map((k) => (
              <StatTile
                key={k.label}
                label={k.label}
                leading={
                  <span aria-hidden className="text-[var(--wy-text-faint)]">
                    {k.icon}
                  </span>
                }
                value={k.value}
                loading={k.loading}
                sparkline={
                  !k.loading && k.footer ? (
                    <p className="flex h-full items-end gap-1.5 truncate text-xs text-[var(--wy-text-muted)]">
                      {"live" in k && k.live && <StatusDot status="ok" live />}
                      {k.footer}
                    </p>
                  ) : undefined
                }
              />
            ))}
          </div>

          {/* 5. Guests online · Devices by OS · Sessions by hour */}
          <SectionBoundary name="charts" fallback={sectionFallback}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Panel
                className="md:col-span-2"
                title={
                  <PanelTitle icon={<Users />}>
                    {t("guestsOnline.title", "Guests Online")}
                  </PanelTitle>
                }
                description={
                  byHour
                    ? t("guestsOnline.subtitleHourly", "Guests connected each hour, {{range}}", {
                        range: rangeLabel,
                      })
                    : t("guestsOnline.subtitleDaily", "Guests connected each day, {{range}}", {
                        range: rangeLabel,
                      })
                }
              >
                <div className="h-64" data-testid="activity-panel">
                  {chartBody(
                    t("guestsOnline.empty", "No guest activity {{range}}.", { range: rangeLabel }),
                    <SeriesChart
                      testId="activity-chart"
                      points={points}
                      field="online"
                      kind="area"
                      byHour={byHour}
                      color="var(--wy-series-1)"
                      seriesLabel={t("guestsOnline.tooltipLabel", "Online")}
                      summary={t("guestsOnline.srSummary", {
                        range: rangeLabel,
                        peak: s?.peakOnline ?? 0,
                        defaultValue:
                          "Guests online, {{range}}. Peak {{peak}}. Use the arrow keys to read each bucket.",
                      })}
                    />,
                  )}
                </div>
              </Panel>

              <Panel
                title={
                  <PanelTitle icon={<Laptop />}>
                    {t("devicesByOs.title", "Devices by OS")}
                  </PanelTitle>
                }
                description={rangeLabel}
              >
                <div className="flex h-64 flex-col justify-center">
                  {series.isLoading ? (
                    <div className="space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-3 animate-pulse rounded-full bg-[var(--wy-surface-2)]"
                        />
                      ))}
                    </div>
                  ) : series.isError ? (
                    <SeriesError onRetry={() => series.refetch()} />
                  ) : !s || s.osBreakdown.length === 0 ? (
                    <ChartEmptyState
                      label={t("devicesByOs.empty", "No devices {{range}}.", { range: rangeLabel })}
                    />
                  ) : (
                    <ul className="space-y-3">
                      {s.osBreakdown.map((o, i) => (
                        <li
                          key={o.name}
                          title={`${o.name}: ${o.value.toLocaleString()}${osTotal ? ` (${Math.round((o.value / osTotal) * 100)}%)` : ""}`}
                          className="rounded-[var(--wy-radius)] px-1 py-0.5 transition-colors duration-150 hover:bg-[var(--wy-surface-2)]"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-1.5 font-medium">
                              <span
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{ background: OS_COLORS[i % OS_COLORS.length] }}
                              />
                              <span className="truncate">{o.name}</span>
                            </span>
                            <span className="tabular-nums text-[var(--wy-text-muted)]">
                              <span className="font-semibold text-[var(--wy-text)]">
                                {o.value.toLocaleString()}
                              </span>
                              {osTotal > 0 && (
                                <span className="ml-1.5 inline-block w-9 text-right text-[var(--wy-text-faint)]">
                                  {Math.round((o.value / osTotal) * 100)}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--wy-surface-2)]">
                            <div
                              className="h-full rounded-full transition-[width] duration-200"
                              style={{
                                width: `${(o.value / osMax) * 100}%`,
                                backgroundColor: OS_COLORS[i % OS_COLORS.length],
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Panel>

              <Panel
                title={
                  <PanelTitle icon={<Activity />}>
                    {byHour
                      ? t("sessions.titleHourly", "Sessions by Hour")
                      : t("sessions.titleDaily", "Sessions by Day")}
                  </PanelTitle>
                }
                description={t("sessions.subtitle", "New guest sessions")}
              >
                <div className="h-64">
                  {chartBody(
                    t("sessions.empty", "No sessions {{range}}.", { range: rangeLabel }),
                    <SeriesChart
                      testId="sessions-chart"
                      points={points}
                      field="arrivals"
                      kind="bar"
                      byHour={byHour}
                      color="var(--wy-series-2)"
                      seriesLabel={t("sessions.tooltipLabel", "Sessions")}
                      summary={t("sessions.srSummary", {
                        range: rangeLabel,
                        total: s?.sessions ?? 0,
                        defaultValue:
                          "New guest sessions, {{range}}: {{total}} in total. Use the arrow keys to read each bucket.",
                      })}
                    />,
                  )}
                </div>
              </Panel>
            </div>
          </SectionBoundary>

          {/* 6. Bandwidth · 7. Recent users · Recent alerts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-12">
            <div className="min-w-0 lg:col-span-2 2xl:col-span-5 [&>*]:h-full">
              {nasOnlyVenue ? (
                <div className={cn(PANEL, "p-4")} data-testid="aruba-traffic-unsupported">
                  <p className="text-sm font-semibold">{t("bandwidth.title", "Bandwidth")}</p>
                  <p className="mt-2 text-xs text-[var(--wy-text-muted)]">
                    {controllerDeviceMetricsReason("aruba_instant_on")}
                  </p>
                </div>
              ) : (
                <BandwidthUtilizationCard
                  locationId={locationId}
                  onManage={() => handleNav("isp-details")}
                />
              )}
            </div>

            <Panel
              flush
              className="overflow-hidden 2xl:col-span-4"
              title={
                <PanelTitle icon={<Users />}>{t("recentUsers.title", "Recent Users")}</PanelTitle>
              }
              actions={
                <PanelLink onClick={() => handleNav("users")}>
                  {t("viewAll", "View all →")}
                </PanelLink>
              }
            >
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-[var(--wy-surface-2)]" />
                  ))}
                </div>
              ) : !d ? (
                <p className="py-8 text-center text-xs text-[var(--wy-text-muted)]">
                  {t("couldNotLoadDot", "Couldn't load.")}
                </p>
              ) : d.recentUsers.length === 0 ? (
                <EmptyState
                  className="gap-2 px-4 py-6"
                  title={t("recentUsers.empty", "No guests have connected in the last 24 hours.")}
                />
              ) : (
                <RecentGuestsTable
                  rows={d.recentUsers}
                  maskEmail={(e) => (masked ? maskEmail(e) : e)}
                  onOpenRow={() => handleNav("users")}
                  limit={5}
                />
              )}
            </Panel>

            <Panel
              flush
              className="2xl:col-span-3"
              title={
                <PanelTitle icon={<AlertTriangle />}>
                  {t("recentAlerts.title", "Recent Alerts")}
                </PanelTitle>
              }
              actions={
                <PanelLink onClick={() => handleNav("alerts")}>
                  {t("viewAll", "View all →")}
                </PanelLink>
              }
            >
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded bg-[var(--wy-surface-2)]" />
                  ))}
                </div>
              ) : !d ? (
                <p className="py-8 text-center text-xs text-[var(--wy-text-muted)]">
                  {t("couldNotLoadDot", "Couldn't load.")}
                </p>
              ) : d.recentAlerts.length === 0 ? (
                <EmptyState
                  className="gap-2 px-4 py-6"
                  title={t("recentAlerts.empty", "No alerts. Nothing needs your attention.")}
                />
              ) : (
                <ul className="divide-y divide-[var(--wy-border)]">
                  {d.recentAlerts.map((a, i) => {
                    const st: OverviewStatus =
                      a.type === "error"
                        ? "crit"
                        : a.type === "warning"
                          ? "warn"
                          : a.type === "success"
                            ? "ok"
                            : "info";
                    return (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => handleNav("alerts")}
                          className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--wy-surface-2)] focus-visible:bg-[var(--wy-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)]"
                        >
                          <StatusDot
                            status={st}
                            className="mt-1"
                            label={t(`recentAlerts.type.${a.type}`, a.type)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-xs font-medium">{a.msg}</span>
                            <span className="text-[11px] tabular-nums text-[var(--wy-text-faint)]">
                              {a.time}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* 8. Guest insights -- when guests come, who comes back, where
              sign-in drops off, and (multi-venue orgs only) how this venue
              compares. Each card reads its own fixed window (last 28 days by
              default), not the page's range picker: a weekly pattern needs
              weeks, and "today" would make the heatmap mostly empty. */}
          <SectionBoundary name="insights" fallback={sectionFallback}>
            <div className="grid gap-4 lg:grid-cols-2">
              <PeakHoursHeatmapCard locationId={locationId} className="lg:col-span-2" />
              <GuestMixCard locationId={locationId} />
              <LoginFunnelCard locationId={locationId} />
            </div>
            {/* Renders nothing for single-venue orgs and the demo. */}
            <div className="mt-4 empty:hidden">
              <LocationComparisonCard />
            </div>
          </SectionBoundary>

          {/* 9. Real uplink health and hardware -- the detail behind the status
              bar's ISP and router figures at the top of this page. The
              network map is the same rows drawn as a chain, behind a toggle
              so it never moves the cards. */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <h2 className="text-[13px] font-semibold">{t("network.heading", "Network")}</h2>
            <SegmentedControl
              value={networkView}
              onChange={setNetworkView}
              ariaLabel={t("network.viewLabel", "Network view")}
              options={[
                { value: "cards", label: t("network.cards", "Cards") },
                { value: "map", label: t("network.map", "Map") },
              ]}
            />
          </div>
          {networkView === "map" ? (
            <SectionBoundary name="topology" fallback={sectionFallback}>
              <div data-testid="topology-panel" className="min-w-0">
                <Panel
                  title={
                    <PanelTitle icon={<Network />}>{t("topology.title", "Network map")}</PanelTitle>
                  }
                  description={
                    topology.downstreamSource === "controller"
                      ? t(
                          "topology.metaController",
                          "Access points as your controller reports them",
                        )
                      : t("topology.meta", "Live status · hover for details, click to open")
                  }
                  actions={
                    <PanelLink onClick={() => handleNav("devices")}>
                      {t("topology.openDevices", "Devices →")}
                    </PanelLink>
                  }
                >
                  <TopologyMap model={topology} onOpen={(target) => handleNav(target)} />
                </Panel>
              </div>
            </SectionBoundary>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <WanStatusCardView wan={wan} onManage={() => handleNav("isp-details")} />
              {nasOnlyVenue ? (
                <ArubaInstantOnVenueCard locationId={locationId} />
              ) : (
                <DeviceStatusCardView
                  devices={hardware.devices}
                  onManage={() => handleNav("devices")}
                />
              )}
            </div>
          )}
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}
