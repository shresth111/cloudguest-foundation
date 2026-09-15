import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Info,
  Laptop,
  Router,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useCustomerStore } from "@/stores/customerStore";
import {
  useCustomerDashboard,
  useDashboardSeries,
  useIsDemo,
  useDataMasking,
} from "@/hooks/useCustomerDashboard";
import {
  LocationLivenessBadge,
  LocationLivenessExplainer,
} from "@/components/customer/LocationLiveness";
import { livenessTone, CHECKING_LIVENESS, UNKNOWN_LIVENESS } from "@/lib/location-liveness";
import type { LocationLiveness, LivenessTone } from "@/lib/location-liveness";
import { useMyBillingDashboard } from "@/hooks/useBilling";
import { customerFeatureHref } from "@/lib/customerNav";
import { formatUptimePercent } from "@/lib/uptime-format";
import { DASHBOARD_RANGES, bucketLabel } from "@/lib/dashboard-range";
import type { DashboardRange } from "@/lib/dashboard-range";
import {
  ChartEmptyState,
  WanStatusCard,
  BandwidthUtilizationCard,
  DeviceStatusCard,
} from "@/components/customer/dashboard";

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

const CARD =
  "rounded-2xl border border-border/70 bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md";

const OS_COLORS = ["#6C4EFF", "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981", "#94A3B8"];

const STATUS_BAR: Record<LivenessTone, { wrap: string; icon: string; title: string }> = {
  live: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
    title: "All core systems operational",
  },
  warn: {
    wrap: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
    icon: "text-amber-600 dark:text-amber-400",
    title: "Some systems need attention",
  },
  down: {
    wrap: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
    icon: "text-rose-600 dark:text-rose-400",
    title: "Your network is not reachable",
  },
  neutral: {
    wrap: "border-border bg-muted/50 text-foreground",
    icon: "text-muted-foreground",
    title: "System status unavailable",
  },
};

/** Status-bar icon tint. Emerald is earned by the verdict, never default. */
const CORE_ICON: Record<LivenessTone, string> = {
  live: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  down: "text-rose-600 dark:text-rose-400",
  neutral: "text-muted-foreground",
};

const HEADER_DOT: Record<LivenessTone, string> = {
  live: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-rose-400",
  neutral: "bg-white/40",
};

const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.35)",
};

function IconChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6C4EFF]/10 text-[#6C4EFF] dark:bg-[#6C4EFF]/20 dark:text-indigo-300">
      {children}
    </div>
  );
}

function CardHead({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <IconChip>{icon}</IconChip>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function KpiCard({
  label,
  icon,
  value,
  footer,
  loading,
}: {
  label: string;
  icon: ReactNode;
  value: string | null;
  footer?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className={cn(CARD, "p-5")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <IconChip>{icon}</IconChip>
      </div>
      <div className="mt-3 h-9">
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <span
            className={cn(
              "font-display text-3xl font-bold tracking-tight tabular-nums",
              value == null && "text-muted-foreground/60",
            )}
          >
            {value ?? "—"}
          </span>
        )}
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {!loading && footer}
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-full items-end gap-1.5 px-2 pb-2" aria-hidden="true">
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="w-full animate-pulse rounded-t bg-muted"
          style={{ height: `${25 + (i % 5) * 12}%` }}
        />
      ))}
    </div>
  );
}

