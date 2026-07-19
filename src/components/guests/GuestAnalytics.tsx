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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { useGuestAnalytics } from "@/hooks/useGuests";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#84cc16"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

export function GuestAnalytics() {
  const { data, isLoading, isError, refetch } = useGuestAnalytics();

  if (isError) return <ErrorState title="Failed to load analytics" onRetry={() => refetch()} />;
  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Daily Guests" subtitle="Unique guests connecting per day">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.dailyGuests}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Area type="monotone" dataKey="guests" stroke="#6366f1" fill="url(#g1)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Login Method Distribution" subtitle="Share of sessions by login type">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.loginMethodDist} dataKey="value" nameKey="method" innerRadius={45} outerRadius={80} paddingAngle={3}>
              {data.loginMethodDist.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Returning vs New Guests" subtitle="Loyalty split across all guests">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data.returningVsNew} dataKey="value" nameKey="name" outerRadius={80} label>
              {data.returningVsNew.map((_, i) => (
                <Cell key={i} fill={[COLORS[1], COLORS[2]][i]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Device Types" subtitle="Sessions by device category">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.deviceTypes}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top Locations" subtitle="Locations by active sessions">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.topLocations} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" fontSize={10} width={140} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="guests" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Peak Login Hours" subtitle="Logins by hour of day">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.peakHours}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="hour" fontSize={10} tickLine={false} axisLine={false} interval={2} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="logins" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Bandwidth Usage" subtitle="Download vs upload (GB/day)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bandwidth}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="downloadGb" name="Download" stackId="a" fill="#6366f1" radius={[6, 6, 0, 0]} />
            <Bar dataKey="uploadGb" name="Upload" stackId="a" fill="#f43f5e" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
