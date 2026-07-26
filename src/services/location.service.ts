import { api } from "@/services/api";
import { isDemo } from "@/services/customer.service";
import type {
  CreateLocationPayload,
  Location,
  LocationListQuery,
  LocationListResult,
  LocationStatus,
  ProvisionLocationPayload,
  ProvisionLocationResult,
} from "@/types/location";

// The Master Console's demo sign-in (master-login.tsx's "admin@example.com /
// test") issues a local-only `demo-access-token` the real backend never
// accepts -- every real call below 401s. Without this, the Smart Location
// Provisioning wizard's "Existing organization" step had zero organizations
// to pick from (its dropdown calls `organizations()` below, which calls
// `fetchAllOrganizations()`), the org id 401ed out of every other page that
// calls it, and the final "Provision location" submit failed outright. Same
// pattern master.locations.tsx's own local DEMO_ORGS/DEMO_LOCATIONS already
// applies for its simpler "Create Location" dialog -- fixed here at the
// shared fetch helpers so every caller (the wizard, the Customers page,
// `listAll()`, `get()`, `create()`) inherits it in one place instead of
// needing its own copy.
const DEMO_ORG_OPTIONS: BackendOrgListItem[] = [
  { id: "org-001", name: "Acme Corp" },
  { id: "org-002", name: "Blue Cedar Cafes" },
];

