import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import type { NetworkAnalytics } from "@/types/analytics";

interface Props {
  data?: NetworkAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function NetworkAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Bandwidth usage" description="Download vs upload (Mbps)" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.bandwidth ?? []}>
            <defs>
              <linearGradient id="dl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="ul" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="download" stroke={CHART_COLORS[0]} fill="url(#dl)" strokeWidth={2} />
            <Area type="monotone" dataKey="upload" stroke={CHART_COLORS[1]} fill="url(#ul)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Peak bandwidth hours" description="Aggregate Mbps by hour" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.peakBandwidthHours ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="value" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Internet utilization" description="% of capacity" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.internetUtilization ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Router health score" description="Fleet average" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.routerHealthScore ?? []}>
            <defs>
              <linearGradient id="hs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[4]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[4]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[70, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[4]} fill="url(#hs)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Packet loss" description="Average % per day" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data?.packetLoss ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
            <Bar dataKey="value" fill={CHART_COLORS[6]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Latency" description="Average ms" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data?.latency ?? []}>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[5]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Uptime trend" description="% uptime" className="xl:col-span-2" {...state}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.uptime ?? []}>
            <defs>
              <linearGradient id="ut" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeOpacity={0.15} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[95, 100]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[1]} fill="url(#ut)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
