import { api } from "@/services/api";
import type {
  CreateOrgPayload,
  OrgListQuery,
  OrgListResult,
  OrgStatus,
  Organization,
} from "@/types/organization";

interface BackendOrganization {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  org_type: Organization["orgType"];
  status: OrgStatus;
  parent_organization_id: string | null;
  contact_email: string;
  contact_phone: string | null;
  timezone: string;
  default_locale: string;
  settings: Record<string, unknown>;
  subscription_tier: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendOrgListResponse {
  items: BackendOrganization[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toOrganization(o: BackendOrganization): Organization {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    legalName: o.legal_name,
    orgType: o.org_type,
    status: o.status,
    parentOrganizationId: o.parent_organization_id,
    contactEmail: o.contact_email,
    contactPhone: o.contact_phone,
    timezone: o.timezone,
    defaultLocale: o.default_locale,
    settings: o.settings,
    subscriptionTier: o.subscription_tier,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

export const organizationService = {
  async list(q: OrgListQuery): Promise<OrgListResult> {
    const { data } = await api.get<BackendOrgListResponse>("/organizations", {
      params: {
        page: q.page,
        page_size: q.pageSize,
        search: q.search || undefined,
      },
    });
    let rows = data.items.map(toOrganization);
    // The list endpoint has no status filter param -- filter client-side over
    // the current page rather than fake a server-side filter that doesn't exist.
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    return {
      rows,
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async get(id: string): Promise<Organization | null> {
    const { data } = await api.get<BackendOrganization>(`/organizations/${id}`);
    return toOrganization(data);
  },

  async create(payload: CreateOrgPayload): Promise<Organization> {
    const { data } = await api.post<BackendOrganization>("/organizations", {
      name: payload.basic.name,
      slug: payload.basic.slug,
      legal_name: payload.basic.legalName,
      org_type: payload.basic.orgType,
      contact_email: payload.contact.contactEmail,
      contact_phone: payload.contact.contactPhone,
      timezone: payload.settings.timezone,
      default_locale: payload.settings.defaultLocale,
      subscription_tier: payload.settings.subscriptionTier,
    });
    return toOrganization(data);
  },

  async updateStatus(ids: string[], status: OrgStatus): Promise<void> {
    const endpoint = status === "suspended" ? "suspend" : "activate";
    await Promise.all(ids.map((id) => api.post(`/organizations/${id}/${endpoint}`)));
  },

  async remove(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => api.delete(`/organizations/${id}`)));
  },

  async locationCount(id: string): Promise<number> {
    const { data } = await api.get<{ total_items: number }>(
      `/organizations/${id}/locations`,
      { params: { page_size: 1 }, headers: { "X-Organization-Id": id } },
    );
    return data.total_items;
  },
};
