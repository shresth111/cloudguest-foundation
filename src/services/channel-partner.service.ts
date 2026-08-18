import { api } from "@/services/api";
import type {
  ChannelPartner,
  ChannelPartnerStatus,
  CreateChannelPartnerPayload,
} from "@/types/channel-partner";

interface BackendChannelPartner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  gst_number: string;
  status: ChannelPartnerStatus;
  welcome_sms_sent_at: string | null;
  welcome_sms_error: string | null;
  welcome_email_sent_at: string | null;
  welcome_email_error: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendChannelPartnerListResponse {
  items: BackendChannelPartner[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toChannelPartner(p: BackendChannelPartner): ChannelPartner {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    address: p.address,
    city: p.city,
    gstNumber: p.gst_number,
    status: p.status,
    welcomeSmsSentAt: p.welcome_sms_sent_at,
    welcomeSmsError: p.welcome_sms_error,
    welcomeEmailSentAt: p.welcome_email_sent_at,
    welcomeEmailError: p.welcome_email_error,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export const channelPartnerService = {
  /** Master console -- onboards a new channel partner and sends them a
   * welcome message (SMS always, email too when provided) in one step,
   * gated by channel_partners.create. Always resolves with the created
   * partner -- POST /channel-partners always 201s even when a welcome
   * channel fails/is unconfigured, that outcome is reflected in the
   * returned `welcomeSmsError`/`welcomeEmailError` fields instead (see the
   * backend's app.domains.channel_partner.service.ChannelPartnerService,
   * same "create always succeeds, send outcome is separate" shape as
   * quotationService.createAndSend). */
  async createAndOnboard(payload: CreateChannelPartnerPayload): Promise<ChannelPartner> {
    const { data } = await api.post<BackendChannelPartner>("/channel-partners", {
      name: payload.name,
      phone: payload.phone,
      email: payload.email || undefined,
      address: payload.address,
      city: payload.city,
      gst_number: payload.gstNumber,
    });
    return toChannelPartner(data);
  },

  /** Master console -- lists onboarded channel partners, gated by
   * channel_partners.read. */
  async list(params?: {
    status?: ChannelPartnerStatus;
    search?: string;
  }): Promise<ChannelPartner[]> {
    const { data } = await api.get<BackendChannelPartnerListResponse>("/channel-partners", {
      params: { page_size: 100, ...params },
    });
    return data.items.map(toChannelPartner);
  },

  /** Master console -- fetches one channel partner, gated by
   * channel_partners.read. */
  async get(partnerId: string): Promise<ChannelPartner> {
    const { data } = await api.get<BackendChannelPartner>(`/channel-partners/${partnerId}`);
    return toChannelPartner(data);
  },
};
