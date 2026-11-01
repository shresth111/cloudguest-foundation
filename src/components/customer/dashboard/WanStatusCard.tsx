import { motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IspLink, IspHealthCheck } from "@/types/isp";
import { IspProviderIcon } from "@/components/icons/isp";
import { useWanSummary } from "./useWanSummary";
import type { WanSummaryState } from "./dashboard.types";
import { Panel, StatusDot } from "@/components/customer/console";
import { PanelLink, PanelTitle } from "./overview/console-ui";
import { failoverState, linkStatus } from "@/components/customer/isp/isp-model";
import {
  CheckTicks,
  FailoverBanner,
  LatencySpark,
  LinkStatus,
  PlanMeter,
  RoleChips,
} from "@/components/customer/isp/isp-ui";
import {
  STATUS_TEXT,
  fmtClock,
  fmtDuration,
  fmtNum,
  ispColor,
  useIspT,
} from "@/components/customer/isp/isp-shared";

/** Oldest -> newest, left to right -- the same "last dozen real checks as
 * ticks" reading the Internet Connection page uses, so the two surfaces
 * share one idiom for the same rows. Non-interactive here: the page is
 * where a tick opens its detail. */
export function WanRecentChecks({ checks }: { checks: IspHealthCheck[] }) {
  const { t } = useIspT();
  if (checks.length === 0) {
    return (
      <p className="text-[11px] text-[var(--wy-text-muted)]">
        {t("card.noHistory", "No health-check history yet.")}
      </p>
    );
  }
  return <CheckTicks checks={checks} max={12} interactive={false} />;
}

/**
 * Empty-state illustration: a router waiting on a dashed link up to an
 * outline-only globe -- never a solid line or filled globe, either of
 * which would claim a connection that doesn't exist yet. Kept for callers
 * of the barrel export; colours follow the console accent.
 */
export function WanSetupIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 200 130" className="h-20 w-auto" fill="none">
      <circle
        cx="136"
        cy="42"
        r="24"
        stroke="var(--wy-accent)"
        strokeWidth="2"
        strokeDasharray="4 5"
        opacity="0.55"
      />
      <path
        d="M112 42h48M136 18a32 32 0 0 1 0 48 32 32 0 0 1 0-48z"
        stroke="var(--wy-accent)"
        strokeWidth="1.4"
        opacity="0.4"
      />
      <motion.path
        d="M92 100C100 78 114 58 126 48"
        stroke="var(--wy-text-faint)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
        animate={shouldReduceMotion ? undefined : { strokeDashoffset: [0, -16] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "linear" }
        }
      />
      <rect
        x="48"
        y="90"
        width="58"
        height="28"
        rx="7"
        fill="var(--wy-surface-2)"
        stroke="var(--wy-border-strong)"
      />
      <circle cx="60" cy="104" r="2.6" fill="var(--wy-text-faint)" />
      <circle cx="70" cy="104" r="2.6" fill="var(--wy-text-faint)" opacity="0.6" />
      <circle cx="80" cy="104" r="2.6" fill="var(--wy-text-faint)" opacity="0.3" />
    </svg>
  );
}

/** One ISP, compact: identity + role, status, ↓/↑ against plan, latency with
 * a sparkline from the checks already in hand, loss, and the recent-check
 * ticks. Shown for every uplink, so a venue on two ISPs sees each line. */
