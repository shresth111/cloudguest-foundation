import { KeyRound, Mail, MousePointerClick, Share2, Ticket, Building2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard } from "./ChartCard";
import { AXIS_STYLE, CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import type { AuthAnalytics } from "@/types/analytics";

interface Props {
  data?: AuthAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function AuthAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };
  const methods = data
    ? [
        { label: "OTP", value: data.methods.otp, icon: KeyRound },
        { label: "Voucher", value: data.methods.voucher, icon: Ticket },
        { label: "PMS", value: data.methods.pms, icon: Building2 },
        { label: "Social", value: data.methods.social, icon: Share2 },
        { label: "Email", value: data.methods.email, icon: Mail },
        { label: "Click-through", value: data.methods.clickThrough, icon: MousePointerClick },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {(isLoading || !data ? Array.from({ length: 6 }) : methods).map((m, i) => {
          if (isLoading || !data) return <Card key={i}><CardContent className="h-20" /></Card>;
          const method = m as { label: string; value: number; icon: typeof KeyRound };
          const Icon = method.icon;
          return (
            <Card key={method.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{method.label}</div>
                  <div className="text-lg font-semibold">{method.value}%</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Authentication success vs failure" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.successFailTrend ?? []}>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="success" stackId="a" fill={CHART_COLORS[1]} radius={[0, 0, 0, 0]} />
              <Bar dataKey="failure" stackId="a" fill={CHART_COLORS[4]} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Login trends" description="Total logins per day" {...state}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.loginTrends ?? []}>
              <defs>
                <linearGradient id="login" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeOpacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill="url(#login)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
