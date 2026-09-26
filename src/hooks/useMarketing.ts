import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useIsDemo } from "@/hooks/useCustomerDashboard";
import { customerKeys } from "@/hooks/useCustomerDashboard";
import { useCustomerStore } from "@/stores/customerStore";
import { resolveActiveOrganizationId } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useCustomerLocations } from "@/hooks/useCustomerDashboard";
import {
  marketingLocationHeader,
  resolveMarketingScope,
  type MarketingScope,
} from "@/lib/marketing-scope";
import {
  isEntitlementError,
  marketingPlatformService,
  marketingService,
} from "@/services/marketing.service";
import type {
  AudienceFilter,
  CampaignCreatePayload,
  CampaignListQuery,
  CampaignPatchPayload,
  ContactListQuery,
  DeliveryListQuery,
  MarketingChannel,
  PortalConsentUpdate,
  ProviderPutPayload,
  ProviderVerifyPayload,
  RecipientListQuery,
  TemplateListQuery,
  TemplatePatchPayload,
  TemplatePreviewRequest,
  TemplateWritePayload,
} from "@/types/marketing";

/**
 * TanStack Query hooks for the Marketing add-on. Every query:
 *
 *  - goes through `useMarketingApi()`: the real client for every real
 *    session, and the in-memory demo backend (no network at all) for the
 *    demo workspace, whose key space is kept separate (`demo:` venue key);
 *  - is keyed on the organization and on the `X-Location-Id` it sends (the
 *    venue for a location-scoped caller, nothing for an org-scoped one --
 *    see lib/marketing-scope.ts), so a switch of venue or of scope can never
 *    paint the previous answer;
 *  - does NOT retry a 402. A locked add-on is an answer, not a blip, and
 *    retrying it only delays the upsell screen.
 */

import type { DemoMarketingBackend } from "@/components/marketing/demo/demo-backend";

/** The Marketing API as the screens see it. */
export type MarketingApi = typeof marketingService;

/**
 * DEMO ONLY: the in-memory demo backend, fetched as its own chunk the first
 * time a demo session calls it. This is the ONLY import of the demo module
 * anywhere, and it is reachable only through `useMarketingApi()` below when
 * `useIsDemo()` is true -- a real account never downloads the fixtures and
 * never runs them. Enforced by scripts/test-marketing-ui.mjs.
 */
let demoApiPromise: Promise<MarketingApi> | null = null;
function loadDemoMarketingApi(): Promise<MarketingApi> {
  demoApiPromise ??= import("@/components/marketing/demo/demo-backend").then(
    (m) => m.demoMarketingBackend as unknown as MarketingApi,
  );
  return demoApiPromise;
}
// Compile-time: the demo backend implements every method of the real client.
type _DemoCoversApi = {
  [K in keyof MarketingApi]: K extends keyof DemoMarketingBackend ? true : never;
};
const _demoCoversApi: _DemoCoversApi = {} as { [K in keyof MarketingApi]: true };
void _demoCoversApi;
const demoMarketingApi = new Proxy({} as MarketingApi, {
  get:
    (_target, method: string) =>
    async (...args: unknown[]) => {
      const api = (await loadDemoMarketingApi()) as unknown as Record<
        string,
        (...a: unknown[]) => Promise<unknown>
      >;
      return api[method](...args);
    },
});

/**
 * Which Marketing API this session talks to: the real client, or -- for the
 * demo workspace only (src/lib/demo-host.ts) -- the in-memory demo backend,
 * which makes no network request at all.
 */
export function useMarketingApi(): MarketingApi {
  return useIsDemo() ? demoMarketingApi : marketingService;
}

const retryUnlessEntitlement = (failureCount: number, err: unknown) =>
  !isEntitlementError(err) && failureCount < 1;

type Scope = { org: string | null; loc: string | null };

/** `["marketing", orgId, locationId, kind, ...]` (spec §8.1). The org is in
 * the key as well as the venue so that a session that switches organization
 * can never be served the previous tenant's cached rows. */
