/**
 * Guests online + new sessions for the page's selected range, one chart.
 *
 * Data: exactly the `useDashboardSeries` buckets the page already holds
 * (`/guest-analytics/dashboard-series`), passed in -- this component fetches
 * nothing. Interactions:
 *   - hover: crosshair + tooltip (Recharts)
 *   - click a bucket, or focus the plot and use the arrow keys: pins that
 *     bucket and shows its readout below; Esc / "Clear" unpins
 *   - legend chips toggle each series (a view choice, not a data change)
 * X is keyed by bucket INDEX, not label: a rolling 24h window starts and ends
 * on the same clock hour, so labels repeat.
 */
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { bucketLabel } from "@/lib/dashboard-range";
import type { DashboardSeries } from "@/services/customer.service";
import { CONSOLE_TOOLTIP_STYLE } from "./console-ui";

type Key = "online" | "arrivals";

const COLOR: Record<Key, string> = {
  online: "var(--wy-series-1)",
  arrivals: "var(--wy-series-2)",
};

export interface ActivityPoint {
  i: number;
  label: string;
  bucketStart: string;
  online: number;
  arrivals: number;
}

/** Pure: buckets -> chart rows. Drops nothing, invents nothing. */
export function toActivityPoints(s: DashboardSeries | undefined): ActivityPoint[] {
  if (!s || !Array.isArray(s.series)) return [];
  return s.series.map((b, i) => ({
    i,
    label: bucketLabel(b.bucketStart, s.bucket ?? "hour"),
    bucketStart: b.bucketStart,
    online: Number.isFinite(b.online) ? b.online : 0,
    arrivals: Number.isFinite(b.arrivals) ? b.arrivals : 0,
  }));
}

