export type OrgStatus = "trial" | "active" | "suspended" | "archived";
export type OrgType = "standard" | "msp";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  orgType: OrgType;
  status: OrgStatus;
  parentOrganizationId: string | null;
  contactEmail: string;
  contactPhone: string | null;
  timezone: string;
  defaultLocale: string;
  settings: Record<string, unknown>;
  subscriptionTier: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgListQuery {
  search?: string;
  status?: OrgStatus | "all";
  page: number;
  pageSize: number;
}

export interface OrgListResult {
  rows: Organization[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateOrgPayload {
  basic: {
    name: string;
    slug: string;
    legalName?: string;
    orgType: OrgType;
  };
  contact: {
    contactEmail: string;
    contactPhone?: string;
  };
  settings: {
    timezone: string;
    defaultLocale: string;
    subscriptionTier?: string;
  };
}

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  trial: "Trial",
  active: "Active",
  suspended: "Suspended",
  archived: "Archived",
};

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  standard: "Standard",
  msp: "MSP",
};
