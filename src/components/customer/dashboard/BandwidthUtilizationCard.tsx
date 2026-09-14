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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IspProviderIcon } from "@/components/icons/isp";
import { BlurFade } from "@/components/magicui/blur-fade";
import { ChartEmptyState } from "./ChartEmptyState";
import { WAN_HEALTH_STYLE } from "./dashboard.types";
import { useBandwidthSeries } from "./useBandwidthSeries";

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
  const utilizationPct =
    capacityDownload != null && capacityDownload > 0 && latest?.downloadMbps != null
      ? Math.round((latest.downloadMbps / capacityDownload) * 100)
      : null;

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

  return (
    <Card className="premium-card premium-card-hover">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Gauge className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm">Bandwidth Utilization</CardTitle>
            <p className="text-xs text-muted-foreground">
              Traffic on {bw.status === "ready" ? bw.link.providerName : "your primary uplink"}, new
              reading roughly every 30 sec
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <span className="hidden items-baseline gap-3 text-xs sm:flex">
              {latest.downloadMbps != null && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {latest.downloadMbps.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">Mbps ↓</span>
                </span>
              )}
              {latest.uploadMbps != null && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="font-semibold tabular-nums text-foreground">
                    {latest.uploadMbps.toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">Mbps ↑</span>
                </span>
              )}
              {utilizationPct != null && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-semibold tabular-nums",
                    utilizationPct >= 90
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                      : utilizationPct >= 70
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
                  )}
                  title={`${latest?.downloadMbps?.toFixed(1)} of ${capacityDownload} Mbps plan (as advertised by your ISP, not independently measured)`}
                >
                  {utilizationPct}% of plan
                </span>
              )}
            </span>
          )}
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
            Manage →
          </Button>
        </div>
      </CardHeader>
      {bw.status === "ready" && bw.otherLinks.length > 0 && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-1.5">
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
                    {l.currentDownloadMbps.toFixed(0)} Mbps↓
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
            "mx-4 mb-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
            congestionSummary.pct >= 30
              ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
              : congestionSummary.count > 0
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
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
      <CardContent>
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
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="bw-up" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    width={32}
                    domain={
                      capacityDownload != null
                        ? [0, (dataMax: number) => Math.max(dataMax, capacityDownload) * 1.1]
                        : [0, "auto"]
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                    formatter={(
                      value: number | string | Array<number | string> | undefined,
                      name: string | number,
                    ) => [
                      typeof value !== "number" ? "No reading" : `${value.toFixed(1)} Mbps`,
                      name === "download" ? "Download" : "Upload",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    name="download"
                    stroke="#14b8a6"
                    fill="url(#bw-down)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    name="upload"
                    stroke="#8b5cf6"
                    fill="url(#bw-up)"
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {capacityDownload != null && (
                    <ReferenceLine
                      y={capacityDownload}
                      stroke="#14b8a6"
                      strokeDasharray="5 4"
                      strokeOpacity={0.7}
                      label={{
                        value: `${capacityDownload} Mbps plan`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: "#14b8a6",
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
      </CardContent>
    </Card>
  );
}
