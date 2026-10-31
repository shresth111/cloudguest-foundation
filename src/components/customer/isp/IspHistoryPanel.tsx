/**
 * History for every line at once: availability strips, then latency, packet
 * loss and throughput as three synced small charts on one time axis.
 *
 * Data: the backend's bucketed `/health-checks/summary` per link (hourly for
 * 24h/7d, daily for 30d) -- see `useIspSummaries`. Incident bands are the
 * buckets whose own counts say checks failed (or a fifth were degraded),
 * merged when adjacent: `incidentsFromSummary`. Nothing is interpolated: a
 * bucket with no reading is a gap, not a zero.
 *
 * Interaction: hover = shared crosshair + tooltip across all three charts
 * (Recharts `syncId`); legend buttons toggle each ISP; click a band, a red
 * strip cell or an incident chip to pin that window and read it out below.
 * Esc clears. Keyboard: every control is a real button.
 */
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, AlertTriangle, RotateCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, SegmentedControl } from "@/components/customer/console";
import { CONSOLE_TOOLTIP_STYLE } from "@/components/customer/dashboard/overview/console-ui";
import type { IspHealthCheckSummary, IspLink } from "@/types/isp";
import {
  incidentsFromSummary,
  mergeHistory,
  uptimePercent,
  type HistoryRow,
  type Incident,
} from "./isp-model";
import { fmtClock, fmtDuration, fmtNum, ispColor, STATUS_BG, useIspT } from "./isp-ui";
import type { IspRange } from "./isp.demo";
import type { Loadable } from "./useIspHistory";

type Metric = "lat" | "loss" | "down";

