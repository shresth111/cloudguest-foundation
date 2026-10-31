import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronDown, Wrench } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusDot, type ConsoleStatus } from "@/components/customer/console";
import { useConsoleHealth } from "@/components/customer/useConsoleHealth";
import { useVenueIssues, venueVerdict, type VenueVerdict } from "@/components/customer/venueIssues";
import { actionLabel, rowCopy } from "@/components/customer/dashboard/needsAttentionCopy";
import type {
  AttentionItem,
  AttentionSeverity,
} from "@/components/customer/dashboard/needsAttentionModel";
import { customerFeatureHref } from "@/lib/customerNav";
import { stateIsControllerManaged, livenessTone } from "@/lib/location-liveness";
import { formatRelative } from "@/lib/format";
import type { LocationLiveness, RouterLiveness } from "@/lib/location-liveness";

function routerStatus(r: RouterLiveness): ConsoleStatus {
  if (r.status === "pass") return "ok";
  if (r.status === "unknown") return "offline";
  return r.state === "heartbeat-late" ? "warn" : "crit";
}

/** The router's short badge word. `@/lib/location-liveness` writes it in
 * English for every console; the customer shell looks it up by its English
 * text, so an unknown future label still renders (in English) rather than a
 * raw key. */
const ROUTER_LABEL_KEY: Record<string, string> = {
  Online: "online",
  "Gone quiet": "goneQuiet",
  "Can't confirm": "cantConfirm",
  "Never checked in": "neverCheckedIn",
  "Waiting for setup": "waitingForSetup",
  "Setup not started": "setupNotStarted",
  Suspended: "suspended",
  Retired: "retired",
  "Controller down": "controllerDown",
  "Managed by controller": "managedByController",
};
function routerLabel(r: RouterLiveness, t: TFunction): string {
  const k = ROUTER_LABEL_KEY[r.shortLabel];
  return k ? t(`consoleShell.health.router.${k}`, r.shortLabel) : r.shortLabel;
}

/** `lastContactLabel` from `@/lib/location-liveness`, in the dashboard
 * language, with the shared relative-time formatter. */
