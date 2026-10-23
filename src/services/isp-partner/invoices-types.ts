/**
 * Wire types for ADDENDUM_03 §12: the unified invoice list (customer and
 * subscriber invoices, FY numbering, credit notes), zones, reminders,
 * recharge and reports. Money is integer paise.
 */

export type InvoiceStatusX = "issued" | "partially_paid" | "paid" | "cancelled" | "void";
export type BillToKind = "customer" | "subscriber";
export type InvoiceKind = "recharge" | "renewal" | "cycle" | "manual" | "coupon";

export interface InvoiceRow {
  id: string;
  display_id: number;
  number: string;
  doc_type: "invoice" | "credit_note" | string;
  created_at: string;
  invoice_date: string;
  due_date?: string | null;
  bill_to_kind: BillToKind | string;
  subscriber: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    circuit_id: number | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  customer: { isp_customer_id: string; name: string; contact_phone?: string | null } | null;
  zone: { id: string; name: string } | null;
  invoice_kind: InvoiceKind | string;
  package: { id: string; name: string } | null;
  po_number: string | null;
  buyer_gstin: string | null;
  total_paise: number;
  paid_paise: number;
  credit_noted_paise: number;
  balance_paise: number;
  status: InvoiceStatusX | string;
  status_label: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  sac_code: string | null;
  quantity: number;
  unit_amount_paise: number;
  price_includes_gst: boolean;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  period_from: string | null;
  period_to: string | null;
}

export interface InvoiceDetail extends InvoiceRow {
  lines: InvoiceLine[];
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  place_of_supply_state_code: string | null;
  seller_state_code: string | null;
  payments: {
    payment_id: string;
    amount_paise: number;
    mode: string;
    reference: string | null;
    received_at: string;
    recorded_by_name?: string | null;
    receipt_number: string;
  }[];
  credit_notes: {
    id: string;
    number: string;
    amount_paise: number;
    reason: string | null;
    created_at: string;
  }[];
  reminders: { channel: string; sent_at: string; status: string; sent_by_name?: string | null }[];
  cancelled_reason?: string | null;
  credit_note_for?: { id: string; number: string } | null;
}

export interface InvoiceListQuery {
  since?: string;
  until?: string;
  status?: string;
  bill_to_kind?: BillToKind;
  zone_id?: string;
  package_id?: string;
  username?: string;
  isp_customer_id?: string;
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

/** Optional totals for the filtered set (§13 "totals footer"). */
export interface InvoiceListPage {
  items: InvoiceRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  totals?: { invoiced_paise: number; collected_paise: number; outstanding_paise: number } | null;
}

export interface ManualInvoiceLine {
  description: string;
  sac_code: string;
  amount_paise: number;
  price_includes_gst: boolean;
}

export interface ManualInvoiceBody {
  bill_to:
    | { kind: "subscriber"; subscriber_id: string }
    | { kind: "customer"; isp_customer_id: string };
  invoice_date: string;
  due_date?: string | null;
  lines: ManualInvoiceLine[];
  po_number?: string | null;
  buyer_gstin?: string | null;
}

export interface BulkBody {
  action: "mark_paid" | "download_pdfs" | "send_reminder";
  invoice_ids: string[];
  payment?: { mode: string; reference_prefix: string | null; received_at: string | null };
  channel?: "email";
}

export interface BulkMarkPaidResult {
  paid: number;
  skipped: { invoice_id: string; reason: string }[];
}

export interface BulkReminderResult {
  queued: number;
  skipped_no_consent: number;
  skipped_no_contact: number;
}

export interface InvoiceSettings {
  invoice_prefix: string;
  credit_note_prefix: string;
  receipt_prefix: string;
  coupon_invoice_on_activation: boolean;
  reminder_days_before_expiry: number;
  invoice_footer: string | null;
}

export interface Zone {
  id: string;
  name: string;
  city: string | null;
  state_code: string | null;
  notes: string | null;
  /** Usage count, if BE sends it (§13 "usage count"). */
  customers?: number;
  subscribers?: number;
}

export interface ZoneBody {
  name: string;
  city?: string | null;
  state_code?: string | null;
  notes?: string | null;
}

export interface RechargeBody {
  package_id: string;
  paid_now: boolean;
  payment: {
    mode: string;
    reference: string | null;
    amount_paise: number;
    received_at: string | null;
  } | null;
  po_number: string | null;
  idempotency_key: string;
}

export interface RechargeResult {
  invoice: InvoiceRow;
  payment: { id: string; receipt_number: string; amount_paise: number } | null;
  subscriber: { valid_until: string; package: { id: string; name: string } | null };
}

export interface CollectionsReport {
  rows: {
    key: string;
    invoiced_paise: number;
    collected_paise: number;
    by_mode: Record<string, number>;
    invoices: number;
    payments: number;
  }[];
  totals: { invoiced_paise: number; collected_paise: number } & Record<string, unknown>;
}

export interface OutstandingReport {
  as_of: string;
  buckets: { "0_30": number; "31_60": number; "61_90": number; "90_plus": number };
  by_zone: { zone_id: string | null; name: string; balance_paise: number }[];
  top_debtors: {
    subscriber?: { id: string; username: string; name?: string | null } | null;
    customer?: { isp_customer_id: string; name: string } | null;
    balance_paise: number;
    oldest_due: string | null;
  }[];
}
