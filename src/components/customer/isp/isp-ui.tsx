/**
 * Small building blocks shared by the Internet Connection page and the
 * Overview's Internet Connection card, so the two read as one system: the
 * same status words, the same per-ISP colour (series-1, series-2 -- status
 * colours are reserved for state), the same plan meter and failover banner.
 * Kept free of charts and services so the dashboard bundle stays small.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, ShieldAlert, ShieldCheck } from "lucide-react";
import i18n from "@/lib/i18n";
import { formatDateTime, formatRelative, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusDot, type ConsoleStatus } from "@/components/customer/console";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { IspHealthCheck, IspLink } from "@/types/isp";
import { linkStatus, planShare, type FailoverState } from "./isp-model";

/** Fixed per-ISP colour, by position in the sorted list. */
export const ISP_SERIES = [
  "var(--wy-series-1)",
  "var(--wy-series-2)",
  "var(--wy-series-6)",
  "var(--wy-series-3)",
];
export const ispColor = (i: number) => ISP_SERIES[i % ISP_SERIES.length];

export function useIspT() {
  return useTranslation("isp", { i18n });
}

export const STATUS_WORD_KEY: Record<string, [string, string]> = {
  healthy: ["status.healthy", "Online"],
  degraded: ["status.degraded", "Degraded"],
  unhealthy: ["status.unhealthy", "Offline"],
  unknown: ["status.unknown", "Not checked"],
};

export function useStatusWord() {
  const { t } = useIspT();
  return (healthStatus: string | null | undefined) => {
    const [k, d] = STATUS_WORD_KEY[healthStatus ?? "unknown"] ?? STATUS_WORD_KEY.unknown;
    return t(k, d);
  };
}

export const STATUS_TEXT: Record<ConsoleStatus, string> = {
  ok: "text-[var(--wy-ok)]",
  warn: "text-[var(--wy-warn)]",
  crit: "text-[var(--wy-crit)]",
  info: "text-[var(--wy-info)]",
  offline: "text-[var(--wy-text-muted)]",
};

export const STATUS_BG: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok)]",
  warn: "bg-[var(--wy-warn)]",
  crit: "bg-[var(--wy-crit)]",
  info: "bg-[var(--wy-info)]",
  offline: "bg-[var(--wy-offline)]",
};

export const STATUS_SOFT: Record<ConsoleStatus, string> = {
  ok: "bg-[var(--wy-ok-soft)]",
  warn: "bg-[var(--wy-warn-soft)]",
  crit: "bg-[var(--wy-crit-soft)]",
  info: "bg-[var(--wy-info-soft)]",
  offline: "bg-[var(--wy-offline-soft)]",
};

/* ---------- formatting ---------- */

export function fmtNum(v: number | null | undefined, digits = 0): string | null {
  return v == null || !Number.isFinite(v) ? null : v.toFixed(digits);
}

/** "3h 12m" / "4d 2h" / "45m" / "<1m". Units are read the same in en/hi. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 60_000) return "<1m";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/** Clock time; adds the date when it is not today. 12-hour, Indian locale
 * (see `@/lib/format`). */
export function fmtClock(iso: string, lang: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? formatTime(d, lang) : formatDateTime(d, lang);
}

export function fmtAgo(iso: string | null | undefined, lang: string): string | null {
  if (!iso || !Number.isFinite(new Date(iso).getTime())) return null;
  return formatRelative(iso, lang, { style: "short" });
}

/* ---------- pieces ---------- */

/** A link's status: dot + word, plus a "Manual" tag when an admin set it. */
export function LinkStatus({
  link,
  size = "md",
  className,
}: {
  link: Pick<IspLink, "healthStatus" | "healthStatusSource">;
  size?: "md" | "lg";
  className?: string;
}) {
  const { t } = useIspT();
  const word = useStatusWord();
  const st = linkStatus(link.healthStatus);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StatusDot status={st} label={word(link.healthStatus)} pulse={st === "ok"} />
      <span
        className={cn("font-semibold", size === "lg" ? "text-[15px]" : "text-xs", STATUS_TEXT[st])}
      >
        {word(link.healthStatus)}
      </span>
      {link.healthStatusSource === "manual" && (
        <span
          className="rounded border border-[var(--wy-border-strong)] px-1 text-[10px] font-medium leading-4 text-[var(--wy-text-faint)]"
          title={t("manualHint", "Set by an admin, not by the automatic health check")}
        >
          {t("manual", "Manual")}
        </span>
      )}
    </span>
  );
}

