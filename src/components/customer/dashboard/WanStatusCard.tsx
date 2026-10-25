import { motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IspLink, IspHealthCheck } from "@/types/isp";
import { IspProviderIcon } from "@/components/icons/isp";
import {
  WAN_HEALTH_STYLE,
  WAN_CONNECTION_MODE_LABEL,
  formatDownDuration,
  integratedWanHealth,
} from "./dashboard.types";
import { useWanSummary } from "./useWanSummary";

/** Oldest -> newest, left to right -- the exact same "last dozen real
 * checks as colored ticks" reading `IspStatusTimeline` (Internet
 * Connection page) already established, so this widget's timeline isn't a
 * visually-unrelated second idiom for the same underlying data. */
export function WanRecentChecks({ checks }: { checks: IspHealthCheck[] }) {
  if (checks.length === 0) {
    return <p className="text-xs text-muted-foreground">No health-check history yet.</p>;
  }
  const ordered = [...checks].reverse();
  return (
    <div className="flex items-center gap-1" title="Recent health checks, oldest to newest">
      {ordered.map((c) => {
        const style = WAN_HEALTH_STYLE[c.status] ?? WAN_HEALTH_STYLE.unknown;
        return (
          <span
            key={c.id}
            title={`${new Date(c.checkedAt).toLocaleString()} — ${style.label}`}
            className={cn("h-5 w-1.5 rounded-sm", style.bar)}
          />
        );
      })}
    </div>
  );
}

/**
 * Empty-state illustration for the WAN Status card: a router waiting on a
 * dashed, animated link up to an outline-only globe -- deliberately never
 * a solid connected line or filled globe, either of which would visually
 * claim a connection that doesn't exist yet.
 */
export function WanSetupIllustration() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <svg aria-hidden="true" viewBox="0 0 200 130" className="h-24 w-auto" fill="none">
      <ellipse cx="100" cy="119" rx="66" ry="5" fill="#6C4EFF" opacity="0.07" />

      <circle
        cx="136"
        cy="42"
        r="24"
        stroke="#8B5CF6"
        strokeWidth="2"
        strokeDasharray="4 5"
        opacity="0.55"
      />
      <path
        d="M112 42h48M136 18a32 32 0 0 1 0 48 32 32 0 0 1 0-48z"
        stroke="#8B5CF6"
        strokeWidth="1.4"
        opacity="0.4"
      />

      <motion.path
        d="M92 100C100 78 114 58 126 48"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
        animate={shouldReduceMotion ? undefined : { strokeDashoffset: [0, -16] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "linear" }
        }
      />

      <rect x="48" y="90" width="58" height="28" rx="7" fill="#4338ca" />
      <rect x="48" y="90" width="58" height="28" rx="7" fill="#7c3aed" opacity="0.15" />
      <rect x="56" y="84" width="4" height="8" rx="2" fill="#4338ca" />
      <rect x="94" y="84" width="4" height="8" rx="2" fill="#4338ca" />
      <circle cx="60" cy="104" r="2.6" fill="white" />
      <motion.circle
        cx="70"
        cy="104"
        r="2.6"
        fill="#22d3ee"
        animate={shouldReduceMotion ? { opacity: 0.7 } : { opacity: [0.25, 1, 0.25] }}
        transition={
          shouldReduceMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
        }
      />
      <circle cx="80" cy="104" r="2.6" fill="white" opacity="0.5" />
    </svg>
  );
}

function fmt(value: number | null, digits: number, unit: string) {
  return value != null ? `${value.toFixed(digits)} ${unit}` : "—";
}

/** One ISP's own health: status, latency/loss, live rate and its own
 * recent-check timeline. Shown for every uplink, so a venue on two ISPs
 * sees each line separately, not only the one flagged active. */
export function UplinkHealthRow({ link, checks }: { link: IspLink; checks: IspHealthCheck[] }) {
  const style = WAN_HEALTH_STYLE[link.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5 text-xs">
          <IspProviderIcon providerName={link.providerName} className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-foreground">{link.providerName}</span>
          <span className="text-muted-foreground">
            · {link.role === "primary" ? "Primary" : "Backup"}
            {link.interface ? ` · ${link.interface}` : ""}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", style.dot)} />
          <span className={cn("text-xs font-semibold", style.text)}>{style.label}</span>
          {link.healthStatusSource === "manual" && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] font-normal text-muted-foreground"
              title="Manually set by an admin, not the automated health-check sweep"
            >
              Manual
            </Badge>
          )}
        </span>
      </div>
      {link.healthStatus === "unhealthy" && link.unhealthySince && (
        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
          Down for {formatDownDuration(link.unhealthySince)}
        </p>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
        <span>
          ↓{" "}
          <span className="tabular-nums text-foreground">
            {fmt(link.currentDownloadMbps, 0, "Mbps")}
          </span>
        </span>
        <span>
          ↑{" "}
          <span className="tabular-nums text-foreground">
            {fmt(link.currentUploadMbps, 0, "Mbps")}
          </span>
        </span>
        <span>
          Latency{" "}
          <span className="tabular-nums text-foreground">{fmt(link.latencyMs, 0, "ms")}</span>
        </span>
        <span>
          Loss{" "}
          <span className="tabular-nums text-foreground">
            {fmt(link.packetLossPercentage, 1, "%")}
          </span>
        </span>
      </div>
      <WanRecentChecks checks={checks} />
    </div>
  );
}

