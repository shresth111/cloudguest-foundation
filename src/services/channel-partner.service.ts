import { api } from "@/services/api";
import type {
  ChannelPartner,
  ChannelPartnerStatus,
  CreateChannelPartnerPayload,
  WelcomeDeliveryStatus,
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
  // Optional: added alongside the backend's `welcome_delivery_status`, so a
  // response from a not-yet-deployed backend simply omits them.
  welcome_sms_status?: WelcomeDeliveryStatus;
  welcome_email_status?: WelcomeDeliveryStatus;
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

/** The backend's `welcome_delivery_status`, restated for the window where
 * a response predates it. Never used when the field is present. */
function deriveWelcomeStatus(sentAt: string | null, error: string | null): WelcomeDeliveryStatus {
  if (sentAt) return "sent";
  if (!error) return "not_attempted";
  return error.startsWith("No real ") && error.includes("provider is configured")
    ? "not_configured"
    : "failed";
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
    // Fall back rather than trusting the field to be there. The frontend
    // and the backend that added these two fields deploy independently, so
    // for the length of one rollout -- and again on any rollback -- this
    // response can legitimately arrive without them. Undefined would reach
    // `WELCOME_CHANNEL_LABEL[status](detail)` as `undefined(detail)` and
    // take the whole partner drawer down over a field that only decides a
    // label. Deriving it here from the columns that have always been on the
    // row keeps the page working, and the derivation matches the backend's
    // `welcome_delivery_status` -- `sent_at` wins, then the absence of an
    // error, and "no provider configured" is not a failure.
    welcomeSmsStatus:
      p.welcome_sms_status ?? deriveWelcomeStatus(p.welcome_sms_sent_at, p.welcome_sms_error),
    welcomeEmailStatus:
      p.welcome_email_status ?? deriveWelcomeStatus(p.welcome_email_sent_at, p.welcome_email_error),
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

  /** Master console -- deactivates a channel partner, gated by
   * channel_partners.manage (a mutation, unlike the .read-gated calls
   * above). Idempotent on the backend: revoking an already-inactive
   * partner is a 200 no-op, not an error, so this never needs its own
   * "already revoked" handling here. */
  async revoke(partnerId: string): Promise<ChannelPartner> {
    const { data } = await api.post<BackendChannelPartner>(`/channel-partners/${partnerId}/revoke`);
    return toChannelPartner(data);
  },
};
