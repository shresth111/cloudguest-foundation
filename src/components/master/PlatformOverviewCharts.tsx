import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_BODY_H } from "@/components/master/chart-layout";
import type { PlanDistribution, RevenuePoint } from "@/types/billing";

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

const TOOLTIP_CONTENT_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
  boxShadow: "0 4px 16px -4px rgb(0 0 0 / 0.12)",
} as const;

export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
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
  return (
    <ResponsiveContainer width="100%" height={CHART_BODY_H}>
      <BarChart data={data} margin={{ left: -22, right: 6, top: 6, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="tier" tick={AXIS_TICK} tickLine={false} axisLine={false} />
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
