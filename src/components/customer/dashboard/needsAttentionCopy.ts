/**
 * The words for each Needs-attention row and action, in one place, so the
 * card, the top bar's health pill and the notification bell say exactly the
 * same thing about the same issue. Pure (takes the `needsAttention`
 * namespace's `t`), so the top bar can import it without the card's data
 * layer.
 */
import type { TFunction } from "i18next";
import type { AttentionItem } from "./needsAttentionModel";

export function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(
    d,
  );
}

export function joinList(parts: string[], lang: string): string {
  try {
    return new Intl.ListFormat(lang, { style: "long", type: "conjunction" }).format(parts);
  } catch {
    return parts.join(", ");
  }
}

/** Title + detail for one row, in the reader's language. Exported so the
 * top bar's health pill and bell word each issue exactly as this card does
 * (call with the `needsAttention` namespace's `t`). */
export function rowCopy(
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
    case "devicesUnstable":
      return {
        title: t("rows.devicesUnstable.title", {
          count,
          defaultValue_one: "{{count}} device is unstable",
          defaultValue_other: "{{count}} devices are unstable",
        }),
        detail: t(
          "rows.devicesUnstable.detail",
          "They answer, but keep dropping off or missing checks. Often a loose cable.",
        ),
      };
    case "ispDown":
      return {
        title: t("rows.ispDown.title", {
          count,
          defaultValue_one: "An internet line is down",
          defaultValue_other: "{{count}} internet lines are down",
        }),
        detail: item.params.names,
      };
    case "ispDegraded":
      return {
        title: t("rows.ispDegraded.title", {
          count,
          defaultValue_one: "An internet line is slow or unreliable",
          defaultValue_other: "{{count}} internet lines are slow or unreliable",
        }),
        detail: item.params.names,
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

export function actionLabel(id: string, t: TFunction): string {
  switch (id) {
    case "isp-details":
      return t("action.isp-details", "View internet connection");
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
