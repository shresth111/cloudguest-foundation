import { Cpu, MemoryStick, Radio, ShieldCheck, Thermometer, Wifi, WifiOff, Router as RouterIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "./ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import { cn } from "@/lib/utils";
import type { RouterAnalytics } from "@/types/analytics";

interface Props {
  data?: RouterAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

interface Stat {
  label: string;
  value: string;
  icon: typeof Cpu;
  tone: "default" | "success" | "warning" | "danger";
}

const toneClass: Record<Stat["tone"], string> = {
  default: "bg-muted/40 text-foreground",
  success: "bg-emerald-500/10 text-emerald-500",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-red-500/10 text-red-500",
};

export function RouterAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };
  const stats: Stat[] = data
    ? [
        { label: "Online", value: data.online.toLocaleString(), icon: RouterIcon, tone: "success" },
        { label: "Offline", value: data.offline.toLocaleString(), icon: WifiOff, tone: "danger" },
        { label: "CPU", value: `${data.avgCpu}%`, icon: Cpu, tone: data.avgCpu > 70 ? "warning" : "default" },
        { label: "Memory", value: `${data.avgMemory}%`, icon: MemoryStick, tone: data.avgMemory > 75 ? "warning" : "default" },
        { label: "Temperature", value: `${data.avgTemperature}°C`, icon: Thermometer, tone: data.avgTemperature > 65 ? "warning" : "default" },
        { label: "WAN availability", value: `${data.wanAvailability}%`, icon: Wifi, tone: "success" },
        { label: "WireGuard health", value: `${data.wireguardHealth}%`, icon: Radio, tone: "success" },
        { label: "RADIUS health", value: `${data.radiusHealth}%`, icon: ShieldCheck, tone: "success" },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 8 }).map((_, i) => <Card key={i}><CardContent className="h-20" /></Card>)
          : stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneClass[s.tone])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                      <div className="text-lg font-semibold">{s.value}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Router performance" description="Throughput vs latency" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.performance ?? []}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis yAxisId="l" tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="r" orientation="right" tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="l" type="monotone" dataKey="throughput" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="latency" stroke={CHART_COLORS[4]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CPU trend" description="Fleet average %" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.cpuTrend ?? []}>
              <defs>
                <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[2]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[2]} fill="url(#cpu)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Memory trend" description="Fleet average %" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.memoryTrend ?? []}>
              <defs>
                <linearGradient id="mem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[3]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[3]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[3]} fill="url(#mem)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Health score trend" description="Composite score" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.healthScoreTrend ?? []}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} domain={[70, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
