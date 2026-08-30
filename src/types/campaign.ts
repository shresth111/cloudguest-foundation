export type CampaignType = "survey" | "banner" | "redirect";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

export type DisplayRule = "every_login" | "first_login_only" | "once_per_n_days";

export interface Campaign {
  id: string;
  organizationId: string;
  locationId: string | null;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  displayRule: DisplayRule;
  displayIntervalDays: number | null;
  targetNetworks: string[];
  isSkippable: boolean;
  createdAt: string;
}

export interface CampaignListQuery {
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface CampaignListResult {
  rows: Campaign[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateCampaignPayload {
  locationId?: string | null;
  name: string;
  campaignType: CampaignType;
  startsAt?: string | null;
  endsAt?: string | null;
  displayRule?: DisplayRule;
  displayIntervalDays?: number | null;
  targetNetworks?: string[];
  isSkippable?: boolean;
}

export interface UpdateCampaignPayload {
  locationId?: string | null;
  name?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  displayRule?: DisplayRule;
  displayIntervalDays?: number | null;
  targetNetworks?: string[];
  isSkippable?: boolean;
}

export interface CampaignKpis {
  total: number;
  active: number;
  scheduled: number;
  draft: number;
}

export type QuestionAnswerType = "single_choice" | "multi_choice" | "rating_5" | "free_text";

export interface CampaignQuestion {
  id: string;
  campaignId: string;
  orderIndex: number;
  questionText: string;
  answerType: QuestionAnswerType;
  options: string[];
  isRequired: boolean;
}

export interface CreateCampaignQuestionPayload {
  orderIndex: number;
  questionText: string;
  answerType: QuestionAnswerType;
  options?: string[];
  isRequired?: boolean;
}

export interface UpdateCampaignQuestionPayload {
  orderIndex?: number;
  questionText?: string;
  answerType?: QuestionAnswerType;
  options?: string[];
  isRequired?: boolean;
}

// BANNER/REDIRECT campaigns carry their real guest-facing content as an
// asset (image + click-through link) rather than questions -- see
// backend app/domains/campaigns/models.py's CampaignAsset docstring.
export interface CampaignAsset {
  id: string;
  campaignId: string;
  imageUrl: string | null;
  clickUrl: string | null;
  altText: string | null;
  locale: string | null;
  // Banner & Discounts promo copy -- a text banner with a redeemable
  // coupon, rendered as a coupon card rather than only a tappable image
  // (backend campaign_assets.headline/subtext/coupon_code/coupon_expires_at).
  headline: string | null;
  subtext: string | null;
  couponCode: string | null;
  couponExpiresAt: string | null;
}

export interface CreateCampaignAssetPayload {
  imageUrl?: string | null;
  clickUrl?: string | null;
  altText?: string | null;
  locale?: string | null;
  headline?: string | null;
  subtext?: string | null;
  couponCode?: string | null;
  couponExpiresAt?: string | null;
}

// ============================================================================
// Guest-facing (captive-portal) shapes -- the narrow subset
// `GET /portal/campaigns/next` actually returns (see backend
// app/domains/campaigns/schemas.py's `NextCampaignResponse` docstring: never
// the admin-only fields above like `status`/`target_networks`/timestamps).
// ============================================================================

export interface NextCampaignQuestion {
  id: string;
  orderIndex: number;
  questionText: string;
  answerType: QuestionAnswerType;
  options: string[];
  isRequired: boolean;
}

export interface NextCampaignAsset {
  imageUrl: string | null;
  clickUrl: string | null;
  altText: string | null;
  // Banner & Discounts promo copy the captive portal renders as a coupon
  // card. Null for a plain image/redirect banner.
  headline: string | null;
  subtext: string | null;
  couponCode: string | null;
  couponExpiresAt: string | null;
}

export interface NextCampaign {
  campaignId: string;
  campaignType: CampaignType;
  isSkippable: boolean;
  questions: NextCampaignQuestion[];
  asset: NextCampaignAsset | null;
}

/** A guest's raw answer to one question -- a string for
 * single_choice/free_text, a string array for multi_choice, a number 1-5
 * for rating_5. Matches the backend's own `answers: dict[str, object]`
 * (see `CampaignRespondRequest`). */
export type CampaignAnswerValue = string | string[] | number;
