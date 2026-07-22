import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import {
  useAnalyticsOtpSuccessRate,
  useAnalyticsSummary,
  useAnalyticsTopDevices,
  useAnalyticsTopLocations,
} from "@/hooks/useGuests";

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/70 p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </Card>
  );
}

export function GuestAnalytics() {
  const summary = useAnalyticsSummary();
  const topLocations = useAnalyticsTopLocations();
  const topDevices = useAnalyticsTopDevices();
  const otpRate = useAnalyticsOtpSuccessRate();

  const isLoading =
    summary.isLoading || topLocations.isLoading || topDevices.isLoading || otpRate.isLoading;
  const isError = summary.isError || topLocations.isError || topDevices.isError || otpRate.isError;

  if (isError) {
    return (
      <ErrorState
        title="Failed to load analytics"
        onRetry={() => {
          summary.refetch();
          topLocations.refetch();
          topDevices.refetch();
          otpRate.refetch();
        }}
      />
    );
  }
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Visitors" value={(summary.data?.visitors ?? 0).toLocaleString()} />
        <StatCard
          label="Unique Guests"
          value={(summary.data?.uniqueGuests ?? 0).toLocaleString()}
        />
        <StatCard
          label="Returning Guests"
          value={(summary.data?.returningGuests ?? 0).toLocaleString()}
        />
        <StatCard
          label="OTP Success Rate"
          value={`${((otpRate.data?.successRate ?? 0) * 100).toFixed(0)}% (${otpRate.data?.successfulAttempts ?? 0}/${otpRate.data?.totalAttempts ?? 0})`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top Locations" subtitle="Locations by session count">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topLocations.data ?? []} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="locationName"
                fontSize={10}
                width={140}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="sessionCount" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Devices</CardTitle>
            <p className="text-xs text-muted-foreground">By session count</p>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto" style={{ maxHeight: 240 }}>
            {(topDevices.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No device data yet.</p>
            ) : (
              (topDevices.data ?? []).map((d) => (
                <div
                  key={d.deviceId}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{d.macAddress}</span>
                  <span className="text-muted-foreground">
                    {d.sessionCount} sessions · {d.uniqueGuestCount} guests
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