export function ActivityChart({
  points,
  byHour,
  rangeLabel,
}: {
  points: ActivityPoint[];
  byHour: boolean;
  rangeLabel: string;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  const [hidden, setHidden] = useState<Record<Key, boolean>>({ online: false, arrivals: false });
  const [pinned, setPinned] = useState<number | null>(null);
  const readoutId = useId();

  const peakIdx = useMemo(
    () => points.reduce((best, p, i) => (p.online > (points[best]?.online ?? -1) ? i : best), 0),
    [points],
  );
  const totals = useMemo(
    () => ({
      arrivals: points.reduce((a, p) => a + p.arrivals, 0),
      peak: points[peakIdx]?.online ?? 0,
    }),
    [points, peakIdx],
  );

  const pin = pinned != null && pinned < points.length ? points[pinned] : null;
  const labelOf = (i: number) => points[i]?.label ?? "";

  const series: { key: Key; label: string }[] = [
    { key: "online", label: t("activity.online", "Guests online") },
    { key: "arrivals", label: t("activity.arrivals", "New sessions") },
  ];

  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return;
    const cur = pinned ?? (e.key === "ArrowLeft" ? points.length : -1);
    let next: number | null = cur;
    if (e.key === "ArrowRight") next = Math.min(points.length - 1, cur + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, cur - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = points.length - 1;
    else if (e.key === "Escape") next = null;
    else return;
    e.preventDefault();
    setPinned(next);
  };

  const summary = t("activity.srSummary", {
    range: rangeLabel,
    peak: totals.peak,
    when: labelOf(peakIdx),
    sessions: totals.arrivals,
    defaultValue:
      "Guest activity, {{range}}. Peak {{peak}} guests online at {{when}}. {{sessions}} new sessions in total. Use the arrow keys to read each bucket.",
  });

  return (
    <div data-testid="activity-chart">
      <div
        className="mb-2 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={t("activity.legend", "Series")}
      >
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={!hidden[s.key]}
            onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--wy-text-muted)] transition-opacity duration-150 hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
              hidden[s.key] && "opacity-45",
            )}
          >
            <span
              className={cn("h-2 w-2", s.key === "online" ? "rounded-full" : "rounded-[2px]")}
              style={{ background: COLOR[s.key] }}
            />
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[var(--wy-text-faint)]">
          {t("activity.hint", "Click a bar to pin it")}
        </span>
      </div>

      <div
        role="group"
        tabIndex={0}
        aria-label={summary}
        aria-describedby={readoutId}
        onKeyDown={onKey}
        className="h-60 rounded-[var(--wy-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 20, right: -8, left: -16, bottom: 0 }}
            onClick={(st: { activeTooltipIndex?: number } | null) => {
              const idx = st?.activeTooltipIndex;
              if (typeof idx === "number") setPinned((p) => (p === idx ? null : idx));
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke="var(--wy-border)" />
            <XAxis
              dataKey="i"
              type="category"
              tickFormatter={(i: number) => {
                const l = labelOf(i);
                return byHour ? l.slice(0, 2) : l;
              }}
              tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--wy-border)" }}
              interval={byHour ? 2 : "preserveStartEnd"}
              minTickGap={8}
            />
            <YAxis
              yAxisId="online"
              tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <YAxis
              yAxisId="arrivals"
              orientation="right"
              tick={{ fontSize: 10, fill: "var(--wy-series-2)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
              hide={hidden.arrivals}
            />
            <Tooltip
              contentStyle={CONSOLE_TOOLTIP_STYLE}
              cursor={{
                stroke: "var(--wy-border-strong)",
                strokeDasharray: "3 3",
                fill: "transparent",
              }}
              labelFormatter={(i: number) => labelOf(i)}
              formatter={(v: unknown, name: string) => [
                typeof v === "number" ? v.toLocaleString() : "—",
                name === "online" ? series[0].label : series[1].label,
              ]}
            />
            {pin && (
              <ReferenceLine
                yAxisId="online"
                x={pin.i}
                stroke="var(--wy-accent)"
                strokeWidth={1.5}
              />
            )}
            <Bar
              yAxisId="arrivals"
              dataKey="arrivals"
              name="arrivals"
              fill={COLOR.arrivals}
              fillOpacity={0.32}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              hide={hidden.arrivals}
              isAnimationActive={false}
            />
            <Line
              yAxisId="online"
              type="monotone"
              dataKey="online"
              name="online"
              stroke={COLOR.online}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--wy-surface)" }}
              hide={hidden.online}
              isAnimationActive={false}
            />
            {!hidden.online && points[peakIdx] && points[peakIdx].online > 0 && (
              <ReferenceDot
                yAxisId="online"
                x={peakIdx}
                y={points[peakIdx].online}
                r={4}
                fill={COLOR.online}
                stroke="var(--wy-surface)"
                strokeWidth={2}
                label={{
                  value: t("activity.peak", "Peak"),
                  position: "top",
                  fontSize: 10,
                  fill: "var(--wy-text-muted)",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div
        id={readoutId}
        aria-live="polite"
        className="mt-2 flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)] px-3 py-1.5 text-xs"
        data-testid="activity-readout"
      >
        {pin ? (
          <>
            <span className="font-semibold">{pin.label}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLOR.online }} />
              <span className="text-[var(--wy-text-muted)]">{series[0].label}</span>
              <span className="font-semibold tabular-nums">{pin.online.toLocaleString()}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: COLOR.arrivals }} />
              <span className="text-[var(--wy-text-muted)]">{series[1].label}</span>
              <span className="font-semibold tabular-nums">{pin.arrivals.toLocaleString()}</span>
            </span>
            <button
              type="button"
              onClick={() => setPinned(null)}
              className="ml-auto rounded px-1 text-[11px] font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
            >
              {t("activity.clear", "Clear")}
            </button>
          </>
        ) : (
          <span className="text-[var(--wy-text-muted)]">
            {t("activity.peakLine", {
              peak: totals.peak.toLocaleString(),
              when: labelOf(peakIdx),
              defaultValue: "Peak {{peak}} online at {{when}}",
            })}
            {" · "}
            {t("activity.totalSessions", {
              count: totals.arrivals,
              formatted: totals.arrivals.toLocaleString(),
              defaultValue_one: "{{formatted}} new session",
              defaultValue_other: "{{formatted}} new sessions",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
