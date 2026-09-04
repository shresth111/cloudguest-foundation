export type ChannelPartnerStatus = "active" | "inactive";

/** One welcome channel's outcome, as the backend classifies it.
 *
 * `not_configured` is a property of the *server* -- it means this
 * deployment has no provider wired for that channel at all, so it reads
 * identically for every partner and no per-partner follow-up changes it.
 * `failed` is a property of the *partner* and is worth chasing. Treating
 * the two the same is what put a red "Welcome failed" badge on all five
 * live partners while three of them had had their welcome email
 * delivered. */
export type WelcomeDeliveryStatus = "sent" | "not_configured" | "failed" | "not_attempted";

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
  welcomeSmsStatus: WelcomeDeliveryStatus;
  welcomeEmailStatus: WelcomeDeliveryStatus;
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
