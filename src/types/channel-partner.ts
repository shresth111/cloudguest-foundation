export type ChannelPartnerStatus = "active" | "inactive";

export interface ChannelPartner {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  gstNumber: string;
  status: ChannelPartnerStatus;
  welcomeSmsSentAt: string | null;
  welcomeSmsError: string | null;
  welcomeEmailSentAt: string | null;
  welcomeEmailError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelPartnerPayload {
  name: string;
  /** 10-digit Indian mobile number, e.g. "9876543210" -- normalized to
   * E.164 by the backend, mirrored client-side only for instant feedback
   * (see routes/master.channel-partners.tsx's isValidIndianMobile). */
  phone: string;
  email?: string;
  address: string;
  city: string;
  /** 15-character GSTIN, e.g. "27AAAAA0000A1Z5". */
  gstNumber: string;
}

export const CHANNEL_PARTNER_STATUS_LABEL: Record<ChannelPartnerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};
