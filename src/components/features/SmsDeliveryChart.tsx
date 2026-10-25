import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Info } from "lucide-react";
import {
  deliveryReportsNotice,
  smsChartSeries,
  type SmsDeliveryReport,
} from "@/lib/sms-delivery-report";

/**
 * Daily SMS outcomes as one stacked column per day (part-to-whole of that
 * day's attempts). Colours come from CSS variables set on the wrapper so the
 * dark-mode steps are their own validated values, not an automatic flip; see
 * SMS_OUTCOMES in lib/sms-delivery-report.ts. The table under it is the
 * accessible / exact view of the same numbers.
 */

const CHART_H = 240;
const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" } as const;

// Tailwind arbitrary properties: light value, then the .dark override.
const VAR_CLASSES =
  "[--sms-delivered:#0ca30c] [--sms-awaiting_dlr:#b5b3ab] [--sms-sent:#b5b3ab] " +
  "[--sms-failed:#d03b3b] [--sms-undelivered:#ec835a] " +
  "dark:[--sms-awaiting_dlr:#8a8983] dark:[--sms-sent:#8a8983]";

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

type Series = ReturnType<typeof smsChartSeries>[number];

function DayTooltip({
  active,
  label,
  payload,
  series,
}: {
  active?: boolean;
  label?: string;
  payload?: {
    dataKey?: string | number;
    value?: number | null;
    payload?: Record<string, number>;
  }[];
  series: readonly Series[];
}) {
  if (!active || !label) return null;
  const row = payload?.[0]?.payload ?? {};
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {[...series].reverse().map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ background: `var(--sms-${s.key})` }}
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto pl-3 tabular-nums text-foreground">{row[s.key] ?? 0}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 border-t border-border pt-0.5">
          <span className="text-muted-foreground">Attempted</span>
          <span className="ml-auto pl-3 tabular-nums font-medium text-foreground">
            {row.attempted ?? 0}
          </span>
        </li>
      </ul>
    </div>
  );
}

export function SmsDeliveryChart({ report }: { report: SmsDeliveryReport }) {
  const series = smsChartSeries(report);
  const notice = deliveryReportsNotice(report);
  const hasAny = report.totals.attempted > 0;

  return (
    <div className={VAR_CLASSES}>
      {notice && (
        <div
          role="note"
          className="mb-4 flex items-start gap-2 rounded-lg border border-dashed border-input bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium text-foreground">{notice.title}.</span> {notice.body}
          </span>
        </div>
      )}
      {!hasAny ? (
        <div
          className="mb-4 flex w-full items-center justify-center rounded-lg border border-dashed border-border"
          style={{ height: CHART_H }}
        >
          <p className="px-4 text-center text-xs text-muted-foreground">
            No SMS were sent for this venue in this period.
          </p>
        </div>
      ) : (
        <div className="mb-4">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-sm"
                  style={{ background: `var(--sms-${s.key})` }}
                />
                {s.label}
              </li>
            ))}
          </ul>
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={report.days}
              margin={{ left: 0, right: 6, top: 6, bottom: 0 }}
              barCategoryGap="20%"
              accessibilityLayer
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={16}
                tickFormatter={shortDate}
              />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                content={<DayTooltip series={series} />}
              />
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="sms"
                  fill={`var(--sms-${s.key})`}
                  // 2px surface gap between stacked segments, never a border.
                  stroke="var(--card)"
                  strokeWidth={2}
                  maxBarSize={24}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
