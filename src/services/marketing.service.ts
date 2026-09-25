import { api, requestErrorOf, type AppError } from "@/services/api";
import type {
  AddonWriteResult,
  AudienceFilter,
  AudiencePreview,
  CampaignCreatePayload,
  CampaignListQuery,
  CampaignPatchPayload,
  CampaignRecipient,
  ContactListQuery,
  DeliveryListQuery,
  DeliveryLogEntry,
  MarketingCampaign,
  MarketingChannel,
  MarketingContact,
  MarketingStatus,
  MarketingTemplate,
  OptOutResult,
  OrganizationAddons,
  Page,
  PortalConsentResult,
  PortalConsentUpdate,
  RecipientListQuery,
  TemplateListQuery,
  TemplatePatchPayload,
  TemplatePreview,
  TemplatePreviewRequest,
  TemplateWritePayload,
  TestSendResult,
} from "@/types/marketing";

/**
 * Guest Marketing add-on -- the typed client for
 * wyfy-specs/guest-marketing-campaigns.md §5 (customer routes) and §5.9
 * (Master add-on control). One function per endpoint, no fallbacks: a
 * failed request rejects with the `AppError` the api interceptor built, and
 * the screen shows it. There is no demo/fixture branch in here on purpose --
 * demo sessions never reach this module (the hooks are `enabled: !demo`).
 *
 * TENANCY
 * -------
 * `X-Organization-Id` is attached by the api interceptor for every customer
 * session (see `attachOrganizationScope`). `X-Location-Id` is set here, per
 * call, to the venue the customer dashboard is showing: the whole customer
 * shell is scoped to one active venue ("Marketing · Mumbai HQ"), and the
 * contract's LocScope rules (§5.0) make that header the thing that lets a
 * location-scoped staff member in at all, and makes every list and count on
 * these screens that venue's -- the same venue the page heading names.
 *
 * `organization_id` is never sent in a body or query (§5.0 rule 4).
 */

/** Headers for a venue-scoped marketing call. */
function scoped(locationId: string | null | undefined): Record<string, string> | undefined {
  return locationId ? { "X-Location-Id": locationId } : undefined;
}

/** Comma-joined list params per §5.5/§5.6 (`status?` is a comma list). */
function csv(values: readonly string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(",") : undefined;
}

/** Drops undefined/empty-string keys so axios doesn't send `?search=`. */
function params(q: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
}

// ── Error codes ─────────────────────────────────────────────────────────

/**
 * The contract's machine-readable error code (`data.error_code`, §5.0). The
 * FE switches on this, never on `message`. Falls back to the interceptor's
 * own normalised code (`validation_error`, `forbidden`, `network_error`...)
 * when the backend did not send one.
 */
export function marketingErrorCode(err: unknown): string | null {
  const e = requestErrorOf(err);
  if (!e) return null;
  const code = e.data?.error_code;
  if (typeof code === "string" && code) return code;
  if (e.status === 402) return "feature_not_entitled";
  return e.code;
}

export function marketingErrorData(err: unknown): Record<string, unknown> | undefined {
  return requestErrorOf(err)?.data;
}

export function marketingError(err: unknown): AppError | null {
  return requestErrorOf(err);
}

/** 402 from any marketing route: the add-on is locked for this org
 * (`feature_not_entitled`) or the whole license has lapsed
 * (`license_not_active`). */
export function isEntitlementError(err: unknown): boolean {
  const e = requestErrorOf(err);
  if (!e) return false;
  const code = marketingErrorCode(err);
  return e.status === 402 || code === "feature_not_entitled" || code === "license_not_active";
}

// ── Service ─────────────────────────────────────────────────────────────

