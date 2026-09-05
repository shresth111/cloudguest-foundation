import { api } from "@/services/api";
import { resolveOrganizationId as sharedResolveOrganizationId } from "./organization-id";
import type {
  Campaign,
  CampaignAsset,
  CampaignKpis,
  CampaignResults,
  CampaignListQuery,
  CampaignListResult,
  CampaignQuestion,
  CampaignType,
  CreateCampaignAssetPayload,
  CreateCampaignPayload,
  CreateCampaignQuestionPayload,
  NextCampaign,
  QuestionAnswerType,
  UpdateCampaignPayload,
  UpdateCampaignQuestionPayload,
} from "@/types/campaign";

interface BackendCampaign {
  id: string;
  organization_id: string;
  location_id: string | null;
  name: string;
  campaign_type: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  display_rule: string;
  display_interval_days: number | null;
  target_networks: string[];
  is_skippable: boolean;
  created_at: string;
}

interface BackendCampaignListResponse {
  items: BackendCampaign[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendCampaignQuestion {
  id: string;
  campaign_id: string;
  order_index: number;
  question_text: string;
  answer_type: string;
  options: string[];
  is_required: boolean;
}

interface BackendCampaignAsset {
  id: string;
  campaign_id: string;
  image_url: string | null;
  click_url: string | null;
  alt_text: string | null;
  locale: string | null;
  headline: string | null;
  subtext: string | null;
  coupon_code: string | null;
  coupon_expires_at: string | null;
}

function toAsset(a: BackendCampaignAsset): CampaignAsset {
  return {
    id: a.id,
    campaignId: a.campaign_id,
    imageUrl: a.image_url,
    clickUrl: a.click_url,
    altText: a.alt_text,
    locale: a.locale,
    headline: a.headline,
    subtext: a.subtext,
    couponCode: a.coupon_code,
    couponExpiresAt: a.coupon_expires_at,
  };
}

function toQuestion(q: BackendCampaignQuestion): CampaignQuestion {
  return {
    id: q.id,
    campaignId: q.campaign_id,
    orderIndex: q.order_index,
    questionText: q.question_text,
    answerType: q.answer_type as CampaignQuestion["answerType"],
    options: q.options,
    isRequired: q.is_required,
  };
}

function toCampaign(c: BackendCampaign): Campaign {
  return {
    id: c.id,
    organizationId: c.organization_id,
    locationId: c.location_id,
    name: c.name,
    campaignType: c.campaign_type as Campaign["campaignType"],
    status: c.status as Campaign["status"],
    startsAt: c.starts_at,
    endsAt: c.ends_at,
    displayRule: c.display_rule as Campaign["displayRule"],
    displayIntervalDays: c.display_interval_days,
    targetNetworks: c.target_networks,
    isSkippable: c.is_skippable,
    createdAt: c.created_at,
  };
}

// Campaigns are organization-scoped (X-Organization-Id) with an optional
// location_id filter -- this page has no org selector, so it resolves to
// the caller's first/only organization.
//
// GET /organizations is the platform-wide admin listing -- it requires
// organizations.read at GLOBAL scope, which an ordinary customer/org-owner
// session doesn't hold (only at ORGANIZATION scope, for their own org), so
// it 403s and silently broke every method on this service for a real
// customer session (see customer.service.ts's resolveOrgId doc comment for
// the full explanation -- same fix applied here, first fixed in
// ticket.service.ts's resolveOrgId).
async function resolveOrganizationId(): Promise<string> {
  // Delegates to the one shared resolver. This used to hold its own
  // module cache and issue its own `/me/organizations`, which is why a
  // single page load fetched that endpoint once per active service.
  // See services/organization-id.ts.
  return sharedResolveOrganizationId();
}

export const campaignService = {
  async getOrganizationId(): Promise<string> {
    return resolveOrganizationId();
  },

  /** Real engagement counters for one campaign.
   *
   * Impressions and survey responses have been recorded by the guest
   * portal since campaigns shipped; this is simply the first caller to
   * read them back. Kept as a per-campaign call because the list endpoint
   * does not embed counters -- see `listResults` for the batched form the
   * admin table actually uses. */
  async getResults(campaignId: string): Promise<CampaignResults> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<{
      campaign_id: string;
      total_responses: number;
      total_impressions: number;
      total_skipped: number;
      total_clicked: number;
    }>(`/campaigns/${campaignId}/results`, {
      headers: { "X-Organization-Id": orgId },
    });
    return {
      campaignId: data.campaign_id,
      totalResponses: data.total_responses,
      totalImpressions: data.total_impressions,
      totalSkipped: data.total_skipped,
      totalClicked: data.total_clicked,
    };
  },

  /**
   * Counters for many campaigns at once, keyed by campaign id.
   *
   * There is no bulk results endpoint, so this fans out -- but it does so
   * with `allSettled`, deliberately: one campaign whose results 403 or 404
   * must not blank the counters for every other row. A campaign whose call
   * fails is simply absent from the returned map, and the caller renders
   * that as "--" rather than as a confident zero. Showing 0 for "we could
   * not ask" is how the previous version of this table came to claim every
   * campaign had never been seen.
   */
  async listResults(campaignIds: string[]): Promise<Record<string, CampaignResults>> {
    const settled = await Promise.allSettled(campaignIds.map((id) => this.getResults(id)));
    const out: Record<string, CampaignResults> = {};
    settled.forEach((r, i) => {
      if (r.status === "fulfilled") out[campaignIds[i]] = r.value;
    });
    return out;
  },

  async list(q: CampaignListQuery): Promise<CampaignListResult> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaignListResponse>("/campaigns", {
      params: { location_id: q.locationId, page: q.page, page_size: q.pageSize },
      headers: { "X-Organization-Id": orgId },
    });
    return {
      rows: data.items.map(toCampaign),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  /**
   * Every campaign in the caller's organization, paged out in full.
   *
   * The endpoint caps page_size at 100 and offers no status filter, so
   * "active campaigns" could only ever be counted client-side over whatever
   * fitted in the first page -- an organization with more than 100
   * campaigns undercounted silently, with nothing on screen saying the
   * number was a cap. Bounded so a pathological total can't spin.
   */
  async listAll(locationId?: string): Promise<Campaign[]> {
    const MAX_PAGES = 20;
    const first = await campaignService.list({ locationId, page: 1, pageSize: 100 });
    const totalPages = Math.min(first.totalPages ?? 1, MAX_PAGES);
    if (totalPages <= 1) return first.rows;

    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        campaignService.list({ locationId, page: i + 2, pageSize: 100 }),
      ),
    );
    return [...first.rows, ...rest.flatMap((r) => r.rows)];
  },