export const marketingKeys = {
  all: ["marketing"] as const,
  status: (s: Scope) => ["marketing", s.org, s.loc, "status"] as const,
  contacts: (s: Scope, q: ContactListQuery) => ["marketing", s.org, s.loc, "contacts", q] as const,
  audience: (s: Scope, f: AudienceFilter | null) =>
    ["marketing", s.org, s.loc, "audience", f] as const,
  templates: (s: Scope, q: TemplateListQuery) =>
    ["marketing", s.org, s.loc, "templates", q] as const,
  template: (s: Scope, id: string) => ["marketing", s.org, s.loc, "template", id] as const,
  templatePreview: (s: Scope, body: TemplatePreviewRequest | null) =>
    ["marketing", s.org, s.loc, "template-preview", body] as const,
  campaigns: (s: Scope, q: CampaignListQuery) =>
    ["marketing", s.org, s.loc, "campaigns", q] as const,
  campaign: (s: Scope, id: string) => ["marketing", s.org, s.loc, "campaign", id] as const,
  recipients: (s: Scope, id: string, q: RecipientListQuery) =>
    ["marketing", s.org, s.loc, "recipients", id, q] as const,
  deliveries: (s: Scope, q: DeliveryListQuery) =>
    ["marketing", s.org, s.loc, "deliveries", q] as const,
  providers: (s: Scope) => ["marketing", s.org, s.loc, "providers"] as const,
  addons: (orgId: string) => ["platform", "addons", orgId] as const,
  platformProviders: (orgId: string) => ["platform", "marketing-providers", orgId] as const,
};

/**
 * Org-scoped or location-scoped, from the caller's real role assignments
 * (the backend's own sign-in answer), never from the login-role radio. See
 * lib/marketing-scope.ts.
 */
export function useMarketingScope(): MarketingScope {
  const { roles } = useAuth();
  const activeLocationId = useCustomerStore((s) => s.activeLocationId) ?? null;
  return resolveMarketingScope(roles, resolveActiveOrganizationId(), activeLocationId);
}

/** The `X-Location-Id` every marketing call carries: the caller's venue when
 * location-scoped, `null` (no header) when org-scoped. */
export function useMarketingLocationId(): string | null {
  return marketingLocationHeader(useMarketingScope());
}

/** The organization's venues, for the org-scoped venue picker, filters and
 * the campaigns list's Venue column. Only venues of the active organization. */
export function useOrgVenues() {
  const q = useCustomerLocations();
  const demo = useIsDemo();
  const org = resolveActiveOrganizationId();
  // The demo workspace's fixture venues carry their own org id, which is not
  // the demo session's; in demo every listed venue is the org's.
  const venues = (q.data ?? [])
    .filter((l) => demo || !org || l.organizationId === org)
    .map((l) => ({ id: l.id, name: l.name }));
  return { ...q, venues };
}

/** Venue name lookup for list columns: `null` location = all venues. */
export function useVenueLabel() {
  const { venues } = useOrgVenues();
  const byId = new Map(venues.map((v) => [v.id, v.name]));
  return (locationId: string | null, locationIds?: string[] | null): string => {
    if (locationId) return byId.get(locationId) ?? "One venue";
    if (locationIds && locationIds.length > 0) {
      const names = locationIds.map((id) => byId.get(id)).filter(Boolean) as string[];
      if (names.length === locationIds.length && names.length <= 2) return names.join(", ");
      return `${locationIds.length} venues`;
    }
    return "All venues";
  };
}

function useScope() {
  const demo = useIsDemo();
  const api = useMarketingApi();
  const loc = useMarketingLocationId();
  const org = resolveActiveOrganizationId();
  return { demo, api, loc, scope: { org, loc: demo ? `demo:${loc}` : loc } as Scope };
}

// ── Queries ─────────────────────────────────────────────────────────────

export function useMarketingStatus() {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.status(scope),
    queryFn: () => api.getStatus(loc),
    staleTime: 60_000,
    retry: retryUnlessEntitlement,
  });
}

/**
 * `/marketing/status` for ONE venue, for the portal opt-in card of an
 * org-scoped caller (§5.1: `portal_consent` is "for the location in
 * X-Location-Id, else the org's default portal config"). `venueId` null =
 * the organization default, read with no header. This is the one read that
 * names a venue for an org-scoped caller, and only because the contract has
 * no other way to ask for one venue's opt-in setting.
 */
export function useVenueMarketingStatus(venueId: string | null, enabled = true) {
  const { api, scope } = useScope();
  return useQuery({
    queryKey: ["marketing", scope.org, `venue:${venueId ?? "org-default"}`, "status"] as const,
    queryFn: () => api.getStatus(venueId),
    enabled,
    staleTime: 60_000,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingContacts(q: ContactListQuery) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.contacts(scope, q),
    queryFn: () => api.listContacts(q, loc),
    placeholderData: keepPreviousData,
    retry: retryUnlessEntitlement,
  });
}

