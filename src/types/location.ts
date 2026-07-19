export type LocationStatus =
  | "active"
  | "inactive"
  | "maintenance"
  | "offline"
  | "pending"
  | "suspended";

export type SiteType =
  | "hotel"
  | "cafe"
  | "restaurant"
  | "hospital"
  | "school"
  | "office"
  | "mall"
  | "airport"
  | "other";

export type InternetStatus = "online" | "offline" | "degraded";
export type SubscriptionStatus = "active" | "trial" | "expired" | "suspended";

export interface Location {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  siteType: SiteType;
  country: string;
  state: string;
  city: string;
  address: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  primaryWan: string;
  secondaryWan?: string;
  internetSpeedMbps: number;
  publicIp: string;
  dns: string;
  routerCount: number;
  activeGuests: number;
  todaysSessions: number;
  bandwidthUsageMbps: number;
  uptimePct: number;
  activeAlerts: number;
  guestWifiEnabled: boolean;
  captivePortalEnabled: boolean;
  voucherLogin: boolean;
  otpLogin: boolean;
  pmsIntegration: boolean;
  socialLogin: boolean;
  internetStatus: InternetStatus;
  subscriptionStatus: SubscriptionStatus;
  status: LocationStatus;
  createdAt: string;
}

export interface LocationListQuery {
  search?: string;
  status?: LocationStatus | "all";
  siteType?: SiteType | "all";
  organizationId?: string | "all";
  country?: string | "all";
  page: number;
  pageSize: number;
  sortBy?: keyof Location;
  sortDir?: "asc" | "desc";
}

export interface LocationListResult {
  rows: Location[];
  total: number;
}

export interface CreateLocationPayload {
  basic: {
    name: string;
    organizationId: string;
    siteType: SiteType;
  };
  address: {
    country: string;
    state: string;
    city: string;
    address: string;
    zipCode: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  network: {
    isp: string;
    primaryWan: string;
    secondaryWan?: string;
    internetSpeedMbps: number;
    publicIp: string;
    dns: string;
  };
  settings: {
    guestWifiEnabled: boolean;
    captivePortalEnabled: boolean;
    voucherLogin: boolean;
    otpLogin: boolean;
    pmsIntegration: boolean;
    socialLogin: boolean;
  };
}

export const SITE_TYPE_LABEL: Record<SiteType, string> = {
  hotel: "Hotel",
  cafe: "Cafe",
  restaurant: "Restaurant",
  hospital: "Hospital",
  school: "School",
  office: "Office",
  mall: "Mall",
  airport: "Airport",
  other: "Other",
};

export const LOCATION_STATUS_LABEL: Record<LocationStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  maintenance: "Maintenance",
  offline: "Offline",
  pending: "Pending",
  suspended: "Suspended",
};
