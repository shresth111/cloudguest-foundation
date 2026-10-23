/**
 * Master console client for the ISP partner platform endpoints
 * (API_CONTRACT §3, router `isp_partner_platform_router`, prefix
 * `/platform/isp-partners`). Every route is GLOBAL-pinned on the backend
 * (`organizations.*` at `ScopeType.GLOBAL`), so only a platform operator can
 * call any of it: an ISP user, an MSP Owner or an Organization Owner gets 403.
 *
 * Every call states the platform-wide scope explicitly
 * (`crossOrganizationHeaders()`, i.e. `X-Organization-Scope: all`) instead of
 * inheriting whatever single org the operator last picked in the scope picker.
 *
 * Wire shapes are snake_case exactly as the contract; the page works with the
 * camelCase types below. The `api` interceptor already unwraps the
 * `{ success, data }` envelope.
 */
import { api, crossOrganizationHeaders } from "@/services/api";

export type IspPartnerStatus = "active" | "suspended";

export interface IspPartnerCounts {
  customers: number;
  customersSuspended: number;
  locations: number;
  routersTotal: number;
  routersOnline: number;
  cpesTotal: number;
  cpesOnline: number;
  users: number;
}

export interface IspPartnerOwnerSummary {
  userId: string;
  name: string;
  email: string;
  status: "active" | "disabled";
}

export interface IspPartner {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  gstin: string | null;
  status: IspPartnerStatus;
  orgStatus: string;
  contactEmail: string;
  contactPhone: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
  timezone: string;
  defaultCustomerPlan: { id: string; name: string } | null;
  maxCustomers: number | null;
  notes: string | null;
  counts: IspPartnerCounts;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** Detail only (GET /platform/isp-partners/{id}); absent on list rows. */
  owners?: IspPartnerOwnerSummary[];
  /** Detail only: the ISP's own ACS credential, status only (never the password). */
  acs?: { username: string; enabled: boolean } | null;
}

export interface IspPartnerPage {
  items: IspPartner[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface IspOwnerInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  sendWelcomeEmail: boolean;
}

export interface CreateIspPartnerInput {
  name: string;
  slug: string;
  legalName: string | null;
  gstin: string | null;
  contactEmail: string;
  contactPhone: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
  timezone: string;
  defaultCustomerPlanId: string;
  maxCustomers: number | null;
  notes: string | null;
  owner: IspOwnerInput;
}

export type UpdateIspPartnerInput = Partial<
  Omit<CreateIspPartnerInput, "slug" | "owner" | "defaultCustomerPlanId">
> & { defaultCustomerPlanId?: string };

/** Shown once, right after create / add owner / reset password. */
export interface IspOwnerCredential {
  userId: string;
  username: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
}

export interface CreateIspPartnerResult {
  ispPartner: IspPartner;
  owner: IspOwnerCredential;
}

export interface PlanOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------- wire types

interface WireCounts {
  customers: number;
  customers_suspended: number;
  locations: number;
  routers_total: number;
  routers_online: number;
  cpes_total: number;
  cpes_online: number;
  users: number;
}

interface WireIspPartner {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  gstin: string | null;
  status: IspPartnerStatus;
  org_status: string;
  contact_email: string;
  contact_phone: string | null;
  support_phone: string | null;
  support_email: string | null;
  timezone: string;
  default_customer_plan: { id: string; name: string } | null;
  max_customers: number | null;
  notes?: string | null;
  counts: WireCounts;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  owners?: { user_id: string; name: string; email: string; status: "active" | "disabled" }[];
  acs?: { username: string; enabled: boolean } | null;
}

interface WirePage {
  items: WireIspPartner[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

interface WireCredential {
  user_id: string;
  username: string;
  email: string;
  temporary_password: string;
  login_url: string;
}

const ZERO_COUNTS: IspPartnerCounts = {
  customers: 0,
  customersSuspended: 0,
  locations: 0,
  routersTotal: 0,
  routersOnline: 0,
  cpesTotal: 0,
  cpesOnline: 0,
  users: 0,
};

function toIspPartner(w: WireIspPartner): IspPartner {
  const c = w.counts;
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    legalName: w.legal_name,
    gstin: w.gstin,
    status: w.status,
    orgStatus: w.org_status,
    contactEmail: w.contact_email,
    contactPhone: w.contact_phone,
    supportPhone: w.support_phone,
    supportEmail: w.support_email,
    timezone: w.timezone,
    defaultCustomerPlan: w.default_customer_plan,
    maxCustomers: w.max_customers,
    notes: w.notes ?? null,
    counts: c
      ? {
          customers: c.customers,
          customersSuspended: c.customers_suspended,
          locations: c.locations,
          routersTotal: c.routers_total,
          routersOnline: c.routers_online,
          cpesTotal: c.cpes_total,
          cpesOnline: c.cpes_online,
          users: c.users,
        }
      : ZERO_COUNTS,
    createdAt: w.created_at,
    suspendedAt: w.suspended_at,
    suspendedReason: w.suspended_reason,
    owners: w.owners?.map((o) => ({
      userId: o.user_id,
      name: o.name,
      email: o.email,
      status: o.status,
    })),
    acs: w.acs,
  };
}

function toCredential(w: WireCredential): IspOwnerCredential {
  return {
    userId: w.user_id,
    username: w.username,
    email: w.email,
    temporaryPassword: w.temporary_password,
    loginUrl: w.login_url,
  };
}

function ownerToWire(o: IspOwnerInput) {
  return {
    first_name: o.firstName,
    last_name: o.lastName,
    email: o.email,
    phone: o.phone,
    send_welcome_email: o.sendWelcomeEmail,
  };
}

function updateToWire(input: UpdateIspPartnerInput): Record<string, unknown> {
  const map: Record<string, string> = {
    name: "name",
    legalName: "legal_name",
    gstin: "gstin",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
    supportPhone: "support_phone",
    supportEmail: "support_email",
    timezone: "timezone",
    defaultCustomerPlanId: "default_customer_plan_id",
    maxCustomers: "max_customers",
    notes: "notes",
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && map[k]) out[map[k]] = v;
  }
  return out;
}

const BASE = "/platform/isp-partners";

function platformHeaders() {
  return crossOrganizationHeaders();
}

export const ispPartnerPlatformService = {
  async list(params: {
    page?: number;
    pageSize?: number;
    status?: IspPartnerStatus;
    search?: string;
  }): Promise<IspPartnerPage> {
    const { data } = await api.get<WirePage>(BASE, {
      headers: platformHeaders(),
      params: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? 50,
        status: params.status || undefined,
        search: params.search?.trim() || undefined,
      },
    });
    return {
      items: data.items.map(toIspPartner),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      pages: data.pages,
    };
  },

