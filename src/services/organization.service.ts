import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreateOrgPayload,
  OrgListQuery,
  OrgListResult,
  OrgStatus,
  Organization,
} from "@/types/organization";

// Same demo-session gap as location.service.ts's `fetchAllOrganizations()`
// (see its comment) -- the Master Console's demo sign-in issues a token the
// real backend never accepts, so this 401ed for a demo super-admin session
// and left the Customers page's own table empty with a "Could not load
// customers from the server." toast. Same two orgs/ids as
// location.service.ts's DEMO_ORG_OPTIONS so a demo session sees one
// consistent customer list everywhere in the Master Console.
const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: "org-001",
    name: "Acme Corp",
    slug: "acme-corp",
    legalName: "Acme Corporation Pvt Ltd",
    orgType: "standard",
    status: "active",
    parentOrganizationId: null,
    contactEmail: "ops@acme.example.com",
    contactPhone: null,
    timezone: "Asia/Kolkata",
    defaultLocale: "en",
    settings: {},
    subscriptionTier: "enterprise",
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "org-002",
    name: "Blue Cedar Cafes",
    slug: "blue-cedar-cafes",
    legalName: null,
    orgType: "standard",
    status: "active",
    parentOrganizationId: null,
    contactEmail: "hello@bluecedar.example.com",
    contactPhone: null,
    timezone: "UTC",
    defaultLocale: "en",
    settings: {},
    subscriptionTier: "starter",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
    if (isDemo()) {
      let rows = DEMO_ORGANIZATIONS;
      if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
      if (q.search) {
        const s = q.search.toLowerCase();
        rows = rows.filter(
          (r) => r.name.toLowerCase().includes(s) || r.contactEmail.toLowerCase().includes(s),
        );
      }
      return { rows, total: rows.length, totalPages: 1, hasNext: false, hasPrevious: false };
    }
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
    const { data } = await api.get<{ total_items: number }>(`/organizations/${id}/locations`, {
      params: { page_size: 1 },
      headers: { "X-Organization-Id": id },
    });
    return data.total_items;
  },
};
