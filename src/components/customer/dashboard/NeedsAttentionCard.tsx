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
import {
  useNeedsAttention,
  type AttentionItem,
  type AttentionSeverity,
  type AttentionSource,
} from "./useNeedsAttention";

// Same shell as the dashboard's own cards (`CARD` / `CardHead` in
// CustomerDashboardPage.tsx, which are not exported).
const CARD =
  "rounded-2xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-[box-shadow,border-color,transform] duration-200 hover:border-[#6C4EFF]/25 hover:shadow-[0_12px_28px_-18px_rgb(49_46_129/0.35)]";

// Same tints as the dashboard's Recent Alerts list.
const TINT: Record<AttentionSeverity, string> = {
  error: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  info: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
};

const ICON: Record<AttentionSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function CardHead({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#6C4EFF]/10 bg-[#6C4EFF]/10 text-[#6C4EFF] shadow-sm dark:bg-[#6C4EFF]/20 dark:text-indigo-300">
        <ListChecks className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

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
    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
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
      className={cn(CARD, "p-5")}
      aria-labelledby="needs-attention-title"
      aria-busy={loading || undefined}
    >
      <CardHead
        id="needs-attention-title"
        title={t("title", "Needs attention")}
        subtitle={t("subtitle", "What to sort out at this venue right now")}
      />

      {loading ? (
        <div className="space-y-3" role="status" aria-label={t("loading", "Checking your venue…")}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.length > 0 && (
            <ul className="space-y-2" data-testid="needs-attention-list">
              {items.map((item) => {
                const Icon = ICON[item.severity];
                const copy = rowCopy(item, t, lang);
                return (
                  <li
                    key={item.kind}
                    data-severity={item.severity}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-border/60 p-3 sm:flex-nowrap"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        TINT[item.severity],
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="sr-only">{severityLabel(item.severity, t)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">{copy.title}</p>
                      {copy.detail && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{copy.detail}</p>
                      )}
                    </div>
                    {item.actionId && (
                      <Link
                        to={customerFeatureHref(item.actionId)}
                        data-action={item.actionId}
                        className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-[#6C4EFF]/40 hover:text-[#6C4EFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C4EFF]/50 dark:hover:text-indigo-300"
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
                className="flex flex-col items-center gap-2 py-6 text-center"
                data-testid="needs-attention-all-good"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                </span>
                <p className="text-sm font-medium">
                  {t("allGood", "All good — nothing needs your attention")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("checkedList", { list: list(checked), defaultValue: "We checked: {{list}}." })}
                </p>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {t("nothingToCheck", "There's nothing here we can check for your account.")}
              </p>
            ))}

          {unchecked.length > 0 && (
            <div
              data-testid="needs-attention-unchecked"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
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
    </section>
  );
}
