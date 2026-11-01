/** ADDENDUM_05 JAZE-1 endpoints (`/isp/subscribers/*` 360 + directory). */
import api from "@/services/api";
import { cleanParams } from "@/services/isp-partner/isp";
import type {
  DirectoryPage,
  DirectoryQuery,
  NoteBody,
  OnboardBody,
  PlanSyncBody,
  PlanSyncResult,
  RenewBody,
  Subscriber360,
  SubscriberLedger,
  SubscriberProfile,
  TypeaheadHit,
} from "@/services/isp-partner/subscribers360-types";

const base = (id: string) => `/isp/subscribers/${id}`;

async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<T>(url, body ?? {});
  return data;
}

export const subscribers360Service = {
  async directory(q: DirectoryQuery): Promise<DirectoryPage> {
    const { data } = await api.get<DirectoryPage>("/isp/subscribers/directory", {
      params: cleanParams(q),
    });
    return data;
  },
  async typeahead(q: string): Promise<TypeaheadHit[]> {
    const { data } = await api.get<TypeaheadHit[]>("/isp/subscribers/typeahead", {
      params: { q },
    });
    return data;
  },
  async nextCircuitId(): Promise<number> {
    const { data } = await api.get<{ next_circuit_id: number }>("/isp/subscribers/circuit-id/next");
    return data.next_circuit_id;
  },
  async get(id: string): Promise<Subscriber360> {
    const { data } = await api.get<Subscriber360>(`${base(id)}/360`);
    return data;
  },
  async ledger(id: string): Promise<SubscriberLedger> {
    const { data } = await api.get<SubscriberLedger>(`${base(id)}/ledger`);
    return data;
  },
  async putProfile(id: string, body: SubscriberProfile): Promise<SubscriberProfile> {
    const { data } = await api.put<SubscriberProfile>(`${base(id)}/profile`, body);
    return data;
  },
  onboard: (body: OnboardBody) => post<Subscriber360>("/isp/subscribers/onboard", body),
  disconnect: (id: string) =>
    post<{ sessions_ended: number; unconfirmed: number }>(`${base(id)}/disconnect`),
  grace: (id: string, hours: number, note?: string | null) =>
    post<{ valid_until: string }>(`${base(id)}/grace`, { hours, note: note || null }),
  block: (id: string, kind: "temporary" | "permanent", reason?: string | null) =>
    post<unknown>(`${base(id)}/block`, { kind, reason: reason || null }),
  unblock: (id: string) => post<Subscriber360>(`${base(id)}/unblock`),
  freeze: (id: string, reason?: string | null) =>
    post<unknown>(`${base(id)}/freeze`, { reason: reason || null }),
  unfreeze: (id: string) => post<Subscriber360>(`${base(id)}/unfreeze`),
  note: (id: string, body: NoteBody) => post<{ id: string }>(`${base(id)}/notes`, body),
  renew: (id: string, body: RenewBody) => post<unknown>(`${base(id)}/renew`, body),
  revert: (id: string, reason: string) =>
    post<{ valid_until: string | null; credit_note_number: string | null }>(`${base(id)}/revert`, {
      reason,
    }),
  move: (id: string, ispCustomerId: string, reason?: string | null) =>
    post<{ customer_name: string }>(`${base(id)}/move`, {
      isp_customer_id: ispCustomerId,
      reason: reason || null,
    }),
  planSync: (kind: "package" | "group", id: string, body: PlanSyncBody) =>
    post<PlanSyncResult>(
      `/isp/${kind === "package" ? "packages" : "speed-groups"}/${id}/apply-to-subscribers`,
      body,
    ),
};
