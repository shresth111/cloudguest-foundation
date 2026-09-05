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

/** Real engagement counters for one campaign, from
 * `GET /campaigns/{id}/results`.
 *
 * The guest-facing portal has always recorded these -- `CampaignOverlay`
 * fires `POST /portal/campaigns/{id}/impression` and survey submissions go
 * through `campaign-portal.service.ts` -- but nothing in the dashboard ever
 * read them back, so the admin table hardcoded `impressions: 0,
 * conversions: 0` for every real campaign while demo fixtures showed
 * 2841/423. The data was there the whole time; only the caller was
 * missing.
 *
 */
export interface CampaignResults {
  campaignId: string;
  totalResponses: number;
  totalImpressions: number;
  totalSkipped: number;
  totalClicked: number;
  questionBreakdowns: CampaignQuestionBreakdown[];
}

/** One question's aggregated answers.
 *
 * The backend already computes all of this
 * (`QuestionResultBreakdownResponse`); which fields are populated depends
 * on `answerType`:
 *
 *   - `rating_5`      -> `averageRating` + `ratingDistribution`
 *   - `single_choice` /
 *     `multi_choice`  -> `optionCounts`
 *   - `free_text`     -> `freeTextAnswers`
 *
 * Every one of them is nullable, so a UI must render "no answers yet"
 * rather than assume the shape its answer type implies. */
export interface CampaignQuestionBreakdown {
  questionId: string;
  questionText: string;
  answerType: QuestionAnswerType;
  totalAnswers: number;
  optionCounts: Record<string, number> | null;
  averageRating: number | null;
  ratingDistribution: Record<number, number> | null;
  freeTextAnswers: string[] | null;
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
