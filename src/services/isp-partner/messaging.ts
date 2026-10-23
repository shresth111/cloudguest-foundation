/**
 * F1/F3 calls (ADDENDUM_04, coordinator defaults): the ISP's one messaging
 * credit wallet, messaging settings, the ISP-level BYO sender and the
 * per-customer own-sender override. All ISP routes (`/isp/...`); the shim
 * passes them through.
 */
import { api } from "@/services/api";

export interface WalletSummary {
  available_minor: number;
  reserved_minor: number;
  low_balance_threshold_minor: number;
  is_low: boolean;
}
export interface IspWallet {
  minor_per_credit: number;
  pool: WalletSummary;
  held_by_customers: ({ isp_customer_id: string } & WalletSummary)[];
  held_total_minor: number;
}
export interface MessagingSettings {
  byo_customer_override_enabled: boolean;
  pii_unmask_enabled: boolean;
  pii_unmasked_for_me: boolean;
}
export interface ProviderOwnView {
  channel: string;
  provider_type: string;
  enabled: boolean;
  status: string;
  last_error: string | null;
  display: Record<string, unknown>;
}
export interface ProviderChannel {
  channel: "sms" | "whatsapp" | "email";
  effective_source: string;
  own: ProviderOwnView | null;
}
export interface CustomerSender {
  isp_customer_id: string;
  own_sender: boolean;
  override_allowed: boolean;
}

export const messagingService = {
  async wallet(): Promise<IspWallet> {
    const { data } = await api.get<IspWallet>("/isp/wallet");
    return data;
  },
  async settings(): Promise<MessagingSettings> {
    const { data } = await api.get<MessagingSettings>("/isp/messaging/settings");
    return data;
  },
  async setOverride(enabled: boolean): Promise<void> {
    await api.put("/isp/messaging/settings", { byo_customer_override_enabled: enabled });
  },
  async providers(): Promise<ProviderChannel[]> {
    const { data } = await api.get<{ channels: ProviderChannel[] }>("/isp/messaging/providers");
    return data.channels;
  },
  async putProvider(
    channel: string,
    body: { provider_type: string; config: Record<string, unknown>; enabled?: boolean | null },
  ): Promise<void> {
    await api.put(`/isp/messaging/providers/${channel}`, body);
  },
  async deleteProvider(channel: string): Promise<void> {
    await api.delete(`/isp/messaging/providers/${channel}`);
  },
  async verifyProvider(channel: string, testTo: string | null): Promise<void> {
    await api.post(`/isp/messaging/providers/${channel}/verify`, { test_to: testTo });
  },
  async syncAll(): Promise<void> {
    await api.post("/isp/messaging/providers/sync");
  },
  async customerSender(customerId: string): Promise<CustomerSender> {
    const { data } = await api.get<CustomerSender>(`/isp/customers/${customerId}/messaging`);
    return data;
  },
  async setCustomerSender(customerId: string, ownSender: boolean): Promise<void> {
    await api.put(`/isp/customers/${customerId}/messaging`, { own_sender: ownSender });
  },
};

export function credits(minor: number, perCredit: number): string {
  return (minor / (perCredit || 100)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
