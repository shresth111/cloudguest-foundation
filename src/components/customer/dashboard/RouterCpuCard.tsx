import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Cpu } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useFormat } from "@/lib/useFormat";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/customer/console";
import { PanelLink, PanelTitle } from "./overview/console-ui";
import { CONSOLE_TOOLTIP_STYLE } from "./overview/console-shared";
import type { DashboardRange } from "@/lib/dashboard-range";
import { useRouterCpu, type RouterCpuData, type RouterCpuRouter } from "./useRouterCpu";

/**
 * Dashboard "Router CPU" card: processor use over the page's selected range
 * for each MikroTik router at the venue, with the current reading beside
 * each chart. One request (`useRouterCpu`); the series is downsampled by
 * the backend.
 *
 * Renders nothing at all when the venue has no MikroTik router (the
 * owner's call: no "not reported" rows for Omada or Aruba equipment, which
 * never report CPU), and nothing while the first read is in flight, so a
 * venue without one never sees a card appear and vanish. A MikroTik with
 * no recent reading says "Not reported" -- never a stale number shown as
 * current, never 0%.
 *
 * Read-only: nothing here talks to a router.
 */

const SERIES = "var(--wy-series-1)";
const CHART_HEIGHT = 120;

function axisProps() {
  return { tick: { fontSize: 10, fill: "var(--wy-text-faint)" }, tickLine: false } as const;
}

export function RouterCpuCard({
  locationId,
  range,
  rangeLabel,
  enabled,
  onOpenDevices,
}: {
  locationId: string;
  range: DashboardRange;
  /** Mid-sentence range wording the page already computed ("last 24 hours"). */
  rangeLabel: string;
  /** False at venues that cannot have a MikroTik: no request, no card. */
  enabled: boolean;
  onOpenDevices: () => void;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  const q = useRouterCpu(locationId, range, enabled);

  if (!enabled || q.isLoading) return null;
  if (!q.isError && (!q.data || q.data.routers.length === 0)) return null;

  return (
    <Panel
      title={<PanelTitle icon={<Cpu />}>{t("routerCpu.title", "Router CPU")}</PanelTitle>}
      description={t("routerCpu.subtitle", "Processor use, {{range}}", { range: rangeLabel })}
      actions={
        <PanelLink onClick={onOpenDevices}>{t("routerCpu.openDevices", "Devices →")}</PanelLink>
      }
    >
      <div data-testid="router-cpu-card">
        {q.isError || !q.data ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center" role="alert">
            <p className="text-xs text-[var(--wy-text-muted)]">
              {t("routerCpu.error", "Couldn't load router CPU.")}
            </p>
            <Button variant="outline" size="sm" onClick={q.refetch}>
              {t("retry", "Retry")}
            </Button>
          </div>
        ) : (
          <RouterCpuList data={q.data} range={range} />
        )}
      </div>
    </Panel>
  );
}

function RouterCpuList({ data, range }: { data: RouterCpuData; range: DashboardRange }) {
  const { t } = useTranslation("dashboard", { i18n });
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-[var(--wy-border)]">
        {data.routers.map((r) => (
          <li key={r.router_id} className="py-3 first:pt-0 last:pb-0">
            <RouterCpuRow router={r} high={data.high_cpu_percent} range={range} />
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--wy-text-faint)]">
        <Cpu aria-hidden className="h-3 w-3" />
        {t("routerCpu.gaps", "Gaps mean no reading was taken, not zero usage.")}
      </p>
    </div>
  );
}

function RouterCpuRow({
  router,
  high,
  range,
}: {
  router: RouterCpuRouter;
  high: number;
  range: DashboardRange;
}) {
  const { t } = useTranslation("dashboard", { i18n });
  const fmt = useFormat();
  const latest = router.latest;
  const current = latest && !latest.is_stale && latest.cpu_usage_percent != null ? latest : null;
  const isHigh = current != null && (current.cpu_usage_percent ?? 0) >= high;

  const chart = router.points.map((p, i) => ({
    i,
    label: range === "24h" ? fmt.time(p.bucket_start) : fmt.dateTime(p.bucket_start),
    cpu: p.cpu_avg,
    peak: p.cpu_max,
  }));

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium" title={router.router_name}>
          {router.router_name}
        </p>
        {current ? (
          <>
            <p
              className={cn(
                "mt-1 font-display text-2xl font-bold tabular-nums tracking-[-0.03em]",
                isHigh ? "text-[var(--wy-warn)]" : "text-[var(--wy-text)]",
              )}
              data-testid="router-cpu-current"
            >
              {`${Math.round(current.cpu_usage_percent ?? 0)}%`}
            </p>
            {isHigh && (
              <p className="text-[11px] font-medium text-[var(--wy-warn)]">
                {t("routerCpu.high", "High load")}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-[var(--wy-text-muted)]">
              {current.memory_usage_percent != null
                ? t("routerCpu.memory", "Memory {{value}}%", {
                    value: Math.round(current.memory_usage_percent),
                  })
                : t("routerCpu.memoryNotReported", "Memory not reported")}
            </p>
            <p className="text-[11px] text-[var(--wy-text-faint)]">
              {t("routerCpu.updated", "Updated {{when}}", {
                when: fmt.relative(current.recorded_at, { style: "short" }),
              })}
            </p>
          </>
        ) : (
          <>
            <p
              className="mt-1 text-sm font-semibold text-[var(--wy-text-muted)]"
              data-testid="router-cpu-not-reported"
            >
              {t("routerCpu.notReported", "Not reported")}
            </p>
            <p className="text-[11px] text-[var(--wy-text-faint)]">
              {latest
                ? t("routerCpu.lastReading", "Last reading {{when}}", {
                    when: fmt.when(latest.recorded_at),
                  })
                : t("routerCpu.noReadingYet", "No reading from this router yet")}
            </p>
          </>
        )}
      </div>

      {chart.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border)] text-xs text-[var(--wy-text-faint)]"
          style={{ height: CHART_HEIGHT }}
        >
          {t("routerCpu.noPoints", "No readings in this period.")}
        </div>
      ) : (
        <div
          style={{ height: CHART_HEIGHT }}
          role="img"
          aria-label={t("routerCpu.chartLabel", "Processor use over time for {{name}}", {
            name: router.router_name,
          })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--wy-border)" />
              <XAxis
                dataKey="i"
                type="category"
                tickFormatter={(i: number) => chart[i]?.label ?? ""}
                interval="preserveStartEnd"
                minTickGap={48}
                axisLine={{ stroke: "var(--wy-border)" }}
                {...axisProps()}
              />
              <YAxis width={40} domain={[0, 100]} unit="%" axisLine={false} {...axisProps()} />
              <ReferenceLine y={high} stroke="var(--wy-warn)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={CONSOLE_TOOLTIP_STYLE}
                cursor={{ stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }}
                labelFormatter={(i: number) => chart[i]?.label ?? ""}
                formatter={(value: unknown, name: unknown) => [
                  typeof value === "number"
                    ? `${value.toFixed(0)}%`
                    : t("routerCpu.noReading", "No reading"),
                  name === "peak" ? t("routerCpu.peak", "Peak") : t("routerCpu.average", "Average"),
                ]}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                name="cpu"
                stroke={SERIES}
                fill={SERIES}
                fillOpacity={0.14}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="peak"
                name="peak"
                stroke={SERIES}
                strokeOpacity={0.55}
                strokeDasharray="3 3"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
