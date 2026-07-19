export type OrgStatus = "active" | "suspended" | "trial" | "expired" | "pending_verification";
export type OrgType = "enterprise" | "smb" | "hospitality" | "retail" | "education" | "healthcare";
export type SubscriptionPlan = "starter" | "growth" | "business" | "enterprise";
export type BillingCycle = "monthly" | "quarterly" | "annual";

export interface Organization {
  id: string;
  name: string;
  businessName: string;
  type: OrgType;
  industry: string;
  companySize: string;
  gstNumber?: string;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactDesignation: string;
  country: string;
  state: string;
  city: string;
  address: string;
  zipCode: string;
  timezone: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  trial: boolean;
  expiryDate: string;
  activeLocations: number;
  activeRouters: number;
  activeGuests: number;
  monthlyRevenue: number;
  activeSessions: number;
  uptimePct: number;
  status: OrgStatus;
  createdAt: string;
}

export interface OrgListQuery {
  search?: string;
  status?: OrgStatus | "all";
  plan?: SubscriptionPlan | "all";
  page: number;
  pageSize: number;
  sortBy?: keyof Organization;
  sortDir?: "asc" | "desc";
}

export interface OrgListResult {
  rows: Organization[];
  total: number;
}

export interface CreateOrgPayload {
  basic: {
    name: string;
    businessName: string;
    industry: string;
    companySize: string;
    gstNumber?: string;
    website?: string;
  };
  contact: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    contactDesignation: string;
  };
  address: {
    country: string;
    state: string;
    city: string;
    address: string;
    zipCode: string;
    timezone: string;
  };
  subscription: {
    plan: SubscriptionPlan;
    billingCycle: BillingCycle;
    trial: boolean;
    expiryDate: string;
  };
  admin: {
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    tempPassword: string;
  };
}

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  trial: "Trial",
  expired: "Expired",
  pending_verification: "Pending Verification",
};

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  business: "Business",
  enterprise: "Enterprise",
};
