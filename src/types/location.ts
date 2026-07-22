export type LocationStatus = "active" | "inactive" | "suspended" | "archived";

export type PropertyType =
  | "hotel"
  | "resort"
  | "cafe"
  | "restaurant"
  | "hospital"
  | "clinic"
  | "office"
  | "coworking_space"
  | "school"
  | "college"
  | "university"
  | "mall"
  | "airport"
  | "factory"
  | "warehouse"
  | "apartment"
  | "hostel"
  | "custom";

// Kept as an alias -- Phase 1's WorkspaceContext/select-space already import
// `SiteType` from here for display purposes.
export type SiteType = PropertyType;

export interface Location {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organizationName: string;
  status: LocationStatus;
  propertyType: PropertyType | null;
  locationCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LocationListQuery {
  search?: string;
  status?: LocationStatus | "all";
  propertyType?: PropertyType | "all";
  organizationId?: string | "all";
  country?: string | "all";
  page: number;
  pageSize: number;
}

export interface LocationListResult {
  rows: Location[];
  total: number;
}

export interface CreateLocationPayload {
  organizationId: string;
  name: string;
  slug: string;
  propertyType?: PropertyType;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  settings?: Record<string, unknown>;
}

export interface ProvisionLocationPayload {
  existingOrganizationId?: string;
  newOrganization?: {
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string;
    legalName?: string;
    timezone?: string;
    defaultLocale?: string;
  };
  location: {
    name: string;
    slug: string;
    propertyType?: PropertyType;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    timezone?: string;
    latitude?: number;
    longitude?: number;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
  };
  owner: {
    firstName: string;
    lastName: string;
    email: string;
    username?: string;
    phone?: string;
    designation?: string;
    department?: string;
  };
  router: {
    name: string;
    serialNumber: string;
    macAddress: string;
    model: string;
    managementIpAddress?: string;
    publicIpAddress?: string;
  };
  planId: string;
  featureOverrides?: Array<{ featureKey: string; isEnabled?: boolean; limitValue?: number }>;
  couponCode?: string;
}

export interface ProvisionLocationResult {
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  planId: string;
  planName: string;
  routerId: string;
  routerName: string;
  ownerUserId: string;
  ownerName: string;
  ownerUsername: string;
  ownerEmail: string;
  ownerTemporaryPassword: string;
  loginUrl: string;
  provisionedAt: string;
}

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  hotel: "Hotel",
  resort: "Resort",
  cafe: "Cafe",
  restaurant: "Restaurant",
  hospital: "Hospital",
  clinic: "Clinic",
  office: "Office",
  coworking_space: "Coworking Space",
  school: "School",
  college: "College",
  university: "University",
  mall: "Mall",
  airport: "Airport",
  factory: "Factory",
  warehouse: "Warehouse",
  apartment: "Apartment",
  hostel: "Hostel",
  custom: "Custom",
};

// Kept as an alias -- see `SiteType` above.
export const SITE_TYPE_LABEL = PROPERTY_TYPE_LABEL;

export const LOCATION_STATUS_LABEL: Record<LocationStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
  archived: "Archived",
};
