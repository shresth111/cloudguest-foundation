/**
 * REVENUE-HUB + CHURN-RISK shapes. Contract: LANE_NOTES [REVENUE-HUB] /
 * [CHURN-RISK] (BE `feat/isp-revenue-hub`, `revenue_router.py`). Money is
 * integer paise; MRR / ARPU / billed are GST-exclusive. Rates are 0..1 or
 * null when there is nothing to divide by.
 */

/** The Overview's (DASH-1) buckets: active/pending/expired/churned; other =
 * suspended, frozen, blocked or off (ACTIVE-ALIGN). */
export type RevState = "active" | "pending" | "expired" | "churned" | "other";
export type AgeingBucket = "not_due" | "d0_30" | "d31_60" | "d61_90" | "d90_plus";
export type SubscriberMetric = RevState | "unpriced" | "new" | "lost";
export type InvoiceMetric = `dues_${AgeingBucket}` | "uncollected";
export type RevMetric = SubscriberMetric | InvoiceMetric;
export type RiskReason =
  | "expired_recently"
  | "expiring_no_payment"
  | "late_payments"
  | "tickets"
  | "fup_hits"
  | "long_offline";

export interface RevFilters {
  /** `YYYY-MM`; omitted = this month. */
  month?: string;
  months?: number;
  zone_id?: string;
  no_zone?: boolean;
  package_id?: string;
}

export interface RevTrendRow {
  month: string;
  partial: boolean;
  new: number;
  lost: number;
  net: number;
  base_at_start: number;
  churn_rate: number | null;
  invoices: number;
  billed_paise: number;
  net_billed_paise: number;
  collected_paise: number;
  collection_rate: number | null;
}

export interface RevZoneRow {
  zone_id: string | null;
  name: string | null;
  active: number;
  churned: number;
  mrr_paise: number;
  arpu_paise: number | null;
  billed_paise: number;
  net_billed_paise: number;
  collected_paise: number;
  collection_rate: number | null;
  dues_paise: number;
  /** null while the zone ledger is off, or for confined staff. */
  wallet_balance_paise: number | null;
}

export interface RevPackageRow {
  package_id: string | null;
  name: string | null;
  type: string | null;
  active: number;
  mrr_paise: number;
  unpriced: number;
  mrr_share: number | null;
  active_share: number | null;
}

export interface RevenueSummary {
  as_of: string;
  month: string;
  months: number;
  churn_after_days: number;
  gst_exclusive: boolean;
  kpis: {
    mrr_paise: number;
    arpu_paise: number | null;
    active: number;
    pending: number;
    expired: number;
    churned: number;
    other: number;
    total: number;
    unpriced: number;
    new: number;
    lost: number;
    churn_rate: number | null;
    billed_paise: number;
    net_billed_paise: number;
    collected_paise: number;
    collection_rate: number | null;
    uncollected_paise: number;
    dues_paise: number;
  };
  ageing: Record<AgeingBucket, { invoices: number; amount_paise: number }>;
  trend: RevTrendRow[];
  zones: RevZoneRow[];
  packages: RevPackageRow[];
  definitions: Record<string, string>;
}

export interface RevSubscriberItem {
  id: string;
  identifier: string | null;
  display_name: string | null;
  phone: string | null;
  circuit_id: number | null;
  customer_id: string;
  customer_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  package_id: string | null;
  package_name: string | null;
  display_state: string;
  state: RevState;
  mrr_paise: number | null;
  valid_until: string | null;
  created_at: string | null;
  churned_at: string | null;
}

export interface RevInvoiceItem {
  invoice_id: string;
  number: string;
  issue_date: string;
  due_date: string;
  days_past_due: number;
  total_paise: number;
  balance_paise: number;
  subscriber_id: string | null;
  identifier: string | null;
  display_name: string | null;
  phone: string | null;
  customer_name: string | null;
  zone_name: string | null;
}

interface Paged {
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type RevList =
  | (Paged & { metric: RevMetric; month: string; kind: "subscribers"; items: RevSubscriberItem[] })
  | (Paged & { metric: RevMetric; month: string; kind: "invoices"; items: RevInvoiceItem[] });

export interface RiskReasonRow {
  code: RiskReason;
  weight: number;
  label: string;
  /** The measured values, in words ("Validity ends on 05 Nov 2026 (in 4 days) ..."). */
  detail: string;
}

export interface RiskItem extends RevSubscriberItem {
  isp_customer_id: string;
  score: number;
  reasons: RiskReasonRow[];
  open_invoice: { id: string; number: string; total_paise: number; balance_paise: number } | null;
}

export interface RiskList extends Paged {
  items: RiskItem[];
  reason: RiskReason | null;
  /** false while the Apps helpdesk is off: the "tickets" rule cannot fire. */
  tickets_measured: boolean;
  rules: Record<RiskReason, { weight: number; definition: string }>;
}

export interface RiskSummary {
  at_risk: number;
  mrr_at_risk_paise: number;
  by_reason: Record<RiskReason, number>;
  tickets_measured: boolean;
  weights: Record<RiskReason, number>;
}
