import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_BODY_H } from "@/components/master/chart-layout";
import type { PlanDistribution, PlanTier, RevenuePoint } from "@/types/billing";

/**
 * The two bar charts on the Master Console's Platform Overview (`/master`),
 * pulled out of `master.index.tsx` so `recharts` is behind a dynamic import
 * instead of on that route's critical path.
 *
 * WHY, with numbers. `recharts` and its d3-* / react-smooth dependents are
 * pinned into their own `vendor-2-charts` chunk (see vite.config.ts's long
 * chunking comment for the guest-portal incident that pinning exists for).
 * That chunk is 408KB raw / 104KB gzip. While `master.index.tsx` imported
 * recharts at module top level, `vendor-2-charts` was a STATIC import of the
 * route chunk -- 28% of the route's 1470KB raw critical path -- so the browser
 * had to fetch, parse and execute the entire charting library before the page
 * could paint its heading, its KPI numbers or its tables, none of which are
 * charts. Behind `lazy()` the route paints first and the chart chunk arrives in
 * parallel, which is strictly better here because the chart's DATA is the real
 * long pole anyway (a `/billing/dashboard/super-admin` round trip): the chunk
 * has always landed well before there is anything to plot.
 *
 * The plot height comes from `chart-layout.ts`, shared with the caller's
 * reserved placeholder, and that file explains why it is a separate module
 * rather than an export from here (importing it from here statically re-hoists
 * this whole chunk back onto the route's critical path).
 *
 * This file is deliberately NOT a route file. Per vite.config.ts's wrinkle #2,
 * a non-`Route` export living in a route module gets pulled into that route's
 * statically-imported registration chunk, which is exactly how recharts once
 * leaked into the entry chunk that the guest captive portal downloads.
 */

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" } as const;

/** Operator-facing names for the raw backend PlanType values. Only used for the
 * category axis and the tooltip -- the underlying tier strings stay the
 * backend's own, so nothing here has to be mapped back. */
const TIER_LABEL: Record<PlanTier, string> = {
  free_trial: "Trial",
  starter: "Starter",
  professional: "Pro",
  business: "Business",
  enterprise: "Enterprise",
  msp: "MSP",
  custom: "Custom",
};

/**
 * What a chart shows when the endpoint answered 200 and the answer was
 * "nothing".
 *
 * Both charts on this page render at a fixed body height, and an empty recharts
 * BarChart at that height is two grid rules and blank space -- which reads as a
 * broken widget, not as "no data". Saying so plainly is the whole point: the
 * alternative this codebase has actually shipped before (a Math.sin() session
 * curve with a `|| 20` floor) invented numbers to make a chart look busy, and
 * an operator cannot tell an invented trend from a real one.
 */
function ChartEmpty({ message }: { message: string }) {
  return (
    <div
      className="flex w-full items-center justify-center rounded-lg border border-dashed border-border"
      style={{ height: CHART_BODY_H }}
    >
      <p className="px-4 text-center text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

const TOOLTIP_CONTENT_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
  boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)",
} as const;

export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
  // The backend returns one point per calendar month that has at least one
  // captured payment (BillingDashboardRepository.revenue_by_month) -- it does
  // NOT zero-fill the window, so a platform that has taken no payments yet gets
  // an empty list rather than twelve zeroes. Both are legitimately "no revenue
  // to plot"; neither is an error, and neither should be padded into a flat
  // line that implies twelve months of confirmed zero revenue.
  if (data.length === 0) {
    return <ChartEmpty message="No revenue recorded yet." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_BODY_H}>
      <BarChart data={data} margin={{ left: -18, right: 6, top: 6, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} labelStyle={{ fontWeight: 600 }} />
        <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PlanTierChart({ data }: { data: PlanDistribution[] }) {
  // `data` always carries one entry per backend PlanType, subscribers or not
  // (planDistributionFrom maps over the fixed tier list), so "is it empty" is a
  // question about the counts, never about the array's length.
  if (data.every((d) => d.count === 0)) {
    return <ChartEmpty message="No subscriptions on any plan tier yet." />;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_BODY_H}>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 6, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="tier"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(tier: PlanTier) => TIER_LABEL[tier] ?? tier}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={TOOLTIP_CONTENT_STYLE} />
        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
