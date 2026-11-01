/**
 * One ISP line: status first, then the live numbers against the plan, then
 * the recent checks, then the record (type, port, DNS, priority) and every
 * action the old table row offered (mark up/down, check now, history, edit,
 * remove). Data: the link row itself, its newest raw checks and its range
 * summary -- all already read by the page.
 */
import { CheckCircle2, History, Pencil, RefreshCw, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { IspProviderIcon } from "@/components/icons/isp";
import type { IspHealthCheck, IspHealthCheckSummary, IspLink } from "@/types/isp";
import { linkStatus, stateSince, uptimePercent } from "./isp-model";
import { CheckTicks, LatencySpark, LinkStatus, PlanMeter, RoleChips } from "./isp-ui";
import { fmtAgo, fmtClock, fmtDuration, fmtNum, ispColor, useIspT } from "./isp-shared";
import { linkTypeLabel } from "./isp-link-types";
import type { Loadable } from "./useIspHistory";
import type { IspRange } from "./isp.demo";

const MODE_LABEL: Record<string, string> = { static: "Static IP", dhcp: "DHCP", pppoe: "PPPoE" }; // i18n-ignore: English fallback for dialog.mode.*

export function IspLinkCard({
  link,
  index,
  multi,
  checks,
  summary,
  range,
  deviceControlsApply,
  checking,
  statusBusy,
  onCheck,
  onMark,
  onHistory,
  onEdit,
  onRemove,
}: {
  link: IspLink;
  index: number;
  multi: boolean;
  checks: Loadable<IspHealthCheck[]> | undefined;
  summary: Loadable<IspHealthCheckSummary> | undefined;
  range: IspRange;
  deviceControlsApply: boolean;
  checking: boolean;
  statusBusy: boolean;
  onCheck: () => void;
  onMark: (s: "healthy" | "unhealthy") => void;
  onHistory: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t, i18n: inst } = useIspT();
  const lang = inst.language;
  const color = ispColor(index);
  const rows = checks?.status === "ready" ? checks.data : [];
  const since = stateSince(link, rows);
  const up = summary?.status === "ready" ? uptimePercent(summary.data.buckets) : null;
  const st = linkStatus(link.healthStatus);
  const typeLabel = linkTypeLabel(t, link.linkType);

  let sinceText: string | null = null;
  if (link.healthStatus === "unhealthy" && link.unhealthySince) {
    sinceText = t("card.downFor", "Down for {{d}} · since {{time}}", {
      d: fmtDuration(Date.now() - new Date(link.unhealthySince).getTime()),
      time: fmtClock(link.unhealthySince, lang),
    });
  } else if (since && !since.atLeast) {
    sinceText = t("card.since", "since {{time}}", { time: fmtClock(since.iso, lang) });
  } else if (since && since.atLeast) {
    sinceText = t("card.forAtLeast", "for at least {{d}}", {
      d: fmtDuration(Date.now() - new Date(since.iso).getTime()),
    });
  }

  return (
    <article
      data-wy="isp-card"
      data-link={link.id}
      aria-labelledby={`isp-card-${link.id}`}
      className={cn(
        "flex min-w-0 flex-col rounded-[var(--wy-radius)] border bg-[var(--wy-surface)] shadow-[var(--wy-shadow)]",
        st === "crit"
          ? "border-[color-mix(in_srgb,var(--wy-crit)_45%,var(--wy-border))]"
          : multi && link.isActiveUplink
            ? "border-[var(--wy-border-strong)]"
            : "border-[var(--wy-border)]",
      )}
    >
      {/* Identity + status */}
      <header className="flex flex-wrap items-start gap-x-3 gap-y-1.5 border-b border-[var(--wy-border)] px-4 py-3">
        <span
          aria-hidden
          className="mt-1 h-3 w-1 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          {/* The brand badge sits beside the heading, not inside it: its SVG
              draws the initial as <text>, so inside the <h3> the heading's
              text read "AAirtel" (it is aria-hidden, but copy, find-in-page
              and text-based tools still saw the letter). */}
          <div className="flex min-w-0 items-center gap-1.5">
            <IspProviderIcon providerName={link.providerName} className="h-4 w-4 shrink-0" />
            <h3
              id={`isp-card-${link.id}`}
              className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold"
            >
              <span className="truncate">{link.providerName}</span>
              {!link.isEnabled && (
                <span className="rounded bg-[var(--wy-surface-2)] px-1.5 text-[11px] font-medium leading-5 text-[var(--wy-text-faint)]">
                  {t("card.disabled", "Disabled")}
                </span>
              )}
            </h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--wy-text-faint)]">
            <RoleChips link={link} multi={multi} />
            {link.interface && (
              <span>
                {t("card.port", "Port")}{" "}
                <span className="font-mono text-[var(--wy-text-muted)]">{link.interface}</span>
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <LinkStatus link={link} size="lg" />
          {sinceText && (
            <p
              className={cn(
                "mt-0.5 text-[11px] tabular-nums",
                st === "crit" ? "font-medium text-[var(--wy-crit)]" : "text-[var(--wy-text-muted)]",
              )}
            >
              {sinceText}
            </p>
          )}
        </div>
      </header>

      {/* Live numbers */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4">
        <PlanMeter
          dir="down"
          current={link.currentDownloadMbps}
          plan={link.downloadBandwidthMbps}
          color={color}
        />
        <PlanMeter
          dir="up"
          current={link.currentUploadMbps}
          plan={link.uploadBandwidthMbps}
          color={color}
        />
        <div className="min-w-0">
          <p className="text-[11px] text-[var(--wy-text-muted)]">{t("card.latency", "Latency")}</p>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold tabular-nums">
              {fmtNum(link.latencyMs, 0) ?? "—"}
              {link.latencyMs != null && (
                <span className="ml-0.5 text-xs font-normal text-[var(--wy-text-faint)]">ms</span>
              )}
            </span>
            <LatencySpark checks={rows} color={color} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[11px] text-[var(--wy-text-muted)]">{t("card.loss", "Loss")}</p>
            <p className="text-[13px] font-semibold tabular-nums">
              {fmtNum(link.packetLossPercentage, 1) != null
                ? `${fmtNum(link.packetLossPercentage, 1)}%`
                : "—"}
            </p>
          </div>
          <div>
            <p
              className="whitespace-nowrap text-[11px] text-[var(--wy-text-muted)]"
              title={t(
                "card.uptimeHint",
                "Share of health checks that passed in the selected range",
              )}
            >
              {t("card.uptimeRange", "Uptime {{range}}", { range })}
            </p>
            <p className="text-[13px] font-semibold tabular-nums">
              {up != null ? `${up >= 99.95 ? "100" : up.toFixed(up >= 99 ? 2 : 1)}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent checks */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--wy-border)] px-4 py-2.5">
        {checks?.status === "loading" || !checks ? (
          <div className="flex h-4 gap-[2px]" aria-hidden>
            {Array.from({ length: 20 }).map((_, i) => (
              <span
                key={i}
                className="h-4 w-[5px] animate-pulse rounded-[1.5px] bg-[var(--wy-surface-2)]"
              />
            ))}
          </div>
        ) : checks.status === "error" ? (
          <span className="text-[11px] text-[var(--wy-crit)]">
            {t("card.checksError", "Couldn't load recent checks")}
          </span>
        ) : rows.length === 0 ? (
          <span className="text-[11px] text-[var(--wy-text-muted)]">
            {deviceControlsApply
              ? t(
                  "card.noChecks",
                  "No health checks yet -- the first runs within a minute of the router being reachable.",
                )
              : t(
                  "card.noChecksController",
                  "Health checks don't run for a controller-managed venue.",
                )}
          </span>
        ) : (
          <>
            <CheckTicks checks={rows} />
            <span className="text-[11px] tabular-nums text-[var(--wy-text-faint)]">
              {t("card.lastN", "Last {{n}} checks · newest {{ago}}", {
                n: rows.length,
                ago: fmtAgo(rows[0].checkedAt, lang) ?? "—",
              })}
            </span>
          </>
        )}
      </div>

      {/* The record */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-[var(--wy-border)] px-4 py-2.5 text-[11px] sm:grid-cols-3">
        <Detail label={t("card.type", "Type")} value={typeLabel} />
        <Detail
          label={t("card.connection", "Connection")}
          value={
            link.connectionMode === "static"
              ? t("dialog.mode.static", MODE_LABEL.static)
              : (MODE_LABEL[link.connectionMode] ?? link.connectionMode)
          }
        />
        <Detail
          label={t("card.dns", "DNS")}
          value={[link.dnsPrimary, link.dnsSecondary].filter(Boolean).join(", ") || "—"}
          mono
        />
        <Detail label={t("card.priority", "Priority")} value={String(link.priority)} />
        <Detail
          label={t("card.failback", "Auto-failback")}
          value={link.autoFailback ? t("on", "On") : t("off", "Off")}
          title={t(
            "card.failbackHint",
            "Whether this line automatically goes back to primary once healthy again, or stays on the failover line until switched back manually",
          )}
        />
        <Detail
          label={t("card.lastChecked", "Last checked")}
          value={fmtAgo(link.lastCheckedAt, lang) ?? t("never", "Never")}
        />
      </dl>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-0.5 border-t border-[var(--wy-border)] px-2 py-1.5">
        <ActionButton
          icon={
            <RefreshCw
              className={cn("h-3.5 w-3.5", checking && "animate-spin motion-reduce:animate-none")}
            />
          }
          label={t("action.check", "Check now")}
          title={
            deviceControlsApply
              ? t("action.checkHint", "Run a health check now")
              : t(
                  "action.checkController",
                  "Health checks run on the router itself, which we do not reach for a controller-managed venue.",
                )
          }
          disabled={checking || !deviceControlsApply}
          onClick={onCheck}
        />
        <ActionButton
          icon={<History className="h-3.5 w-3.5" />}
          label={t("action.history", "History")}
          onClick={onHistory}
        />
        <span className="mx-0.5 h-4 w-px bg-[var(--wy-border)] sm:mx-1" aria-hidden />
        <ActionButton
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-[var(--wy-ok)]" />}
          label={t("action.markUp", "Mark up")}
          title={t("action.markUpHint", "Mark as Up (healthy) until the next automatic check")}
          disabled={statusBusy}
          onClick={() => onMark("healthy")}
          iconOnlyBelowSm
        />
        <ActionButton
          icon={<XCircle className="h-3.5 w-3.5 text-[var(--wy-crit)]" />}
          label={t("action.markDown", "Mark down")}
          title={t(
            "action.markDownHint",
            "Mark as Down (unhealthy) until the next automatic check",
          )}
          disabled={statusBusy}
          onClick={() => onMark("unhealthy")}
          iconOnlyBelowSm
        />
        <span className="ml-auto" />
        <ActionButton
          icon={<Pencil className="h-3.5 w-3.5" />}
          label={t("action.edit", "Edit")}
          onClick={onEdit}
          iconOnlyBelowSm
        />
        <ActionButton
          icon={<Trash2 className="h-3.5 w-3.5" />}
          label={t("action.remove", "Remove")}
          onClick={onRemove}
          iconOnly
        />
      </div>
    </article>
  );
}

function Detail({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="text-[var(--wy-text-faint)]">{label}</dt>
      <dd className={cn("truncate text-[var(--wy-text-muted)]", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  title,
  disabled,
  onClick,
  iconOnly,
  iconOnlyBelowSm,
}: {
  icon: React.ReactNode;
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
  iconOnly?: boolean;
  iconOnlyBelowSm?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={iconOnly || iconOnlyBelowSm ? label : undefined}
      className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-1.5 text-xs sm:px-2 font-medium text-[var(--wy-text-muted)] transition-colors hover:bg-[var(--wy-surface-2)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] disabled:pointer-events-none disabled:opacity-45"
    >
      {icon}
      {!iconOnly && <span className={cn(iconOnlyBelowSm && "hidden sm:inline")}>{label}</span>}
    </button>
  );
}
