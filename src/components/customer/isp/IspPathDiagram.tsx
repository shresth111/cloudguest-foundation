/**
 * Venue -> router port -> ISP -> internet, drawn the way the Overview's
 * topology map draws the same chain: bordered nodes, status dots, a solid
 * path for the line carrying traffic and a dashed one for standby. Only
 * what the page already knows -- the router row, each link's own interface
 * name and health -- so a port label appears only when the link records one.
 * Below `sm` it stacks vertically.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Globe, Router as RouterIcon, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot, type ConsoleStatus } from "@/components/customer/console";
import { IspProviderIcon } from "@/components/icons/isp";
import type { RouterDevice } from "@/types/router";
import type { IspLink } from "@/types/isp";
import { linkStatus, type FailoverState } from "./isp-model";
import { STATUS_TEXT, ispColor, useIspT, useStatusWord } from "./isp-shared";

function Node({
  icon,
  title,
  sub,
  status,
  statusLabel,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  status?: ConsoleStatus;
  statusLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2.5 py-1.5",
        className,
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--wy-surface-2)] text-[var(--wy-text-muted)] [&_svg]:h-3.5 [&_svg]:w-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[var(--wy-text)]">{title}</span>
        {sub != null && (
          <span className="block truncate text-[11px] text-[var(--wy-text-muted)]">{sub}</span>
        )}
      </span>
      {status && statusLabel && <StatusDot status={status} label={statusLabel} />}
    </div>
  );
}

/** A connector. `active` = solid accent-free text colour; standby = dashed. */
function Wire({
  active,
  down,
  label,
  vertical,
}: {
  active: boolean;
  down?: boolean;
  label?: string | null;
  vertical?: boolean;
}) {
  const stroke = down
    ? "border-[var(--wy-crit)]"
    : active
      ? "border-[var(--wy-text-muted)]"
      : "border-[var(--wy-border-strong)]";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        vertical ? "h-5 w-full flex-col" : "h-full min-w-6 flex-1",
      )}
      aria-hidden
    >
      <span
        className={cn(
          vertical ? "h-full border-l-[1.5px]" : "w-full border-t-[1.5px]",
          active ? "border-solid" : "border-dashed",
          stroke,
        )}
      />
      {label && (
        <span className="absolute rounded bg-[var(--wy-surface)] px-1 font-mono text-[10px] leading-4 text-[var(--wy-text-faint)]">
          {label}
        </span>
      )}
    </div>
  );
}

function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() =>
    typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return ok;
}

