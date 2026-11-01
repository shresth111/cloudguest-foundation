/** QUEUED-RENEWAL endpoints. All 404 while ISP_QUEUED_RENEWAL_ENABLED is off.
 * Create wraps the JAZE-1 renew (same invoice), cancel wraps the JAZE-1
 * revert (credit note); nothing here moves money itself. */
import api from "@/services/api";

export interface QueuedRenewal {
  id: string;
  subscriber_id: string;
  isp_customer_id: string;
  package: { id: string; name: string | null };
  previous_package: { id: string; name: string | null } | null;
  cycles: number;
  starts_at: string;
  ends_at: string;
  status: "pending" | "active" | "cancelled";
  invoice: {
    id: string;
    number: string;
    total_paise: number;
    paid_paise: number;
    status: string;
  } | null;
  activated_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  outcome: { credit_note_number?: string | null; voided_receipts?: string[] };
  created_at: string;
}

export interface QueuedList {
  subscriber_id: string;
  valid_until: string | null;
  can_queue: boolean;
  items: QueuedRenewal[];
}

export const queuedRenewalService = {
  async forSubscriber(subscriberId: string): Promise<QueuedList> {
    const { data } = await api.get<QueuedList>(`/isp/subscribers/${subscriberId}/queued-renewals`);
    return data;
  },
  async queue(
    subscriberId: string,
    body: {
      package_id: string;
      cycles: number;
      paid_now: boolean;
      payment?: { mode: string; reference?: string };
      idempotency_key: string;
    },
  ): Promise<{ queued: QueuedRenewal; repeat: boolean }> {
    const { data } = await api.post<{ queued: QueuedRenewal; repeat: boolean }>(
      `/isp/subscribers/${subscriberId}/queued-renewals`,
      body,
    );
    return data;
  },
  async cancel(
    subscriberId: string,
    id: string,
    reason: string,
  ): Promise<{ credit_note_number: string | null; voided_receipts: string[] }> {
    const { data } = await api.post<{
      credit_note_number: string | null;
      voided_receipts: string[];
    }>(`/isp/subscribers/${subscriberId}/queued-renewals/${id}/cancel`, { reason });
    return data;
  },
};
