/**
 * JAZE-4 endpoints (`/isp/finance/*`, `/isp/public/pay/*`): invoice template
 * and bank details, product catalogue, package billing plan + price preview,
 * static-IP leases, security deposits, billing contacts, invoice email,
 * thermal slips, the labels-only zone ledger, WhatsApp/Telegram automation
 * and the outbound message log. Each group is behind its own backend flag;
 * a 404 means "not switched on for this account yet".
 */
import api from "@/services/api";
import type { EmailInvoiceResult, EmailSenderKey, EmailSenders } from "@/lib/isp-partner/comms2b";
import { cleanParams, downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type { IspPage } from "@/services/isp-partner/types";

export interface InvoiceTemplate {
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  website: string | null;
  care_phone: string | null;
  care_email: string | null;
  pan: string | null;
  licence_number: string | null;
  terms: string | null;
  show_bank_details: boolean;
  show_zone_operator: boolean;
  configured: boolean;
}

export type ProductKind = "bandwidth" | "static_ip" | "installation" | "other";
export interface BillingProduct {
  id: string;
  name: string;
  kind: ProductKind;
  sac_code: string;
  default_amount_paise: number;
  price_includes_gst: boolean;
  active: boolean;
}

export interface PricePreview {
  gst_applied: boolean;
  gst_rate_bp: number;
  intra_state: boolean;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
  billing_configured: boolean;
}

export interface PackageBilling {
  package_id: string;
  package_name: string;
  price_paise: number;
  price_includes_gst: boolean;
  validity_days: number;
  configured: boolean;
  plan_kind: "prepaid" | "postpaid";
  chargeable_unit: "days" | "months";
  chargeable_count: number;
  invoice_description: string;
  product_id: string | null;
  preview: PricePreview;
}

export interface StaticIpLease {
  id: string;
  isp_customer_id: string;
  customer_name: string | null;
  subscriber_id: string | null;
  subscriber_name: string | null;
  ip_address: string;
  monthly_amount_paise: number;
  price_includes_gst: boolean;
  active_since: string;
  active_until: string | null;
  billed_through: string | null;
  status: "active" | "ended";
  notes: string | null;
}

export interface DepositEntry {
  id: string;
  isp_customer_id: string;
  subscriber_id: string | null;
  entry_kind: "collect" | "refund" | "forfeit";
  item: "ont" | "router" | "stb" | "other";
  item_serial: string | null;
  amount_paise: number;
  mode: string;
  reference: string | null;
  note: string | null;
  occurred_at: string;
}

export interface DepositHeld {
  isp_customer_id: string;
  customer_name: string | null;
  subscriber_id: string | null;
  subscriber_name: string | null;
  collected_paise: number;
  refunded_paise: number;
  forfeited_paise: number;
  held_paise: number;
}

export interface BillingContact {
  subject_kind: "customer" | "subscriber";
  subject_id: string;
  name: string;
  primary_email: string | null;
  alternate_email: string | null;
  alternate_name: string | null;
  exclude_from_reminders: boolean;
}

export interface ZoneLedger {
  zone_id: string;
  name: string;
  city: string | null;
  state_code: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  pincode: string | null;
  gstin: string | null;
  pan: string | null;
  operator_name: string | null;
  operator_phone: string | null;
  revenue_share_bp: number;
  tds_rate_bp: number;
  min_balance_paise: number;
  credit_limit_paise: number;
  balance_paise: number;
  available_paise: number;
  standing: "paid" | "unpaid";
}

export interface ZoneEntry {
  id: string;
  entry_kind: "add" | "reduce" | "credit_limit";
  amount_paise: number;
  balance_after_paise: number;
  mode: string | null;
  reference: string | null;
  note: string | null;
  detail: Record<string, number>;
  occurred_at: string;
  recorded_by: string | null;
}

export interface ZoneRevenue {
  zone_id: string;
  name: string;
  revenue_share_bp: number;
  invoiced_paise: number;
  collected_paise: number;
  zone_share_paise: number;
  isp_share_paise: number;
}

export interface Tds194h {
  fy: string;
  threshold_paise: number;
  zones: {
    zone_id: string;
    name: string;
    pan: string | null;
    tds_rate_bp: number;
    commission_paise: number;
    tds_paise: number;
    threshold_crossed: boolean;
    pan_missing: boolean;
    quarters: Record<string, { commission_paise: number; tds_paise: number }>;
  }[];
  note: string;
}

export type Trigger = "pre_expiry" | "unpaid" | "receipt" | "renewal" | "overdue" | "welcome";
export interface AutomationSettings {
  whatsapp_enabled: boolean;
  whatsapp_enabled_at: string | null;
  whatsapp_templates: Partial<Record<Trigger, { template_name: string; language: string }>>;
  pre_expiry_days: number;
  unpaid_reminder_after_days: number;
  telegram_enabled: boolean;
  telegram_bot_token: { set: boolean; hint: string | null };
  telegram_chat_id: string | null;
  telegram_debounce_minutes: number;
  telegram_include_aps: boolean;
  triggers: Trigger[];
  flags: { whatsapp: boolean; telegram: boolean };
}

export interface MessageRow {
  id: string;
  created_at: string;
  channel: "email" | "whatsapp" | "telegram";
  trigger: string;
  recipient: string;
  summary: string;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  isp_customer_id: string | null;
  invoice_id: string | null;
}

export interface PublicPayView {
  isp_name: string;
  support_phone: string | null;
  support_email: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  bill_to_first_name: string;
  total_paise: number;
  balance_paise: number;
  status: string;
  upi_uri: string | null;
  upi_vpa: string | null;
  payee_name: string;
  bank: {
    name: string | null;
    account_name: string | null;
    account_number: string;
    ifsc: string | null;
  } | null;
  note: string;
}

const B = "/isp/finance";

export const financeService = {
  async template(): Promise<InvoiceTemplate> {
    return (await api.get<InvoiceTemplate>(`${B}/invoice-template`)).data;
  },
  async saveTemplate(body: Partial<InvoiceTemplate>): Promise<InvoiceTemplate> {
    return (await api.put<InvoiceTemplate>(`${B}/invoice-template`, body)).data;
  },
  async products(): Promise<BillingProduct[]> {
    return (await api.get<{ items: BillingProduct[] }>(`${B}/products`)).data.items;
  },
  async createProduct(body: Omit<BillingProduct, "id">): Promise<BillingProduct> {
    return (await api.post<BillingProduct>(`${B}/products`, body)).data;
  },
  async updateProduct(id: string, body: Partial<BillingProduct>): Promise<BillingProduct> {
    return (await api.patch<BillingProduct>(`${B}/products/${id}`, body)).data;
  },
  async standardProducts(): Promise<BillingProduct[]> {
    return (await api.post<{ items: BillingProduct[] }>(`${B}/products/standard`)).data.items;
  },
  async pricePreview(q: {
    amount_paise: number;
    price_includes_gst: boolean;
    place_of_supply_state_code?: string;
  }): Promise<PricePreview> {
    return (await api.get<PricePreview>(`${B}/price-preview`, { params: cleanParams(q) })).data;
  },
  async packageBilling(packageId: string): Promise<PackageBilling> {
    return (await api.get<PackageBilling>(`${B}/packages/${packageId}/billing`)).data;
  },
  async savePackageBilling(
    packageId: string,
    body: Pick<
      PackageBilling,
      "plan_kind" | "chargeable_unit" | "chargeable_count" | "invoice_description"
    > & {
      product_id: string | null;
    },
  ): Promise<PackageBilling> {
    return (await api.put<PackageBilling>(`${B}/packages/${packageId}/billing`, body)).data;
  },
  async leases(q: { status?: string } = {}): Promise<StaticIpLease[]> {
    return (
      await api.get<{ items: StaticIpLease[] }>(`${B}/static-ip-leases`, { params: cleanParams(q) })
    ).data.items;
  },
  async createLease(body: {
    isp_customer_id?: string;
    subscriber_id?: string;
    ip_address: string;
    monthly_amount_paise: number;
    price_includes_gst: boolean;
    active_since?: string;
    notes?: string;
  }): Promise<StaticIpLease> {
    return (await api.post<StaticIpLease>(`${B}/static-ip-leases`, body)).data;
  },
  async endLease(id: string, activeUntil?: string): Promise<StaticIpLease> {
    return (
      await api.post<StaticIpLease>(
        `${B}/static-ip-leases/${id}/end`,
        activeUntil ? { active_until: activeUntil } : {},
      )
    ).data;
  },
  async billLeases(): Promise<{ invoices_issued: number }> {
    return (await api.post<{ invoices_issued: number }>(`${B}/static-ip-leases/bill`)).data;
  },
  async depositsHeld(): Promise<DepositHeld[]> {
    return (await api.get<{ items: DepositHeld[] }>(`${B}/deposits/summary`)).data.items;
  },
  async deposits(q: { isp_customer_id?: string; subscriber_id?: string }): Promise<{
    held_paise: number | null;
    items: DepositEntry[];
  }> {
    return (await api.get(`${B}/deposits`, { params: cleanParams(q) })).data as {
      held_paise: number | null;
      items: DepositEntry[];
    };
  },
  async addDeposit(body: {
    isp_customer_id?: string;
    subscriber_id?: string;
    entry_kind: DepositEntry["entry_kind"];
    item: DepositEntry["item"];
    item_serial?: string;
    amount_paise: number;
    mode: string;
    reference?: string;
    note?: string;
  }): Promise<DepositEntry> {
    return (await api.post<DepositEntry>(`${B}/deposits`, body)).data;
  },
  async contact(kind: "customer" | "subscriber", id: string): Promise<BillingContact> {
    return (await api.get<BillingContact>(`${B}/contacts/${kind}/${id}`)).data;
  },
  async saveContact(
    kind: "customer" | "subscriber",
    id: string,
    body: {
      alternate_email?: string;
      alternate_name?: string;
      exclude_from_reminders?: boolean;
      whatsapp_opt_in?: boolean;
    },
  ): Promise<BillingContact> {
    return (await api.put<BillingContact>(`${B}/contacts/${kind}/${id}`, body)).data;
  },
  async emailInvoice(
    invoiceId: string,
    sendTo: "primary" | "alternate" | "both",
    message?: string,
    sender?: EmailSenderKey,
  ): Promise<EmailInvoiceResult> {
    return (
      await api.post(`${B}/invoices/${invoiceId}/email`, {
        send_to: sendTo,
        message: message || undefined,
        // COMMS-2b: only sent when not the default, so old backends see the
        // same body as before.
        sender: sender && sender !== "platform" ? sender : undefined,
      })
    ).data as EmailInvoiceResult;
  },
  /** COMMS-2b: the senders a manual invoice email can use. */
  async emailSenders(): Promise<EmailSenders> {
    return (await api.get<EmailSenders>(`${B}/email-senders`)).data;
  },
  async thermalInvoice(invoiceId: string, width: 58 | 80 = 80): Promise<FileDownload> {
    return downloadFile(
      `${B}/invoices/${invoiceId}/thermal.pdf`,
      { width: String(width) },
      `invoice-${width}mm.pdf`,
    );
  },
  async thermalReceipt(paymentId: string, width: 58 | 80 = 80): Promise<FileDownload> {
    return downloadFile(
      `${B}/payments/${paymentId}/thermal.pdf`,
      { width: String(width) },
      `receipt-${width}mm.pdf`,
    );
  },
  async payLink(invoiceId: string): Promise<{ url: string }> {
    return (await api.post<{ url: string }>(`${B}/invoices/${invoiceId}/pay-link`)).data;
  },
  async zones(): Promise<ZoneLedger[]> {
    return (await api.get<{ items: ZoneLedger[] }>(`${B}/zones`)).data.items;
  },
  async zone(zoneId: string): Promise<{ zone: ZoneLedger; entries: ZoneEntry[] }> {
    return (await api.get(`${B}/zones/${zoneId}`)).data as {
      zone: ZoneLedger;
      entries: ZoneEntry[];
    };
  },
  async saveZoneProfile(zoneId: string, body: Partial<ZoneLedger>): Promise<ZoneLedger> {
    return (await api.put<ZoneLedger>(`${B}/zones/${zoneId}/profile`, body)).data;
  },
  async zoneEntry(
    zoneId: string,
    body: {
      entry_kind: ZoneEntry["entry_kind"];
      amount_paise?: number;
      credit_limit_paise?: number;
      mode?: string;
      reference?: string;
      note?: string;
    },
  ): Promise<{ zone: ZoneLedger; entries: ZoneEntry[] }> {
    return (await api.post(`${B}/zones/${zoneId}/entries`, body)).data as {
      zone: ZoneLedger;
      entries: ZoneEntry[];
    };
  },
  async zoneRevenue(dateFrom: string, dateTo: string): Promise<ZoneRevenue[]> {
    return (
      await api.get<{ items: ZoneRevenue[] }>(`${B}/zones/revenue`, {
        params: { date_from: dateFrom, date_to: dateTo },
      })
    ).data.items;
  },
  async tds(fy?: string): Promise<Tds194h> {
    return (await api.get<Tds194h>(`${B}/zones/tds-194h`, { params: cleanParams({ fy }) })).data;
  },
  async automation(): Promise<AutomationSettings> {
    return (await api.get<AutomationSettings>(`${B}/automation`)).data;
  },
  async saveAutomation(body: Record<string, unknown>): Promise<AutomationSettings> {
    return (await api.put<AutomationSettings>(`${B}/automation`, body)).data;
  },
  async telegramTest(): Promise<{ ok: boolean; error: string | null }> {
    return (await api.post<{ ok: boolean; error: string | null }>(`${B}/automation/telegram/test`))
      .data;
  },
  async messages(q: {
    channel?: string;
    status?: string;
    page?: number;
  }): Promise<IspPage<MessageRow>> {
    return (
      await api.get<IspPage<MessageRow>>(`${B}/messages`, {
        params: cleanParams({ page_size: 25, ...q }),
      })
    ).data;
  },
  async publicPay(token: string): Promise<PublicPayView> {
    return (await api.get<PublicPayView>(`/isp/public/pay/${encodeURIComponent(token)}`)).data;
  },
};