export function IspPathDiagram({
  router,
  links,
  failover,
}: {
  router: RouterDevice;
  links: IspLink[];
  failover: FailoverState;
}) {
  const { t } = useIspT();
  const word = useStatusWord();
  // One layout in the DOM, not two with one display:none: provider icons
  // carry SVG gradient ids, and a hidden duplicate breaks every other copy.
  const wide = useMinWidth(640);
  const routerOnline = router.status === "online";
  const anyUp = links.some(
    (l) => l.isEnabled && (l.healthStatus === "healthy" || l.healthStatus === "degraded"),
  );
  const internetStatus: ConsoleStatus =
    failover.kind === "all-down"
      ? "crit"
      : anyUp
        ? failover.kind === "on-backup"
          ? "warn"
          : "ok"
        : "offline";
  const internetWord =
    internetStatus === "crit"
      ? t("path.unreachable", "Unreachable")
      : internetStatus === "offline"
        ? t("status.unknown", "Not checked")
        : failover.kind === "on-backup"
          ? t("path.viaBackup", "Via backup")
          : t("path.reachable", "Reachable");
  const multi = links.length > 1;
  const n = links.length;
  const inset = `${50 / n}%`;

  const ispNode = (l: IspLink, i: number) => (
    <Node
      icon={<IspProviderIcon providerName={l.providerName} className="h-4 w-4" />}
      title={
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-sm"
            style={{ background: ispColor(i) }}
          />
          <span className="truncate">{l.providerName}</span>
        </span>
      }
      sub={
        <span className={cn(STATUS_TEXT[linkStatus(l.healthStatus)])}>
          {word(l.healthStatus)}
          {multi && (
            <span className="text-[var(--wy-text-faint)]">
              {" · "}
              {l.isActiveUplink
                ? t("role.active", "In use")
                : l.healthStatus === "unhealthy"
                  ? t("role.idle", "Not in use")
                  : t("role.standby", "Standby")}
            </span>
          )}
        </span>
      }
      status={linkStatus(l.healthStatus)}
      statusLabel={word(l.healthStatus)}
      className="w-full"
    />
  );

  return (
    <figure aria-label={t("path.label", "How your venue reaches the internet")} className="m-0">
      {/* Desktop: left -> right */}
      {wide ? (
        <div className="flex items-center">
          <Node
            icon={<Users />}
            title={t("path.venue", "Your venue")}
            sub={t("path.guests", "Guest WiFi")}
            className="w-36 shrink-0"
          />
          <Wire active={routerOnline} />
          <Node
            icon={<RouterIcon />}
            title={router.name}
            sub={router.model ?? t("path.router", "Router")}
            status={routerOnline ? "ok" : "crit"}
            statusLabel={
              routerOnline
                ? t("path.routerOnline", "Router online")
                : t("path.routerOffline", "Router offline")
            }
            className="w-44 shrink-0"
          />
          {/* Branches: one row per link, joined by a bus on each side. */}
          <div className="relative flex min-w-0 flex-[3] flex-col gap-2">
            <span
              aria-hidden
              className="absolute left-0 border-l-[1.5px] border-[var(--wy-border-strong)]"
              style={{ top: inset, bottom: inset }}
            />
            <span
              aria-hidden
              className="absolute right-0 border-l-[1.5px] border-[var(--wy-border-strong)]"
              style={{ top: inset, bottom: inset }}
            />
            {links.map((l, i) => {
              const carrying = multi ? l.isActiveUplink : true;
              const down = l.healthStatus === "unhealthy";
              return (
                <div key={l.id} className="flex h-11 items-center">
                  <Wire active={carrying} down={down} label={l.interface} />
                  <div className="w-44 shrink-0">{ispNode(l, i)}</div>
                  <Wire active={carrying} down={down} />
                </div>
              );
            })}
          </div>
          <Node
            icon={<Globe />}
            title={t("path.internet", "Internet")}
            sub={<span className={STATUS_TEXT[internetStatus]}>{internetWord}</span>}
            status={internetStatus}
            statusLabel={internetWord}
            className="w-36 shrink-0"
          />
        </div>
      ) : (
        <div className="flex flex-col items-stretch">
          <Node
            icon={<Users />}
            title={t("path.venue", "Your venue")}
            sub={t("path.guests", "Guest WiFi")}
          />
          <Wire vertical active={routerOnline} />
          <Node
            icon={<RouterIcon />}
            title={router.name}
            sub={router.model ?? t("path.router", "Router")}
            status={routerOnline ? "ok" : "crit"}
            statusLabel={
              routerOnline
                ? t("path.routerOnline", "Router online")
                : t("path.routerOffline", "Router offline")
            }
          />
          <div className="flex flex-col gap-1.5 border-l-[1.5px] border-[var(--wy-border-strong)] py-2 pl-3 ml-4">
            {links.map((l, i) => (
              <div key={l.id} className="flex items-center gap-2">
                {l.interface && (
                  <span className="w-10 shrink-0 font-mono text-[10px] text-[var(--wy-text-faint)]">
                    {l.interface}
                  </span>
                )}
                <div className="min-w-0 flex-1">{ispNode(l, i)}</div>
              </div>
            ))}
          </div>
          <Node
            icon={<Globe />}
            title={t("path.internet", "Internet")}
            sub={<span className={STATUS_TEXT[internetStatus]}>{internetWord}</span>}
            status={internetStatus}
            statusLabel={internetWord}
          />
        </div>
      )}
    </figure>
  );
}