export function IspHistoryPanel({
  links,
  summaries,
  range,
  onRangeChange,
  onRetry,
  hidden,
  onToggle,
  healthChecksApply,
}: {
  links: IspLink[];
  summaries: Record<string, Loadable<IspHealthCheckSummary>>;
  range: IspRange;
  onRangeChange: (r: IspRange) => void;
  onRetry: () => void;
  hidden: Set<string>;
  onToggle: (linkId: string) => void;
  /** False for a controller-managed venue: no health sweep runs there. */
  healthChecksApply: boolean;
}) {
  const { t, i18n: inst } = useIspT();
  const lang = inst.language;
  const [selected, setSelected] = useState<string | null>(null);
  const readoutId = useId();

  const states = links.map((l) => summaries[l.id] ?? { status: "loading" as const });
  const loading = states.some((s) => s.status === "loading");
  const failed = links.filter((_, i) => states[i].status === "error");
  const ready = states.map((s) => (s.status === "ready" ? s.data : null));
  const unit = ready.find(Boolean)?.bucketUnit ?? (range === "30d" ? "day" : "hour");
  const unitMs = unit === "day" ? 86_400_000 : 3_600_000;

  const rows = mergeHistory(ready);
  const incidents = links
    .flatMap((l, i) => {
      const s = ready[i];
      return s ? incidentsFromSummary(l.id, s) : [];
    })
    .sort((a, b) => b.start.localeCompare(a.start));
  const visibleIncidents = incidents.filter((x) => !hidden.has(x.linkId));
  const sel = incidents.find((x) => x.id === selected) ?? null;
  const totalChecks = ready.reduce(
    (s, r) => s + (r ? r.buckets.reduce((a, b) => a + b.totalChecks, 0) : 0),
    0,
  );
  const linkName = (id: string) => links.find((l) => l.id === id)?.providerName ?? "";
  const tickFmt = (ms: number) =>
    unit === "day"
      ? new Date(ms).toLocaleDateString(lang, { month: "short", day: "numeric" })
      : range === "24h"
        ? new Date(ms).toLocaleTimeString(lang, { hour: "numeric" })
        : new Date(ms).toLocaleString(lang, { weekday: "short", hour: "numeric" });
  const windowFmt = (x: Incident) =>
    `${fmtClock(x.start, lang)} – ${fmtClock(x.end, lang)} · ${fmtDuration(new Date(x.end).getTime() - new Date(x.start).getTime())}`;

  const pickAt = (ms: number | undefined) => {
    if (ms == null) return;
    const hit = visibleIncidents.find(
      (x) => ms >= new Date(x.start).getTime() && ms < new Date(x.end).getTime(),
    );
    setSelected((cur) => (hit ? (cur === hit.id ? null : hit.id) : null));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && selected) {
      e.preventDefault();
      setSelected(null);
    }
  };

  const rangeControl = (
    <SegmentedControl<IspRange>
      ariaLabel={t("history.range", "Time range")}
      value={range}
      onChange={(r) => {
        setSelected(null);
        onRangeChange(r);
      }}
      options={[
        { value: "24h", label: "24h", ariaLabel: t("history.r24h", "Last 24 hours") },
        { value: "7d", label: "7d", ariaLabel: t("history.r7d", "Last 7 days") },
        { value: "30d", label: "30d", ariaLabel: t("history.r30d", "Last 30 days") },
      ]}
    />
  );

  let body: ReactNode;
  if (loading && rows.length === 0) {
    body = (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]"
          />
        ))}
      </div>
    );
  } else if (failed.length === links.length) {
    body = (
      <EmptyState
        compact
        icon={AlertTriangle}
        title={t("history.errorTitle", "Couldn't load the history")}
        description={t(
          "history.errorBody",
          "Something went wrong fetching health-check history -- your connection or our servers, not your internet line.",
        )}
        action={<RetryButton onClick={onRetry} />}
      />
    );
  } else if (totalChecks === 0) {
    body = (
      <EmptyState
        compact
        icon={Activity}
        title={t("history.emptyTitle", "No health checks in this range")}
        description={
          healthChecksApply
            ? t(
                "history.emptyBody",
                "We check each line about once a minute while the router is reachable. None were recorded in this range yet -- try a longer range, or use Check now on a line.",
              )
            : t(
                "history.emptyController",
                "Health checks run on a WyfyGuest-managed router. This venue's network is run by a controller, so there is no history to show.",
              )
        }
      />
    );
  } else {
    body = (
      <div className="space-y-4" onKeyDown={onKey}>
        {/* Availability strips: one row per ISP, one cell per bucket. */}
        <div
          className="space-y-2"
          aria-label={t("history.availability", "Availability")}
          role="group"
        >
          {links.map((l, i) => {
            const s = ready[i];
            if (hidden.has(l.id)) return null;
            const up = s ? uptimePercent(s.buckets) : null;
            return (
              <div
                key={l.id}
                className="grid grid-cols-[minmax(0,7.5rem)_3.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[9rem_4rem_minmax(0,1fr)]"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--wy-text-muted)]">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: ispColor(i) }}
                  />
                  <span className="truncate">{l.providerName}</span>
                </span>
                <span className="text-right text-xs font-semibold tabular-nums text-[var(--wy-text)]">
                  {up != null ? `${up >= 99.95 ? "100" : up.toFixed(up >= 99 ? 2 : 1)}%` : "—"}
                </span>
                {s ? (
                  <AvailabilityStrip
                    summary={s}
                    incidents={incidents.filter((x) => x.linkId === l.id)}
                    selected={selected}
                    onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
                    label={(b) =>
                      `${l.providerName} · ${fmtClock(b.bucketStart, lang)} · ${
                        b.uptimePercentage != null
                          ? t("history.cellUptime", "{{v}}% up", {
                              v: b.uptimePercentage.toFixed(1),
                            })
                          : t("history.noData", "no data")
                      }${b.unhealthyCount ? ` · ${t("history.failedN", "{{n}} failed checks", { n: b.unhealthyCount })}` : ""}`
                    }
                  />
                ) : (
                  <span className="text-[11px] text-[var(--wy-text-faint)]">
                    {states[i].status === "error" ? t("history.lineError", "Couldn't load") : "…"}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="grid gap-4 lg:grid-cols-3"
          data-wy="isp-history"
          aria-describedby={readoutId}
        >
          {(
            [
              ["lat", t("history.latency", "Latency"), "ms"],
              ["loss", t("history.loss", "Packet loss"), "%"],
              ["down", t("history.throughput", "Throughput"), "Mbps"],
            ] as Array<[Metric, string, string]>
          ).map(([m, title, u]) => (
            <MetricChart
              key={m}
              metric={m}
              title={title}
              unit={u}
              rows={rows}
              links={links}
              hidden={hidden}
              incidents={visibleIncidents}
              selected={selected}
              unitMs={unitMs}
              tickFmt={tickFmt}
              onPick={pickAt}
              tooltipTitle={(ms) =>
                unit === "day"
                  ? new Date(ms).toLocaleDateString(lang, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : `${fmtClock(new Date(ms).toISOString(), lang)} – ${new Date(ms + unitMs).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" })}`
              }
              upLabel={t("history.upload", "upload")}
            />
          ))}
        </div>

        {/* Readout of the pinned incident, or the incident list. */}
        <div id={readoutId} aria-live="polite">
          {sel ? (
            <div
              data-wy="incident-readout"
              className={cn(
                "flex flex-wrap items-start gap-x-6 gap-y-2 rounded-[var(--wy-radius)] border px-3 py-2.5 text-xs",
                sel.severity === "crit"
                  ? "border-[color-mix(in_srgb,var(--wy-crit)_30%,transparent)] bg-[var(--wy-crit-soft)]"
                  : "border-[color-mix(in_srgb,var(--wy-warn)_30%,transparent)] bg-[var(--wy-warn-soft)]",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-[var(--wy-text)]">
                  {linkName(sel.linkId)} ·{" "}
                  {sel.severity === "crit"
                    ? t("history.incidentDown", "Checks failing")
                    : t("history.incidentDegraded", "Degraded")}
                </p>
                <p className="tabular-nums text-[var(--wy-text-muted)]">{windowFmt(sel)}</p>
              </div>
              <Fact
                label={t("history.failedChecks", "Failed checks")}
                value={`${sel.failedChecks} / ${sel.totalChecks}`}
              />
              <Fact
                label={t("history.degradedChecks", "Degraded checks")}
                value={`${sel.degradedChecks}`}
              />
              <Fact
                label={t("history.worstLatency", "Worst avg latency")}
                value={
                  fmtNum(sel.worstLatencyMs, 0) != null
                    ? `${fmtNum(sel.worstLatencyMs, 0)} ms`
                    : "—"
                }
              />
              <Fact
                label={t("history.worstLoss", "Worst avg loss")}
                value={
                  fmtNum(sel.worstLossPct, 1) != null ? `${fmtNum(sel.worstLossPct, 1)}%` : "—"
                }
              />
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="ml-auto inline-flex items-center gap-1 rounded px-1 text-[11px] font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
              >
                <X aria-hidden className="h-3 w-3" />
                {t("history.clear", "Clear")}
              </button>
            </div>
          ) : visibleIncidents.length ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--wy-text-faint)]">
                {t("history.incidents", "Incidents in this range")} · {visibleIncidents.length}
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {visibleIncidents.slice(0, 8).map((x) => (
                  <li key={x.id}>
                    <button
                      type="button"
                      data-wy="incident-chip"
                      onClick={() => setSelected(x.id)}
                      className="inline-flex items-center gap-1.5 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2 py-1 text-[11px] text-[var(--wy-text-muted)] transition-colors hover:border-[var(--wy-border-strong)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                    >
                      <span
                        aria-hidden
                        className={cn("h-2 w-2 rounded-full", STATUS_BG[x.severity])}
                      />
                      <span className="font-medium text-[var(--wy-text)]">
                        {linkName(x.linkId)}
                      </span>
                      <span className="tabular-nums">{windowFmt(x)}</span>
                    </button>
                  </li>
                ))}
                {visibleIncidents.length > 8 && (
                  <li className="self-center text-[11px] text-[var(--wy-text-faint)]">
                    {t("history.more", "+{{n}} more", { n: visibleIncidents.length - 8 })}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-[var(--wy-text-muted)]">
              {t("history.noIncidents", "No failed checks in this range.")}
            </p>
          )}
        </div>

        {failed.length > 0 && (
          <p className="flex items-center gap-2 text-xs text-[var(--wy-text-muted)]">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-[var(--wy-warn)]" />
            {t("history.partial", "Couldn't load history for {{names}}.", {
              names: failed.map((l) => l.providerName).join(", "),
            })}
            <RetryButton onClick={onRetry} />
          </p>
        )}
      </div>
    );
  }

  return (
    <section
      aria-labelledby="isp-history-title"
      className="min-w-0 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text)] shadow-[var(--wy-shadow)]"
    >
      <header className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--wy-border)] px-4 py-2">
        <h2 id="isp-history-title" className="text-[13px] font-semibold">
          {t("history.title", "History")}
        </h2>
        {links.length > 1 && (
          <div
            className="flex flex-wrap items-center gap-1"
            role="group"
            aria-label={t("history.legend", "Show lines")}
          >
            {links.map((l, i) => {
              const on = !hidden.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(l.id)}
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-[var(--wy-radius)] border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
                    on
                      ? "border-[var(--wy-border-strong)] text-[var(--wy-text)]"
                      : "border-dashed border-[var(--wy-border)] text-[var(--wy-text-faint)] line-through",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-sm"
                    style={{ background: on ? ispColor(i) : "var(--wy-border-strong)" }}
                  />
                  {l.providerName}
                </button>
              );
            })}
          </div>
        )}
        <div className="ml-auto">{rangeControl}</div>
      </header>
      <div className="p-4">{body}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--wy-text-muted)]">{label}</p>
      <p className="font-semibold tabular-nums text-[var(--wy-text)]">{value}</p>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const { t } = useIspT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-[var(--wy-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
    >
      <RotateCw aria-hidden className="h-3 w-3" />
      {t("retry", "Retry")}
    </button>
  );
}

function AvailabilityStrip({
  summary,
  incidents,
  selected,
  onSelect,
  label,
}: {
  summary: IspHealthCheckSummary;
  incidents: Incident[];
  selected: string | null;
  onSelect: (id: string) => void;
  label: (b: IspHealthCheckSummary["buckets"][number]) => string;
}) {
  const buckets = summary.buckets;
  if (!buckets.length) return <span className="text-[11px] text-[var(--wy-text-faint)]">—</span>;
  // Very long ranges (7d hourly = 168) still fit: cells flex and shrink.
  return (
    <div className="flex h-5 min-w-0 items-stretch gap-px">
      {buckets.map((b) => {
        const inc = incidents.find((x) => x.bucketStarts.includes(b.bucketStart));
        const tone =
          b.totalChecks === 0
            ? "bg-[var(--wy-surface-2)]"
            : b.unhealthyCount > 0
              ? STATUS_BG.crit
              : b.degradedCount / b.totalChecks >= 0.2
                ? STATUS_BG.warn
                : STATUS_BG.ok;
        const cls = cn(
          "min-w-[2px] flex-1 rounded-[1px]",
          tone,
          b.totalChecks > 0 && !inc && "opacity-70",
          inc &&
            selected === inc.id &&
            "outline outline-2 outline-offset-1 outline-[var(--wy-text)]",
        );
        return inc ? (
          <button
            key={b.bucketStart}
            type="button"
            aria-label={label(b)}
            title={label(b)}
            onClick={() => onSelect(inc.id)}
            className={cn(
              cls,
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--wy-accent)]",
            )}
          />
        ) : (
          <span key={b.bucketStart} title={label(b)} className={cls} />
        );
      })}
    </div>
  );
}

