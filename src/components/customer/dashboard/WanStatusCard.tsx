import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Globe, Gauge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isDemo } from "@/services/customer.service";
import { ispService } from "@/services/isp.service";
import type { AppError } from "@/services/api";
import type { IspLink, IspHealthCheck } from "@/types/isp";
import { IspProviderIcon } from "@/components/icons/isp";
import {
  WAN_HEALTH_STYLE,
  WAN_CONNECTION_MODE_LABEL,
  formatDownDuration,
  type SpeedTestState,
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

/** One uplink row plus its own on-demand "Run Speed Test" action */
export function UplinkRow({ link }: { link: IspLink }) {
  const [state, setState] = useState<SpeedTestState>({ status: "idle" });

  const runSpeedTest = async () => {
    if (isDemo()) {
      toast.info("Speed tests run against real router hardware — not available in demo mode.");
      return;
    }
    setState({ status: "running" });
    try {
      const result = await ispService.runSpeedTest(link.id);
      setState({ status: "done", result });
    } catch (err) {
      const message = (err as AppError).message || "Speed test failed.";
      setState({ status: "error", message });
      toast.error(message);
    }
  };

  return (
    <div className="space-y-1">
      {/* Fixed columns (name | role | state | action), not a free-flowing
       * row: with a flowing row "Primary"/"Backup" started wherever the
       * provider name happened to end and the Active/Standby badges were
       * different widths, so no two uplinks lined up. */}
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.75rem_auto] items-center gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <IspProviderIcon providerName={link.providerName} className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-foreground">{link.providerName}</span>
        </span>
        <span className="text-muted-foreground">
          {link.role === "primary" ? "Primary" : "Backup"}
        </span>
        <Badge
          variant={link.isActiveUplink ? "default" : "secondary"}
          className="h-5 w-full justify-center px-1.5 text-[10px]"
        >
          {link.isActiveUplink ? "Active" : "Standby"}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 gap-1 px-1.5 text-[10px] font-medium text-primary hover:text-primary"
          disabled={state.status === "running"}
          onClick={runSpeedTest}
          title="Run a real speed test against this link's router"
        >
          <Gauge className={cn("h-3 w-3", state.status === "running" && "animate-spin")} />
          {state.status === "running" ? "Testing…" : "Speed Test"}
        </Button>
      </div>
      {state.status === "running" && (
        <div className="flex items-center gap-1.5 pl-[22px] text-[10px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Measuring real download speed — real traffic, can take up to a minute…
        </div>
      )}
      {state.status === "done" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-[22px] text-[10px]">
          <span className="font-semibold text-foreground">
            {state.result.downloadMbps.toFixed(1)} Mbps{" "}
            <span className="font-normal text-muted-foreground">↓</span>
          </span>
          {state.result.latencyMs != null && (
            <span className="text-muted-foreground">
              {state.result.latencyMs.toFixed(0)}ms latency
            </span>
          )}
          <span className="text-muted-foreground/70">upload not measurable on this hardware</span>
        </div>
      )}
    </div>
  );
}

/**
 * The dashboard's own WAN/Internet Connection status widget: real up/down
 * state + a real recent-history timeline for this location's primary
 * uplink, or an honest setup prompt when no `IspLink` is configured yet.
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
        {wan.status === "ready" &&
          (() => {
            const active = wan.links.find((l) => l.isActiveUplink) ?? wan.links[0];
            const backup = wan.links.find((l) => l.id !== active.id);
            const primary = wan.links.find((l) => l.role === "primary") ?? active;
            const style = WAN_HEALTH_STYLE[active.healthStatus] ?? WAN_HEALTH_STYLE.unknown;
            const hasBandwidth =
              active.currentDownloadMbps != null || active.currentUploadMbps != null;
            return (
              <div className="space-y-4">
                {/* Connection status */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                      <span className={cn("text-base font-semibold leading-none", style.text)}>
                        {style.label}
                      </span>
                      {active.healthStatusSource === "manual" && (
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
                      <IspProviderIcon providerName={active.providerName} className="h-4 w-4" />
                      <span className="truncate">
                        {active.providerName} ·{" "}
                        {WAN_CONNECTION_MODE_LABEL[active.connectionMode] ?? active.connectionMode}
                      </span>
                    </span>
                  </div>
                  {active.healthStatus === "unhealthy" && active.unhealthySince && (
                    <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                      Down for {formatDownDuration(active.unhealthySince)}
                    </p>
                  )}
                  <div className="mt-2">
                    <WanRecentChecks checks={wan.checks} />
                  </div>
                </div>

                {/* Bandwidth */}
                {hasBandwidth && (
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Bandwidth · live
                    </p>
                    {/* One equal-width cell per figure, value over label, so
                     * the four numbers sit on one baseline and one grid
                     * instead of wrapping at whatever width the card has. */}
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                      {[
                        {
                          label: "Download",
                          value: active.currentDownloadMbps,
                          unit: "Mbps",
                          digits: 0,
                        },
                        {
                          label: "Upload",
                          value: active.currentUploadMbps,
                          unit: "Mbps",
                          digits: 0,
                        },
                        { label: "Latency", value: active.latencyMs, unit: "ms", digits: 0 },
                        {
                          label: "Loss",
                          value: active.packetLossPercentage,
                          unit: "%",
                          digits: 1,
                        },
                      ].map((m) => (
                        <div key={m.label} className="min-w-0">
                          <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">
                            {m.value != null ? m.value.toFixed(m.digits) : "—"}
                            {m.value != null && (
                              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                {m.unit}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uplinks */}
                <div className="space-y-2.5 border-t border-border/60 pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Uplinks
                  </p>
                  {wan.links.map((l) => (
                    <UplinkRow key={l.id} link={l} />
                  ))}
                  {backup && (
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      Automatic failover armed — switches to Backup if Primary fails repeated health
                      checks
                      {primary.autoFailback
                        ? ", and returns automatically once Primary recovers."
                        : "; a manual failback is required once Primary recovers."}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}
