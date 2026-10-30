import { AlertTriangle, Gauge } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { IspProviderIcon } from "@/components/icons/isp";
import { BlurFade } from "@/components/magicui/blur-fade";
import { ChartEmptyState } from "./ChartEmptyState";
import { WAN_HEALTH_STYLE } from "./dashboard.types";
import { useBandwidthSeries } from "./useBandwidthSeries";
import { Panel } from "@/components/customer/console";
import { CONSOLE_TOOLTIP_STYLE, PanelLink, PanelTitle } from "./overview/console-ui";
import { anchorAxisToPlan, formatMbps, utilizationLabel } from "./bandwidth-display";

/**
 * Bandwidth Utilization -- a live, rolling graph of this location's active
 * uplink's real traffic-load rate.
 */
export function BandwidthUtilizationCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const bw = useBandwidthSeries(locationId);
  // Legend toggles: hiding a series is a view choice, never a data change.
  const [hidden, setHidden] = useState({ download: false, upload: false });
  const ordered = bw.status === "ready" ? [...bw.checks].reverse() : [];
  const hasTraffic = ordered.some((c) => c.downloadMbps != null || c.uploadMbps != null);
  const chartData = ordered.map((c) => ({
    label: new Date(c.checkedAt).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
    download: c.downloadMbps,
    upload: c.uploadMbps,
  }));
  const latest =
    bw.status === "ready"
      ? bw.checks.find((c) => c.downloadMbps != null || c.uploadMbps != null)
      : undefined;
  const capacityDownload = bw.status === "ready" ? bw.link.downloadBandwidthMbps : null;
  const utilization = utilizationLabel(latest?.downloadMbps, capacityDownload);
  const utilizationPct = utilization?.pct ?? null;
  const dataMax = ordered.reduce<number | null>((m, c) => {
    const v = Math.max(c.downloadMbps ?? -Infinity, c.uploadMbps ?? -Infinity);
    return Number.isFinite(v) ? Math.max(m ?? 0, v) : m;
  }, null);
  const showPlanOnAxis = anchorAxisToPlan(dataMax, capacityDownload);

  const capacitySamples =
    capacityDownload != null && capacityDownload > 0
      ? ordered.filter((c) => c.downloadMbps != null)
      : [];
  const nearCapacityCount = capacitySamples.filter(
    (c) => (c.downloadMbps as number) / (capacityDownload as number) >= 0.9,
  ).length;
  const congestionSummary =
    capacitySamples.length >= 3
      ? {
          count: nearCapacityCount,
          total: capacitySamples.length,
          pct: Math.round((nearCapacityCount / capacitySamples.length) * 100),
        }
      : null;

  const toggle = (k: "download" | "upload") => setHidden((h) => ({ ...h, [k]: !h[k] }));
  return (
    <Panel
      flush
      className="h-full"
      title={<PanelTitle icon={<Gauge />}>Bandwidth Utilization</PanelTitle>}
      description={`${bw.status === "ready" ? bw.link.providerName : "Primary uplink"} · new reading about every 30 s`}
      actions={
        <>
          {utilizationPct != null && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                utilizationPct >= 90
                  ? "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]"
                  : utilizationPct >= 70
                    ? "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]"
                    : "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]",
              )}
              title={`${formatMbps(latest?.downloadMbps ?? null)} of ${capacityDownload} Mbps plan (as advertised by your ISP, not independently measured)`}
            >
              {utilization?.label} of plan
            </span>
          )}
          <PanelLink onClick={onManage}>Manage →</PanelLink>
        </>
      }
    >
      {latest && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3" aria-label="Series">
          {(
            [
              ["download", "Download", latest.downloadMbps, "var(--wy-series-2)", "↓"],
              ["upload", "Upload", latest.uploadMbps, "var(--wy-series-1)", "↑"],
            ] as const
          ).map(([key, label, value, color, arrow]) => (
            <button
              key={key}
              type="button"
              aria-pressed={!hidden[key]}
              onClick={() => toggle(key)}
              title={hidden[key] ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] px-2 py-1 text-xs transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
                hidden[key] && "opacity-45",
              )}
            >
              <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
              <span className="text-[var(--wy-text-muted)]">{label}</span>
              <span className="font-semibold tabular-nums">
                {value != null ? formatMbps(value) : "—"}
              </span>
              <span className="text-[var(--wy-text-faint)]">{arrow}</span>
            </button>
          ))}
        </div>
      )}
      {bw.status === "ready" && bw.otherLinks.length > 0 && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Also here
          </span>
          {bw.otherLinks.map((l) => {
            const style = WAN_HEALTH_STYLE[l.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
            return (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[11px]"
                title={`${l.providerName} (${l.role === "primary" ? "Primary" : "Backup"}) — ${style.label}`}
              >
                <IspProviderIcon providerName={l.providerName} className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[8rem] truncate font-medium text-foreground">
                  {l.providerName}
                </span>
                <span className="text-muted-foreground">
                  {l.role === "primary" ? "Primary" : "Backup"}
                </span>
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                <span className={cn("font-medium", style.text)}>{style.label}</span>
                {l.currentDownloadMbps != null && (
                  <span className="text-muted-foreground tabular-nums">
                    {formatMbps(l.currentDownloadMbps)}↓
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
      {congestionSummary && (
        <div
          className={cn(
            "mx-4 mt-3 flex items-start gap-2 rounded-[var(--wy-radius)] px-3 py-2 text-xs",
            congestionSummary.pct >= 30
              ? "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]"
              : congestionSummary.count > 0
                ? "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]"
                : "bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]",
          )}
        >
          <AlertTriangle
            className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", congestionSummary.count === 0 && "hidden")}
          />
          <span>
            {congestionSummary.count === 0 ? (
              <>
                Comfortably under {capacityDownload} Mbps across the last {congestionSummary.total}{" "}
                readings.
              </>
            ) : (
              <>
                Hit 90%+ of your {capacityDownload} Mbps plan in {congestionSummary.count} of the
                last {congestionSummary.total} readings ({congestionSummary.pct}%)
                {congestionSummary.pct >= 30
                  ? " — your guests are likely feeling this. Consider upgrading your plan."
                  : "."}
              </>
            )}
          </span>
        </div>
      )}
      <div className="px-4 pb-4 pt-3">
        <div className="h-56">
          {bw.status === "loading" ? (
            <div className="flex h-full items-end gap-1 px-2 pb-2" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-full animate-pulse rounded-t bg-muted"
                  style={{ height: `${20 + (i % 5) * 12}%` }}
                />
              ))}
            </div>
          ) : bw.status === "empty" ? (
            <ChartEmptyState label="No internet connection configured yet." />
          ) : !hasTraffic ? (
            <ChartEmptyState label="No bandwidth samples yet — the next health-check sweep runs within 60 seconds." />
          ) : (
            <BlurFade inView className="h-full w-full" blur="4px" offset={4}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bw-down" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--wy-series-2)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--wy-series-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bw-up" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--wy-series-1)" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="var(--wy-series-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--wy-border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--wy-border)" }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    domain={
                      showPlanOnAxis && capacityDownload != null
                        ? [0, (max: number) => Math.max(max, capacityDownload) * 1.1]
                        : [0, "auto"]
                    }
                  />
                  <Tooltip
                    contentStyle={CONSOLE_TOOLTIP_STYLE}
                    cursor={{ stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }}
                    formatter={(
                      value: number | string | Array<number | string> | undefined,
                      name: string | number,
                    ) => [
                      typeof value !== "number" ? "No reading" : formatMbps(value),
                      name === "download" ? "Download" : "Upload",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    name="download"
                    stroke="var(--wy-series-2)"
                    fill="url(#bw-down)"
                    hide={hidden.download}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    name="upload"
                    stroke="var(--wy-series-1)"
                    fill="url(#bw-up)"
                    hide={hidden.upload}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {showPlanOnAxis && capacityDownload != null && (
                    <ReferenceLine
                      y={capacityDownload}
                      stroke="var(--wy-series-2)"
                      strokeDasharray="5 4"
                      strokeOpacity={0.7}
                      label={{
                        value: `${capacityDownload} Mbps plan`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "var(--wy-series-2)",
                      }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </BlurFade>
          )}
        </div>
        {bw.status === "ready" && capacityDownload == null && (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Set {bw.link.providerName}'s plan speed to see utilization as a %.{" "}
            <button
              type="button"
              onClick={onManage}
              className="font-medium text-primary hover:underline"
            >
              Set it →
            </button>
          </p>
        )}
      </div>
    </Panel>
  );
}
