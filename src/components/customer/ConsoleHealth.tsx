import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusDot, livenessToStatus, type ConsoleStatus } from "@/components/customer/console";
import { useConsoleHealth } from "@/components/customer/useConsoleHealth";
import { customerFeatureHref } from "@/lib/customerNav";
import { formatAgo, lastContactLabel, livenessTone } from "@/lib/location-liveness";
import type { LocationLiveness, RouterLiveness } from "@/lib/location-liveness";

/** Routers whose own verdict is a failure -- the "issues" the pill counts. */
function failingRouters(liveness: LocationLiveness): RouterLiveness[] {
  return (liveness.routers ?? []).filter((r) => r.status === "fail");
}

function routerStatus(r: RouterLiveness): ConsoleStatus {
  if (r.status === "pass") return "ok";
  if (r.status === "unknown") return "offline";
  return r.state === "heartbeat-late" ? "warn" : "crit";
}

/** Re-render once a minute so "checked 2 min ago" does not freeze. */
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const PILL_TONE: Record<ConsoleStatus, string> = {
  ok: "border-[color-mix(in_oklab,var(--wy-ok)_25%,transparent)] bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]",
  warn: "border-[color-mix(in_oklab,var(--wy-warn)_25%,transparent)] bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
  crit: "border-[color-mix(in_oklab,var(--wy-crit)_25%,transparent)] bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]",
  info: "border-[color-mix(in_oklab,var(--wy-info)_25%,transparent)] bg-[var(--wy-info-soft)] text-[var(--wy-info)]",
  offline: "border-[var(--wy-border)] bg-[var(--wy-offline-soft)] text-[var(--wy-offline)]",
};

/**
 * The global health pill: one word about the active venue, opening a
 * popover that lists each router's verdict and links to Fix a Problem.
 * Every word in it is the liveness module's own -- nothing is computed here
 * beyond counting the routers that module already marked `fail`.
 */
export function ConsoleHealthPill({ locationId }: { locationId: string }) {
  const { t } = useTranslation("nav", { i18n });
  const health = useConsoleHealth(locationId);
  const now = useMinuteTick();
  if (!health) return null;
  const { liveness, source, updatedAt } = health;
  // `?? []`: the snapshot is persisted in localStorage, so a summary written
  // by an older build (or a partial stub) can arrive without the array.
  const routers = liveness.routers ?? [];
  const tone = livenessTone(liveness.state);
  const status = livenessToStatus(tone);
  const issues = failingRouters(liveness).length;
  const pillLabel =
    tone === "live"
      ? t("consoleShell.health.allNormal", "All systems normal")
      : (tone === "warn" || tone === "down") && issues > 0
        ? t("consoleShell.health.issues", { count: issues, defaultValue: "{{count}} issues" })
        : liveness.label;
  const checked =
    source === "live" && updatedAt
      ? t("consoleShell.health.checkedAgo", {
          ago: formatAgo(new Date(updatedAt).toISOString(), now) ?? "",
          defaultValue: "Live · checked {{ago}}",
        })
      : t(
          "consoleShell.health.snapshot",
          "Last known status, from when this venue was opened. The Dashboard checks it live.",
        );

  return (
    <Popover>
      <PopoverTrigger
        data-wy="health-pill"
        aria-label={`${t("consoleShell.health.title", "Venue health")}: ${pillLabel}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
          PILL_TONE[status],
        )}
      >
        <StatusDot
          status={status}
          label={pillLabel}
          pulse={source === "live" && tone !== "neutral"}
        />
        <span className="whitespace-nowrap">{pillLabel}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-70" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="wy-console w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-[var(--wy-radius-lg)] border-[var(--wy-border)] bg-[var(--wy-surface)] p-0 text-[var(--wy-text)] shadow-lg"
      >
        <div className="flex items-start gap-2.5 border-b border-[var(--wy-border)] px-4 py-3">
          <StatusDot status={status} label={liveness.label} className="mt-1.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{liveness.label}</p>
            {/* Server/liveness copy, as written. */}
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--wy-text-muted)]">
              {liveness.summary}
            </p>
          </div>
        </div>
        {routers.length > 0 && (
          <ul className="max-h-64 divide-y divide-[var(--wy-border)] overflow-y-auto">
            {routers.map((r) => {
              const rs = routerStatus(r);
              return (
                <li key={r.key} className="flex gap-2.5 px-4 py-2.5">
                  <StatusDot status={rs} label={r.shortLabel} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-medium">{r.label}</span>
                      <span className="shrink-0 text-[11px] font-medium text-[var(--wy-text-muted)]">
                        {r.shortLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--wy-text-faint)]">
                      {lastContactLabel(r, now)}
                    </p>
                    {r.nextStep && r.status !== "pass" && (
                      <p className="mt-1 text-xs leading-relaxed text-[var(--wy-text-muted)]">
                        {r.nextStep}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="space-y-2 border-t border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-4 py-2.5">
          <p className="text-[11px] leading-snug text-[var(--wy-text-faint)]">{checked}</p>
          <div className="flex items-center justify-end gap-1.5 empty:hidden">
            {source === "snapshot" && (
              <Link
                to={customerFeatureHref("dashboard")}
                className="rounded-md px-2 py-1 text-xs font-medium text-[var(--wy-text-muted)] hover:bg-[var(--wy-surface)] hover:text-[var(--wy-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
              >
                {t("customerItem.dashboard", "Dashboard")}
              </Link>
            )}
            {tone !== "live" && (
              <Link
                to={customerFeatureHref("debugging")}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--wy-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--wy-accent-fg)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] focus-visible:ring-offset-1"
              >
                <Wrench aria-hidden className="h-3.5 w-3.5" />
                {t("customerItem.debugging", "Fix a Problem")}
              </Link>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