export const marketingService = {
  // §5.1
  async getStatus(locationId?: string | null): Promise<MarketingStatus> {
    const { data } = await api.get<MarketingStatus>("/marketing/status", {
      headers: scoped(locationId),
    });
    return data;
  },

  async setPortalConsent(
    body: PortalConsentUpdate,
    locationId?: string | null,
  ): Promise<PortalConsentResult> {
    const { data } = await api.put<PortalConsentResult>("/marketing/portal-consent", body, {
      headers: scoped(locationId),
    });
    return data;
  },

  // §5.2
  async listContacts(q: ContactListQuery, locationId?: string | null) {
    const { data } = await api.get<Page<MarketingContact>>("/marketing/contacts", {
      params: params(q),
      headers: scoped(locationId),
    });
    return data;
  },

  async optOutContact(
    guestId: string,
    body: { channels: MarketingChannel[]; note?: string | null },
    locationId?: string | null,
  ): Promise<OptOutResult> {
    const { data } = await api.post<OptOutResult>(
      `/marketing/contacts/${encodeURIComponent(guestId)}/opt-out`,
      body,
      { headers: scoped(locationId) },
    );
    return data;
  },

  // §5.3
  async previewAudience(
    filter: AudienceFilter,
    locationId?: string | null,
    signal?: AbortSignal,
  ): Promise<AudiencePreview> {
    const { data } = await api.post<AudiencePreview>("/marketing/audience/preview", filter, {
      headers: scoped(locationId),
      signal,
    });
    return data;
  },

  // §5.4
  async listTemplates(q: TemplateListQuery, locationId?: string | null) {
    const { data } = await api.get<Page<MarketingTemplate>>("/marketing/templates", {
      params: params(q),
      headers: scoped(locationId),
    });
    return data;
  },

  async getTemplate(id: string, locationId?: string | null): Promise<MarketingTemplate> {
    const { data } = await api.get<MarketingTemplate>(
      `/marketing/templates/${encodeURIComponent(id)}`,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async createTemplate(
    body: TemplateWritePayload,
    locationId?: string | null,
  ): Promise<MarketingTemplate> {
    const { data } = await api.post<MarketingTemplate>("/marketing/templates", body, {
      headers: scoped(locationId),
    });
    return data;
  },

  async updateTemplate(
    id: string,
    body: TemplatePatchPayload,
    locationId?: string | null,
  ): Promise<MarketingTemplate> {
    const { data } = await api.patch<MarketingTemplate>(
      `/marketing/templates/${encodeURIComponent(id)}`,
      body,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async deleteTemplate(id: string, locationId?: string | null) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(
      `/marketing/templates/${encodeURIComponent(id)}`,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async duplicateTemplate(
    id: string,
    name: string,
    locationId?: string | null,
  ): Promise<MarketingTemplate> {
    const { data } = await api.post<MarketingTemplate>(
      `/marketing/templates/${encodeURIComponent(id)}/duplicate`,
      { name },
      { headers: scoped(locationId) },
    );
    return data;
  },

  async previewTemplate(
    body: TemplatePreviewRequest,
    locationId?: string | null,
    signal?: AbortSignal,
  ): Promise<TemplatePreview> {
    const { data } = await api.post<TemplatePreview>("/marketing/templates/preview", body, {
      headers: scoped(locationId),
      signal,
    });
    return data;
  },

  // §5.5
  async listCampaigns(q: CampaignListQuery, locationId?: string | null) {
    const { status, ...rest } = q;
    const { data } = await api.get<Page<MarketingCampaign>>("/marketing/campaigns", {
      params: params({ ...rest, status: csv(status) }),
      headers: scoped(locationId),
    });
    return data;
  },

  async getCampaign(id: string, locationId?: string | null): Promise<MarketingCampaign> {
    const { data } = await api.get<MarketingCampaign>(
      `/marketing/campaigns/${encodeURIComponent(id)}`,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async createCampaign(
    body: CampaignCreatePayload,
    locationId?: string | null,
  ): Promise<MarketingCampaign> {
    const { data } = await api.post<MarketingCampaign>("/marketing/campaigns", body, {
      headers: scoped(locationId),
    });
    return data;
  },

  async updateCampaign(
    id: string,
    body: CampaignPatchPayload,
    locationId?: string | null,
  ): Promise<MarketingCampaign> {
    const { data } = await api.patch<MarketingCampaign>(
      `/marketing/campaigns/${encodeURIComponent(id)}`,
      body,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async deleteCampaign(id: string, locationId?: string | null) {
    const { data } = await api.delete<{ id: string; deleted: boolean }>(
      `/marketing/campaigns/${encodeURIComponent(id)}`,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async testSend(
    id: string,
    body: { to: string[]; sample_guest_name?: string | null },
    locationId?: string | null,
  ): Promise<TestSendResult> {
    const { data } = await api.post<TestSendResult>(
      `/marketing/campaigns/${encodeURIComponent(id)}/test-send`,
      body,
      { headers: scoped(locationId) },
    );
    return data;
  },

  /** `scheduledAt: null` = send now. `idempotencyKey` is required by the
   * contract: the same key within 24h returns the same result rather than
   * scheduling twice, so a double click or a retried request is safe. */
  async scheduleCampaign(
    id: string,
    body: { scheduled_at: string | null; idempotency_key: string },
    locationId?: string | null,
  ): Promise<MarketingCampaign> {
    const { data } = await api.post<MarketingCampaign>(
      `/marketing/campaigns/${encodeURIComponent(id)}/schedule`,
      body,
      { headers: scoped(locationId) },
    );
    return data;
  },

  async unscheduleCampaign(id: string, locationId?: string | null): Promise<MarketingCampaign> {
    const { data } = await api.post<MarketingCampaign>(
      `/marketing/campaigns/${encodeURIComponent(id)}/unschedule`,
      {},
      { headers: scoped(locationId) },
    );
    return data;
  },

  async cancelCampaign(id: string, locationId?: string | null): Promise<MarketingCampaign> {
    const { data } = await api.post<MarketingCampaign>(
      `/marketing/campaigns/${encodeURIComponent(id)}/cancel`,
      {},
      { headers: scoped(locationId) },
    );
    return data;
  },

  // §5.6
  async listRecipients(campaignId: string, q: RecipientListQuery, locationId?: string | null) {
    const { status, ...rest } = q;
    const { data } = await api.get<Page<CampaignRecipient>>(
      `/marketing/campaigns/${encodeURIComponent(campaignId)}/recipients`,
      { params: params({ ...rest, status: csv(status) }), headers: scoped(locationId) },
    );
    return data;
  },

  async listDeliveries(q: DeliveryListQuery, locationId?: string | null) {
    const { status, ...rest } = q;
    const { data } = await api.get<Page<DeliveryLogEntry>>("/marketing/deliveries", {
      params: params({ ...rest, status: csv(status) }),
      headers: scoped(locationId),
    });
    return data;
  },
};

/**
 * §5.9 -- Master console. Platform routes: no organization header (the
 * organization is the path parameter, and the backend pins these to GLOBAL
 * scope). The master console's interceptor sends `X-Organization-Scope: all`
 * for a GLOBAL caller, which is what a platform route expects.
 */
export const marketingPlatformService = {
  async getAddons(organizationId: string): Promise<OrganizationAddons> {
    const { data } = await api.get<OrganizationAddons>(
      `/platform/organizations/${encodeURIComponent(organizationId)}/addons`,
    );
    return data;
  },

  async setAddon(
    organizationId: string,
    addonKey: string,
    body: { enabled: boolean; reason?: string | null },
  ): Promise<AddonWriteResult> {
    const { data } = await api.put<AddonWriteResult>(
      `/platform/organizations/${encodeURIComponent(organizationId)}/addons/${encodeURIComponent(addonKey)}`,
      body,
    );
    return data;
  },

  async clearAddonOverride(organizationId: string, addonKey: string): Promise<AddonWriteResult> {
    const { data } = await api.delete<AddonWriteResult>(
      `/platform/organizations/${encodeURIComponent(organizationId)}/addons/${encodeURIComponent(addonKey)}`,
    );
    return data;
  },
};