/** Debounces a value; the audience count is re-asked 400 ms after the last
 * filter change (spec §5.3), not on every keystroke. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  // Keyed on the VALUE, not the reference: callers pass freshly built
  // filter objects on every render, and a reference dependency re-armed the
  // timer each render and re-rendered every 400 ms forever.
  const key = JSON.stringify(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  return v;
}

export function useAudiencePreview(filter: AudienceFilter | null) {
  const { api, loc, scope } = useScope();
  const debounced = useDebounced(filter, 400);
  return useQuery({
    queryKey: marketingKeys.audience(scope, debounced),
    queryFn: ({ signal }) => api.previewAudience(debounced!, loc, signal),
    enabled: !!debounced,
    // Counts are exact server-side COUNTs of consent state that changes as
    // guests opt in and out; a short stale window keeps the number honest.
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingTemplates(q: TemplateListQuery) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.templates(scope, q),
    queryFn: () => api.listTemplates(q, loc),
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingTemplate(id: string | null) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.template(scope, id ?? ""),
    queryFn: () => api.getTemplate(id!, loc),
    enabled: !!id,
    retry: retryUnlessEntitlement,
  });
}

/** Server-side render of a template with sample values. Debounced, since the
 * editor calls it as the owner types. */
export function useTemplatePreview(body: TemplatePreviewRequest | null) {
  const { api, loc, scope } = useScope();
  const debounced = useDebounced(body, 400);
  return useQuery({
    queryKey: marketingKeys.templatePreview(scope, debounced),
    queryFn: ({ signal }) => api.previewTemplate(debounced!, loc, signal),
    enabled: !!debounced,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useMarketingCampaigns(q: CampaignListQuery) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.campaigns(scope, q),
    queryFn: () => api.listCampaigns(q, loc),
    placeholderData: keepPreviousData,
    // A campaign in `sending` moves on its own; keep the list's counters
    // moving with it while anything is in flight.
    refetchInterval: (query) =>
      query.state.data?.items.some((c) => c.status === "sending") ? 15_000 : false,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingCampaign(id: string | null) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.campaign(scope, id ?? ""),
    queryFn: () => api.getCampaign(id!, loc),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "sending" ? 10_000 : false),
    retry: retryUnlessEntitlement,
  });
}

export function useCampaignRecipients(id: string | null, q: RecipientListQuery, live = false) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.recipients(scope, id ?? "", q),
    queryFn: () => api.listRecipients(id!, q, loc),
    enabled: !!id,
    placeholderData: keepPreviousData,
    refetchInterval: live ? 10_000 : false,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingDeliveries(q: DeliveryListQuery) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.deliveries(scope, q),
    queryFn: () => api.listDeliveries(q, loc),
    placeholderData: keepPreviousData,
    retry: retryUnlessEntitlement,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────
//
// None of these toast on their own. The calling screen owns the message,
// because only it knows what the server's answer means there -- and a hook
// that toasted "Saved" on success would be one refactor away from toasting
// it without a request (this codebase has shipped that twice).

function useInvalidate() {
  const qc = useQueryClient();
  return (...parts: string[]) =>
    Promise.all(
      parts.map((p) =>
        qc.invalidateQueries({
          predicate: (q) => q.queryKey[0] === "marketing" && q.queryKey[3] === p,
        }),
      ),
    );
}

export function useSetPortalConsent() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: PortalConsentUpdate) => api.setPortalConsent(body, loc),
    onSuccess: () => invalidate("status"),
  });
}

export function useOptOutContact() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { guestId: string; channels: MarketingChannel[]; note?: string | null }) =>
      api.optOutContact(v.guestId, { channels: v.channels, note: v.note ?? null }, loc),
    onSuccess: () => invalidate("contacts", "status", "audience"),
  });
}

export function useCreateTemplate() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TemplateWritePayload) => api.createTemplate(body, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useUpdateTemplate() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; body: TemplatePatchPayload }) =>
      api.updateTemplate(v.id, v.body, loc),
    onSuccess: () => invalidate("templates", "template"),
  });
}

export function useDeleteTemplate() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useDuplicateTemplate() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) => api.duplicateTemplate(v.id, v.name, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useCreateCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CampaignCreatePayload) => api.createCampaign(body, loc),
    onSuccess: () => invalidate("campaigns"),
  });
}

export function useUpdateCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; body: CampaignPatchPayload }) =>
      api.updateCampaign(v.id, v.body, loc),
    onSuccess: () => invalidate("campaigns", "campaign"),
  });
}

export function useDeleteCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.deleteCampaign(id, loc),
    onSuccess: () => invalidate("campaigns"),
  });
}

export function useTestSend() {
  const { api, loc } = useScope();
  return useMutation({
    mutationFn: (v: { id: string; to: string[]; sampleGuestName?: string | null }) =>
      api.testSend(v.id, { to: v.to, sample_guest_name: v.sampleGuestName ?? null }, loc),
  });
}

