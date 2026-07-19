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
import { ChartCard } from "./ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import type { GuestAnalytics } from "@/types/analytics";

interface Props {
  data?: GuestAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function GuestAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Daily guests" description="Unique guest connections per day" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.daily ?? []}>
            <defs>
              <linearGradient id="daily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill="url(#daily)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Weekly guests" description="Total per week" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.weekly ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Monthly guests" description="Rolling twelve months" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.monthly ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="New vs returning" description="Daily split" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.newVsReturning ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="new" stackId="g" fill={CHART_COLORS[0]} radius={[0, 0, 0, 0]} />
            <Bar dataKey="returning" stackId="g" fill={CHART_COLORS[3]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Login method distribution"
        description={data ? `Success rate ${data.loginSuccessRate}%` : undefined}
        {...state}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data?.loginMethods ?? []} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {(data?.loginMethods ?? []).map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Peak login hours" description="Hour of day" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.peakHours ?? []}>
            <defs>
              <linearGradient id="peakH" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[4]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[4]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[4]} fill="url(#peakH)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top locations" description="By guest connections" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.topLocations ?? []} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeOpacity={0.15} horizontal={false} />
            <XAxis type="number" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} width={130} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="value" fill={CHART_COLORS[5]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Guest growth trend" description="Monthly growth" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.growthTrend ?? []}>
            <defs>
              <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[1]} fill="url(#growth)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
