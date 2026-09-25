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
  RecipientListQuery,
  TemplateListQuery,
  TemplatePatchPayload,
  TemplatePreviewRequest,
  TemplateWritePayload,
} from "@/types/marketing";

/**
 * TanStack Query hooks for the Marketing add-on. Every query:
 *
 *  - is `enabled: !demo` -- the demo workspace has no backend session and
 *    this screen has no fixtures (the page renders an honest "not available
 *    in the demo" panel instead; see MarketingPage);
 *  - is keyed on the organization and on the `X-Location-Id` it sends (the
 *    venue for a location-scoped caller, nothing for an org-scoped one --
 *    see lib/marketing-scope.ts), so a switch of venue or of scope can never
 *    paint the previous answer;
 *  - does NOT retry a 402. A locked add-on is an answer, not a blip, and
 *    retrying it only delays the upsell screen.
 */

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
  addons: (orgId: string) => ["platform", "addons", orgId] as const,
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
  const org = resolveActiveOrganizationId();
  const venues = (q.data ?? [])
    .filter((l) => !org || l.organizationId === org)
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
  const loc = useMarketingLocationId();
  const org = resolveActiveOrganizationId();
  return { demo, loc, scope: { org, loc } as Scope };
}

// ── Queries ─────────────────────────────────────────────────────────────

export function useMarketingStatus() {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.status(scope),
    queryFn: () => marketingService.getStatus(loc),
    enabled: !demo,
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
  const { demo, scope } = useScope();
  return useQuery({
    queryKey: ["marketing", scope.org, `venue:${venueId ?? "org-default"}`, "status"] as const,
    queryFn: () => marketingService.getStatus(venueId),
    enabled: !demo && enabled,
    staleTime: 60_000,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingContacts(q: ContactListQuery) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.contacts(scope, q),
    queryFn: () => marketingService.listContacts(q, loc),
    enabled: !demo,
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
  const { demo, loc, scope } = useScope();
  const debounced = useDebounced(filter, 400);
  return useQuery({
    queryKey: marketingKeys.audience(scope, debounced),
    queryFn: ({ signal }) => marketingService.previewAudience(debounced!, loc, signal),
    enabled: !demo && !!debounced,
    // Counts are exact server-side COUNTs of consent state that changes as
    // guests opt in and out; a short stale window keeps the number honest.
    staleTime: 10_000,
    placeholderData: keepPreviousData,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingTemplates(q: TemplateListQuery) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.templates(scope, q),
    queryFn: () => marketingService.listTemplates(q, loc),
    enabled: !demo,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingTemplate(id: string | null) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.template(scope, id ?? ""),
    queryFn: () => marketingService.getTemplate(id!, loc),
    enabled: !demo && !!id,
    retry: retryUnlessEntitlement,
  });
}

/** Server-side render of a template with sample values. Debounced, since the
 * editor calls it as the owner types. */
export function useTemplatePreview(body: TemplatePreviewRequest | null) {
  const { demo, loc, scope } = useScope();
  const debounced = useDebounced(body, 400);
  return useQuery({
    queryKey: marketingKeys.templatePreview(scope, debounced),
    queryFn: ({ signal }) => marketingService.previewTemplate(debounced!, loc, signal),
    enabled: !demo && !!debounced,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useMarketingCampaigns(q: CampaignListQuery) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.campaigns(scope, q),
    queryFn: () => marketingService.listCampaigns(q, loc),
    enabled: !demo,
    placeholderData: keepPreviousData,
    // A campaign in `sending` moves on its own; keep the list's counters
    // moving with it while anything is in flight.
    refetchInterval: (query) =>
      query.state.data?.items.some((c) => c.status === "sending") ? 15_000 : false,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingCampaign(id: string | null) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.campaign(scope, id ?? ""),
    queryFn: () => marketingService.getCampaign(id!, loc),
    enabled: !demo && !!id,
    refetchInterval: (query) => (query.state.data?.status === "sending" ? 10_000 : false),
    retry: retryUnlessEntitlement,
  });
}

export function useCampaignRecipients(id: string | null, q: RecipientListQuery, live = false) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.recipients(scope, id ?? "", q),
    queryFn: () => marketingService.listRecipients(id!, q, loc),
    enabled: !demo && !!id,
    placeholderData: keepPreviousData,
    refetchInterval: live ? 10_000 : false,
    retry: retryUnlessEntitlement,
  });
}

export function useMarketingDeliveries(q: DeliveryListQuery) {
  const { demo, loc, scope } = useScope();
  return useQuery({
    queryKey: marketingKeys.deliveries(scope, q),
    queryFn: () => marketingService.listDeliveries(q, loc),
    enabled: !demo,
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
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: PortalConsentUpdate) => marketingService.setPortalConsent(body, loc),
    onSuccess: () => invalidate("status"),
  });
}

export function useOptOutContact() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { guestId: string; channels: MarketingChannel[]; note?: string | null }) =>
      marketingService.optOutContact(
        v.guestId,
        { channels: v.channels, note: v.note ?? null },
        loc,
      ),
    onSuccess: () => invalidate("contacts", "status", "audience"),
  });
}

export function useCreateTemplate() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: TemplateWritePayload) => marketingService.createTemplate(body, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useUpdateTemplate() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; body: TemplatePatchPayload }) =>
      marketingService.updateTemplate(v.id, v.body, loc),
    onSuccess: () => invalidate("templates", "template"),
  });
}

export function useDeleteTemplate() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => marketingService.deleteTemplate(id, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useDuplicateTemplate() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      marketingService.duplicateTemplate(v.id, v.name, loc),
    onSuccess: () => invalidate("templates"),
  });
}

export function useCreateCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: CampaignCreatePayload) => marketingService.createCampaign(body, loc),
    onSuccess: () => invalidate("campaigns"),
  });
}

export function useUpdateCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; body: CampaignPatchPayload }) =>
      marketingService.updateCampaign(v.id, v.body, loc),
    onSuccess: () => invalidate("campaigns", "campaign"),
  });
}

export function useDeleteCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => marketingService.deleteCampaign(id, loc),
    onSuccess: () => invalidate("campaigns"),
  });
}

export function useTestSend() {
  const { loc } = useScope();
  return useMutation({
    mutationFn: (v: { id: string; to: string[]; sampleGuestName?: string | null }) =>
      marketingService.testSend(
        v.id,
        { to: v.to, sample_guest_name: v.sampleGuestName ?? null },
        loc,
      ),
  });
}

export function useScheduleCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; scheduledAt: string | null; idempotencyKey: string }) =>
      marketingService.scheduleCampaign(
        v.id,
        { scheduled_at: v.scheduledAt, idempotency_key: v.idempotencyKey },
        loc,
      ),
    onSuccess: () => invalidate("campaigns", "campaign", "recipients", "deliveries"),
  });
}

export function useUnscheduleCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => marketingService.unscheduleCampaign(id, loc),
    onSuccess: () => invalidate("campaigns", "campaign"),
  });
}

export function useCancelCampaign() {
  const { loc } = useScope();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => marketingService.cancelCampaign(id, loc),
    onSuccess: () => invalidate("campaigns", "campaign", "recipients", "deliveries"),
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
      void qc.invalidateQueries({ queryKey: customerKeys.entitlementsAll });
    },
  });
}
