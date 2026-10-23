/**
 * Wire types for ADDENDUM_01: customer service state (suspend cuts internet,
 * §A.8) and Phase 1b manual billing (§B.3). Money is integer paise.
 *
 * The addendum specifies the tables and routes; where it does not spell out
 * a response body, these fields mirror the table columns (gaps recorded in
 * `~/wyfy-ops/isp-network/CONTRACT_CHANGES.md`).
 */

// ------------------------------------------------------------- service state

export type ServiceStateName = "active" | "suspend_pending" | "suspended" | "resume_pending";
export type SuspendReason = "non_payment" | "customer_request" | "abuse" | "other";

export interface ServiceStep {
  kind:
    | "nas_disable"
    | "kick_sessions"
    | "portal_suspended_page"
    | "device_fallback"
    | "nas_activate"
    | "portal_restore"
    | "device_fallback_remove"
    | string;
  status: "pending" | "done" | "skipped" | "failed" | string;
  attempts: number;
  last_error: string | null;
  detail: string | null;
}

export interface ServiceState {
  isp_customer_id: string;
  state: ServiceStateName | string;
  reason: SuspendReason | string | null;
  note: string | null;
  requested_by: { id: string; name: string } | null;
  requested_at: string | null;
  completed_at: string | null;
  routers: { isp_router_id: string; name: string; online: boolean; steps: ServiceStep[] }[];
  warnings: string[];
  bypass_entries_not_cut: number;
}

export interface SuspendServiceBody {
  reason: SuspendReason;
  note?: string;
  show_suspended_page: boolean;
}

// ------------------------------------------------------------------ billing

export type BillingCycle = "monthly" | "quarterly" | "half_yearly" | "yearly";
export type PaymentMode = "cash" | "upi" | "bank_transfer" | "online";
export type InvoiceStatus = "issued" | "partially_paid" | "paid" | "void";

export interface BillingSettings {
  legal_name: string | null;
  gstin: string | null;
  state_code: string | null;
  address: string | null;
  invoice_prefix: string;
  receipt_prefix: string;
  gst_enabled: boolean;
  gst_rate_bp: number;
  sac_code: string;
  upi_vpa: string | null;
  payee_name: string | null;
  default_due_days: number;
  grace_days: number;
  auto_suspend_enabled: boolean;
  auto_suspend_after_days: number | null;
  /** Read-only on the FE. */
  next_invoice_seq?: number;
  next_receipt_seq?: number;
}

export type BillingSettingsUpdate = Partial<
  Omit<BillingSettings, "next_invoice_seq" | "next_receipt_seq">
>;

export interface CustomerBillingPlan {
  plan_name: string;
  amount_paise: number;
  billing_cycle: BillingCycle;
  anchor_day: number;
  next_invoice_date: string | null;
  gst_applicable: boolean;
  place_of_supply_state_code: string | null;
  active: boolean;
  notes: string | null;
}

export interface IspInvoice {
  id: string;
  number: string;
  isp_customer_id: string;
  customer_name?: string | null;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string;
  description: string | null;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  paid_paise: number;
  status: InvoiceStatus | string;
  voided_reason: string | null;
  /** Past due date + grace with a balance left. Computed by BE when present. */
  overdue?: boolean;
}

export interface IspPayment {
  id: string;
  isp_customer_id: string;
  customer_name?: string | null;
  invoice_id: string | null;
  invoice_number?: string | null;
  amount_paise: number;
  mode: PaymentMode | string;
  reference: string | null;
  received_at: string;
  recorded_by?: { id: string; name: string } | string | null;
  receipt_number: string;
  status: "confirmed" | "voided" | string;
  voided_reason: string | null;
}

export interface CustomerLedger {
  balance_paise: number;
  overdue_paise: number;
  invoices: IspInvoice[];
  payments: IspPayment[];
  /** BE-B4: true when a suspended-for-dues customer has no overdue left. */
  can_resume?: boolean;
}

export interface InvoiceCreate {
  isp_customer_id: string;
  period_start: string | null;
  period_end: string | null;
  description: string;
  amount_paise: number;
  due_date?: string;
}

export interface PaymentCreate {
  /** One of the two (ADDENDUM_03 §8 adds subscriber payments). */
  isp_customer_id?: string;
  subscriber_id?: string;
  invoice_id?: string | null;
  amount_paise: number;
  mode: PaymentMode;
  reference?: string | null;
  received_at?: string;
}

export interface InvoiceQuery {
  isp_customer_id?: string;
  status?: string;
  overdue?: boolean;
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}

export interface PaymentQuery {
  isp_customer_id?: string;
  since?: string;
  until?: string;
  page?: number;
  page_size?: number;
}