export function UplinkHealthRow({
  link,
  checks,
  index = 0,
  multi = false,
}: {
  link: IspLink;
  checks: IspHealthCheck[];
  index?: number;
  multi?: boolean;
}) {
  const { t, i18n: inst } = useIspT();
  const color = ispColor(index);
  const down = link.healthStatus === "unhealthy";
  return (
    <div
      className={cn(
        "space-y-2 rounded-[var(--wy-radius)] border px-3 py-2.5",
        down
          ? "border-[color-mix(in_srgb,var(--wy-crit)_45%,var(--wy-border))]"
          : "border-[var(--wy-border)]",
      )}
      data-wy="wan-row"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="h-3 w-1 shrink-0 rounded-full"
            style={{ background: color }}
          />
          <IspProviderIcon providerName={link.providerName} className="h-4 w-4 shrink-0" />
          <span className="truncate font-semibold text-[var(--wy-text)]">{link.providerName}</span>
          <RoleChips link={link} multi={multi} />
        </span>
        <LinkStatus link={link} />
      </div>
      {down && link.unhealthySince && (
        <p className="text-[11px] font-medium text-[var(--wy-crit)]">
          {t("card.downFor", "Down for {{d}} · since {{time}}", {
            d: fmtDuration(Date.now() - new Date(link.unhealthySince).getTime()),
            time: fmtClock(link.unhealthySince, inst.language),
          })}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[1fr_1fr_auto]">
        <PlanMeter
          dir="down"
          current={link.currentDownloadMbps}
          plan={link.downloadBandwidthMbps}
          color={color}
          compact
        />
        <PlanMeter
          dir="up"
          current={link.currentUploadMbps}
          plan={link.uploadBandwidthMbps}
          color={color}
          compact
        />
        <div className="col-span-2 flex items-center gap-3 whitespace-nowrap text-xs sm:col-span-1 sm:justify-end">
          <span className="flex items-center gap-1.5">
            <span className="text-[var(--wy-text-muted)]">{t("card.latency", "Latency")}</span>
            <span className="font-semibold tabular-nums text-[var(--wy-text)]">
              {fmtNum(link.latencyMs, 0) != null ? `${fmtNum(link.latencyMs, 0)} ms` : "—"}
            </span>
            <LatencySpark checks={checks} color={color} className="w-12" />
          </span>
          <span className="flex items-center gap-1">
            <span className="text-[var(--wy-text-muted)]">{t("card.loss", "Loss")}</span>
            <span className="font-semibold tabular-nums text-[var(--wy-text)]">
              {fmtNum(link.packetLossPercentage, 1) != null
                ? `${fmtNum(link.packetLossPercentage, 1)}%`
                : "—"}
            </span>
          </span>
        </div>
      </div>
      <WanRecentChecks checks={checks} />
    </div>
  );
}

/**
 * The Overview's Internet Connection card: a compact summary of the
 * Internet Connection page. One headline for the venue, the failover state
 * when traffic is on a backup line or every line is down, then each ISP's
 * own row. Data: exactly the `useWanSummary` state the page already holds
 * (links + up to 12 recent checks each) -- this card fetches nothing.
 */
export function WanStatusCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const wan = useWanSummary(locationId);
  return <WanStatusCardView wan={wan} onManage={onManage} />;
}

/** The card itself, for a caller that already holds the summary -- the
 * dashboard reads it once for the topology map and this card, because
 * `useWanSummary` is plain state and a second call is a second set of
 * health-check requests. */
export function WanStatusCardView({
  wan,
  onManage,
}: {
  wan: WanSummaryState;
  onManage: () => void;
}) {
  const { t } = useIspT();
  return (
    <div className="h-full" data-wy="wan-card">
      <Panel
        className="h-full"
        title={<PanelTitle icon={<Globe />}>{t("card.title", "Internet Connection")}</PanelTitle>}
        actions={<PanelLink onClick={onManage}>{t("card.manage", "Manage →")}</PanelLink>}
      >
        {wan.status === "loading" && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-5 w-32 animate-pulse rounded bg-[var(--wy-surface-2)]" />
            <div className="h-20 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]" />
          </div>
        )}
        {wan.status === "empty" && (
          <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
            <WanSetupIllustration />
            <p className="text-[13px] font-semibold text-[var(--wy-text)]">
              {t("card.emptyTitle", "No WAN link configured")}
            </p>
            <p className="max-w-xs text-xs text-[var(--wy-text-muted)]">
              {t(
                "card.emptyBody",
                "Connect this location's internet uplink to see live up/down status here.",
              )}
            </p>
            <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
              {t("card.setUp", "Set up Internet Connection")}
            </Button>
          </div>
        )}
        {wan.status === "ready" && <WanReady links={wan.links} checks={wan.checks} />}
      </Panel>
    </div>
  );
}

function WanReady({
  links,
  checks,
}: {
  links: IspLink[];
  checks: Record<string, IspHealthCheck[]>;
}) {
  const { t } = useIspT();
  const multi = links.length > 1;
  const failover = failoverState(links);
  const active = links.find((l) => l.isActiveUplink) ?? null;
  const known = links.filter((l) => l.healthStatus && l.healthStatus !== "unknown");
  const healthy = links.filter((l) => l.healthStatus === "healthy").length;

  let headline: string;
  let status = linkStatus("unknown");
  if (failover.kind === "all-down") {
    headline = multi ? t("head.allIspsDown", "All ISPs down") : t("head.allDown", "No internet");
    status = "crit";
  } else if (failover.kind === "on-backup") {
    headline = t("head.onBackup", "Online on backup");
    status = "warn";
  } else if (known.length === 0) {
    headline = t("head.notChecked", "Not checked yet");
  } else if (healthy === links.length) {
    headline = multi
      ? t("head.allIsps", "All {{n}} ISPs online", { n: links.length })
      : t("head.online", "Online");
    status = "ok";
  } else if (active?.healthStatus === "healthy") {
    headline = t("head.online", "Online");
    status = "ok";
  } else {
    headline = t("head.someIssues", "{{up}} of {{n}} lines healthy", {
      up: healthy,
      n: links.length,
    });
    status = active?.healthStatus === "unhealthy" ? "crit" : "warn";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p
          className={cn("flex items-center gap-2 text-[15px] font-semibold", STATUS_TEXT[status])}
          data-wy="wan-headline"
        >
          <StatusDot status={status} label={headline} pulse={status === "ok"} />
          {headline}
        </p>
        {multi && (
          <p className="text-[11px] uppercase tracking-wider text-[var(--wy-text-faint)]">
            {t("card.nIsps", "{{n}} ISPs", { n: links.length })}
          </p>
        )}
      </div>
      <FailoverBanner state={failover} compact />
      <div className="space-y-2">
        {links.map((l, i) => (
          <UplinkHealthRow
            key={l.id}
            link={l}
            checks={checks[l.id] ?? []}
            index={i}
            multi={multi}
          />
        ))}
      </div>
      {multi && failover.kind === "normal" && (
        <p className="text-[11px] text-[var(--wy-text-muted)]">
          {t(
            "card.failoverNote",
            "If one ISP fails its health checks, traffic moves to the remaining ISP automatically.",
          )}
        </p>
      )}
    </div>
  );
}