function SeriesError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-xs text-muted-foreground">Couldn't load guest analytics.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function RangeSelect({
  value,
  onChange,
  compact,
}: {
  value: DashboardRange;
  onChange: (r: DashboardRange) => void;
  compact?: boolean;
}) {
  const label = DASHBOARD_RANGES.find((r) => r.value === value)?.label ?? "";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-card font-medium shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-xs",
        )}
      >
        {!compact && <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as DashboardRange)}>
          {DASHBOARD_RANGES.map((r) => (
            <DropdownMenuRadioItem key={r.value} value={r.value}>
              {r.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The customer dashboard, rendered at "/" (index.tsx) for the venue picked
 * in `useCustomerStore`. */
export function CustomerDashboardPage() {
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

  const handleNav = (id: string) => navigate({ to: customerFeatureHref(id) });
  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login", replace: true });
  };

  const s = series.data;
  const rangeLabel = DASHBOARD_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "";
  const byHour = s?.bucket !== "day";
  const chartData = (s?.series ?? []).map((b) => ({
    label: bucketLabel(b.bucketStart, s?.bucket ?? "hour"),
    online: b.online,
    arrivals: b.arrivals,
  }));
  const noGuestActivity = chartData.every((b) => b.online === 0 && b.arrivals === 0);
  const peakIdx = chartData.reduce(
    (best, b, i) => (b.online > (chartData[best]?.online ?? -1) ? i : best),
    0,
  );
  const osMax = Math.max(1, ...(s?.osBreakdown ?? []).map((o) => o.value));
  const isOwner = roles.some(
    (r) =>
      r.roleSlug === "owner" ||
      r.roleSlug === "organization-owner" ||
      r.roleName?.toLowerCase().includes("owner") ||
      r.scopeType === "global",
  );

  const kpis = [
    {
      label: "Guests",
      icon: <Users className="h-4 w-4" />,
      value: s ? s.guests.toLocaleString() : null,
      loading: series.isLoading,
      footer: series.isError ? (
        <span>Couldn't load</span>
      ) : (
        <span>Unique guests, {rangeLabel}</span>
      ),
    },
    {
      label: "Currently online",
      icon: <Wifi className="h-4 w-4" />,
      value: d ? d.kpis.onlineUsers.toLocaleString() : null,
      loading: isLoading,
      footer: s ? (
        <span>
          Peak {rangeLabel}: {s.peakOnline.toLocaleString()}
        </span>
      ) : isError ? (
        <span>Couldn't load</span>
      ) : null,
    },
    {
      label: "Avg. session time",
      icon: <Clock className="h-4 w-4" />,
      value: s?.avgSessionMinutes != null ? `${s.avgSessionMinutes} min` : null,
      loading: series.isLoading,
      footer: s ? (
        <span>
          {s.avgSessionMinutes == null
            ? `No sessions ${rangeLabel}`
            : `Across ${s.sessions.toLocaleString()} sessions`}
        </span>
      ) : null,
    },
    {
      label: "Uptime",
      icon: <Activity className="h-4 w-4" />,
      value: d?.kpis.slaUptime != null ? formatUptimePercent(d.kpis.slaUptime) : null,
      loading: isLoading,
      footer: d ? (
        tone === "live" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            All systems healthy
          </span>
        ) : (
          <LocationLivenessBadge liveness={liveness} />
        )
      ) : null,
    },
  ];

  return (
    <SidebarProvider
      className="bg-[#F8F9FC] dark:bg-background"
      style={
        {
          "--primary": "#6C4EFF",
          "--primary-foreground": "#ffffff",
          "--ring": "#6366f1",
        } as React.CSSProperties
      }
    >
      <CustomerSidebar activeFeatureId="dashboard" dataMasking={dataMasking} />

      <div className="flex min-w-0 flex-1 flex-col">
        <CustomerHeader
          title={
            <>
              <LocationLivenessBadge
                liveness={liveness}
                surface="dark"
                className="hidden sm:inline-flex"
              />
              <span
                aria-hidden
                className={cn("block h-2 w-2 rounded-full sm:hidden", HEADER_DOT[tone])}
              />
            </>
          }
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

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {/* 1. Page header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Here's what's happening at {activeLocation?.name ?? "your venue"}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {d?.kpis.failedLogins != null && d.kpis.failedLogins > 0 && (
                <button
                  type="button"
                  onClick={() => handleNav("admin-logs")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {d.kpis.failedLogins} failed login{d.kpis.failedLogins === 1 ? "" : "s"} today
                </button>
              )}
              {d && d.kpis.failedLogins === null && isOwner && (
                <span
                  title="The failed-login check could not read this venue's login audit log."
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Login check unavailable
                </span>
              )}
              <RangeSelect value={range} onChange={setRange} />
            </div>
          </div>

          {/* Why the venue is not live, and what to do. Nothing when it is. */}
          {d && <LocationLivenessExplainer liveness={d.liveness} />}

          {isError && !d && (
            <div className={cn(CARD, "flex flex-col items-center gap-3 py-8 text-center")}>
              <p className="text-sm font-medium">Couldn't load this venue's live status</p>
              <p className="text-xs text-muted-foreground">
                Online guests, uptime, recent guests and alerts are unavailable right now.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {/* 2. KPI row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <KpiCard key={k.label} {...k} />
            ))}
          </div>

          {/* 3. Guests online · Devices by OS · Sessions by hour */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            <div className={cn(CARD, "p-5 md:col-span-2")}>
              <CardHead
                icon={<Users className="h-4 w-4" />}
                title="Guests Online"
                subtitle={`Guests connected ${byHour ? "each hour" : "each day"}, ${rangeLabel}`}
                right={<RangeSelect value={range} onChange={setRange} compact />}
              />
              <div className="h-64">
                {series.isLoading ? (
                  <ChartSkeleton />
                ) : series.isError ? (
                  <SeriesError onRetry={() => series.refetch()} />
                ) : noGuestActivity ? (
                  <ChartEmptyState label={`No guest activity ${rangeLabel}.`} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dash-online" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6C4EFF" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6C4EFF" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        strokeOpacity={0.6}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        interval={byHour ? 3 : "preserveStartEnd"}
                        minTickGap={12}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={40}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ stroke: "#6C4EFF", strokeOpacity: 0.3 }}
                        formatter={(v: unknown) => [
                          `${typeof v === "number" ? v : 0} guests`,
                          "Online",
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="online"
                        stroke="#6C4EFF"
                        strokeWidth={2.25}
                        fill="url(#dash-online)"
                        dot={(props: { cx?: number; cy?: number; index?: number }) =>
                          props.index === peakIdx && props.cx != null && props.cy != null ? (
                            <circle
                              key="peak"
                              cx={props.cx}
                              cy={props.cy}
                              r={5}
                              fill="#6C4EFF"
                              stroke="var(--card)"
                              strokeWidth={2}
                            />
                          ) : (
                            <g key={`d-${props.index}`} />
                          )
                        }
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className={cn(CARD, "p-5")}>
              <CardHead icon={<Laptop className="h-4 w-4" />} title="Devices by OS" />
              <div className="flex h-64 flex-col justify-center">
                {series.isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-3 animate-pulse rounded-full bg-muted" />
                    ))}
                  </div>
                ) : series.isError ? (
                  <SeriesError onRetry={() => series.refetch()} />
                ) : !s || s.osBreakdown.length === 0 ? (
                  <ChartEmptyState label={`No devices ${rangeLabel}.`} />
                ) : (
                  <div className="space-y-4">
                    {s.osBreakdown.map((o, i) => (
                      <div key={o.name}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-medium">{o.name}</span>
                          <span className="font-semibold tabular-nums text-muted-foreground">
                            {o.value.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(o.value / osMax) * 100}%`,
                              backgroundColor: OS_COLORS[i % OS_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={cn(CARD, "p-5")}>
              <CardHead
                icon={<Activity className="h-4 w-4" />}
                title={byHour ? "Sessions by Hour" : "Sessions by Day"}
                subtitle="New guest sessions"
              />
              <div className="h-64">
                {series.isLoading ? (
                  <ChartSkeleton />
                ) : series.isError ? (
                  <SeriesError onRetry={() => series.refetch()} />
                ) : noGuestActivity ? (
                  <ChartEmptyState label={`No sessions ${rangeLabel}.`} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dash-arrivals" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6C4EFF" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                        strokeOpacity={0.6}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        interval={byHour ? 3 : "preserveStartEnd"}
                        tickFormatter={(v: string) => (byHour ? v.slice(0, 2) : v)}
                        minTickGap={8}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={36}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                        formatter={(v: unknown) => [`${typeof v === "number" ? v : 0}`, "Sessions"]}
                      />
                      <Bar
                        dataKey="arrivals"
                        fill="url(#dash-arrivals)"
                        radius={[5, 5, 0, 0]}
                        maxBarSize={22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* 4. Bandwidth · Recent users · Recent alerts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-12">
            <div className="lg:col-span-2 xl:col-span-5 [&>div]:h-full">
              <BandwidthUtilizationCard
                locationId={locationId}
                onManage={() => handleNav("isp-details")}
              />
            </div>

            <div className={cn(CARD, "p-5 xl:col-span-4")}>
              <CardHead
                icon={<Users className="h-4 w-4" />}
                title="Recent Users"
                right={
                  <button
                    type="button"
                    onClick={() => handleNav("users")}
                    className="text-xs font-medium text-[#6C4EFF] hover:underline"
                  >
                    View all →
                  </button>
                }
              />
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : !d ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Couldn't load.</p>
              ) : d.recentUsers.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No guests have connected in the last 24 hours.
                </p>
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="px-1 pb-2 font-semibold">User</th>
                        <th className="px-1 pb-2 font-semibold">Device</th>
                        <th className="px-1 pb-2 font-semibold">Time</th>
                        <th className="px-1 pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recentUsers.slice(0, 5).map((u) => (
                        <tr key={u.id} className="border-t border-border/60">
                          <td className="max-w-[9rem] px-1 py-2.5">
                            <p className="truncate font-medium text-foreground">{u.name}</p>
                            {u.email && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {masked ? maskEmail(u.email) : u.email}
                              </p>
                            )}
                          </td>
                          <td className="max-w-[7rem] truncate px-1 py-2.5 text-muted-foreground">
                            {u.device}
                          </td>
                          <td className="whitespace-nowrap px-1 py-2.5 text-muted-foreground">
                            {u.time}
                          </td>
                          <td className="px-1 py-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  u.status === "online" ? "bg-emerald-500" : "bg-slate-400",
                                )}
                              />
                              {u.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className={cn(CARD, "p-5 xl:col-span-3")}>
              <CardHead
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Recent Alerts"
                right={
                  <button
                    type="button"
                    onClick={() => handleNav("alerts")}
                    className="text-xs font-medium text-[#6C4EFF] hover:underline"
                  >
                    View all →
                  </button>
                }
              />
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              ) : !d ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Couldn't load.</p>
              ) : d.recentAlerts.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No alerts. Nothing needs your attention.
                </p>
              ) : (
                <ul className="space-y-3">
                  {d.recentAlerts.map((a, i) => {
                    const Icon =
                      a.type === "error"
                        ? XCircle
                        : a.type === "warning"
                          ? AlertTriangle
                          : a.type === "success"
                            ? CheckCircle2
                            : Info;
                    const tint =
                      a.type === "error"
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                        : a.type === "warning"
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                          : a.type === "success"
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400";
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            tint,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-medium">{a.msg}</p>
                          <p className="text-[11px] text-muted-foreground">{a.time}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Real uplink health and hardware -- the detail behind the status
              bar's ISP and router figures. */}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <WanStatusCard locationId={locationId} onManage={() => handleNav("isp-details")} />
            <DeviceStatusCard locationId={locationId} onManage={() => handleNav("devices")} />
          </div>

          {/* 5. System status bar */}
          <div
            className={cn(
              "flex flex-col gap-3 rounded-2xl border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between",
              STATUS_BAR[isLoading ? "neutral" : tone].wrap,
            )}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className={cn("h-5 w-5", STATUS_BAR[isLoading ? "neutral" : tone].icon)}
              />
              <span className="text-sm font-semibold">
                {isLoading
                  ? "Checking systems…"
                  : tone === "live"
                    ? STATUS_BAR.live.title
                    : liveness.summary || STATUS_BAR[tone].title}
              </span>
            </div>
            {d && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    aria-hidden
                    className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                  />
                  <span className="opacity-70">System</span>
                  <span className="font-semibold">{d.health.systemHealth}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Router
                    aria-hidden
                    className={cn("h-3.5 w-3.5", CORE_ICON[livenessTone(d.liveness.state)])}
                  />
                  <span className="opacity-70">Routers</span>
                  <span className="font-semibold">{d.health.routersOnline}</span>
                </span>
                {/* No status tint: this names the active uplink, it is not a
                    health measurement -- the WAN card above carries that. */}
                <span className="inline-flex items-center gap-1.5">
                  <Activity aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="opacity-70">ISP</span>
                  <span className="font-semibold">{d.health.isp}</span>
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
      <ChangePasswordDialog open={changePwOpen} onOpenChange={setChangePwOpen} />
      <TwoFactorDialog open={tfaOpen} onOpenChange={setTfaOpen} />
      <CustomerCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantWidget />
    </SidebarProvider>
  );
}
