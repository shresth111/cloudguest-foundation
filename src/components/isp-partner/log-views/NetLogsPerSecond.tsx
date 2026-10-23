/**
 * NetLogs: events per second (founder ask 2026-10-23).
 *
 * One series over time -> a thin column per second in the console's primary
 * token, no legend (the title names it), recessive axis, a hover readout per
 * second, and total / peak tiles beside it. Minutes where the collector's
 * per-router throttle was reached are called out, so a flat top is never read
 * as the real rate. Data: GET /isp/logs/netlogs/per-second (same scope and
 * filters as the NetLogs list).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { MSeg, MStat } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { ExactRange, type ExactWindow } from "@/components/isp-partner/log-views/ExactRange";
import { formatNumber } from "@/lib/isp-partner/format";
import { formatClockSeconds } from "@/lib/isp-partner/time-seconds";
import {
  fetchNetLogsPerSecond,
  PER_SECOND_MAX_MS,
  type PerSecondWindow,
} from "@/services/isp-partner/netlogs-rate";

type Preset = "5" | "15" | "60" | "custom";

const W = 960;
const H = 180;
const PAD = { l: 40, r: 8, t: 8, b: 22 };

export function NetLogsPerSecond({ scope }: { scope: Record<string, string> }) {
  const [preset, setPreset] = useState<Preset>("15");
  const [custom, setCustom] = useState<ExactWindow | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const range: PerSecondWindow | null =
    preset === "custom"
      ? custom
        ? { kind: "custom", since: custom.since, until: custom.until }
        : null
      : { kind: "preset", minutes: Number(preset) as 5 | 15 | 60 };

  const q = useQuery({
    queryKey: ["isp", "logs", "netlogs-per-second", scope, range],
    queryFn: () => fetchNetLogsPerSecond(scope, range as PerSecondWindow),
    enabled: range !== null,
    refetchInterval: preset === "custom" ? false : 15_000,
  });

  const geo = useMemo(() => {
    const d = q.data;
    if (!d || d.counts.length === 0) return null;
    const n = d.counts.length;
    const max = Math.max(1, d.peak);
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const step = plotW / n;
    const barW = Math.max(1, step - (step > 3 ? 1 : 0));
    const start = new Date(d.since).getTime();
    const ticks = 6;
    return { n, max, plotW, plotH, step, barW, start, ticks };
  }, [q.data]);

  const d = q.data;
  const hoverAt = geo && hover !== null ? new Date(geo.start + hover * 1000) : null;

  return (
    <Card title="Events per second">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <MSeg<Preset>
          value={preset}
          onChange={setPreset}
          options={[
            { value: "5", label: "Last 5 min" },
            { value: "15", label: "Last 15 min" },
            { value: "60", label: "Last 60 min" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {preset === "custom" && (
          <ExactRange
            value={custom}
            onChange={setCustom}
            maxMs={PER_SECOND_MAX_MS}
            label="Up to 3 hours"
          />
        )}
      </div>
      {range === null && (
        <p className="text-sm text-muted-foreground">Pick a range down to the second.</p>
      )}
      {q.isLoading && range !== null && <LoadingBlock />}
      {q.isError && (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="events per second" />
      )}
      {d && !d.feature_enabled && (
        <p className="text-sm text-muted-foreground">
          Network logging is switched off on the platform, so there is nothing to count.
        </p>
      )}
      {d && d.feature_enabled && geo && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MStat label="Events in window" value={formatNumber(d.total)} />
            <MStat label="Peak per second" value={formatNumber(d.peak)} />
            <MStat label="Average per second" value={(d.total / Math.max(1, geo.n)).toFixed(2)} />
          </div>
          <div className="relative overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-48 w-full min-w-[480px]"
              role="img"
              aria-label={`Events per second, ${formatNumber(d.total)} total, peak ${d.peak}`}
              onMouseLeave={() => setHover(null)}
              onMouseMove={(e) => {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * W - PAD.l;
                const i = Math.floor(x / geo.step);
                setHover(i >= 0 && i < geo.n ? i : null);
              }}
            >
              {[0, 0.5, 1].map((f) => {
                const y = PAD.t + geo.plotH * (1 - f);
                return (
                  <g key={f}>
                    <line
                      x1={PAD.l}
                      x2={W - PAD.r}
                      y1={y}
                      y2={y}
                      className="stroke-border"
                      strokeWidth={1}
                    />
                    <text
                      x={PAD.l - 6}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {Math.round(geo.max * f)}
                    </text>
                  </g>
                );
              })}
              {d.counts.map((c, i) =>
                c === 0 ? null : (
                  <rect
                    key={i}
                    x={PAD.l + i * geo.step}
                    y={PAD.t + geo.plotH * (1 - c / geo.max)}
                    width={geo.barW}
                    height={(geo.plotH * c) / geo.max}
                    rx={geo.barW >= 4 ? 2 : 0}
                    className={hover === i ? "fill-foreground" : "fill-primary"}
                  />
                ),
              )}
              {Array.from({ length: geo.ticks + 1 }, (_, k) => {
                const i = Math.min(geo.n - 1, Math.round((k * (geo.n - 1)) / geo.ticks));
                return (
                  <text
                    key={k}
                    x={PAD.l + i * geo.step}
                    y={H - 6}
                    textAnchor={k === 0 ? "start" : k === geo.ticks ? "end" : "middle"}
                    className="fill-muted-foreground text-[10px]"
                  >
                    {formatClockSeconds(new Date(geo.start + i * 1000))}
                  </text>
                );
              })}
              {hover !== null && (
                <line
                  x1={PAD.l + hover * geo.step + geo.barW / 2}
                  x2={PAD.l + hover * geo.step + geo.barW / 2}
                  y1={PAD.t}
                  y2={PAD.t + geo.plotH}
                  className="stroke-muted-foreground"
                  strokeDasharray="2 2"
                />
              )}
            </svg>
            <p className="mt-1 h-4 text-xs text-muted-foreground" aria-live="polite">
              {hoverAt && hover !== null
                ? `${formatClockSeconds(hoverAt)} · ${formatNumber(d.counts[hover])} events`
                : "Hover the chart to read one second."}
            </p>
          </div>
          {d.throttled_minutes.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {d.throttled_minutes.length} minute(s) reached the collector&apos;s limit of{" "}
                {formatNumber(d.throttle_per_router_per_minute)} lines per router per minute. Lines
                above it are kept in the raw archive but not shown here, so the real rate was
                higher.
              </span>
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Times are when the platform received each line, to the second, in your time zone.
          </p>
        </div>
      )}
    </Card>
  );
}
