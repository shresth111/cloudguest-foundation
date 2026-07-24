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
import { ChartCard } from "@/components/analytics/ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "@/components/analytics/chart-theme";
import type { RevenueAnalytics } from "@/types/billing";

interface Props {
  data?: RevenueAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function RevenueAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Revenue trend" description="Monthly recurring revenue over time" {...state} isEmpty={!data?.trend?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.trend ?? []}>
            <defs>
              <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `₹${v.toLocaleString()}`} />
            <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS[0]} fill="url(#rev-fill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly growth" description="% change month-over-month" {...state} isEmpty={!data?.trend?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.trend ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            <Bar dataKey="growth" radius={[6, 6, 0, 0]}>
              {(data?.trend ?? []).map((d, i) => (
                <Cell key={i} fill={d.growth >= 0 ? CHART_COLORS[1] : CHART_COLORS[4]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Subscription distribution" description="Active subscriptions by status" {...state} isEmpty={!data?.subscriptionDistribution?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Pie data={data?.subscriptionDistribution ?? []} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {(data?.subscriptionDistribution ?? []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Plan distribution" description="Subscribers and revenue by tier" {...state} isEmpty={!data?.planDistribution?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.planDistribution ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="tier" tick={AXIS_STYLE} interval={0} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[6, 6, 0, 0]} name="Subscribers" />
            <Bar dataKey="revenue" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Payment success rate" description="Success vs failed payments" {...state} isEmpty={!data?.paymentSuccessRate?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.paymentSuccessRate ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="success" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="failed" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Churn rate" description="Monthly churn %" {...state} isEmpty={!data?.churnRate?.length}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.churnRate ?? []}>
            <defs>
              <linearGradient id="churn-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[4]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_COLORS[4]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={AXIS_STYLE} />
            <YAxis tick={AXIS_STYLE} tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[4]} fill="url(#churn-fill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
