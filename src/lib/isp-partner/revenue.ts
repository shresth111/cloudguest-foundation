/**
 * REVENUE-HUB + CHURN-RISK pure helpers: filters -> query params, labels,
 * the KPI tile layout (each tile names the list it opens), percentages, the
 * month picker, and the "renew at an offer price" plan built only from the
 * existing 360 endpoints. No React.
 */
import { formatRupees } from "@/lib/isp-partner/money";
import type {
  AgeingBucket,
  RevFilters,
  RevMetric,
  RevenueSummary,
  RiskReason,
} from "@/services/isp-partner/revenue-types";

const MONTH = /^\d{4}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

/** Query params for the API. Only well-formed values are sent. */
export function revParams(f: RevFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.month && MONTH.test(f.month)) out.month = f.month;
  if (f.months && Number.isInteger(f.months) && f.months >= 1 && f.months <= 24)
    out.months = String(f.months);
  if (f.no_zone) out.no_zone = "true";
  else if (f.zone_id && UUID.test(f.zone_id)) out.zone_id = f.zone_id;
  if (f.package_id && UUID.test(f.package_id)) out.package_id = f.package_id;
  return out;
}

/** `YYYY-MM` of a local date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The last `n` months, newest first, as `{ value: "YYYY-MM", label }`. */
export function monthOptions(now: Date = new Date(), n = 12): { value: string; label: string }[] {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    });
  }
  return out;
}

