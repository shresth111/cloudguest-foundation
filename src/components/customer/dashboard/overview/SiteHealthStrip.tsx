/**
 * Site health at a glance: internet, router, access points, guests online.
 * One status dot and one number per cell, each cell a way into the page that
 * owns the detail. Every value is handed in from data the page already
 * holds; a cell with nothing to say shows "—" and says why, never a zero.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Router as RouterIcon, Users, Wifi } from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { integratedWanHealth } from "../dashboard.types";
import type { WanSummaryState } from "../dashboard.types";
import type { LocationLiveness, LivenessTone } from "@/lib/location-liveness";
import { StatusDot, STATUS_TEXT, type ConsoleStatus } from "./console-ui";
import { worstStatus, type TopologyModel } from "./topology-model";

const TONE_STATUS: Record<LivenessTone, ConsoleStatus> = {
  live: "ok",
  warn: "warn",
  down: "crit",
  neutral: "unknown",
};

function Cell({
  icon,
  label,
  status,
  value,
  foot,
  onClick,
  live,
  loading,
  testId,
}: {
  icon: ReactNode;
  label: string;
  status: ConsoleStatus;
  value: string;
  foot: ReactNode;
  onClick: () => void;
  live?: boolean;
  loading?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-status={status}
      className="group flex min-w-0 flex-col gap-1 bg-[var(--wy-surface)] px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--wy-surface-2)] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wy-accent)]"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--wy-text-muted)]">
        <span className="text-[var(--wy-text-faint)] [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-2">
        {loading ? (
          <span className="h-6 w-14 animate-pulse rounded bg-[var(--wy-surface-2)]" />
        ) : (
          <>
            <StatusDot status={status} live={live} />
            <span
              className={cn(
                "text-xl font-semibold tabular-nums tracking-[-0.02em]",
                value === "—" && "text-[var(--wy-text-faint)]",
              )}
            >
              {value}
            </span>
          </>
        )}
      </span>
      <span
        className={cn(
          "truncate text-xs",
          status === "crit" || status === "warn"
            ? STATUS_TEXT[status]
            : "text-[var(--wy-text-muted)]",
        )}
      >
        {!loading && foot}
      </span>
    </button>
  );
}

export function SiteHealthStrip({
  wan,
  liveness,
  tone,
  livenessLoading,
  topology,
  onlineUsers,
  onlineLoading,
  onlineFoot,
  onOpen,
}: {
  wan: WanSummaryState;
  liveness: LocationLiveness;
  tone: LivenessTone;
  livenessLoading: boolean;
  topology: TopologyModel;
  onlineUsers: number | null;
  onlineLoading: boolean;
  onlineFoot: ReactNode;
  onOpen: (featureId: string) => void;
}) {
  const { t } = useTranslation("dashboard", { i18n });

  // --- Internet
  let netStatus: ConsoleStatus = "unknown";
  let netValue = "—";
  let netFoot: ReactNode = null;
  if (wan.status === "empty") {
    netFoot = t("health.noIsp", "No ISP added yet");
  } else if (wan.status === "ready") {
    const h = integratedWanHealth(wan.links);
    netStatus =
      h.status === "healthy"
        ? "ok"
        : h.status === "degraded"
          ? "warn"
          : h.status === "unhealthy"
            ? "crit"
            : "unknown";
    netValue = h.total ? `${h.up}/${h.total}` : "—";
    const active = wan.links.find((l) => l.isActiveUplink) ?? wan.links[0];
    netFoot =
      h.status === "unknown"
        ? t("health.notChecked", "Not checked yet")
        : h.down > 0
          ? t("health.ispsDown", {
              count: h.down,
              defaultValue_one: "{{count}} ISP down",
              defaultValue_other: "{{count}} ISPs down",
            })
          : [
              active?.providerName,
              active?.latencyMs != null ? `${Math.round(active.latencyMs)} ms` : null,
            ]
              .filter(Boolean)
              .join(" · ");
  }

  // --- Router
  const rStatus = TONE_STATUS[tone];
  const rValue =
    liveness.routersOnline != null && liveness.routersTotal != null && liveness.routersTotal > 0
      ? `${liveness.routersOnline}/${liveness.routersTotal}`
      : "—";

  // --- Access points & hardware
  const c = topology.downstreamCounts;
  const total = topology.downstreamTotal;
  const apStatus = total
    ? worstStatus((Object.keys(c) as ConsoleStatus[]).flatMap((k) => (c[k] > 0 ? [k] : [])))
    : topology.downstreamState === "controller-unreachable"
      ? "warn"
      : "unknown";
  const apFoot =
    total === 0
      ? topology.downstreamState === "unmeasured"
        ? t("health.apsUnmeasured", "Managed in your vendor's app")
        : topology.downstreamState === "controller-unreachable"
          ? t("health.controllerDown", "Controller not answering")
          : topology.downstreamState === "loading"
            ? t("topology.checking", "Checking…")
            : t("health.noAps", "None added yet")
      : c.crit > 0
        ? t("health.devicesDown", {
            count: c.crit,
            defaultValue_one: "{{count}} down",
            defaultValue_other: "{{count}} down",
          })
        : c.warn > 0
          ? t("health.devicesWarn", { count: c.warn, defaultValue: "{{count}} need a look" })
          : c.ok === total
            ? t("health.allUp", "All up")
            : t("health.notMeasured", {
                count: total - c.ok,
                defaultValue: "{{count}} not measured here",
              });

  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-b-[var(--wy-radius-lg)] bg-[var(--wy-border)] lg:grid-cols-4"
      data-testid="site-health-strip"
    >
      <Cell
        testId="health-internet"
        icon={<Globe />}
        label={t("health.internet", "Internet")}
        status={netStatus}
        value={netValue}
        foot={netFoot}
        loading={wan.status === "loading"}
        onClick={() => onOpen("isp-details")}
      />
      <Cell
        testId="health-router"
        icon={<RouterIcon />}
        label={t("health.router", "Router")}
        status={rStatus}
        value={rValue}
        foot={liveness.label}
        live={tone === "live"}
        loading={livenessLoading}
        onClick={() => onOpen("devices")}
      />
      <Cell
        testId="health-aps"
        icon={<Wifi />}
        label={t("health.aps", "Access points")}
        status={apStatus}
        value={total ? `${c.ok}/${total}` : "—"}
        foot={apFoot}
        loading={topology.downstreamState === "loading"}
        onClick={() => onOpen("devices")}
      />
      <Cell
        testId="health-guests"
        icon={<Users />}
        label={t("kpi.online", "Currently online")}
        status={onlineUsers == null ? "unknown" : onlineUsers > 0 ? "ok" : "unknown"}
        value={onlineUsers == null ? "—" : onlineUsers.toLocaleString()}
        foot={onlineFoot}
        live={onlineUsers != null && onlineUsers > 0}
        loading={onlineLoading}
        onClick={() => onOpen("users")}
      />
    </div>
  );
}