  async get(ispPartnerId: string): Promise<IspPartner> {
    const { data } = await api.get<WireIspPartner>(`${BASE}/${ispPartnerId}`, {
      headers: platformHeaders(),
    });
    return toIspPartner(data);
  },

  async create(input: CreateIspPartnerInput): Promise<CreateIspPartnerResult> {
    const { data } = await api.post<{ isp_partner: WireIspPartner; owner: WireCredential }>(
      BASE,
      {
        name: input.name,
        slug: input.slug,
        legal_name: input.legalName,
        gstin: input.gstin,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        support_phone: input.supportPhone,
        support_email: input.supportEmail,
        timezone: input.timezone,
        default_customer_plan_id: input.defaultCustomerPlanId,
        max_customers: input.maxCustomers,
        notes: input.notes,
        owner: ownerToWire(input.owner),
      },
      { headers: platformHeaders() },
    );
    return { ispPartner: toIspPartner(data.isp_partner), owner: toCredential(data.owner) };
  },

  async update(ispPartnerId: string, input: UpdateIspPartnerInput): Promise<IspPartner> {
    const { data } = await api.patch<WireIspPartner>(
      `${BASE}/${ispPartnerId}`,
      updateToWire(input),
      { headers: platformHeaders() },
    );
    return toIspPartner(data);
  },

  async suspend(ispPartnerId: string, reason: string): Promise<IspPartner> {
    const { data } = await api.post<WireIspPartner>(
      `${BASE}/${ispPartnerId}/suspend`,
      { reason },
      { headers: platformHeaders() },
    );
    return toIspPartner(data);
  },

  async activate(ispPartnerId: string): Promise<IspPartner> {
    const { data } = await api.post<WireIspPartner>(
      `${BASE}/${ispPartnerId}/activate`,
      {},
      { headers: platformHeaders() },
    );
    return toIspPartner(data);
  },

  async addOwner(ispPartnerId: string, owner: IspOwnerInput): Promise<IspOwnerCredential> {
    const { data } = await api.post<WireCredential>(
      `${BASE}/${ispPartnerId}/owners`,
      ownerToWire(owner),
      { headers: platformHeaders() },
    );
    return toCredential(data);
  },

  async resetUserPassword(ispPartnerId: string, ispUserId: string): Promise<IspOwnerCredential> {
    const { data } = await api.post<WireCredential>(
      `${BASE}/${ispPartnerId}/users/${ispUserId}/reset-password`,
      {},
      { headers: platformHeaders() },
    );
    return toCredential(data);
  },

  /** The plan picker. The same `/plans` list Master's billing page reads
   * (active plans, private ones included); first 100 is plenty. */
  async listPlans(): Promise<PlanOption[]> {
    const { data } = await api.get<{ items: { id: string; name: string }[] }>("/plans", {
      headers: platformHeaders(),
      params: { include_private: true, is_active: true, page: 1, page_size: 100 },
    });
    return (data.items ?? []).map((p) => ({ id: p.id, name: p.name }));
  },
};
