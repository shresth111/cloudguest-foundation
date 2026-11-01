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

const AXIS_TICK = { fontSize: 10, fill: "var(--wy-text-faint)" } as const;
const NETLOGS_CHART_H = 180;

/** Fixed per category so a colour means the same thing on every visit.
 * The console's categorical series (`--wy-series-1..6`, assigned in a fixed
 * order, docs/design/console-tokens.md), never the status colours: the old
 * set painted Firewall red and RADIUS green, so a category read as an alarm
 * or an all-clear (design review §2 issue 6). The two categories past the
 * sixth are neutral greys, distinct from each other and labelled in the
 * legend and the tooltip. */
const CATEGORY_COLORS: Record<string, string> = {
  dhcp: "var(--wy-series-1)",
  hotspot_auth: "var(--wy-series-2)",
  radius: "var(--wy-series-3)",
  firewall: "var(--wy-series-4)",
  dns: "var(--wy-series-5)",
  system: "var(--wy-series-6)",
  wireless: "var(--wy-offline)",
  other: "var(--wy-border-strong)",
};

/** The errors chart IS a status chart (errors vs warnings), so it wears the
 * status tokens -- the one place on this page they mean what they say. */
const ERROR_COLOR = "var(--wy-crit)";
const WARNING_COLOR = "var(--wy-warn)";

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
    <div className="rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-3 py-2 text-xs text-[var(--wy-text)] shadow-lg">
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
              <span className="text-[var(--wy-text-muted)]">{b.label}</span>
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
    <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--wy-text-muted)]">
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
          <CartesianGrid stroke="var(--wy-border)" vertical={false} />
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
          <Tooltip
            cursor={{ fill: "var(--wy-surface-2)" }}
            content={<ChartTooltip bands={bands} />}
          />
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
