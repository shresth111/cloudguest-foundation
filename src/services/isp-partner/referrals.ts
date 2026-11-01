/** REFERRAL-1 endpoints. All 404 while ISP_REFERRALS_ENABLED is off. The
 * credit itself is a credit note the backend issues; nothing here moves
 * money. */
import api from "@/services/api";

export type ReferralStatus = "pending" | "earned" | "applied" | "rejected" | "cancelled";

export interface ReferralParty {
  subscriber_id: string;
  label: string | null;
  identifier: string | null;
}

export interface Referral {
  id: string;
  referrer: ReferralParty;
  referred: ReferralParty;
  status: ReferralStatus;
  reward_paise: number | null;
  qualifying_invoice_number: string | null;
  earned_at: string | null;
  applied_invoice_number: string | null;
  credit_note_number: string | null;
  applied_paise: number | null;
  applied_at: string | null;
  reason: string | null;
  note: string | null;
  history: { at: string; status: ReferralStatus; by: string | null; detail: string | null }[];
  created_at: string;
}

export interface ReferralPage {
  items: Referral[];
  total: number;
  page: number;
  page_size: number;
  summary: Record<ReferralStatus, number> & { credited_paise: number };
}

export interface ReferralSettings {
  enabled: boolean;
  reward_paise: number;
  max_rewards_per_year: number;
  window_days: number;
  min_first_invoice_paise: number;
  rules: string;
}

export const referralsService = {
  async list(q: { status?: ReferralStatus; page?: number }): Promise<ReferralPage> {
    const params: Record<string, string | number> = { page_size: 50 };
    if (q.status) params.status = q.status;
    if (q.page) params.page = q.page;
    const { data } = await api.get<ReferralPage>("/isp/referrals", { params });
    return data;
  },
  async create(body: {
    referrer_subscriber_id: string;
    referred_subscriber_id: string;
    note?: string;
  }): Promise<Referral> {
    const { data } = await api.post<Referral>("/isp/referrals", body);
    return data;
  },
  async cancel(id: string, reason: string): Promise<Referral> {
    const { data } = await api.post<Referral>(`/isp/referrals/${id}/cancel`, { reason });
    return data;
  },
  async settings(): Promise<ReferralSettings> {
    const { data } = await api.get<ReferralSettings>("/isp/referrals/settings");
    return data;
  },
  async saveSettings(body: Partial<Omit<ReferralSettings, "rules">>): Promise<ReferralSettings> {
    const { data } = await api.put<ReferralSettings>("/isp/referrals/settings", body);
    return data;
  },
};
