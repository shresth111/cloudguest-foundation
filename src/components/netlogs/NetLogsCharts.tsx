import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryLabel, chartDayLabel, type NetLogsChartRow } from "@/lib/netlogs";

/**
 * NetLogs' two small charts: volume per day stacked by category, and errors
 * (with warnings) per day. Bars, not areas: a day is a count, and a bar that
 * is zero is simply absent rather than bridged by a slope.
 *
 * Its own module, reached through `lazy()` from NetLogsView, so recharts is
 * fetched only when the page actually draws a chart (the same rule as
 * TrafficLensTimelineChart).
 */

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" } as const;
const NETLOGS_CHART_H = 180;

/** Fixed per category so a colour means the same thing on every visit. */
const CATEGORY_COLORS: Record<string, string> = {
  dhcp: "var(--chart-1)",
  hotspot_auth: "var(--chart-3)",
  radius: "var(--chart-4)",
  firewall: "oklch(0.62 0.19 25)",
  dns: "var(--chart-2)",
  system: "var(--chart-5)",
  wireless: "oklch(0.6 0.16 300)",
  other: "oklch(0.7 0.02 260)",
};

const ERROR_COLOR = "oklch(0.6 0.2 25)";
const WARNING_COLOR = "oklch(0.78 0.15 75)";

interface Band {
  key: string;
  label: string;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  bands,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number; payload?: NetLogsChartRow }[];
  bands: Band[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{chartDayLabel(row.day, row.lastDay)}</p>
      <ul className="mt-1 space-y-0.5">
        {bands
          .filter((b) => Number(row[b.key] ?? 0) > 0)
          .map((b) => (
            <li key={b.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: b.color }}
              />
              <span className="text-muted-foreground">{b.label}</span>
              <span className="ml-auto pl-3 tabular-nums">
                {Number(row[b.key] ?? 0).toLocaleString()}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function Legend({ bands }: { bands: Band[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {bands.map((b) => (
        <li key={b.key} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: b.color }} />
          {b.label}
        </li>
      ))}
    </ul>
  );
}

function StackedBars({
  rows,
  bands,
  label,
}: {
  rows: NetLogsChartRow[];
  bands: Band[];
  label: string;
}) {
  return (
    <div role="img" aria-label={label}>
      <Legend bands={bands} />
      <ResponsiveContainer width="100%" height={NETLOGS_CHART_H}>
        <BarChart data={rows} margin={{ left: 0, right: 4, top: 4, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tickFormatter={(d: string) => chartDayLabel(d)}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip bands={bands} />} />
          {bands.map((b) => (
            <Bar key={b.key} dataKey={b.key} stackId="n" fill={b.color} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetLogsVolumeChart({
  rows,
  categories,
}: {
  rows: NetLogsChartRow[];
  categories: string[];
}) {
  const bands = categories.map((c) => ({
    key: c,
    label: categoryLabel(c),
    color: CATEGORY_COLORS[c] ?? CATEGORY_COLORS.other,
  }));
  return <StackedBars rows={rows} bands={bands} label="Log lines per day, by category" />;
}

export function NetLogsErrorsChart({ rows }: { rows: NetLogsChartRow[] }) {
  const bands = [
    { key: "errors", label: "Errors", color: ERROR_COLOR },
    { key: "warnings", label: "Warnings", color: WARNING_COLOR },
  ];
  return <StackedBars rows={rows} bands={bands} label="Errors and warnings per day" />;
}
