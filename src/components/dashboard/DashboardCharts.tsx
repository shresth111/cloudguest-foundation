import {
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
import { useRevenueDashboard, useUnifiedDashboard } from "@/hooks/useDashboardData";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

const tooltipStyle = {
  background: "hsl(var(--popover, 0 0% 100%))",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 10px",
} as const;

/** Turn a snake_case/lowercase backend status key into a display label. */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Convert a status/plan -> count dict into recharts-friendly rows. */
function toChartData(record: Record<string, number> | undefined): { name: string; value: number }[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) => ({ name: formatLabel(key), value }));
}

export function RevenueChart() {
  const { data, isLoading, isError, refetch } = useRevenueDashboard(12);
  const trend = data?.trend ?? [];
  return (
    <WidgetCard
      title="Revenue trend"
      description="Net revenue by month"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && trend.length === 0}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--color-muted-foreground)"
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${v.toLocaleString()}`} />
            <Line type="monotone" dataKey="netAmount" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}

export function RouterHealthChart() {
  const { data, isLoading, isError, refetch } = useUnifiedDashboard();
  const platform = data?.platform;
  const pieData = platform
    ? [
        { name: "Online", value: platform.routersOnline, color: "#22c55e" },
        { name: "Offline", value: platform.routersOffline, color: "#ef4444" },
      ]
    : [];
  return (
    <WidgetCard
      title="Router health"
      description="Fleet status snapshot"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && !platform}
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

export function SubscriptionStatusChart() {
  const { data, isLoading, isError, refetch } = useRevenueDashboard(12);
  const chartData = toChartData(data?.subscriptionsByStatus);
  return (
    <WidgetCard
      title="Subscriptions by status"
      description="Active, trialing, past due & more"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && chartData.length === 0}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={95} label={{ fontSize: 11 }}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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

export function LicenseStatusChart() {
  const { data, isLoading, isError, refetch } = useUnifiedDashboard();
  const chartData = toChartData(data?.licenseStatusBreakdown);
  return (
    <WidgetCard
      title="License status"
      description="Organizations by license state"
      isLoading={isLoading}
      isError={isError}
      isEmpty={!isLoading && !isError && chartData.length === 0}
      onRetry={() => refetch()}
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
