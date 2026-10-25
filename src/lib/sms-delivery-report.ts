/**
 * Daily SMS Delivery report -- pure shaping of GET /sms-delivery/report.
 *
 * The backend writes one row per real SMS send attempt (backend
 * app/domains/sms_delivery). Every count here is a count of those rows:
 *
 *   attempted   every attempt that reached a provider
 *   sent        the provider accepted it (NOT proof of delivery)
 *   failed      the provider refused it, or the call failed
 *   delivered   the provider's own delivery report said delivered
 *   undelivered the provider's own delivery report said it did not arrive
 *   awaiting    accepted, no delivery report yet
 *
 * "Delivered" only ever comes from a provider delivery report (DLR). When no
 * DLR mechanism is switched on, delivered/undelivered are shown as
 * unavailable -- never derived from "sent" -- and the delivery rate is blank.
 *
 * No API import here on purpose, so scripts/test-sms-delivery-report.mjs can
 * bundle and execute it directly.
 */

export interface SmsDeliveryCounts {
  attempted: number;
  sent: number;
  failed: number;
  delivered: number;
  undelivered: number;
  awaiting_dlr: number;
}

export interface SmsDeliveryDay extends SmsDeliveryCounts {
  date: string;
}

export interface SmsDeliveryReport {
  days: SmsDeliveryDay[];
  totals: SmsDeliveryCounts;
  by_location?: Array<SmsDeliveryCounts & { location_id: string | null }>;
  by_purpose?: Array<SmsDeliveryCounts & { purpose: string }>;
  delivery_reports: {
    enabled: boolean;
    mechanisms: string[];
    provider?: string;
    received_in_range: number;
  };
  range?: { start_date: string; end_date: string; timezone: string };
}

/** Stack order bottom-up. Validated with the dataviz palette checker in this
 * order (adjacent pairs delivered/awaiting, awaiting/failed,
 * failed/undelivered pass CVD + the normal-vision floor in both modes).
 * Status colours are reserved for state, and these ARE states; each always
 * ships with its label (legend, tooltip, table column), never colour alone. */
export const SMS_OUTCOMES = [
  { key: "delivered", label: "Delivered", light: "#0ca30c", dark: "#0ca30c" },
  { key: "awaiting_dlr", label: "Sent, no report yet", light: "#b5b3ab", dark: "#8a8983" },
  { key: "failed", label: "Failed", light: "#d03b3b", dark: "#d03b3b" },
  { key: "undelivered", label: "Undelivered", light: "#ec835a", dark: "#ec835a" },
] as const;

export type SmsOutcomeKey = (typeof SMS_OUTCOMES)[number]["key"];

/** Without delivery reports the only honest split is accepted vs failed. */
export const SMS_OUTCOMES_NO_DLR = [
  { key: "sent", label: "Sent (accepted by provider)", light: "#b5b3ab", dark: "#8a8983" },
  { key: "failed", label: "Failed", light: "#d03b3b", dark: "#d03b3b" },
] as const;

export function dlrEnabled(report: SmsDeliveryReport | null | undefined): boolean {
  return Boolean(report?.delivery_reports?.enabled);
}

/** delivered / sent, as "93.4%"; null when it can't be known honestly
 * (no DLR mechanism, nothing sent, or no report received yet for any of
 * the day's sends). */
export function deliveryRate(counts: SmsDeliveryCounts, enabled: boolean): string | null {
  if (!enabled || counts.sent <= 0) return null;
  const reported = counts.delivered + counts.undelivered;
  if (reported === 0) return null;
  return `${((counts.delivered / counts.sent) * 100).toFixed(1)}%`;
}

export type SmsDaywiseRow = {
  date: string;
  attempted: number;
  sent: number;
  failed: number;
  delivered: number | null;
  undelivered: number | null;
  awaiting: number | null;
  rate: string | null;
};

/** Table rows, one per day (the backend zero-fills the range). Delivered /
 * Undelivered / Awaiting are null -- rendered "—" -- when DLRs are off. */
export function smsDaywiseRows(report: SmsDeliveryReport): SmsDaywiseRow[] {
  const enabled = dlrEnabled(report);
  return (report.days ?? []).map((d) => ({
    date: d.date,
    attempted: d.attempted,
    sent: d.sent,
    failed: d.failed,
    delivered: enabled ? d.delivered : null,
    undelivered: enabled ? d.undelivered : null,
    awaiting: enabled ? d.awaiting_dlr : null,
    rate: deliveryRate(d, enabled),
  }));
}

/** The notice shown above the chart. Returns null when nothing needs saying
 * (DLRs on and at least one report received in range). */
export function deliveryReportsNotice(report: SmsDeliveryReport): {
  title: string;
  body: string;
} | null {
  if (!dlrEnabled(report)) {
    return {
      title: "Delivery reports not enabled",
      body:
        "Sent means the SMS provider accepted the message; whether it reached the phone is " +
        "only known from the provider's delivery report, which isn't switched on for this " +
        "account. Delivered and Undelivered are shown as unavailable rather than guessed.",
    };
  }
  if ((report.delivery_reports.received_in_range ?? 0) === 0 && report.totals.sent > 0) {
    return {
      title: "No delivery reports received yet for this period",
      body:
        "Delivery reports are switched on, but the provider hasn't reported on any of these " +
        "messages yet. They stay counted as 'Sent, no report yet' until it does.",
    };
  }
  return null;
}

/** Chart series for the stacked daily column, in stack order. */
export function smsChartSeries(report: SmsDeliveryReport) {
  return dlrEnabled(report) ? SMS_OUTCOMES : SMS_OUTCOMES_NO_DLR;
}

/** demo.wyfyguest.com fixture (zero network calls in demo mode). Shaped
 * exactly like the real response; deterministic so screenshots are stable.
 * Shows delivery reports switched on, which is what a configured account
 * sees. */
export function demoSmsDeliveryReport(from: string, to: string): SmsDeliveryReport {
  const days: SmsDeliveryDay[] = [];
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  let seed = 7;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let t = start; t <= end && days.length < 92; t += 86400000) {
    const attempted = 40 + Math.floor(rand() * 60);
    const failed = Math.floor(attempted * rand() * 0.05);
    const sent = attempted - failed;
    const undelivered = Math.floor(sent * rand() * 0.04);
    const awaiting = t >= end - 86400000 ? Math.floor(sent * 0.1) : 0;
    days.push({
      date: new Date(t).toISOString().slice(0, 10),
      attempted,
      sent,
      failed,
      delivered: sent - undelivered - awaiting,
      undelivered,
      awaiting_dlr: awaiting,
    });
  }
  const totals = days.reduce<SmsDeliveryCounts>(
    (acc, d) => ({
      attempted: acc.attempted + d.attempted,
      sent: acc.sent + d.sent,
      failed: acc.failed + d.failed,
      delivered: acc.delivered + d.delivered,
      undelivered: acc.undelivered + d.undelivered,
      awaiting_dlr: acc.awaiting_dlr + d.awaiting_dlr,
    }),
    { attempted: 0, sent: 0, failed: 0, delivered: 0, undelivered: 0, awaiting_dlr: 0 },
  );
  return {
    days,
    totals,
    delivery_reports: {
      enabled: true,
      mechanisms: ["poll"],
      provider: "ping4sms",
      received_in_range: totals.delivered + totals.undelivered,
    },
  };
}