/** Role and whether this line carries traffic right now. */
export function RoleChips({ link, multi }: { link: IspLink; multi: boolean }) {
  const { t } = useIspT();
  return (
    <span className="inline-flex items-center gap-1">
      <span className="whitespace-nowrap rounded bg-[var(--wy-surface-2)] px-1.5 text-[11px] font-medium leading-5 text-[var(--wy-text-muted)]">
        {link.role === "primary" ? t("role.primary", "Primary") : t("role.backup", "Backup")}
      </span>
      {multi &&
        (link.isActiveUplink ? (
          <span className="whitespace-nowrap rounded bg-[var(--wy-accent-soft)] px-1.5 text-[11px] font-semibold leading-5 text-[var(--wy-accent)]">
            {t("role.active", "In use")}
          </span>
        ) : (
          <span className="whitespace-nowrap rounded border border-dashed border-[var(--wy-border-strong)] px-1.5 text-[11px] font-medium leading-[18px] text-[var(--wy-text-faint)]">
            {link.healthStatus === "unhealthy"
              ? t("role.idle", "Not in use")
              : t("role.standby", "Standby")}
          </span>
        ))}
    </span>
  );
}

/** "↓ 118 / 500 Mbps" with a thin fill bar for share of plan. With no plan
 * it shows the rate alone and no bar -- a bar against nothing would lie. */