export function useScheduleCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: {
      id: string;
      scheduledAt: string | null;
      idempotencyKey: string;
      acknowledgeWyfyFallback?: boolean;
    }) =>
      api.scheduleCampaign(
        v.id,
        {
          scheduled_at: v.scheduledAt,
          idempotency_key: v.idempotencyKey,
          // Sent only when the owner ticked it (§12.1, Q11 option A); the
          // key is otherwise absent, exactly as before BYO existed.
          ...(v.acknowledgeWyfyFallback ? { acknowledge_wyfy_fallback: true } : {}),
        },
        loc,
      ),
    onSuccess: () => invalidate("campaigns", "campaign", "recipients", "deliveries"),
  });
}

export function useUnscheduleCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.unscheduleCampaign(id, loc),
    onSuccess: () => invalidate("campaigns", "campaign"),
  });
}

export function useCancelCampaign() {
  const { api, loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.cancelCampaign(id, loc),
    onSuccess: () => invalidate("campaigns", "campaign", "recipients", "deliveries"),
  });
}

// ── Support-ticket requests (upsells, top-ups) ─────────────────────────

/**
 * An open support request with this exact subject, and the action that
 * files one. "Request sent" is shown only after the ticket came back from
 * the server; an open request is shown as pending, never filed twice.
 */
export function useSupportRequest(subject: string) {
  const { api, loc, scope } = useScope();
  const qc = useQueryClient();
  const key = ["marketing", scope.org, scope.loc, "support-request", subject] as const;
  const existing = useQuery({
    queryKey: key,
    queryFn: () => api.findOpenSupportRequest(subject),
    staleTime: 60_000,
    retry: false,
  });
  const request = useMutation({
    mutationFn: (description: string) => api.requestSupport(subject, description, loc),
    onSuccess: (ticket) => qc.setQueryData(key, ticket),
  });
  return { existing, request };
}

// ── §12 Channel providers (bring-your-own) ─────────────────────────────

/** GET /marketing/providers. A 402 (BYO locked) or 403 (no
 * marketing_providers.read, or a location-confined caller) is an answer the
 * Channels tab renders, so neither is retried. */
export function useMarketingProviders(enabled = true) {
  const { api, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.providers(scope),
    queryFn: () => api.listProviders(loc),
    enabled,
    retry: false,
  });
}

/** Provider writes change what /marketing/status reports (provider_source,
 * own_provider_status) and which templates are sendable, so all three are
 * re-read after every write -- nothing is updated optimistically. */
function useProviderInvalidate() {
  const invalidate = useInvalidate();
  return () => invalidate("providers", "status", "templates");
}

export function useSaveProvider() {
  const { api, loc } = useScope();
  const after = useProviderInvalidate();
  return useMutation({
    mutationFn: (v: { channel: MarketingChannel; body: ProviderPutPayload }) =>
      api.putProvider(v.channel, v.body, loc),
    onSettled: () => after(),
  });
}

export function useDeleteProvider() {
  const { api, loc } = useScope();
  const after = useProviderInvalidate();
  return useMutation({
    mutationFn: (channel: MarketingChannel) => api.deleteProvider(channel, loc),
    onSettled: () => after(),
  });
}

export function useVerifyProvider() {
  const { api, loc } = useScope();
  const after = useProviderInvalidate();
  return useMutation({
    mutationFn: (v: { channel: MarketingChannel; body: ProviderVerifyPayload }) =>
      api.verifyProvider(v.channel, v.body, loc),
    onSettled: () => after(),
  });
}

/** Master: a customer's providers, read-only (§12.4). */
export function useOrgMarketingProviders(organizationId: string | null) {
  return useQuery({
    queryKey: marketingKeys.platformProviders(organizationId ?? ""),
    queryFn: () => marketingPlatformService.getMarketingProviders(organizationId!),
    enabled: !!organizationId,
    retry: 1,
  });
}

// ── Master (§5.9) ───────────────────────────────────────────────────────

export function useOrganizationAddons(organizationId: string | null) {
  return useQuery({
    queryKey: marketingKeys.addons(organizationId ?? ""),
    queryFn: () => marketingPlatformService.getAddons(organizationId!),
    enabled: !!organizationId,
    staleTime: 0,
    retry: 1,
  });
}

export function useSetOrganizationAddon(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { key: string; enabled: boolean; reason?: string | null }) =>
      marketingPlatformService.setAddon(organizationId, v.key, {
        enabled: v.enabled,
        reason: v.reason ?? null,
      }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.addons(organizationId) });
      void qc.invalidateQueries({ queryKey: marketingKeys.platformProviders(organizationId) });
      void qc.invalidateQueries({ queryKey: customerKeys.entitlementsAll });
    },
  });
}

export function useClearOrganizationAddon(organizationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => marketingPlatformService.clearAddonOverride(organizationId, key),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: marketingKeys.addons(organizationId) });
      void qc.invalidateQueries({ queryKey: marketingKeys.platformProviders(organizationId) });
      void qc.invalidateQueries({ queryKey: customerKeys.entitlementsAll });
    },
  });
}
