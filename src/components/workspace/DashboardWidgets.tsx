import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Globe,
  Megaphone,
  MapPin,
  Router as RouterIcon,
  ShieldCheck,
  Ticket,
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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, SectionHeader } from "@/components/ui-ext";
import type { StatTone } from "@/components/ui-ext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceScope } from "@/hooks/useWorkspace";
import { rbacService } from "@/services/rbac.service";
import { campaignService } from "@/services/campaign.service";
import { billingService } from "@/services/billing.service";
import { monitoringService } from "@/services/monitoring.service";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

/** The backend's session payload carries no guest identifier, so fall back to
 *  a short, stable reference rather than rendering an empty line. */
function guestLabel(s: { guestIdentifier: string | null; guestId: string }): string {
  return s.guestIdentifier?.trim() || `Guest ${s.guestId.slice(0, 8)}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Real, org-scoped counts this dashboard's own KPI row needs but that
 * useWorkspace()/useWorkspaceScope() don't already provide: total staff
 * users, active campaigns, and the org's own active subscription/license.
 * Each is a genuinely real backend call -- fetched here rather than
 * fabricated, and each degrades to an honest "—" (not a fake number) if
 * its query hasn't resolved yet or the org has none.
 */
function useOwnerKpis(organizationId: string | undefined, organizationName: string | undefined) {
  const usersQ = useQuery({
    queryKey: ["workspace-kpi", "users", organizationId],
    queryFn: () => rbacService.listUsers({ page: 1, pageSize: 1 }),
    enabled: !!organizationId,
  });

  const campaignsQ = useQuery({
    queryKey: ["workspace-kpi", "campaigns", organizationId],
    queryFn: () => campaignService.listAll(),
    enabled: !!organizationId,
  });

  // GET /billing/dashboard/me, not /billing/dashboard/super-admin. The
  // super-admin snapshot is billing.read at GLOBAL scope, so it 403s for
  // every real venue owner (leaving this tile permanently "—" and retrying
  // three times per mount) and, for a global-scope operator, fans out across
  // every organization on the platform from a customer-facing page.
  const billingQ = useQuery({
    queryKey: ["workspace-kpi", "billing", organizationId],
    queryFn: () => billingService.getMyBillingDashboard(organizationId!, organizationName ?? ""),
    enabled: !!organizationId,
    retry: false,
  });

  const alertsQ = useQuery({
    queryKey: ["workspace-kpi", "alerts", organizationId],
    queryFn: () =>
      monitoringService.listAlerts({
        organizationId,
        status: "triggered",
        page: 1,
        pageSize: 50,
      }),
    enabled: !!organizationId,
  });

  const activeCampaigns = campaignsQ.data?.filter((c) => c.status === "active").length;
  const openAlerts = alertsQ.data?.totalItems;

  return {
    isLoading: usersQ.isLoading || campaignsQ.isLoading || billingQ.isLoading || alertsQ.isLoading,
    totalUsers: usersQ.data?.totalItems,
    activeCampaigns,
    activeLicense: billingQ.data?.plan.name,
    openAlerts,
    // A failed KPI request has to be distinguishable from one still in
    // flight -- otherwise a 403 leaves the tile shimmering forever.
    usersFailed: usersQ.isError,
    campaignsFailed: campaignsQ.isError,
    licenseFailed: billingQ.isError,
    alertsFailed: alertsQ.isError,
  };
}

export function DashboardWidgets() {
  const { customer, locations, activeLocation, activeLocationId } = useWorkspace();
  const { aggregated, scope, isError: scopeFailed, refetchFailed } = useWorkspaceScope();
  const owner = useOwnerKpis(customer?.organizationId, customer?.organizationName);

  const onlineRouters = aggregated.routers.filter((r) => r.status === "online").length;
  const offlineRouters = aggregated.routers.length - onlineRouters;
  const todayGuests = aggregated.guestSessions.filter(
    (g) => new Date(g.startedAt).getTime() >= startOfToday(),
  );
  // Key on guestId. The session payload carries no identifier, so keying on
  // guestIdentifier collapsed every row into one empty string and made this
  // tile read 1 for any venue with a session today and 0 otherwise.
  const newGuestsToday = new Set(todayGuests.map((g) => g.guestId)).size;

  // A real, derived signal -- not a fabricated score. Router online-ratio
  // plus open-alert count, the only two real health inputs this workspace
  // actually has (see the module docstring on RouterDetailTabs' own
  // monitoring-tab gap: no live CPU/RAM/bandwidth endpoint exists yet).
  const routerRatio = aggregated.routers.length ? onlineRouters / aggregated.routers.length : 1;
  const systemHealth: "healthy" | "degraded" | "critical" =
    routerRatio === 1 && (owner.openAlerts ?? 0) === 0
      ? "healthy"
      : routerRatio >= 0.7
        ? "degraded"
        : "critical";

  const kpis: Array<{
    label: string;
    value: number | string | undefined;
    hint: string;
    icon: typeof MapPin;
    tone: StatTone;
  }> = [
    {
      label: activeLocationId === "all" ? "Total locations" : "Location",
      value: activeLocationId === "all" ? locations.length : (activeLocation?.name ?? "—"),
      hint: `${customer?.organizationName ?? "your org"}`,
      icon: MapPin,
      tone: "primary",
    },
    {
      label: "Active routers",
      value: onlineRouters,
      hint: `of ${aggregated.routers.length} total`,
      icon: RouterIcon,
      tone: "info",
    },
    {
      label: "Online guests",
      value: aggregated.analytics.activeSessions,
      hint: "Currently connected",
      icon: Users,
      tone: "success",
    },
    {
      label: "Today's logins",
      value: newGuestsToday,
      hint: "Unique guests since midnight",
      icon: Clock,
      tone: "default",
    },
    {
      label: "Total users",
      value: owner.usersFailed ? "—" : owner.totalUsers,
      hint: "Organization staff · org-wide",
      icon: ShieldCheck,
      tone: "default",
    },
    {
      label: "Active campaigns",
      value: owner.campaignsFailed ? "—" : owner.activeCampaigns,
      hint: "Currently running · org-wide",
      icon: Megaphone,
      tone: "warning",
    },
    {
      label: "License",
      value: owner.licenseFailed ? "—" : (owner.activeLicense ?? "—"),
      hint: "Active plan · org-wide",
      icon: Ticket,
      tone: "info",
    },
    {
      label: "Guest sessions",
      value: aggregated.analytics.totalSessions,
      hint: "Recent sessions",
      icon: Activity,
      tone: "default",
    },
  ];

  // A real histogram of the sessions in scope, bucketed by the hour they
  // started. This replaces a sine wave applied to an all-time session total,
  // which floored at a fabricated 20 per bucket and so drew a busy chart for
  // a venue that had never had a guest.
  const sessionTrend = (() => {
    const now = new Date();
    const buckets = Array.from({ length: 12 }, (_, i) => {
      const end = new Date(now.getTime() - (11 - i) * 2 * 60 * 60 * 1000);
      return {
        hour: `${String(end.getHours()).padStart(2, "0")}:00`,
        from: end.getTime() - 2 * 60 * 60 * 1000,
        to: end.getTime(),
        sessions: 0,
      };
    });
    for (const s of aggregated.guestSessions) {
      const t = new Date(s.startedAt).getTime();
      const b = buckets.find((x) => t > x.from && t <= x.to);
      if (b) b.sessions += 1;
    }
    return buckets.map(({ hour, sessions }) => ({ hour, sessions }));
  })();
  const sessionTrendEmpty = sessionTrend.every((b) => b.sessions === 0);

  // "Recent" has to mean recent: the aggregate concatenates locations in scope
  // order, so the first six rows were whichever location loaded first, in
  // whatever order the API returned them.
  const recentSessions = [...aggregated.guestSessions]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 6);

  const perLocation = scope.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name,
    guests: s.resources?.analytics.activeSessions ?? 0,
    sessions: s.resources?.analytics.totalSessions ?? 0,
  }));

  const methodBreakdown = aggregated.guestSessions.reduce<Record<string, number>>((acc, g) => {
    acc[g.authMethod] = (acc[g.authMethod] ?? 0) + 1;
    return acc;
  }, {});
  const devicePie = Object.entries(methodBreakdown).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Dashboard overview"
        description="Unified view of your locations, guests, routers, and revenue."
      />

      {/* Some locations failed to load. Every total below is then a partial
          view, so say so rather than presenting the reduced numbers as the
          real ones -- which is what a silently-empty result used to do. */}
      {scopeFailed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm">
            Some locations couldn&apos;t be loaded, so the figures below are incomplete.
          </p>
          <Button size="sm" variant="outline" onClick={() => refetchFailed()}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) =>
          k.value === undefined ? (
            <Card key={k.label} className="rounded-2xl border-border/70 shadow-sm">
              <CardContent className="space-y-2 p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ) : (
            <StatCard
              key={k.label}
              label={k.label}
              value={k.value}
              hint={k.hint}
              tone={k.tone}
              icon={k.icon}
            />
          ),
        )}
      </div>

      {/* Network overview */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Network overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            label="Connected routers"
            value={onlineRouters}
            tone="green"
            icon={CheckCircle2}
          />
          <HealthCard
            label="Offline routers"
            value={offlineRouters}
            tone={offlineRouters > 0 ? "red" : "green"}
            icon={XCircle}
          />
          <HealthCard
            label="System health"
            value={
              systemHealth === "healthy"
                ? "Healthy"
                : systemHealth === "degraded"
                  ? "Degraded"
                  : "Critical"
            }
            tone={
              systemHealth === "healthy" ? "green" : systemHealth === "degraded" ? "yellow" : "red"
            }
            icon={systemHealth === "healthy" ? ShieldCheck : AlertTriangle}
            hint={
              owner.openAlerts !== undefined
                ? `${owner.openAlerts} open alert${owner.openAlerts === 1 ? "" : "s"}`
                : undefined
            }
          />
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Last sync</p>
                <p className="truncate text-sm font-medium">
                  {aggregated.routers.length && aggregated.routers.some((r) => r.lastSeenAt)
                    ? new Date(
                        Math.max(
                          ...aggregated.routers
                            .filter((r) => r.lastSeenAt)
                            .map((r) => new Date(r.lastSeenAt as string).getTime()),
                        ),
                      ).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          CPU, memory, disk and uptime aren't shown here yet — the backend only records a
          self-reported heartbeat today, not live device metrics.
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Session trend (24h)</CardTitle>
            <Badge variant="secondary">
              {activeLocationId === "all" ? "All locations" : activeLocation?.name}
            </Badge>
          </CardHeader>
          <CardContent className="h-72">
            {sessionTrendEmpty ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No guest sessions started in the last 24 hours.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sessionTrend}>
                  <defs>
                    <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="hour" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sessions"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gSessions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Login methods</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={devicePie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {devicePie.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location comparison</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perLocation}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="guests" fill="#22c55e" radius={4} />
              <Bar dataKey="sessions" fill="#6366f1" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSessions.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{guestLabel(g)}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {g.authMethod.replace(/_/g, " ")} · {g.ipAddress ?? "—"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{new Date(g.startedAt).toLocaleString()}</p>
                  <p>{g.dataMb.toFixed(1)} MB</p>
                </div>
              </div>
            ))}
            {aggregated.guestSessions.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent guests.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/workspace/locations">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Manage locations ({locations.length})
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/workspace/routers">
                <span className="flex items-center gap-2">
                  <RouterIcon className="h-4 w-4" /> View routers
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/workspace/guests">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Live guests
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link to="/workspace/billing">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Billing · {customer?.subscription.plan}
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const TONE_STYLES = {
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
} as const;

function HealthCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone: "green" | "yellow" | "red";
  icon: typeof CheckCircle2;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn("flex h-9 w-9 items-center justify-center rounded-lg", TONE_STYLES[tone])}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
