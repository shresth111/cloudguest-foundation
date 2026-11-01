/**
 * The two range charts on the Overview -- Guests Online (area) and Sessions
 * by Hour/Day (bars) -- drawn by one component so they read as one system.
 *
 * Data: exactly the `useDashboardSeries` buckets the page already holds
 * (`/guest-analytics/dashboard-series`), passed in -- this file fetches
 * nothing and adds nothing. Interactions:
 *   - hover: dashed crosshair + tooltip (Recharts)
 *   - click a bucket, or focus the plot and use the arrow keys: pins it and
 *     reads it out below the plot; Esc / Clear unpins
 * X is keyed by bucket INDEX, not label: a rolling 24h window starts and ends
 * on the same clock hour, so labels repeat.
 */
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import i18n from "@/lib/i18n";
import { bucketLabel } from "@/lib/dashboard-range";
import type { DashboardSeries } from "@/services/customer.service";
import { CONSOLE_TOOLTIP_STYLE } from "./console-shared";
import { intlLocale } from "@/lib/format";

export interface ActivityPoint {
  i: number;
  label: string;
  bucketStart: string;
  online: number;
  arrivals: number;
}

export function SeriesChart({
  points,
  field,
  kind,
  byHour,
  seriesLabel,
  summary,
  color,
  testId,
}: {
  points: ActivityPoint[];
  field: "online" | "arrivals";
  kind: "area" | "bar";
  byHour: boolean;
  /** Series name for tooltip and readout, e.g. "Online". */
  seriesLabel: string;
  /** Screen-reader summary of the whole chart. */
  summary: string;
  color: string;
  testId?: string;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  const [pinned, setPinned] = useState<number | null>(null);
  const readoutId = useId();
  const gradId = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const peakIdx = useMemo(
    () => points.reduce((best, p, i) => (p[field] > (points[best]?.[field] ?? -1) ? i : best), 0),
    [points, field],
  );
  const pin = pinned != null && pinned < points.length ? points[pinned] : null;
  const labelOf = (i: number) => points[i]?.label ?? "";

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

  const common = {
    data: points,
    margin: { top: 16, right: 6, left: -6, bottom: 0 },
    onClick: (st: { activeTooltipIndex?: number } | null) => {
      const idx = st?.activeTooltipIndex;
      if (typeof idx === "number") setPinned((p) => (p === idx ? null : idx));
    },
    style: { cursor: "pointer" },
  };
  const axes = [
    <CartesianGrid key="grid" vertical={false} stroke="var(--wy-border)" />,
    <XAxis
      key="x"
      dataKey="i"
      type="category"
      tickFormatter={(i: number) => {
        const l = labelOf(i);
        return byHour && kind === "bar" ? l.slice(0, 2) : l;
      }}
      tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
      tickLine={false}
      axisLine={{ stroke: "var(--wy-border)" }}
      interval={byHour ? 3 : "preserveStartEnd"}
      minTickGap={8}
    />,
    <YAxis
      key="y"
      tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
      tickLine={false}
      axisLine={false}
      allowDecimals={false}
      width={38}
    />,
    <Tooltip
      key="tip"
      contentStyle={CONSOLE_TOOLTIP_STYLE}
      cursor={
        kind === "bar"
          ? { fill: "var(--wy-surface-2)" }
          : { stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }
      }
      labelFormatter={(i: number) => labelOf(i)}
      formatter={(v: unknown) => [
        typeof v === "number" ? v.toLocaleString(intlLocale()) : "—",
        seriesLabel,
      ]}
    />,
    pin ? <ReferenceLine key="pin" x={pin.i} stroke="var(--wy-accent)" strokeWidth={1.5} /> : null,
  ];

  return (
    <div className="flex h-full flex-col" data-testid={testId}>
      <div
        role="group"
        tabIndex={0}
        aria-label={summary}
        aria-describedby={readoutId}
        title={t("activity.hint", "Click a bar to pin it")}
        onKeyDown={onKey}
        className="min-h-0 flex-1 rounded-[var(--wy-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
      >
        <ResponsiveContainer width="100%" height="100%">
          {kind === "area" ? (
            <AreaChart {...common}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              {axes}
              <Area
                type="monotone"
                dataKey={field}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--wy-surface)" }}
                isAnimationActive={false}
              />
              {points[peakIdx] && points[peakIdx][field] > 0 && (
                <ReferenceDot
                  x={peakIdx}
                  y={points[peakIdx][field]}
                  r={4}
                  fill={color}
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
            </AreaChart>
          ) : (
            <BarChart {...common}>
              {axes}
              <Bar dataKey={field} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false}>
                {points.map((p) => (
                  <Cell
                    key={p.i}
                    fill={color}
                    fillOpacity={pin ? (p.i === pin.i ? 1 : 0.35) : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <div
        id={readoutId}
        aria-live="polite"
        className="mt-2 flex min-h-6 items-center gap-2 truncate text-xs text-[var(--wy-text-muted)]"
      >
        {pin ? (
          <>
            <span className="font-semibold text-[var(--wy-text)]">{pin.label}</span>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            <span>{seriesLabel}</span>
            <span className="font-semibold tabular-nums text-[var(--wy-text)]">
              {pin[field].toLocaleString(intlLocale())}
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
          <span className="truncate">
            {t("activity.peakAt", {
              value: (points[peakIdx]?.[field] ?? 0).toLocaleString(intlLocale()),
              when: labelOf(peakIdx),
              defaultValue: "Peak {{value}} at {{when}}",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
