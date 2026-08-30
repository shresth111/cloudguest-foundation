import { guestPortalApi } from "@/services/guest-portal-api";
import type {
  CampaignAnswerValue,
  CampaignType,
  NextCampaign,
  QuestionAnswerType,
} from "@/types/campaign";

/**
 * Guest-facing client for `app.domains.campaigns.router.guest_router`
 * (`/portal/campaigns/*`) -- the captive-portal counterpart to
 * `campaign.service.ts` (admin CRUD, authenticated `api` client). Mirrors
 * `portal-runtime.service.ts`'s own conventions exactly: `guestPortalApi`
 * (no admin JWT, these endpoints carry no `RequirePermission`/`CurrentUser`
 * at all -- see the backend router's own module docstring), explicit
 * snake_case-to-camelCase mapping functions rather than
 * `ConfigDict(from_attributes=True)` auto-mapping.
 */

interface BackendNextCampaignQuestion {
  id: string;
  order_index: number;
  question_text: string;
  answer_type: QuestionAnswerType;
  options: string[];
  is_required: boolean;
}

interface BackendNextCampaignAsset {
  image_url: string | null;
  click_url: string | null;
  alt_text: string | null;
  headline: string | null;
  subtext: string | null;
  coupon_code: string | null;
  coupon_expires_at: string | null;
}

interface BackendNextCampaign {
  campaign_id: string;
  campaign_type: CampaignType;
  is_skippable: boolean;
  questions: BackendNextCampaignQuestion[];
  asset: BackendNextCampaignAsset | null;
}

function toNextCampaign(data: BackendNextCampaign): NextCampaign {
  return {
    campaignId: data.campaign_id,
    campaignType: data.campaign_type,
    isSkippable: data.is_skippable,
    questions: data.questions.map((q) => ({
      id: q.id,
      orderIndex: q.order_index,
      questionText: q.question_text,
      answerType: q.answer_type,
      options: q.options,
      isRequired: q.is_required,
    })),
    asset: data.asset
      ? {
          imageUrl: data.asset.image_url,
          clickUrl: data.asset.click_url,
          altText: data.asset.alt_text,
          headline: data.asset.headline,
          subtext: data.asset.subtext,
          couponCode: data.asset.coupon_code,
          couponExpiresAt: data.asset.coupon_expires_at,
        }
      : null,
  };
}

export const campaignPortalService = {
  /** Resolves the one campaign (if any) eligible to show this guest
   * session right now -- `sessionId` is `RuntimeSession.sessionId` (the
   * real `GuestSession.id` an active login just returned). Returns `null`
   * for the common case (no campaign is currently eligible for this
   * session/router/location) -- never throws for that case, since the
   * backend itself returns `success: true, data: null`, not a 404 (see
   * `router.py`'s own `get_next_campaign`). */
  async getNextCampaign(sessionId: string): Promise<NextCampaign | null> {
    const { data } = await guestPortalApi.get<BackendNextCampaign | null>(
      "/portal/campaigns/next",
      { params: { session_id: sessionId } },
    );
    return data ? toNextCampaign(data) : null;
  },

  /** Records one "this campaign was shown to this guest session" event.
   * Fire-and-forget from the caller's perspective (best-effort telemetry,
   * never something a guest's own flow should block or fail on) -- but
   * this function itself still awaits the real request and lets a genuine
   * failure propagate, so a caller that *does* want to know/log a failure
   * can. */
  async recordImpression(
    campaignId: string,
    params: { guestSessionId: string; wasSkipped?: boolean; wasClicked?: boolean },
  ): Promise<void> {
    await guestPortalApi.post(`/portal/campaigns/${campaignId}/impression`, {
      guest_session_id: params.guestSessionId,
      was_skipped: params.wasSkipped ?? false,
      was_clicked: params.wasClicked ?? false,
    });
  },

  /** Submits a guest's completed survey answers -- `answers` is keyed by
   * each responding `NextCampaignQuestion.id`. Only valid for
   * `campaignType: "survey"` (the backend rejects any other type -- see
   * `CampaignsService.submit_response`'s own `WrongCampaignTypeError`). */
  async submitResponse(
    campaignId: string,
    params: { guestSessionId: string; answers: Record<string, CampaignAnswerValue> },
  ): Promise<void> {
    await guestPortalApi.post(`/portal/campaigns/${campaignId}/respond`, {
      guest_session_id: params.guestSessionId,
      answers: params.answers,
    });
  },
};