  async get(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaign>(`/campaigns/${id}`, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async getKpis(): Promise<CampaignKpis> {
    const { rows, total } = await campaignService.list({ page: 1, pageSize: 100 });
    return {
      total,
      active: rows.filter((c) => c.status === "active").length,
      scheduled: rows.filter((c) => c.status === "scheduled").length,
      draft: rows.filter((c) => c.status === "draft").length,
    };
  },

  async create(payload: CreateCampaignPayload): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(
      "/campaigns",
      {
        location_id: payload.locationId ?? null,
        name: payload.name,
        campaign_type: payload.campaignType,
        starts_at: payload.startsAt ?? null,
        ends_at: payload.endsAt ?? null,
        display_rule: payload.displayRule ?? "every_login",
        display_interval_days: payload.displayIntervalDays ?? null,
        target_networks: payload.targetNetworks ?? [],
        is_skippable: payload.isSkippable ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async update(id: string, payload: UpdateCampaignPayload): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendCampaign>(
      `/campaigns/${id}`,
      {
        location_id: payload.locationId,
        name: payload.name,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        display_rule: payload.displayRule,
        display_interval_days: payload.displayIntervalDays,
        target_networks: payload.targetNetworks,
        is_skippable: payload.isSkippable,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async remove(id: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/campaigns/${id}`, { headers: { "X-Organization-Id": orgId } });
  },

  async clone(id: string, newName: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(
      `/campaigns/${id}/clone`,
      { new_name: newName },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toCampaign(data);
  },

  async schedule(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/schedule`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async pause(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/pause`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async resume(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/resume`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  async end(id: string): Promise<Campaign> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaign>(`/campaigns/${id}/end`, undefined, {
      headers: { "X-Organization-Id": orgId },
    });
    return toCampaign(data);
  },

  // Survey questions -- SURVEY-type campaigns only (backend rejects these
  // for BANNER/REDIRECT campaigns). This sub-resource existed on the
  // backend (app/domains/campaigns/router.py) since the Campaigns domain
  // was first built, but no frontend caller ever wired it up -- the
  // "Survey & Feedback" card's question list was always static mock
  // content, and a created survey campaign had no click path at all to
  // configure its real questions.
  async listQuestions(campaignId: string): Promise<CampaignQuestion[]> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaignQuestion[]>(
      `/campaigns/${campaignId}/questions`,
      {
        headers: { "X-Organization-Id": orgId },
      },
    );
    return data.map(toQuestion);
  },

  async addQuestion(
    campaignId: string,
    payload: CreateCampaignQuestionPayload,
  ): Promise<CampaignQuestion> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaignQuestion>(
      `/campaigns/${campaignId}/questions`,
      {
        order_index: payload.orderIndex,
        question_text: payload.questionText,
        answer_type: payload.answerType,
        options: payload.options ?? [],
        is_required: payload.isRequired ?? true,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toQuestion(data);
  },

  async updateQuestion(
    questionId: string,
    payload: UpdateCampaignQuestionPayload,
  ): Promise<CampaignQuestion> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.put<BackendCampaignQuestion>(
      `/campaigns/questions/${questionId}`,
      {
        order_index: payload.orderIndex,
        question_text: payload.questionText,
        answer_type: payload.answerType,
        options: payload.options,
        is_required: payload.isRequired,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toQuestion(data);
  },

  async deleteQuestion(questionId: string): Promise<void> {
    const orgId = await resolveOrganizationId();
    await api.delete(`/campaigns/questions/${questionId}`, {
      headers: { "X-Organization-Id": orgId },
    });
  },

  // Assets -- BANNER/REDIRECT campaigns only (backend rejects these for
  // SURVEY campaigns, mirroring the questions sub-resource being
  // SURVEY-only). Real image/click-through content for a banner ad; there
  // was previously no frontend caller at all, so a BANNER campaign had no
  // way to configure any real content beyond its name/dates.
  async listAssets(campaignId: string): Promise<CampaignAsset[]> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.get<BackendCampaignAsset[]>(`/campaigns/${campaignId}/assets`, {
      headers: { "X-Organization-Id": orgId },
    });
    return data.map(toAsset);
  },

  async addAsset(campaignId: string, payload: CreateCampaignAssetPayload): Promise<CampaignAsset> {
    const orgId = await resolveOrganizationId();
    const { data } = await api.post<BackendCampaignAsset>(
      `/campaigns/${campaignId}/assets`,
      {
        image_url: payload.imageUrl ?? null,
        click_url: payload.clickUrl ?? null,
        alt_text: payload.altText ?? null,
        locale: payload.locale ?? null,
        headline: payload.headline ?? null,
        subtext: payload.subtext ?? null,
        coupon_code: payload.couponCode ?? null,
        coupon_expires_at: payload.couponExpiresAt ?? null,
      },
      { headers: { "X-Organization-Id": orgId } },
    );
    return toAsset(data);
  },

  /**
   * Resolves the campaign the operator Portal Preview should render for a
   * location, as the guest-facing `NextCampaign` shape `CampaignOverlay`
   * consumes -- so the preview shows the *campaign-driven* portal (a Survey &
   * Feedback campaign as the two-step feedback -> continue -> sign-in flow, a
   * Banner & Discounts campaign as its coupon/banner card), which is now the
   * single source of what a guest sees beyond the sign-in card.
   *
   * This is a PREVIEW-ONLY approximation of the real guest resolution: the
   * live guest portal resolves its campaign through the unauthenticated,
   * session-keyed `campaignPortalService.getNextCampaign` (post-login, on
   * `portal.session.tsx`) -- an endpoint that needs a real `GuestSession` the
   * preview has no way to mint. So the preview instead reads the location's
   * campaigns through this authenticated admin client and picks the first
   * ACTIVE one, loading its questions (survey) or assets (banner). It
   * deliberately does NOT reimplement the backend's full eligibility rules
   * (display-rule cadence, target-network match, per-guest impression
   * history); it is a faithful *content* preview, not a per-guest simulator.
   *
   * `orgId` is passed explicitly (not the caller's own via
   * `resolveOrganizationId`) because a Master operator previews locations in
   * organizations they do not belong to. Returns `null` when nothing is
   * active (the preview then shows the plain sign-in card).
   */
  async resolveActivePreviewCampaign(
    orgId: string,
    locationId: string,
  ): Promise<NextCampaign | null> {
    const headers = { "X-Organization-Id": orgId };
    const { data } = await api.get<BackendCampaignListResponse>("/campaigns", {
      params: { location_id: locationId, page: 1, page_size: 100 },
      headers,
    });
    const active = data.items.find((c) => c.status === "active");
    if (!active) return null;

    const base = {
      campaignId: active.id,
      campaignType: active.campaign_type as CampaignType,
      isSkippable: active.is_skippable,
    };

    if (active.campaign_type === "survey") {
      const { data: questions } = await api.get<BackendCampaignQuestion[]>(
        `/campaigns/${active.id}/questions`,
        { headers },
      );
      return {
        ...base,
        questions: questions.map((q) => ({
          id: q.id,
          orderIndex: q.order_index,
          questionText: q.question_text,
          answerType: q.answer_type as QuestionAnswerType,
          options: q.options,
          isRequired: q.is_required,
        })),
        asset: null,
      };
    }

    const { data: assets } = await api.get<BackendCampaignAsset[]>(
      `/campaigns/${active.id}/assets`,
      { headers },
    );
    const a = assets[0] ?? null;
    return {
      ...base,
      questions: [],
      asset: a
        ? {
            imageUrl: a.image_url,
            clickUrl: a.click_url,
            altText: a.alt_text,
            headline: a.headline,
            subtext: a.subtext,
            couponCode: a.coupon_code,
            couponExpiresAt: a.coupon_expires_at,
          }
        : null,
    };
  },
};

// Mirrors the backend's own CAMPAIGN_STATUS_TRANSITIONS
// (app/domains/campaigns/constants.py) -- the *only* legal next statuses
// from a given current status. A campaign's status control (the Play/Pause
// icon and the status <Select>) must never offer a transition outside this
// set: the backend 409s (InvalidCampaignStatusTransitionError) on anything
// else, which previously showed up as "I clicked Play/picked a status and
// nothing happened" -- the optimistic UI flipped, the request 409'd, and it
// silently reverted.
export const CAMPAIGN_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "ended"],
  scheduled: ["active", "draft", "ended"],
  active: ["paused", "ended"],
  paused: ["active", "ended"],
  ended: [],
};