const INTEGRATED_STYLE_KEY = {
  healthy: "healthy",
  degraded: "degraded",
  unhealthy: "unhealthy",
  unknown: "unknown",
} as const;

/**
 * The dashboard's own WAN/Internet Connection status widget. One uplink:
 * that link's real status and history. Two or more: an integrated reading
 * first (how many ISPs are up), then every ISP's own health row underneath.
 * Live traffic is the Bandwidth Utilization card's job, not repeated here. An honest setup prompt
 * when no `IspLink` is configured yet.
 */
export function WanStatusCard({
  locationId,
  onManage,
}: {
  locationId: string;
  onManage: () => void;
}) {
  const wan = useWanSummary(locationId);
  return (
    <Card className="premium-card premium-card-hover h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C4EFF] to-[#8B5CF6]">
            <Globe className="h-3.5 w-3.5 text-white" />
          </div>
          <CardTitle className="text-sm">Internet Connection</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={onManage}>
          Manage →
        </Button>
      </CardHeader>
      <CardContent>
        {wan.status === "loading" && (
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className="h-5 w-1.5 animate-pulse rounded-sm bg-muted" />
              ))}
            </div>
          </div>
        )}
        {wan.status === "empty" && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-4 py-6 text-center">
            <WanSetupIllustration />
            <div>
              <p className="text-sm font-semibold text-foreground">No WAN link configured</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect this location's internet uplink to see live up/down status here.
              </p>
            </div>
            <Button size="sm" variant="outline" className="mt-1 text-xs" onClick={onManage}>
              Set up Internet Connection
            </Button>
          </div>
        )}
        {wan.status === "ready" && wan.links.length === 1 && (
          <SingleWanView link={wan.links[0]} checks={wan.checks[wan.links[0].id] ?? []} />
        )}
        {wan.status === "ready" && wan.links.length > 1 && (
          <MultiWanView links={wan.links} checks={wan.checks} />
        )}
      </CardContent>
    </Card>
  );
}

function SingleWanView({ link, checks }: { link: IspLink; checks: IspHealthCheck[] }) {
  const style = WAN_HEALTH_STYLE[link.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", style.dot)} />
            <span className={cn("text-base font-semibold leading-none", style.text)}>
              {style.label}
            </span>
            {link.healthStatusSource === "manual" && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] font-normal text-muted-foreground"
                title="Manually set by an admin, not the automated health-check sweep"
              >
                Manual
              </Badge>
            )}
          </div>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <IspProviderIcon providerName={link.providerName} className="h-4 w-4" />
            <span className="truncate">
              {link.providerName} ·{" "}
              {WAN_CONNECTION_MODE_LABEL[link.connectionMode] ?? link.connectionMode}
            </span>
          </span>
        </div>
        {link.healthStatus === "unhealthy" && link.unhealthySince && (
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
            Down for {formatDownDuration(link.unhealthySince)}
          </p>
        )}
        <div className="mt-2">
          <WanRecentChecks checks={checks} />
        </div>
      </div>
    </div>
  );
}

function MultiWanView({
  links,
  checks,
}: {
  links: IspLink[];
  checks: Record<string, IspHealthCheck[]>;
}) {
  const health = integratedWanHealth(links);
  const style = WAN_HEALTH_STYLE[INTEGRATED_STYLE_KEY[health.status]];
  const working = links.filter((l) => l.isEnabled && l.healthStatus !== "unhealthy");
  let headline: string;
  if (health.status === "unknown") headline = "Not checked yet";
  else if (health.status === "unhealthy") headline = "All ISPs down";
  else if (health.status === "healthy") headline = `All ${health.total} ISPs online`;
  else if (health.down > 0) headline = `${health.down} of ${health.total} ISPs down`;
  else headline = `${health.degraded} of ${health.total} ISPs degraded`;
  return (
    <div className="space-y-4">
      {/* Integrated reading */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Integrated · {health.total} ISPs
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", style.dot)} />
          <span className={cn("text-base font-semibold leading-none", style.text)}>{headline}</span>
        </div>
        {health.down > 0 && health.status !== "unhealthy" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Guests are running on {working.map((l) => l.providerName).join(" + ")} only
            {health.planDownloadMbps != null && " — reduced capacity"}.
          </p>
        )}
      </div>

      {/* Each ISP on its own */}
      <div className="space-y-2 border-t border-border/60 pt-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Each ISP
        </p>
        {links.map((l) => (
          <UplinkHealthRow key={l.id} link={l} checks={checks[l.id] ?? []} />
        ))}
        <p className="pt-0.5 text-[11px] text-muted-foreground">
          If one ISP fails its health checks, traffic moves to the remaining ISP automatically.
        </p>
      </div>
    </div>
  );
}