export function PlanMeter({
  dir,
  current,
  plan,
  color,
  compact,
}: {
  dir: "down" | "up";
  current: number | null;
  plan: number | null;
  color: string;
  compact?: boolean;
}) {
  const { t } = useIspT();
  const share = planShare(current, plan);
  const Icon = dir === "down" ? ArrowDown : ArrowUp;
  const cur = fmtNum(current, current != null && current < 10 ? 1 : 0);
  const label = dir === "down" ? t("meter.down", "Download") : t("meter.up", "Upload");
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1 text-xs">
        <Icon aria-hidden className="h-3 w-3 shrink-0 self-center text-[var(--wy-text-faint)]" />
        <span className="sr-only">{label}</span>
        <span
          className={cn(
            "font-semibold tabular-nums text-[var(--wy-text)]",
            !compact && "text-[13px]",
          )}
        >
          {cur ?? "—"}
        </span>
        {plan != null && (
          <span className="tabular-nums text-[var(--wy-text-faint)]">/ {fmtNum(plan)}</span>
        )}
        <span className="text-[var(--wy-text-faint)]">Mbps</span>
      </div>
      {plan != null && (
        <div
          className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--wy-surface-2)]"
          role="meter"
          aria-label={t("meter.ofPlan", "{{label}}, share of plan", { label })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={share != null ? Math.round(share * 100) : undefined}
          aria-valuetext={
            share != null
              ? t("meter.valueText", "{{cur}} of {{plan}} Mbps", { cur, plan: fmtNum(plan) })
              : t("meter.noReading", "No live reading")
          }
        >
          {share != null && (
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, share * 100)}%`, background: color }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Tiny latency line from raw checks already in hand (oldest -> newest).
 * Nothing drawn for fewer than two readings. Decorative: the value beside
 * it is the accessible reading. */
export function LatencySpark({
  checks,
  color,
  className,
}: {
  checks: IspHealthCheck[];
  color: string;
  className?: string;
}) {
  const pts = [...checks]
    .reverse()
    .map((c) => c.latencyMs)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (pts.length < 2) return null;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const span = Math.max(1, max - min);
  const W = 64;
  const H = 18;
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - 2 - ((v - min) / span) * (H - 4);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("h-[18px] w-16 overflow-visible", className)}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Raw checks as ticks, oldest -> newest. Each tick is a button with a
 * popover (tap works on touch, where hover does not). A manual reading gets
 * a ring so it reads apart from a real ping. */
export function CheckTicks({
  checks,
  max = 30,
  interactive = true,
}: {
  checks: IspHealthCheck[];
  max?: number;
  interactive?: boolean;
}) {
  const { t, i18n: inst } = useIspT();
  const word = useStatusWord();
  const ordered = [...checks.slice(0, max)].reverse();
  if (!ordered.length) return null;
  return (
    <div
      className="flex h-4 items-end gap-[2px]"
      role="list"
      aria-label={t("ticks.label", "Recent health checks, oldest to newest")}
    >
      {ordered.map((c) => {
        const st = linkStatus(c.status);
        const title = `${fmtClock(c.checkedAt, inst.language)} — ${word(c.status)}${c.source === "manual" ? ` (${t("manual", "Manual")})` : ""}`;
        const cls = cn(
          "block h-4 w-[5px] shrink-0 rounded-[1.5px]",
          STATUS_BG[st],
          st === "offline" && "opacity-40",
          c.source === "manual" &&
            "ring-1 ring-[var(--wy-text)] ring-offset-1 ring-offset-[var(--wy-surface)]",
        );
        if (!interactive) return <span key={c.id} role="listitem" title={title} className={cls} />;
        return (
          <span key={c.id} role="listitem" className="flex">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={title}
                  title={title}
                  className={cn(
                    cls,
                    "transition-transform hover:scale-y-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
                  )}
                />
              </PopoverTrigger>
              <PopoverContent align="center" className="wy-console w-60 space-y-1.5 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[var(--wy-text)]">
                    {formatDateTime(c.checkedAt, inst.language)}
                  </span>
                  <LinkStatus link={{ healthStatus: c.status, healthStatusSource: c.source }} />
                </div>
                <p className="text-[var(--wy-text-muted)]">
                  {c.latencyMs != null
                    ? `${c.latencyMs.toFixed(1)} ms`
                    : t("ticks.noLatency", "No latency reading")}
                  {" · "}
                  {c.packetLossPercentage != null
                    ? t("ticks.loss", "{{v}}% loss", { v: c.packetLossPercentage.toFixed(1) })
                    : t("ticks.noLoss", "No loss reading")}
                </p>
                {(c.downloadMbps != null || c.uploadMbps != null) && (
                  <p className="tabular-nums text-[var(--wy-text-muted)]">
                    ↓ {fmtNum(c.downloadMbps, 1) ?? "—"} · ↑ {fmtNum(c.uploadMbps, 1) ?? "—"} Mbps
                  </p>
                )}
                {c.errorMessage && <p className="text-[var(--wy-crit)]">{c.errorMessage}</p>}
              </PopoverContent>
            </Popover>
          </span>
        );
      })}
    </div>
  );
}

/** The failover reading, said once and prominently when it matters. Renders
 * nothing for the calm states ("normal", "single", "none"). */
export function FailoverBanner({
  state,
  compact,
  action,
}: {
  state: FailoverState;
  compact?: boolean;
  action?: ReactNode;
}) {
  const { t, i18n: inst } = useIspT();
  if (state.kind !== "on-backup" && state.kind !== "all-down") return null;
  const lang = inst.language;
  const allDown = state.kind === "all-down";
  const headline = allDown
    ? t("failover.allDown", "Internet is down on every line")
    : state.since
      ? t("failover.onBackupSince", "On backup since {{time}}", {
          time: fmtClock(state.since, lang),
        })
      : t("failover.onBackup", "Running on the backup line");
  const detail = allDown
    ? state.since
      ? t(
          "failover.allDownFor",
          "No line has passed a health check for {{d}}. Guests cannot get online.",
          {
            d: fmtDuration(Date.now() - new Date(state.since).getTime()),
          },
        )
      : t("failover.allDownBody", "No line is passing its health checks. Guests cannot get online.")
    : t(
        "failover.onBackupBody",
        "{{primary}} is not carrying traffic; guests are on {{backup}}{{forDuration}}.",
        {
          primary: state.primary?.providerName ?? t("failover.thePrimary", "The primary line"),
          backup: state.active?.providerName ?? t("failover.theBackup", "the backup line"),
          forDuration: state.since
            ? t("failover.forDuration", " for {{d}}", {
                d: fmtDuration(Date.now() - new Date(state.since).getTime()),
              })
            : "",
        },
      );
  const Icon = allDown ? ShieldAlert : ShieldCheck;
  return (
    <div
      role="status"
      data-wy="failover-banner"
      data-kind={state.kind}
      className={cn(
        "flex items-start gap-3 rounded-[var(--wy-radius)] border",
        compact ? "px-3 py-2" : "px-4 py-3",
        allDown
          ? "border-[color-mix(in_srgb,var(--wy-crit)_35%,transparent)] bg-[var(--wy-crit-soft)]"
          : "border-[color-mix(in_srgb,var(--wy-warn)_35%,transparent)] bg-[var(--wy-warn-soft)]",
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          allDown ? "text-[var(--wy-crit)]" : "text-[var(--wy-warn)]",
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold",
            compact ? "text-xs" : "text-[13px]",
            allDown ? "text-[var(--wy-crit)]" : "text-[var(--wy-warn)]",
          )}
        >
          {headline}
        </p>
        <p className={cn("text-[var(--wy-text)]", compact ? "text-[11px]" : "text-xs")}>{detail}</p>
      </div>
      {action}
    </div>
  );
}
