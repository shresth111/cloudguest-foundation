import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Info,
  ListChecks,
  XCircle,
} from "lucide-react";
import i18n from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { customerFeatureHref } from "@/lib/customerNav";
import { PANEL, PanelHead } from "./overview/console-ui";
import {
  useNeedsAttention,
  type AttentionItem,
  type AttentionSeverity,
  type AttentionSource,
} from "./useNeedsAttention";

// Console look: the page's shared panel chrome, status tokens for severity.
const TINT: Record<AttentionSeverity, string> = {
  error: "text-[var(--wy-crit)]",
  warning: "text-[var(--wy-warn)]",
  info: "text-[var(--wy-info)]",
};

/** The left severity rail on each row. */
const RAIL: Record<AttentionSeverity, string> = {
  error: "before:bg-[var(--wy-crit)]",
  warning: "before:bg-[var(--wy-warn)]",
  info: "before:bg-[var(--wy-info)]",
};

const ICON: Record<AttentionSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(
    d,
  );
}

function joinList(parts: string[], lang: string): string {
  try {
    return new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

/** Title + detail for one row, in the reader's language. */
function rowCopy(
  item: AttentionItem,
  t: TFunction,
  lang: string,
): { title: string; detail?: string } {
  const { count, total, days } = item.params;
  const date = formatDate(item.params.date, lang);
  switch (item.kind) {
    case "venueOffline":
      return {
        title: t("rows.venueOffline.title", "Your WiFi network is offline"),
        detail: t(
          "rows.venueOffline.detail",
          "None of the routers here are checking in, so guests may not be able to get online.",
        ),
      };
    case "routersPartlyOffline":
      return {
        title: t("rows.routersPartlyOffline.title", {
          count,
          total,
          defaultValue_one: "{{count}} of {{total}} routers isn't checking in",
          defaultValue_other: "{{count}} of {{total}} routers aren't checking in",
        }),
        detail: t(
          "rows.routersPartlyOffline.detail",
          "Guests near them may not be able to get online.",
        ),
      };
    case "noRouter":
      return {
        title: t("rows.noRouter.title", "No router added yet"),
        detail: t(
          "rows.noRouter.detail",
          "Guest WiFi starts working here once a router has been set up.",
        ),
      };
    case "criticalAlerts":
      return {
        title: t("rows.criticalAlerts.title", {
          count,
          defaultValue_one: "{{count}} critical alert is open",
          defaultValue_other: "{{count}} critical alerts are open",
        }),
      };
    case "warningAlerts":
      return {
        title: t("rows.warningAlerts.title", {
          count,
          defaultValue_one: "{{count}} warning is open",
          defaultValue_other: "{{count}} warnings are open",
        }),
      };
    case "devicesDown":
      return {
        title: t("rows.devicesDown.title", {
          count,
          defaultValue_one: "{{count}} device is down",
          defaultValue_other: "{{count}} devices are down",
        }),
        detail: t(
          "rows.devicesDown.detail",
          "Access points, printers or other hardware you monitor aren't responding.",
        ),
      };
    case "failedLogins":
      return {
        title: t("rows.failedLogins.title", {
          count,
          defaultValue_one: "{{count}} failed staff sign-in today",
          defaultValue_other: "{{count}} failed staff sign-ins today",
        }),
        detail: t("rows.failedLogins.detail", "Check that these were your own staff."),
      };
    case "planExpired":
      return {
        title: t("rows.planExpired.title", "Your plan has expired"),
        detail: date
          ? t("rows.planExpired.detail", { date, defaultValue: "It ended on {{date}}." })
          : undefined,
      };
    case "planPastDue":
      return {
        title: t("rows.planPastDue.title", "Your plan payment is overdue"),
        detail: t(
          "rows.planPastDue.detail",
          "The latest payment for your plan hasn't been received.",
        ),
      };
    case "planExpiring":
      return {
        title:
          days === 0
            ? t("rows.planExpiring.today", "Your plan ends today")
            : t("rows.planExpiring.title", {
                count: days,
                defaultValue_one: "Your plan ends in {{count}} day",
                defaultValue_other: "Your plan ends in {{count}} days",
              }),
        detail: date
          ? t("rows.planExpiring.detail", {
              date,
              defaultValue: "Ends on {{date}} and won't renew by itself.",
            })
          : undefined,
      };
  }
}

function actionLabel(id: string, t: TFunction): string {
  switch (id) {
    case "debugging":
      return t("action.debugging", "Fix a problem");
    case "alerts":
      return t("action.alerts", "View alerts");
    case "devices":
      return t("action.devices", "View devices");
    case "admin-logs":
      return t("action.admin-logs", "View staff activity");
    default:
      return id;
  }
}

function sourceLabel(s: AttentionSource, t: TFunction): string {
  switch (s) {
    case "routers":
      return t("source.routers", "routers");
    case "alerts":
      return t("source.alerts", "alerts");
    case "devices":
      return t("source.devices", "devices");
    case "staffLogins":
      return t("source.staffLogins", "staff sign-ins");
    case "plan":
      return t("source.plan", "your plan");
  }
}

function severityLabel(s: AttentionSeverity, t: TFunction): string {
  return s === "error"
    ? t("severity.error", "Problem")
    : s === "warning"
      ? t("severity.warning", "Warning")
      : t("severity.info", "Note");
}

function Note({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[11px] text-[var(--wy-text-muted)]">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * "What do I need to do right now at this venue?" -- a severity-ordered list
 * of real problems, each with the one page that fixes it. See
 * `useNeedsAttention` for where every row comes from. Never says "All good"
 * unless every source it could ask actually answered.
 */
export function NeedsAttentionCard({ locationId }: { locationId: string }) {
  const { t, i18n: inst } = useTranslation("needsAttention", { i18n });
  const lang = inst.language || "en";
  const { items, unchecked, pending, checked, loading } = useNeedsAttention(locationId);
  const list = (sources: AttentionSource[]) =>
    joinList(
      sources.map((s) => sourceLabel(s, t)),
      lang,
    );

  return (
    <section
      className={cn(PANEL, "@container flex flex-col")}
      aria-labelledby="needs-attention-title"
      aria-busy={loading || undefined}
    >
      <PanelHead
        id="needs-attention-title"
        icon={<ListChecks className="h-3.5 w-3.5" />}
        title={t("title", "Needs attention")}
        meta={t("subtitle", "What to sort out at this venue right now")}
        right={
          !loading && items.length > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                items.some((i) => i.severity === "error")
                  ? "bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]"
                  : "bg-[var(--wy-warn-soft)] text-[var(--wy-warn)]",
              )}
            >
              {items.length}
            </span>
          ) : undefined
        }
      />
      <div className="flex-1 p-3">
        {loading ? (
          <div
            className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3"
            role="status"
            aria-label={t("loading", "Checking your venue…")}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-[var(--wy-radius)] bg-[var(--wy-surface-2)]"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.length > 0 && (
              <ul
                className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2 @5xl:grid-cols-3"
                data-testid="needs-attention-list"
              >
                {items.map((item) => {
                  const Icon = ICON[item.severity];
                  const copy = rowCopy(item, t, lang);
                  return (
                    <li
                      key={item.kind}
                      data-severity={item.severity}
                      className={cn(
                        "relative flex flex-wrap items-start gap-2.5 overflow-hidden rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface-2)] py-2 pl-3.5 pr-2 before:absolute before:inset-y-0 before:left-0 before:w-[3px] sm:flex-nowrap",
                        RAIL[item.severity],
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center",
                          TINT[item.severity],
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        <span className="sr-only">{severityLabel(item.severity, t)}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{copy.title}</p>
                        {copy.detail && (
                          <p className="mt-0.5 text-[11px] text-[var(--wy-text-muted)]">
                            {copy.detail}
                          </p>
                        )}
                      </div>
                      {item.actionId && (
                        <Link
                          to={customerFeatureHref(item.actionId)}
                          data-action={item.actionId}
                          className="inline-flex shrink-0 items-center gap-1 self-center rounded-[var(--wy-radius)] border border-[var(--wy-border)] bg-[var(--wy-surface)] px-2 py-1 text-[11px] font-semibold text-[var(--wy-text)] transition-colors duration-150 hover:border-[var(--wy-accent)] hover:text-[var(--wy-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)]"
                        >
                          {actionLabel(item.actionId, t)}
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {items.length === 0 &&
              unchecked.length === 0 &&
              pending.length === 0 &&
              (checked.length > 0 ? (
                <div
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 py-1"
                  data-testid="needs-attention-all-good"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wy-ok-soft)] text-[var(--wy-ok)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                  </span>
                  <p className="text-sm font-medium">
                    {t("allGood", "All good — nothing needs your attention")}
                  </p>
                  <p className="text-[11px] text-[var(--wy-text-muted)]">
                    {t("checkedList", {
                      list: list(checked),
                      defaultValue: "We checked: {{list}}.",
                    })}
                  </p>
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-[var(--wy-text-muted)]">
                  {t("nothingToCheck", "There's nothing here we can check for your account.")}
                </p>
              ))}

            {unchecked.length > 0 && (
              <div
                data-testid="needs-attention-unchecked"
                className="rounded-[var(--wy-radius)] border border-[var(--wy-warn)]/30 bg-[var(--wy-warn-soft)] p-3 text-[var(--wy-text)]"
              >
                <p className="flex items-center gap-2 text-xs font-medium">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("couldntCheck", {
                    list: list(unchecked),
                    defaultValue: "Couldn't check: {{list}}.",
                  })}
                </p>
                {items.length === 0 && (
                  <p className="mt-1 text-[11px] opacity-80">
                    {t(
                      "couldntCheckBody",
                      "So we can't say everything is fine. Refresh the page in a minute.",
                    )}
                  </p>
                )}
              </div>
            )}

            {pending.length > 0 && (
              <Note
                icon={
                  <span className="block h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
                }
              >
                {t("stillChecking", {
                  list: list(pending),
                  defaultValue: "Still checking: {{list}}…",
                })}
              </Note>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
