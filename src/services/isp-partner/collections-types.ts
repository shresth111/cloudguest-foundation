/** COLLECTIONS-1 response shapes (BE `collections_service.py`). */

export type RiskBand = "high" | "medium" | "low";
export type PartyKind = "subscriber" | "customer";
export type PromiseStatus = "open" | "kept" | "broken" | "cancelled" | "superseded";
export type NoteOutcome = "called" | "no_answer" | "visited" | "promised" | "disputed" | "other";
export type HandoverStatus = "submitted" | "approved" | "rejected";
export type OverdueSort = "priority" | "amount" | "age" | "score";

export interface RiskReason {
  code: string;
  points: number;
  text: string;
}

export interface Risk {
  score: number;
  band: RiskBand;
  reasons: RiskReason[];
}

export interface PromiseBrief {
  id: string;
  promised_on: string;
  amount_paise: number | null;
  target_paise: number;
  status: PromiseStatus;
}

export interface OverdueItem {
  party_kind: PartyKind;
  party_key: string;
  subscriber_id: string | null;
  isp_customer_id: string;
  customer_name: string | null;
  name: string | null;
  identifier: string | null;
  circuit_id: number | null;
  phone: string | null;
  zone_id: string | null;
  subscriber_status: string | null;
  overdue_paise: number;
  balance_paise: number;
  invoices_overdue: number;
  invoice_numbers: string[];
  oldest_invoice_id: string;
  oldest_due_date: string;
  days_overdue: number;
  risk: Risk;
  promise: PromiseBrief | null;
  broken_promises_90d: number;
  last_payment_at: string | null;
  last_note: { at: string; outcome: NoteOutcome | null; body: string } | null;
}

export interface OverdueSummary {
  parties: number;
  overdue_paise: number;
  by_band: Record<RiskBand, { parties: number; overdue_paise: number }>;
  open_promises: number;
}

export interface OverduePage {
  items: OverdueItem[];
  total: number;
  page: number;
  page_size: number;
  summary: OverdueSummary;
  as_of: string;
  rules: string;
}

export interface OverdueQuery {
  party_kind?: PartyKind;
  band?: RiskBand;
  promise?: "open" | "broken" | "none";
  min_days?: number;
  search?: string;
  sort?: OverdueSort;
  page?: number;
  page_size?: number;
}

export interface ForecastComponent {
  key: string;
  label: string;
  count: number;
  base_paise: number;
  rate: number;
  rate_measured: boolean;
  expected_paise: number;
  basis: string;
}

export interface Forecast {
  week_start: string;
  week_end: string;
  as_of: string;
  collected_so_far_paise: number;
  predicted_remaining_paise: number;
  predicted_total_paise: number;
  components: ForecastComponent[];
  method: string;
}

export interface Actor {
  id: string;
  name: string | null;
}

export interface CollectionPromise {
  id: string;
  subscriber_id: string | null;
  isp_customer_id: string;
  customer_name: string | null;
  name: string | null;
  phone: string | null;
  promised_on: string;
  amount_paise: number | null;
  target_paise: number;
  overdue_at_creation_paise: number;
  note: string | null;
  status: PromiseStatus;
  stored_status: PromiseStatus;
  resolved_at: string | null;
  resolved_reason: string | null;
  followup_task_id: string | null;
  created_at: string;
  created_by: Actor | null;
}

export interface PromisePage {
  items: CollectionPromise[];
  total: number;
  page: number;
  page_size: number;
}

export interface TimelineEvent {
  id: string;
  source: "collections" | "billing";
  kind: string;
  outcome?: NoteOutcome | null;
  body: string | null;
  detail: Record<string, unknown>;
  at: string | null;
  actor: Actor | null;
}

export interface Timeline {
  items: TimelineEvent[];
  promises: CollectionPromise[];
  open_promise: CollectionPromise | null;
  overdue_paise: number;
}

/** The billing payment row (`IspBillingService.payment_row`). */
export interface CollectionPayment {
  id: string;
  customer_name: string | null;
  invoice_number: string | null;
  isp_customer_id: string;
  subscriber_id: string | null;
  amount_paise: number;
  unallocated_paise: number;
  mode: string;
  reference: string | null;
  received_at: string;
  receipt_number: string;
  status: string;
  recorded_by: Actor | null;
  handover_status?: HandoverStatus | null;
}

export interface CashResult {
  payment: CollectionPayment;
  allocations: { invoice_number: string; amount_paise: number }[];
  slip_path: string;
  repeat: boolean;
  promise_kept?: boolean;
}

export interface MyCash {
  date: string;
  items: CollectionPayment[];
  total_paise: number;
  pending_handover_paise: number;
  pending_handover_count: number;
}

export interface Handover {
  id: string;
  collector: Actor;
  business_date: string;
  expected_paise: number;
  declared_paise: number;
  declared_difference_paise: number;
  received_paise: number | null;
  variance_paise: number | null;
  status: HandoverStatus;
  note: string | null;
  submitted_at: string;
  decided_by: Actor | null;
  decided_at: string | null;
  decision_note: string | null;
}

export interface HandoverDetail extends Handover {
  items: CollectionPayment[];
  expected_now_paise: number;
  voided_since_submit: string[];
}

export interface HandoverPage {
  items: Handover[];
  total: number;
  page: number;
  page_size: number;
  can_approve: boolean;
  pending: { count: number; expected_paise: number } | null;
}

/** Exactly one of the two. */
export type PartyRef = { subscriber_id: string } | { isp_customer_id: string };
