import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Activity, AlertTriangle, Laptop, Network, Users, Wrench } from "lucide-react";
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
import { LocationLivenessExplainer } from "@/components/customer/LocationLiveness";
import {
  livenessTone,
  locationIsControllerManaged,
  locationIsNasOnly,
  CHECKING_LIVENESS,
  UNKNOWN_LIVENESS,
} from "@/lib/location-liveness";
import { ArubaInstantOnVenueCard } from "@/components/customer/ArubaInstantOnVenueCard";
import { controllerDeviceMetricsReason } from "@/lib/router-vendors";
import type { LocationLiveness, LivenessTone } from "@/lib/location-liveness";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { customerFeatureHref } from "@/lib/customerNav";
import { formatUptimePercent } from "@/lib/uptime-format";
import { DASHBOARD_RANGES } from "@/lib/dashboard-range";
import type { DashboardRange } from "@/lib/dashboard-range";
import {
  ChartEmptyState,
  BandwidthUtilizationCard,
  NeedsAttentionCard,
  useWanSummary,
} from "@/components/customer/dashboard";
import { WanStatusCardView } from "@/components/customer/dashboard/WanStatusCard";
import { DeviceStatusCardView } from "@/components/customer/dashboard/DeviceStatusCard";
import {
  PeakHoursHeatmapCard,
  GuestMixCard,
  LoginFunnelCard,
  LocationComparisonCard,
} from "@/components/customer/dashboard/insights";
import { EmptyState, Panel, SegmentedControl } from "@/components/customer/console";
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
import { SiteHealthStrip } from "@/components/customer/dashboard/overview/SiteHealthStrip";
import {
  ActivityChart,
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

/** Verdict line colours. Green is earned by the verdict, never default. */
const VERDICT: Record<LivenessTone, { status: OverviewStatus; title: string }> = {
  live: { status: "ok", title: "All core systems operational" },
  warn: { status: "warn", title: "Some systems need attention" },
  down: { status: "crit", title: "Your network is not reachable" },
  neutral: { status: "unknown", title: "System status unavailable" },
};

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
  // venue makes no request), and never at a NAS-only one -- same gate as
  // the Devices page.
  const controllerVenue = locationIsControllerManaged(liveness) && !nasOnlyVenue;
  const controller = useControllerDevices(controllerVenue ? locationId : undefined);

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

  // Range and venue stats for the activity panel's header rail. "Currently
  // online" is not here: it leads the health strip instead.
  const kpis = [
    {
      label: t("kpi.guests", "Guests"),
      value: s ? s.guests.toLocaleString() : null,
      loading: series.isLoading,
      footer: series.isError
        ? t("couldNotLoad", "Couldn't load")
        : t("kpi.guestsFooter", "Unique guests, {{range}}", { range: rangeLabel }),
    },
    {
      label: t("kpi.avgSession", "Avg. session time"),
      value:
        s?.avgSessionMinutes != null
          ? t("kpi.avgSessionValue", "{{minutes}} min", { minutes: s.avgSessionMinutes })
          : null,
      loading: series.isLoading,
      footer: s
        ? s.avgSessionMinutes == null
          ? t("kpi.noSessions", "No sessions {{range}}", { range: rangeLabel })
          : t("kpi.acrossSessions", "Across {{formatted}} sessions", {
              count: s.sessions,
              formatted: s.sessions.toLocaleString(),
            })
        : null,
    },
    {
      label: t("kpi.uptime", "Uptime"),
      value: d?.kpis.slaUptime != null ? formatUptimePercent(d.kpis.slaUptime) : null,
      loading: isLoading,
      footer: d
        ? d.kpis.slaUptime == null
          ? t("kpi.uptimeNone", "No health checks yet")
          : t("kpi.uptimeFooter", "Primary ISP, last 24 hours")
        : null,
    },
  ];

  const verdict = VERDICT[isLoading ? "neutral" : tone];

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
          {/* 1. Page header: what venue, and the page's ONE range control. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--wy-text-faint)]">
                {t("header.eyebrow", "Location overview")}
              </p>
              <h1 className="truncate text-xl font-semibold tracking-[-0.02em]">
                {activeLocation?.name ?? t("header.title", "Dashboard")}
              </h1>
              <p className="sr-only">
                {t("header.subtitle", "Here's what's happening at {{name}}.", {
                  name: activeLocation?.name ?? t("header.yourVenue", "your venue"),
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {d?.kpis.failedLogins != null && d.kpis.failedLogins > 0 && (
                <button
                  type="button"
                  onClick={() => handleNav("admin-logs")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wy-crit-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wy-crit)] transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden />
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wy-warn-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--wy-warn)]"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden />
                  {t("header.loginCheckUnavailable", "Login check unavailable")}
                </span>
              )}
              <RangeSelect value={range} onChange={setRange} />
            </div>
          </div>

          {/* 2. Site health: the verdict, then one number per layer of the
           * network. This is the answer to "is my WiFi up right now?", so it
           * reads first; the topology and detail cards below are the
           * evidence. */}
          <SectionBoundary
            name="health"
            fallback={
              <SectionFailed
                title={t("sectionError.title", "This section couldn't be shown")}
                body={t("sectionError.body", "The rest of the page still works. Try refreshing.")}
              />
            }
          >
            <section className={PANEL} aria-label={t("health.title", "Site health")}>
              <div className="flex flex-col gap-2 border-b border-[var(--wy-border)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <StatusDot status={verdict.status} live={!isLoading && tone === "live"} />
                  <span className="text-sm font-semibold">
                    {/* `liveness.summary` is server copy and stays as sent. */}
                    {isLoading
                      ? t("status.checking", "Checking systems…")
                      : tone === "live"
                        ? t("status.live", VERDICT.live.title)
                        : liveness.summary || t(`status.${tone}`, VERDICT[tone].title)}
                  </span>
                  {/* A not-live verdict with no way forward leaves the owner
                      stuck; this goes straight to Fix a Problem. Hidden when
                      live and while still checking. */}
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
                </div>
                {d && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--wy-text-muted)]">
                    <span>
                      {t("status.system", "System")}{" "}
                      <span className="font-semibold text-[var(--wy-text)]">
                        {d.health.systemHealth}
                      </span>
                    </span>
                    {/* Names the active uplink; not a health measurement --
                        the Internet cell below carries that. */}
                    <span>
                      {t("status.isp", "ISP")}{" "}
                      <span className="font-semibold text-[var(--wy-text)]">{d.health.isp}</span>
                    </span>
                  </div>
                )}
              </div>
              <SiteHealthStrip
                wan={wan}
                liveness={liveness}
                tone={tone}
                livenessLoading={isLoading && !d}
                topology={topology}
                onlineUsers={d ? d.kpis.onlineUsers : null}
                onlineLoading={isLoading}
                onlineFoot={
                  s
                    ? t("kpi.onlineFooter", "Peak {{range}}: {{peak}}", {
                        range: rangeLabel,
                        peak: s.peakOnline.toLocaleString(),
                      })
                    : isError
                      ? t("couldNotLoad", "Couldn't load")
                      : null
                }
                onOpen={handleNav}
              />
            </section>
          </SectionBoundary>

          {/* Why the venue is not live, and what to do. Nothing when it is. */}
          {d && <LocationLivenessExplainer liveness={d.liveness} />}

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

          {/* 3. What to do right now, one row per problem with the page that
              fixes it -- ahead of the map and charts, because an owner
              opening this screen with something broken should not have to
              read them first. Every row is a real read; see
              NeedsAttentionCard. Full width so its rows lay out side by side
              and it costs one short band, not a column. */}
          <NeedsAttentionCard locationId={locationId} />

          {/* 4. The venue's chain, ISP to guests, full width so device names
              fit on their nodes. */}
          <div>
            <SectionBoundary
              name="topology"
              fallback={
                <div>
                  <SectionFailed
                    title={t("sectionError.title", "This section couldn't be shown")}
                    body={t(
                      "sectionError.body",
                      "The rest of the page still works. Try refreshing.",
                    )}
                  />
                </div>
              }
            >
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
          </div>

          {/* 5. Guest activity for the selected range, with the range's
              headline numbers on the panel's own rail. */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <SectionBoundary
              name="activity"
              fallback={
                <div className="xl:col-span-8">
                  <SectionFailed
                    title={t("sectionError.title", "This section couldn't be shown")}
                    body={t(
                      "sectionError.body",
                      "The rest of the page still works. Try refreshing.",
                    )}
                  />
                </div>
              }
            >
              <div data-testid="activity-panel" className="min-w-0 xl:col-span-8">
                <Panel
                  flush
                  className="h-full"
                  title={
                    <PanelTitle icon={<Activity />}>
                      {t("activity.title", "Guest activity")}
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
                  <dl className="grid grid-cols-3 divide-x divide-[var(--wy-border)] border-b border-[var(--wy-border)]">
                    {kpis.map((k) => (
                      <div key={k.label} className="min-w-0 px-4 py-2.5">
                        <dt className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--wy-text-muted)]">
                          {k.label}
                        </dt>
                        <dd className="mt-0.5">
                          {k.loading ? (
                            <span className="block h-6 w-16 animate-pulse rounded bg-[var(--wy-surface-2)]" />
                          ) : (
                            <span
                              className={cn(
                                "text-lg font-semibold tabular-nums tracking-[-0.02em]",
                                k.value == null && "text-[var(--wy-text-faint)]",
                              )}
                            >
                              {k.value ?? "—"}
                            </span>
                          )}
                          <span className="block truncate text-[11px] text-[var(--wy-text-faint)]">
                            {!k.loading && k.footer}
                          </span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="p-4">
                    {series.isLoading ? (
                      <div className="h-72">
                        <ChartSkeleton />
                      </div>
                    ) : series.isError ? (
                      <div className="h-72">
                        <SeriesError onRetry={() => series.refetch()} />
                      </div>
                    ) : noGuestActivity ? (
                      <div className="h-72">
                        <ChartEmptyState
                          label={t("guestsOnline.empty", "No guest activity {{range}}.", {
                            range: rangeLabel,
                          })}
                        />
                      </div>
                    ) : (
                      <ActivityChart points={points} byHour={byHour} rangeLabel={rangeLabel} />
                    )}
                  </div>
                </Panel>
              </div>
            </SectionBoundary>

            <Panel
              className="xl:col-span-4"
              title={
                <PanelTitle icon={<Laptop />}>{t("devicesByOs.title", "Devices by OS")}</PanelTitle>
              }
              description={rangeLabel}
            >
              <div className="flex flex-col">
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
                      <li key={o.name} className="group">
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
          </div>

          {/* 6. Recent guests and recent alerts. */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel
              flush
              className="overflow-hidden xl:col-span-8"
              title={
                <PanelTitle icon={<Users />}>{t("recentUsers.title", "Recent Users")}</PanelTitle>
              }
              description={t("recentUsers.meta", "Last 24 hours · click a row to open Guests")}
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
                />
              )}
            </Panel>

            <Panel
              flush
              className="xl:col-span-4"
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
                      <li key={i} className="flex items-start gap-2.5 px-4 py-2.5">
                        <StatusDot
                          status={st}
                          className="mt-1"
                          label={t(`recentAlerts.type.${a.type}`, a.type)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-xs font-medium">{a.msg}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[var(--wy-text-faint)]">
                          {a.time}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* 7. The detail behind the health strip: live traffic, each ISP,
              and the hardware list. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-12">
            <div className="min-w-0 lg:col-span-2 2xl:col-span-5">
              {nasOnlyVenue ? (
                <div className={cn(PANEL, "h-full p-4")} data-testid="aruba-traffic-unsupported">
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
            <div className="min-w-0 2xl:col-span-4">
              <WanStatusCardView wan={wan} onManage={() => handleNav("isp-details")} />
            </div>
            <div className="min-w-0 2xl:col-span-3">
              {nasOnlyVenue ? (
                <ArubaInstantOnVenueCard locationId={locationId} />
              ) : (
                <DeviceStatusCardView
                  devices={hardware.devices}
                  onManage={() => handleNav("devices")}
                />
              )}
            </div>
          </div>

          {/* 8. Guest insights -- when guests come, who comes back, where
              sign-in drops off, and (multi-venue orgs only) how this venue
              compares. Each card reads its own fixed window (last 28 days by
              default), not the page's range picker: a weekly pattern needs
              weeks, and "today" would make the heatmap mostly empty. */}
          <div className="flex items-baseline justify-between pt-2">
            <h2 className="text-[13px] font-semibold">{t("insightsHeading", "Guest insights")}</h2>
            <span className="text-xs text-[var(--wy-text-faint)]">
              {t("insightsMeta", "Last 28 days, independent of the range above")}
            </span>
          </div>
          <SectionBoundary
            name="insights"
            fallback={
              <SectionFailed
                title={t("sectionError.title", "This section couldn't be shown")}
                body={t("sectionError.body", "The rest of the page still works. Try refreshing.")}
              />
            }
          >
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
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}
