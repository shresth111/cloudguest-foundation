/** FRANCHISE-2 endpoints (ADDENDUM_06). All 404 while ISP_FRANCHISE_ENABLED is off. */
import api from "@/services/api";
import { downloadFile, type FileDownload } from "@/services/isp-partner/isp";

export interface SharePlan {
  mode: "percent" | "wholesale";
  wholesale_paise: number;
  auto_debit: boolean;
  below_min_since: string | null;
  alerted_at: string | null;
}

export interface ZoneWallet {
  zone_id: string;
  name: string;
  city: string | null;
  state_code: string | null;
  revenue_share_bp: number;
  min_balance_paise: number;
  credit_limit_paise: number;
  balance_paise: number;
  available_paise: number;
  standing: "paid" | "unpaid";
  below_minimum: boolean;
  share_plan: SharePlan | null;
  auto_debited_paise: number;
  auto_reversed_paise: number;
}

export interface WalletOverview {
  items: ZoneWallet[];
  auto_debit_enabled: boolean;
  enforce_credit: boolean;
  rules: string;
}

export interface RevenueRow {
  invoice_id: string;
  number: string;
  issue_date: string;
  subscriber: string | null;
  circuit_id: number | null;
  invoice_kind: string;
  total_paise: number;
  paid_paise: number;
  credit_noted_paise: number;
  isp_share_paise: number;
  zone_share_paise: number;
  auto_debit_paise: number;
  auto_reversed_paise: number;
}

export interface ZoneRevenue {
  zone_id: string;
  name: string;
  mode: string | null;
  revenue_share_bp: number;
  totals: Record<string, number>;
  items: RevenueRow[];
}

export interface ZoneCharge {
  id: string;
  zone_id: string;
  name: string;
  amount_paise: number;
  day_of_month: number;
  starts_on: string;
  active: boolean;
  last_period: string | null;
}

export interface Settlement {
  id: string;
  zone_id: string;
  zone_name: string | null;
  number: string;
  period_from: string;
  period_to: string;
  opening_paise: number;
  debits_paise: number;
  credits_paise: number;
  closing_paise: number;
  billed_paise: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  issued_at: string | null;
}

export const franchiseService = {
  async wallets(): Promise<WalletOverview> {
    const { data } = await api.get<WalletOverview>("/isp/franchise/zones");
    return data;
  },
  async saveShare(
    zoneId: string,
    body: Pick<SharePlan, "mode" | "wholesale_paise" | "auto_debit">,
  ) {
    const { data } = await api.put<SharePlan>(`/isp/franchise/zones/${zoneId}/share`, body);
    return data;
  },
  async revenue(zoneId: string, from: string, to: string): Promise<ZoneRevenue> {
    const { data } = await api.get<ZoneRevenue>(`/isp/franchise/zones/${zoneId}/revenue`, {
      params: { date_from: from, date_to: to },
    });
    return data;
  },
  async charges(zoneId: string): Promise<ZoneCharge[]> {
    const { data } = await api.get<ZoneCharge[]>(`/isp/franchise/zones/${zoneId}/charges`);
    return data ?? [];
  },
  async addCharge(zoneId: string, body: Omit<ZoneCharge, "id" | "zone_id" | "last_period">) {
    const { data } = await api.post<ZoneCharge>(`/isp/franchise/zones/${zoneId}/charges`, body);
    return data;
  },
  async patchCharge(
    id: string,
    body: Partial<Pick<ZoneCharge, "active" | "name" | "amount_paise" | "day_of_month">>,
  ) {
    const { data } = await api.patch<ZoneCharge>(`/isp/franchise/charges/${id}`, body);
    return data;
  },
  async runCharges(): Promise<{ charges: number; alerts: number }> {
    const { data } = await api.post<{ charges: number; alerts: number }>(
      "/isp/franchise/charges/run",
      {},
    );
    return data;
  },
  async settlements(zoneId: string): Promise<Settlement[]> {
    const { data } = await api.get<Settlement[]>(`/isp/franchise/zones/${zoneId}/settlements`);
    return data ?? [];
  },
  async createSettlement(zoneId: string, from: string, to: string): Promise<Settlement> {
    const { data } = await api.post<Settlement>(`/isp/franchise/zones/${zoneId}/settlements`, {
      date_from: from,
      date_to: to,
    });
    return data;
  },
  settlementPdf(id: string, number: string): Promise<FileDownload> {
    return downloadFile(
      `/isp/franchise/settlements/${id}/pdf`,
      {},
      `${number.replace(/\//g, "-")}.pdf`,
    );
  },
};