function lastContact(r: RouterLiveness, t: TFunction, lang: string, now: Date): string {
  if (stateIsControllerManaged(r.state))
    return t("consoleShell.health.contact.notMeasured", "Not measured here");
  if (r.lastContactKind === "none")
    return t("consoleShell.health.contact.never", "Never heard from this router");
  if (!r.lastContactIso || !Number.isFinite(new Date(r.lastContactIso).getTime()))
    return t("consoleShell.health.contact.unknown", "Last contact time unknown");
  const ago = formatRelative(r.lastContactIso, lang, { now: now.getTime() });
  switch (r.lastContactKind) {
    case "heartbeat":
      return t("consoleShell.health.contact.heartbeat", {
        ago,
        defaultValue: "Last check-in {{ago}}",
      });
    case "enrolment":
      return t("consoleShell.health.contact.enrolment", {
        ago,
        defaultValue: "Setup started {{ago}} — no check-in since",
      });
    default:
      return t("consoleShell.health.contact.other", { ago, defaultValue: "Last contact {{ago}}" });
  }
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

const SEVERITY_STATUS: Record<AttentionSeverity, ConsoleStatus> = {
  error: "crit",
  warning: "warn",
  info: "info",
};

/** The pill's own short words for a single issue -- the popover and the
 * Needs-attention card carry the full sentence. `t` is the `nav` namespace. */
function shortIssueLabel(item: AttentionItem, t: TFunction): string {
  const count = item.params.count ?? 1;
  switch (item.kind) {
    case "venueOffline":
      return (item.params.total ?? 1) > 1
        ? t("consoleShell.health.short.routersOffline", "Routers offline")
        : t("consoleShell.health.short.routerOffline", "Router offline");
    case "routersPartlyOffline":
      return t("consoleShell.health.short.someRoutersOffline", {
        count,
        defaultValue_one: "{{count}} router offline",
        defaultValue_other: "{{count}} routers offline",
      });
    case "noRouter":
      return t("consoleShell.health.short.noRouter", "No router yet");
    case "criticalAlerts":
      return t("consoleShell.health.short.criticalAlerts", {
        count,
        defaultValue_one: "{{count}} critical alert",
        defaultValue_other: "{{count}} critical alerts",
      });
    case "warningAlerts":
      return t("consoleShell.health.short.warningAlerts", {
        count,
        defaultValue_one: "{{count}} warning",
        defaultValue_other: "{{count}} warnings",
      });
    case "devicesDown":
      return t("consoleShell.health.short.devicesDown", {
        count,
        defaultValue_one: "{{count}} device down",
        defaultValue_other: "{{count}} devices down",
      });
    case "devicesUnstable":
      return t("consoleShell.health.short.devicesUnstable", {
        count,
        defaultValue_one: "{{count}} device unstable",
        defaultValue_other: "{{count}} devices unstable",
      });
    case "ispDown":
      return t("consoleShell.health.short.ispDown", "Internet line down");
    case "ispDegraded":
      return t("consoleShell.health.short.ispDegraded", "Internet line degraded");
    case "failedLogins":
      return t("consoleShell.health.short.failedLogins", {
        count,
        defaultValue_one: "{{count}} failed sign-in",
        defaultValue_other: "{{count}} failed sign-ins",
      });
    case "planExpired":
      return t("consoleShell.health.short.planExpired", "Plan expired");
    case "planPastDue":
      return t("consoleShell.health.short.planPastDue", "Payment overdue");
    case "planExpiring":
      return t("consoleShell.health.short.planExpiring", "Plan ending soon");
  }
}

function verdictText(v: VenueVerdict, liveness: LocationLiveness, t: TFunction): string {
  switch (v.label.key) {
    case "allNormal":
      return t("consoleShell.health.allNormal", "All systems normal");
    case "routersCheckingIn":
      return t("consoleShell.health.routersCheckingIn", "Routers checking in");
    case "checking":
      return t("consoleShell.health.checking", "Checking…");
    case "notAllChecked":
      return t("consoleShell.health.notAllChecked", "Couldn't check everything");
    case "needAttention":
      return t("consoleShell.health.needAttention", {
        count: v.label.count,
        defaultValue_one: "{{count}} needs attention",
        defaultValue_other: "{{count}} need attention",
      });
    case "single":
      return shortIssueLabel(v.label.item, t);
    case "liveness":
      return liveness.label;
  }
}

const ROW_LINK =
  "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--wy-accent)] hover:bg-[var(--wy-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]";

/**
 * The global health pill: the venue's ONE verdict, opening a popover that
 * lists every issue with the page that fixes it.
 *
 * It reads the same issue list as the Dashboard's Needs-attention card and
 * the bell (`useVenueIssues`), so its count is theirs. It says "All systems
 * normal" only when that full list was checked and is empty; with nothing
 * but router liveness to go on (a page opened before the Dashboard this
 * session) it says "Routers checking in" -- what it actually measured.
 */
export function ConsoleHealthPill({ locationId }: { locationId: string }) {
  const { t } = useTranslation("nav", { i18n });
  const { t: tna, i18n: inst } = useTranslation("needsAttention", { i18n });
  const health = useConsoleHealth(locationId);
  const now = useMinuteTick();
  const issues = useVenueIssues(locationId, now.getTime());
  if (!health || !issues) return null;
  const { liveness } = health;
  // `?? []`: the snapshot is persisted in localStorage, so a summary written
  // by an older build (or a partial stub) can arrive without the array.
  const routers = liveness.routers ?? [];
  const tone = livenessTone(liveness.state);
  const verdict = venueVerdict(issues);
  const status = verdict.status;
  const pillLabel = verdictText(verdict, liveness, t);
  const lang = inst.language || "en";
  const checked =
    issues.checkedAt != null
      ? t("consoleShell.health.checkedAgo", {
          ago: formatRelative(issues.checkedAt, lang, { now: now.getTime() }),
          defaultValue: "Live · checked {{ago}}",
        })
      : t(
          "consoleShell.health.snapshot",
          "Last known status, from when this venue was opened. The Dashboard checks it live.",
        );
  const scopeNote =
    issues.source === "routers"
      ? t(
          "consoleShell.health.routersOnlyNote",
          "Only your routers were checked. Open the Dashboard to also check alerts, devices and internet lines.",
        )
      : null;

  return (
    <Popover>
      <PopoverTrigger
        data-wy="health-pill"
        data-status={status}
        aria-label={`${t("consoleShell.health.title", "Venue health")}: ${pillLabel}`}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-2.5 text-xs font-semibold transition-colors hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]",
          PILL_TONE[status],
        )}
      >
        <StatusDot
          status={status}
          label={pillLabel}
          pulse={issues.checkedAt != null && status !== "offline"}
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
          <StatusDot status={status} label={pillLabel} className="mt-1.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{pillLabel}</p>
            {/* Router liveness, in the liveness module's own words. */}
            {/* Only with nothing listed below: with issues, each row (and
                the router list) already says it, and saying it here too was
                one more restatement of the same outage. */}
            {issues.items.length === 0 && (
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--wy-text-muted)]">
                {liveness.summary}
              </p>
            )}
          </div>
        </div>
        <div className="max-h-[22rem] overflow-y-auto">
          {issues.items.length > 0 && (
            <ul
              className="divide-y divide-[var(--wy-border)] border-b border-[var(--wy-border)]"
              data-testid="health-issues"
            >
              {issues.items.map((item) => {
                const copy = rowCopy(item, tna, lang);
                return (
                  <li key={item.kind} className="flex items-start gap-2.5 px-4 py-2.5">
                    <StatusDot
                      status={SEVERITY_STATUS[item.severity]}
                      label={tna(`severity.${item.severity}`, item.severity)}
                      className="mt-1.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{copy.title}</p>
                      {copy.detail && (
                        <p className="text-[11px] leading-snug text-[var(--wy-text-muted)]">
                          {copy.detail}
                        </p>
                      )}
                    </div>
                    {item.actionId && (
                      <Link to={customerFeatureHref(item.actionId)} className={ROW_LINK}>
                        {actionLabel(item.actionId, tna)}
                        <ArrowRight aria-hidden className="h-3 w-3" />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {routers.length > 0 && (
            <>
              <p className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--wy-text-faint)]">
                {t("consoleShell.health.routersHeading", {
                  online: liveness.routersOnline ?? 0,
                  total: liveness.routersTotal ?? routers.length,
                  defaultValue: "Routers · {{online}} of {{total}} checking in",
                })}
              </p>
              <ul className="divide-y divide-[var(--wy-border)]">
                {routers.map((r) => {
                  const rs = routerStatus(r);
                  return (
                    <li key={r.key} className="flex gap-2.5 px-4 py-2">
                      <StatusDot status={rs} label={routerLabel(r, t)} className="mt-1.5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium">{r.label}</span>
                          <span className="shrink-0 text-[11px] font-medium text-[var(--wy-text-muted)]">
                            {routerLabel(r, t)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--wy-text-faint)]">
                          {lastContact(r, t, lang, now)}
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
            </>
          )}
        </div>
        <div className="space-y-2 border-t border-[var(--wy-border)] bg-[var(--wy-surface-2)] px-4 py-2.5">
          <p className="text-[11px] leading-snug text-[var(--wy-text-faint)]">{checked}</p>
          {scopeNote && (
            <p className="text-[11px] leading-snug text-[var(--wy-text-muted)]">{scopeNote}</p>
          )}
          <div className="flex items-center justify-end gap-1.5 empty:hidden">
            {issues.source === "routers" && (
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
