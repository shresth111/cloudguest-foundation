import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_BODY_H } from "@/components/master/chart-layout";
import {
  FLOW_OTHER_COLOR,
  FLOW_OTHER_KEY,
  FLOW_SERIES_COLORS,
  flowRate,
  serviceLabel,
  timelineTickLabel,
  type TimelineSlot,
} from "@/lib/traffic-flow";
import type { FlowTimelineSeries } from "@/types/traffic-flow";

/**
 * The Traffic Lens timeline: rate over time as stacked bars, either one band
 * per service plus "Other", or download and upload.
 *
 * Bars rather than an area on purpose. An area joins its neighbours, so a
 * step with no data would be bridged by a slope that was never measured; a
 * bar that is not drawn is simply absent. Every step of the range has a slot
 * on the axis (see `timelineSlots`), so a missing step is a visible blank.
 *
 * Not a route file, and reached through `lazy()` from the venue view, so
 * recharts stays off the route's critical path (see PlatformOverviewCharts
 * for the measurements behind that rule).
 *
 * Colours are the Master theme's chart tokens in a fixed order. They are one
 * hue, so identity never rests on colour alone: the legend above the plot,
 * the tooltip and the Services table all name each band.
 */

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" } as const;

export type TimelineMode = "service" | "direction";

interface Band {
  key: string;
  label: string;
  color: string;
}

const DIRECTION_BANDS: Band[] = [
  { key: "down", label: "Download", color: FLOW_SERIES_COLORS[0] },
  { key: "up", label: "Upload", color: FLOW_SERIES_COLORS[1] },
];

function bandsFor(mode: TimelineMode, series: FlowTimelineSeries[]): Band[] {
  if (mode === "direction") return DIRECTION_BANDS;
  return [
    ...series.slice(0, FLOW_SERIES_COLORS.length).map((s, i) => ({
      key: s.key,
      label: serviceLabel(s),
      color: FLOW_SERIES_COLORS[i],
    })),
    { key: FLOW_OTHER_KEY, label: "Other", color: FLOW_OTHER_COLOR },
  ];
}

type Row = { t: number } & Record<string, number | null>;

function rowsFor(mode: TimelineMode, slots: TimelineSlot[]): Row[] {
  return slots.map((s) => {
    // A key left out of the row draws nothing: that is the gap.
    if (mode === "direction") return s.measured ? { t: s.t, down: s.down, up: s.up } : { t: s.t };
    return s.services ? { t: s.t, ...s.services } : { t: s.t };
  });
}

function TimelineTooltip({
  active,
  label,
  payload,
  bands,
  rangeMs,
}: {
  active?: boolean;
  label?: number;
  payload?: { dataKey?: string | number; value?: number | null }[];
  bands: Band[];
  rangeMs: number;
}) {
  if (!active || typeof label !== "number") return null;
  const byKey = new Map((payload ?? []).map((p) => [String(p.dataKey), p.value]));
  const measured = bands.some((b) => typeof byKey.get(b.key) === "number");
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{timelineTickLabel(label, rangeMs)}</p>
      {!measured ? (
        <p className="mt-1 text-muted-foreground">Not measured for this step.</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {bands.map((b) => (
            <li key={b.key} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: b.color }}
              />
              <span className="text-muted-foreground">{b.label}</span>
              <span className="ml-auto pl-3 tabular-nums">{flowRate(byKey.get(b.key))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TrafficFlowTimelineChart({
  slots,
  series,
  mode,
  rangeMs,
}: {
  slots: TimelineSlot[];
  series: FlowTimelineSeries[];
  mode: TimelineMode;
  rangeMs: number;
}) {
  const bands = bandsFor(mode, series);
  const rows = rowsFor(mode, slots);
  const drawable =
    mode === "direction" ? slots.some((s) => s.measured) : slots.some((s) => s.services !== null);

  if (!drawable) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-border"
        style={{ height: CHART_BODY_H }}
      >
        <p className="px-4 text-center text-xs text-muted-foreground">
          {mode === "service"
            ? "The records for this period carried no protocol or port, so there is no per-service timeline. Not measured, not zero."
            : "No step in this period has data."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {bands.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: b.color }} />
            {b.label}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={CHART_BODY_H}>
        <BarChart data={rows} margin={{ left: 4, right: 6, top: 6, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="t"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            tickFormatter={(t: number) => timelineTickLabel(t, rangeMs)}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => flowRate(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)" }}
            content={<TimelineTooltip bands={bands} rangeMs={rangeMs} />}
          />
          {bands.map((b) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              stackId="rate"
              fill={b.color}
              fillOpacity={b.key === FLOW_OTHER_KEY ? 0.35 : 1}
              stroke="var(--card)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
