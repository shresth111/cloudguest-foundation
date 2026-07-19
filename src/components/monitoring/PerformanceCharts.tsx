import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { usePerformanceSeries } from "@/hooks/useMonitoring";
import type { TimePoint } from "@/types/monitoring";

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short" });

export function PerformanceCharts() {
  const { data, isLoading, isError, refetch } = usePerformanceSeries();
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={refetch} />;

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <AreaCard title="CPU usage (%)" data={data.cpu} color="#0EA5E9" />
      <AreaCard title="Memory usage (%)" data={data.memory} color="#8B5CF6" />
      <AreaCard title="Bandwidth (Mbps)" data={data.bandwidth} color="#10B981" />
      <LineCard title="Internet latency (ms)" data={data.latency} color="#F59E0B" />
      <LineCard title="Packet loss (%)" data={data.packetLoss} color="#EF4444" />
      <AreaCard title="Connected guests" data={data.guests} color="#0EA5E9" />
      <LineCard title="Router health score" data={data.healthScore} color="#10B981" />
      <BarCard title="Daily uptime (%)" data={data.dailyUptime} color="#10B981" />
      <BarCard title="Weekly uptime (%)" data={data.weeklyUptime} color="#8B5CF6" tickFormatter={formatDate} />
    </div>
  );
}

interface ChartProps {
  title: string;
  data: TimePoint[];
  color: string;
  tickFormatter?: (v: string) => string;
}

function AreaCard({ title, data, color, tickFormatter = formatTime }: ChartProps) {
  const id = title.replace(/\s+/g, "-");
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent style={{ height: 220 }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={tickFormatter} />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v) => new Date(v as string).toLocaleString()} />
            <Area dataKey="value" stroke={color} fill={`url(#${id})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function LineCard({ title, data, color, tickFormatter = formatTime }: ChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent style={{ height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={tickFormatter} />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v) => new Date(v as string).toLocaleString()} />
            <Line dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function BarCard({ title, data, color, tickFormatter = formatTime }: ChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent style={{ height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={tickFormatter} />
            <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" domain={[90, 100]} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(v) => new Date(v as string).toLocaleString()} />
            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
