import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WidgetCard } from "./WidgetCard";
import {
  useAuthStats,
  useDailyActive,
  useDeviceDist,
  useGuestTrend,
  useMonthlyGrowth,
  useRevenue,
  useRouterHealth,
  useTopOrgs,
} from "@/hooks/useDashboardData";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

const tooltipStyle = {
  background: "hsl(var(--popover, 0 0% 100%))",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 10px",
} as const;

export function GuestConnectionsChart() {
  const { data, isLoading, isError, refetch } = useGuestTrend();
  return (
    <WidgetCard
      title="Guest connections"
      description="Last 30 days"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data ?? []}>
            <defs>
              <linearGradient id="guestGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#guestGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function RevenueChart() {
  const { data, isLoading, isError, refetch } = useRevenue();
  return (
    <WidgetCard
      title="Revenue trend"
      description="MRR by month"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Line type="monotone" dataKey="mrr" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function RouterHealthChart() {
  const { data, isLoading, isError, refetch } = useRouterHealth();
  const pieData = data
    ? [
        { name: "Online", value: data.online, color: "#22c55e" },
        { name: "Warning", value: data.warning, color: "#f59e0b" },
        { name: "Offline", value: data.offline, color: "#ef4444" },
      ]
    : [];
  return (
    <WidgetCard
      title="Router health"
      description="Fleet status snapshot"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && !data}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {pieData.map((s) => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function AuthStatsChart() {
  const { data, isLoading, isError, refetch } = useAuthStats();
  return (
    <WidgetCard
      title="Authentication success vs failed"
      description="Last 14 days"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="success" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function TopOrgsChart() {
  const { data, isLoading, isError, refetch } = useTopOrgs();
  return (
    <WidgetCard
      title="Top organizations by usage"
      description="Percent of platform bandwidth"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="usage" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function DeviceDistributionChart() {
  const { data, isLoading, isError, refetch } = useDeviceDist();
  return (
    <WidgetCard
      title="Device type distribution"
      description="Connected devices by category"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data ?? []} dataKey="value" nameKey="type" outerRadius={95} label={{ fontSize: 11 }}>
              {(data ?? []).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function DailyActiveChart() {
  const { data, isLoading, isError, refetch } = useDailyActive();
  return (
    <WidgetCard
      title="Daily active guests"
      description="Rolling 7 days"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function MonthlyGrowthChart() {
  const { data, isLoading, isError, refetch } = useMonthlyGrowth();
  return (
    <WidgetCard
      title="Monthly growth"
      description="Organizations & locations"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && (!data || data.length === 0)}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="orgs" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="locations" stroke={CHART_COLORS[2]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