function MetricChart({
  metric,
  title,
  unit,
  rows,
  links,
  hidden,
  incidents,
  selected,
  unitMs,
  tickFmt,
  tooltipTitle,
  onPick,
  upLabel,
}: {
  metric: Metric;
  title: string;
  unit: string;
  rows: HistoryRow[];
  links: IspLink[];
  hidden: Set<string>;
  incidents: Incident[];
  selected: string | null;
  unitMs: number;
  tickFmt: (ms: number) => string;
  tooltipTitle: (ms: number) => string;
  onPick: (ms: number | undefined) => void;
  upLabel: string;
}) {
  const { t } = useIspT();
  const noReadings = t("history.noReadings", "No readings in this range");
  const visible = links.map((l, i) => ({ l, i })).filter(({ l }) => !hidden.has(l.id));
  const hasAny = rows.some((r) => visible.some(({ i }) => r[`${i}_${metric}`] != null));
  const first = rows[0]?.t ?? 0;
  const last = (rows[rows.length - 1]?.t ?? 0) + unitMs;
  return (
    <div className="min-w-0">
      <p className="mb-1 flex items-baseline gap-1 text-xs font-medium text-[var(--wy-text-muted)]">
        {title}
        <span className="text-[11px] font-normal text-[var(--wy-text-faint)]">{unit}</span>
      </p>
      <div className="h-32 w-full" role="img" aria-label={title}>
        {hasAny ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              syncId="isp-history"
              margin={{ top: 4, right: 4, left: -14, bottom: 0 }}
              onClick={(st: { activeLabel?: number | string } | null) => {
                const v = st?.activeLabel;
                onPick(typeof v === "number" ? v : v != null ? Number(v) : undefined);
              }}
              style={{ cursor: incidents.length ? "pointer" : undefined }}
            >
              <CartesianGrid vertical={false} stroke="var(--wy-border)" />
              {incidents.map((x) => (
                <ReferenceArea
                  key={x.id}
                  x1={Math.max(first, new Date(x.start).getTime())}
                  x2={Math.min(last, new Date(x.end).getTime())}
                  ifOverflow="hidden"
                  fill={x.severity === "crit" ? "var(--wy-crit)" : "var(--wy-warn)"}
                  fillOpacity={selected === x.id ? 0.3 : selected ? 0.08 : 0.16}
                  stroke={
                    selected === x.id
                      ? x.severity === "crit"
                        ? "var(--wy-crit)"
                        : "var(--wy-warn)"
                      : undefined
                  }
                  strokeOpacity={0.6}
                />
              ))}
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[first, last]}
                tickFormatter={tickFmt}
                tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--wy-border)" }}
                minTickGap={28}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--wy-text-faint)" }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={metric !== "lat"}
                domain={
                  metric === "loss"
                    ? [0, (max: number) => Math.max(1, Math.ceil(max))]
                    : [0, "auto"]
                }
              />
              <Tooltip
                contentStyle={CONSOLE_TOOLTIP_STYLE}
                cursor={{ stroke: "var(--wy-border-strong)", strokeDasharray: "3 3" }}
                labelFormatter={(v: number) => tooltipTitle(v)}
                formatter={(v: unknown, name: string) => {
                  const num = typeof v === "number" ? v : null;
                  const digits = metric === "lat" ? 0 : 1;
                  return [num != null ? `${num.toFixed(digits)} ${unit}` : "—", name];
                }}
                isAnimationActive={false}
              />
              {visible.map(({ l, i }) => (
                <Line
                  key={l.id}
                  type="monotone"
                  dataKey={`${i}_${metric}`}
                  name={l.providerName}
                  stroke={ispColor(i)}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--wy-surface)" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
              {metric === "down" &&
                visible.map(({ l, i }) => (
                  <Line
                    key={`${l.id}-up`}
                    type="monotone"
                    dataKey={`${i}_up`}
                    name={`${l.providerName} ${upLabel}`}
                    stroke={ispColor(i)}
                    strokeOpacity={0.6}
                    strokeDasharray="3 3"
                    strokeWidth={1.25}
                    dot={false}
                    activeDot={{ r: 2.5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[var(--wy-radius)] border border-dashed border-[var(--wy-border)] text-[11px] text-[var(--wy-text-faint)]">
            {noReadings}
          </div>
        )}
      </div>
    </div>
  );
}
