import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  MapPin,
  Router as RouterIcon,
  Users,
  Wifi,
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
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceScope } from "@/hooks/useWorkspace";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

function kFmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

export function DashboardWidgets() {
  const { customer, locations, activeLocation, activeLocationId } = useWorkspace();
  const { aggregated, scope } = useWorkspaceScope();

  const kpis = [
    {
      label: "Active guests",
      value: aggregated.analytics.activeGuests,
      hint: "Currently online",
      icon: Users,
    },
    {
      label: "Routers online",
      value: aggregated.routers.filter((r) => r.status === "online").length,
      hint: `of ${aggregated.routers.length} total`,
      icon: RouterIcon,
    },
    {
      label: "Daily sessions",
      value: aggregated.analytics.dailySessions,
      hint: "Last 24h",
      icon: Activity,
    },
    {
      label: "Data consumed",
      value: `${aggregated.analytics.dataConsumedGb} GB`,
      hint: "Rolling 24h",
      icon: Wifi,
    },
  ];

  const sessionTrend = Array.from({ length: 12 }, (_, i) => ({
    hour: `${i * 2}:00`,
    sessions:
      Math.round(
        (aggregated.analytics.dailySessions / 24) * (0.6 + Math.sin(i / 2) * 0.4 + i * 0.05),
      ) || 20,
  }));

  const perLocation = scope.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name,
    guests: s.resources?.analytics.activeGuests ?? 0,
    sessions: s.resources?.analytics.dailySessions ?? 0,
  }));

  const deviceBreakdown = aggregated.guests.reduce<Record<string, number>>((acc, g) => {
    acc[g.device] = (acc[g.device] ?? 0) + 1;
    return acc;
  }, {});
  const devicePie = Object.entries(deviceBreakdown).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="mt-2 text-2xl font-semibold">
                  {typeof k.value === "number" ? kFmt(k.value) : k.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <k.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
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
                <YAxis fontSize={11} />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Devices</CardTitle>
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
            {aggregated.guests.slice(0, 6).map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.device} · {g.mac}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{g.connectedAt}</p>
                  <p>{g.dataMb} MB</p>
                </div>
              </div>
            ))}
            {aggregated.guests.length === 0 && (
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