const DEMO_LOCATIONS_ALL: Location[] = [
  {
    id: "loc-demo-001", name: "Downtown Branch", slug: "downtown-branch",
    organizationId: "org-001", organizationName: "Acme Corp", status: "active", propertyType: "hotel",
    locationCode: "LOC-DEMO-001", addressLine1: "123 Main St", addressLine2: null, city: "Austin",
    stateProvince: "TX", postalCode: "78701", country: "US", timezone: "America/Chicago",
    latitude: null, longitude: null, contactName: null, contactPhone: null, contactEmail: null,
    settings: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: "loc-demo-002", name: "Airport Kiosk", slug: "airport-kiosk",
    organizationId: "org-002", organizationName: "Blue Cedar Cafes", status: "active", propertyType: "cafe",
    locationCode: "LOC-DEMO-002", addressLine1: "1 Airport Way", addressLine2: null, city: "Austin",
    stateProvince: "TX", postalCode: "78719", country: "US", timezone: "UTC",
    latitude: null, longitude: null, contactName: null, contactPhone: null, contactEmail: null,
    settings: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

interface BackendLocation {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: LocationStatus;
  property_type: Location["propertyType"];
  location_code: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface BackendOrgListItem {
  id: string;
  name: string;
}

interface BackendListResponse<T> {
  items: T[];
  total_items: number;
}

function toLocation(l: BackendLocation, organizationName: string): Location {
  return {
    id: l.id,
    name: l.name,
    slug: l.slug,
    organizationId: l.organization_id,
    organizationName,
    status: l.status,
    propertyType: l.property_type,
    locationCode: l.location_code,
    addressLine1: l.address_line1,
    addressLine2: l.address_line2,
    city: l.city,
    stateProvince: l.state_province,
    postalCode: l.postal_code,
    country: l.country,
    timezone: l.timezone,
    latitude: l.latitude,
    longitude: l.longitude,
    contactName: l.contact_name,
    contactPhone: l.contact_phone,
    contactEmail: l.contact_email,
    settings: l.settings,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

async function fetchAllOrganizations(): Promise<BackendOrgListItem[]> {
  if (isDemo()) return DEMO_ORG_OPTIONS;
  const { data } = await api.get<BackendListResponse<BackendOrgListItem>>("/organizations", {
    params: { page_size: 100 },
  });
  return data.items;
}

/**
 * There is no backend endpoint to list locations across every organization
 * at once -- only `GET /organizations/{id}/locations` (org-scoped). This
 * fans out one call per organization and concatenates client-side to
 * preserve the platform-wide "browse everything" page. Fine at today's
 * scale; a real cross-org endpoint is a backend change out of this repo.
 *
 * `X-Organization-Id` requires the caller to hold an actual
 * `OrganizationMember` row for that org -- confirmed against the real
 * backend, this check has no carve-out for GLOBAL-scoped roles. A platform
 * admin who hasn't explicitly joined every organization will get a 403 for
 * most of them, so this degrades gracefully to "every org the caller can
 * actually reach" via `allSettled`, rather than failing the whole page over
 * organizations the caller was never made a member of.
 */
async function fetchAllLocations(): Promise<Location[]> {
  if (isDemo()) return DEMO_LOCATIONS_ALL;
  const orgs = await fetchAllOrganizations();
  const settled = await Promise.allSettled(
    orgs.map(async (org) => {
      const { data } = await api.get<BackendListResponse<BackendLocation>>(
        `/organizations/${org.id}/locations`,
        { params: { page_size: 100 }, headers: { "X-Organization-Id": org.id } },
      );
      return data.items.map((l) => toLocation(l, org.name));
    }),
  );
  const perOrg = settled
    .filter((r): r is PromiseFulfilledResult<Location[]> => r.status === "fulfilled")
    .map((r) => r.value);
  return perOrg.flat();
}

export const locationService = {
  async list(q: LocationListQuery): Promise<LocationListResult> {
    let rows =
      q.organizationId && q.organizationId !== "all"
        ? await (async () => {
            const orgs = await fetchAllOrganizations();
            const org = orgs.find((o) => o.id === q.organizationId);
            const { data } = await api.get<BackendListResponse<BackendLocation>>(
              `/organizations/${q.organizationId}/locations`,
              { params: { page_size: 100 }, headers: { "X-Organization-Id": q.organizationId } },
            );
            return data.items.map((l) => toLocation(l, org?.name ?? ""));
          })()
        : await fetchAllLocations();

    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.city.toLowerCase().includes(s) ||
          r.organizationName.toLowerCase().includes(s) ||
          r.addressLine1.toLowerCase().includes(s),
      );
    }
    if (q.status && q.status !== "all") rows = rows.filter((r) => r.status === q.status);
    if (q.propertyType && q.propertyType !== "all") rows = rows.filter((r) => r.propertyType === q.propertyType);
    if (q.country && q.country !== "all") rows = rows.filter((r) => r.country === q.country);

    const total = rows.length;
    const start = (q.page - 1) * q.pageSize;
    rows = rows.slice(start, start + q.pageSize);
    return { rows, total };
  },

  async listAll(): Promise<Location[]> {
    return fetchAllLocations();
  },

  async get(id: string): Promise<Location | null> {
    const { data } = await api.get<BackendLocation>(`/locations/${id}`);
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === data.organization_id);
    return toLocation(data, org?.name ?? "");
  },

  async create(payload: CreateLocationPayload): Promise<Location> {
    const { data } = await api.post<BackendLocation>(
      `/organizations/${payload.organizationId}/locations`,
      {
        name: payload.name,
        slug: payload.slug,
        property_type: payload.propertyType,
        address_line1: payload.addressLine1,
        address_line2: payload.addressLine2,
        city: payload.city,
        state_province: payload.stateProvince,
        postal_code: payload.postalCode,
        country: payload.country,
        timezone: payload.timezone,
        latitude: payload.latitude,
        longitude: payload.longitude,
        contact_name: payload.contactName,
        contact_phone: payload.contactPhone,
        contact_email: payload.contactEmail,
        settings: payload.settings ?? {},
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    const orgs = await fetchAllOrganizations();
    const org = orgs.find((o) => o.id === payload.organizationId);
    return toLocation(data, org?.name ?? "");
  },

  async updateStatus(ids: string[], status: LocationStatus): Promise<void> {
    const endpoint = status === "suspended" ? "suspend" : "activate";
    await Promise.all(ids.map((id) => api.post(`/locations/${id}/${endpoint}`)));
  },

  async remove(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => api.delete(`/locations/${id}`)));
  },

  async provisionLocation(payload: ProvisionLocationPayload): Promise<ProvisionLocationResult> {
    if (isDemo()) {
      const orgId = payload.existingOrganizationId ?? "org-demo-new";
      const orgName = payload.existingOrganizationId
        ? (DEMO_ORG_OPTIONS.find((o) => o.id === payload.existingOrganizationId)?.name ?? "Demo Organization")
        : (payload.newOrganization?.name ?? "New Organization");
      return {
        organizationId: orgId,
        organizationName: orgName,
        locationId: `loc-demo-${Date.now()}`,
        locationName: payload.location.name,
        locationCode: `LOC-DEMO-${Math.floor(Math.random() * 9000 + 1000)}`,
        planId: payload.planId,
        planName: "Demo Plan",
        routerId: `router-demo-${Date.now()}`,
        routerName: payload.router.name,
        ownerUserId: `user-demo-${Date.now()}`,
        ownerName: `${payload.owner.firstName} ${payload.owner.lastName}`,
        ownerUsername: payload.owner.email.split("@")[0],
        ownerEmail: payload.owner.email,
        ownerTemporaryPassword: "Demo!Temp2026",
        loginUrl: "https://demo.zipwifi.io/login",
        provisionedAt: new Date().toISOString(),
      };
    }
    const { data } = await api.post<{
      organization_id: string;
      organization_name: string;
      location_id: string;
      location_name: string;
      location_code: string;
      plan_id: string;
      plan_name: string;
      router_id: string;
      router_name: string;
      owner_user_id: string;
      owner_name: string;
      owner_username: string;
      owner_email: string;
      owner_temporary_password: string;
      login_url: string;
      provisioned_at: string;
    }>("/locations/provision", {
      existing_organization_id: payload.existingOrganizationId,
      new_organization: payload.newOrganization && {
        name: payload.newOrganization.name,
        slug: payload.newOrganization.slug,
        contact_email: payload.newOrganization.contactEmail,
        contact_phone: payload.newOrganization.contactPhone,
        legal_name: payload.newOrganization.legalName,
        timezone: payload.newOrganization.timezone,
        default_locale: payload.newOrganization.defaultLocale,
      },
      location: {
        name: payload.location.name,
        slug: payload.location.slug,
        property_type: payload.location.propertyType,
        address_line1: payload.location.addressLine1,
        address_line2: payload.location.addressLine2,
        city: payload.location.city,
        state_province: payload.location.stateProvince,
        postal_code: payload.location.postalCode,
        country: payload.location.country,
        timezone: payload.location.timezone,
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        contact_name: payload.location.contactName,
        contact_phone: payload.location.contactPhone,
        contact_email: payload.location.contactEmail,
      },
      owner: {
        first_name: payload.owner.firstName,
        last_name: payload.owner.lastName,
        email: payload.owner.email,
        username: payload.owner.username,
        phone: payload.owner.phone,
        designation: payload.owner.designation,
        department: payload.owner.department,
      },
      router: {
        name: payload.router.name,
        serial_number: payload.router.serialNumber,
        mac_address: payload.router.macAddress,
        model: payload.router.model,
        management_ip_address: payload.router.managementIpAddress,
        public_ip_address: payload.router.publicIpAddress,
      },
      plan_id: payload.planId,
      feature_overrides: (payload.featureOverrides ?? []).map((f) => ({
        feature_key: f.featureKey,
        is_enabled: f.isEnabled,
        limit_value: f.limitValue,
        tier_value: f.tierValue,
      })),
      coupon_code: payload.couponCode,
    });
    return {
      organizationId: data.organization_id,
      organizationName: data.organization_name,
      locationId: data.location_id,
      locationName: data.location_name,
      locationCode: data.location_code,
      planId: data.plan_id,
      planName: data.plan_name,
      routerId: data.router_id,
      routerName: data.router_name,
      ownerUserId: data.owner_user_id,
      ownerName: data.owner_name,
      ownerUsername: data.owner_username,
      ownerEmail: data.owner_email,
      ownerTemporaryPassword: data.owner_temporary_password,
      loginUrl: data.login_url,
      provisionedAt: data.provisioned_at,
    };
  },

  async organizations(): Promise<{ id: string; name: string }[]> {
    return fetchAllOrganizations();
  },

  countries(): string[] {
    // A country picker's option list -- UI furniture, not app-state data.
    return ["US", "GB", "IN", "SG", "AE", "DE", "AU", "CA", "FR", "JP"];
  },
};