/** "Nov 2026" for "2026-11". */
export function monthLabel(key: string): string {
  if (!MONTH.test(key)) return key;
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** 0.4737 -> "47.4%"; null -> "–" (nothing to divide by, never a fake 0). */
export function formatRate(r: number | null | undefined): string {
  if (r === null || r === undefined || Number.isNaN(r)) return "–";
  return `${(Math.round(r * 1000) / 10).toFixed(1)}%`;
}

export const AGEING_LABEL: Record<AgeingBucket, string> = {
  not_due: "Not due yet",
  d0_30: "0–30 days",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "90+ days",
};
export const AGEING_ORDER: AgeingBucket[] = ["not_due", "d0_30", "d31_60", "d61_90", "d90_plus"];

export const METRIC_LABEL: Record<RevMetric, string> = {
  active: "Active subscribers",
  pending: "Pending (KYC, installation or activation later)",
  expired: "Expired, not churned yet",
  churned: "Churned",
  other: "Blocked, frozen, suspended or off",
  unpriced: "Active without a price",
  new: "New this month",
  lost: "Lost this month",
  dues_not_due: `Dues: ${AGEING_LABEL.not_due}`,
  dues_d0_30: `Dues: ${AGEING_LABEL.d0_30} past due`,
  dues_d31_60: `Dues: ${AGEING_LABEL.d31_60} past due`,
  dues_d61_90: `Dues: ${AGEING_LABEL.d61_90} past due`,
  dues_d90_plus: `Dues: ${AGEING_LABEL.d90_plus} past due`,
  uncollected: "Invoices of the month not fully paid",
};

export interface KpiTile {
  key: string;
  label: string;
  value: string;
  /** The definition key (hover text). */
  def: string;
  /** The list the tile opens; null = an aggregate with no single list. */
  metric: RevMetric | null;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}

/** The KPI row, in display order. Every tile with a `metric` opens exactly
 * the rows it counted (the BE computes both from the same rows). */
export function kpiTiles(d: RevenueSummary): KpiTile[] {
  const k = d.kpis;
  return [
    {
      key: "mrr",
      label: "MRR (excl. GST)",
      value: formatRupees(k.mrr_paise),
      def: "mrr",
      metric: "active",
      sub: k.unpriced ? `${k.unpriced} active without a price` : undefined,
      tone: "info",
    },
    {
      key: "arpu",
      label: "ARPU",
      value: k.arpu_paise === null ? "–" : formatRupees(k.arpu_paise),
      def: "arpu",
      metric: "active",
    },
    {
      key: "active",
      label: "Active",
      value: String(k.active),
      def: "active",
      metric: "active",
      sub: `of ${k.total} subscribers, as on the Overview`,
      tone: "success",
    },
    {
      key: "pending",
      label: "Pending",
      value: String(k.pending),
      def: "pending",
      metric: "pending",
      sub: "KYC, installation or activation date to come",
      tone: "warning",
    },
    {
      key: "churned",
      label: "Churned",
      value: String(k.churned),
      def: "churned",
      metric: "churned",
      sub: k.expired ? `+ ${k.expired} expired, can still renew` : undefined,
      tone: "danger",
    },
    {
      key: "churn_rate",
      label: "Churn rate (month)",
      value: formatRate(k.churn_rate),
      def: "churn_rate",
      metric: "lost",
      sub: `${k.lost} lost · ${k.new} new`,
      tone: "warning",
    },
    {
      key: "collection_rate",
      label: "Collection rate (month)",
      value: formatRate(k.collection_rate),
      def: "collection_rate",
      metric: "uncollected",
      sub: `${formatRupees(k.collected_paise)} of ${formatRupees(k.net_billed_paise)}`,
    },
    {
      key: "dues",
      label: "Open dues",
      value: formatRupees(k.dues_paise),
      def: "dues",
      metric: null,
      tone: k.dues_paise > 0 ? "warning" : "default",
    },
  ];
}

export const REASON_LABEL: Record<RiskReason, string> = {
  expired_recently: "Expired, not renewed",
  expiring_no_payment: "Expiring, no recent payment",
  late_payments: "Pays late",
  tickets: "Complaints",
  fup_hits: "Hit the fair-usage limit",
  long_offline: "Not using the service",
};
export const REASON_ORDER: RiskReason[] = [
  "expired_recently",
  "expiring_no_payment",
  "late_payments",
  "tickets",
  "fup_hits",
  "long_offline",
];

/** Score -> tone for the score badge (thresholds are display-only). */
export function scoreTone(score: number): "overdue" | "warning" | "info" {
  if (score >= 50) return "overdue";
  if (score >= 30) return "warning";
  return "info";
}

/**
 * "Renew at an offer price" with the existing 360 endpoints only:
 *   1. PUT /subscribers/{id}/profile {override_price_paise: offer} (if it differs)
 *   2. POST /subscribers/{id}/renew
 *   3. PUT the previous override back, unless the offer should stay.
 * Returns the steps in order, so the dialog (and the test) run exactly this.
 */
export type OfferStep =
  | { kind: "set_override"; price_paise: number | null }
  | { kind: "renew" }
  | { kind: "restore_override"; price_paise: number | null };

export function offerRenewalSteps(
  current: number | null,
  offer: number | null,
  keep: boolean,
): OfferStep[] {
  if (offer === null || offer === current) return [{ kind: "renew" }];
  const steps: OfferStep[] = [{ kind: "set_override", price_paise: offer }, { kind: "renew" }];
  if (!keep) steps.push({ kind: "restore_override", price_paise: current });
  return steps;
}

/** WhatsApp text for a win-back when there is no open invoice to share. */
export function winbackText(args: {
  name: string | null | undefined;
  ispName: string;
  validUntil: string | null;
  supportPhone?: string | null;
}): string {
  const ended =
    args.validUntil && new Date(args.validUntil).getTime() <= Date.now()
      ? `Your internet plan ended on ${new Date(args.validUntil).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}.`
      : "Your internet plan is due for renewal.";
  return [
    `Hello${args.name ? ` ${args.name}` : ""},`,
    ended,
    "Reply to this message and we will renew it for you.",
    args.supportPhone ? `For help call ${args.supportPhone}.` : "",
    `- ${args.ispName}`,
  ]
    .filter(Boolean)
    .join("\n");
}
