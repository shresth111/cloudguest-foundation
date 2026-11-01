/** COLLECTIONS-1 endpoints. All 404 while ISP_COLLECTIONS_ENABLED is off.
 * Cash goes through the backend's existing payment code
 * (`IspBillingService.record_payment`); this file never posts to
 * `/isp/billing/payments` itself because field staff do not hold
 * `isp_billing.execute`. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";
import type {
  CashResult,
  CollectionPromise,
  Forecast,
  HandoverDetail,
  HandoverPage,
  HandoverStatus,
  MyCash,
  NoteOutcome,
  OverduePage,
  OverdueQuery,
  PartyRef,
  PromisePage,
  PromiseStatus,
  Timeline,
  TimelineEvent,
} from "@/services/isp-partner/collections-types";

const BASE = "/isp/collections";

function clean(q: object): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v as string | number;
  }
  return out;
}

export const collectionsService = {
  async overdue(q: OverdueQuery): Promise<OverduePage> {
    const { data } = await api.get<OverduePage>(`${BASE}/overdue`, { params: clean(q) });
    return data;
  },
  async forecast(): Promise<Forecast> {
    const { data } = await api.get<Forecast>(`${BASE}/forecast`);
    return data;
  },
  async timeline(party: PartyRef): Promise<Timeline> {
    const path =
      "subscriber_id" in party
        ? `${BASE}/subscribers/${party.subscriber_id}/timeline`
        : `${BASE}/customers/${party.isp_customer_id}/timeline`;
    const { data } = await api.get<Timeline>(path);
    return data;
  },
  async addNote(
    party: PartyRef,
    body: string,
    outcome: NoteOutcome | null,
  ): Promise<TimelineEvent> {
    const { data } = await api.post<TimelineEvent>(`${BASE}/notes`, {
      ...party,
      body,
      outcome: outcome || undefined,
    });
    return data;
  },
  async promises(q: {
    status?: PromiseStatus;
    due?: "today" | "week" | "missed";
    page?: number;
    page_size?: number;
  }): Promise<PromisePage> {
    const { data } = await api.get<PromisePage>(`${BASE}/promises`, { params: clean(q) });
    return data;
  },
  async createPromise(
    party: PartyRef,
    body: { promised_on: string; amount_paise?: number | null; note?: string | null },
  ): Promise<CollectionPromise> {
    const { data } = await api.post<CollectionPromise>(`${BASE}/promises`, {
      ...party,
      promised_on: body.promised_on,
      amount_paise: body.amount_paise || undefined,
      note: body.note || undefined,
    });
    return data;
  },
  async cancelPromise(id: string, reason: string): Promise<CollectionPromise> {
    const { data } = await api.post<CollectionPromise>(`${BASE}/promises/${id}/cancel`, {
      reason,
    });
    return data;
  },
  /** `idempotencyKey` is made once per dialog, so a double tap or a retry
   * after a timeout records the cash once. */
  async collectCash(
    party: PartyRef,
    body: { amount_paise: number; invoice_id?: string | null; note?: string | null },
    idempotencyKey: string,
  ): Promise<CashResult> {
    const { data } = await api.post<CashResult>(
      `${BASE}/cash`,
      {
        ...party,
        amount_paise: body.amount_paise,
        invoice_id: body.invoice_id || undefined,
        note: body.note || undefined,
      },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },
  slip(paymentId: string, receipt: string, width: 58 | 80 = 80): Promise<FileDownload> {
    return downloadFile(
      `${BASE}/payments/${paymentId}/slip.pdf`,
      { width: String(width) },
      `${receipt.replace(/\//g, "-")}-${width}mm.pdf`,
    );
  },
  async myCash(date?: string): Promise<MyCash> {
    const { data } = await api.get<MyCash>(`${BASE}/cash/mine`, {
      params: date ? { date } : {},
    });
    return data;
  },
  async submitHandover(body: {
    business_date: string;
    declared_paise: number;
    note?: string | null;
  }): Promise<HandoverDetail> {
    const { data } = await api.post<HandoverDetail>(`${BASE}/handovers`, {
      ...body,
      note: body.note || undefined,
    });
    return data;
  },
  async handovers(q: {
    status?: HandoverStatus;
    isp_user_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }): Promise<HandoverPage> {
    const { data } = await api.get<HandoverPage>(`${BASE}/handovers`, { params: clean(q) });
    return data;
  },
  async handover(id: string): Promise<HandoverDetail> {
    const { data } = await api.get<HandoverDetail>(`${BASE}/handovers/${id}`);
    return data;
  },
  async approveHandover(
    id: string,
    receivedPaise: number,
    note: string | null,
  ): Promise<HandoverDetail> {
    const { data } = await api.post<HandoverDetail>(`${BASE}/handovers/${id}/approve`, {
      received_paise: receivedPaise,
      note: note || undefined,
    });
    return data;
  },
  async rejectHandover(id: string, note: string): Promise<HandoverDetail> {
    const { data } = await api.post<HandoverDetail>(`${BASE}/handovers/${id}/reject`, {
      note,
    });
    return data;
  },
};
