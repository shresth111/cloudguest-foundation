export type CampaignType = "survey" | "banner" | "redirect";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "ended";

export type DisplayRule = "every_login" | "first_login_only" | "once_per_n_days";

export interface Campaign {
  id: string;
  organizationId: string;
  locationId: string | null;
  name: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  displayRule: DisplayRule;
  displayIntervalDays: number | null;
  targetNetworks: string[];
  isSkippable: boolean;
  createdAt: string;
}

export interface CampaignListQuery {
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface CampaignListResult {
  rows: Campaign[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateCampaignPayload {
  locationId?: string | null;
  name: string;
  campaignType: CampaignType;
  startsAt?: string | null;
  endsAt?: string | null;
  displayRule?: DisplayRule;
  displayIntervalDays?: number | null;
  targetNetworks?: string[];
  isSkippable?: boolean;
}

export interface UpdateCampaignPayload {
  locationId?: string | null;
  name?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  displayRule?: DisplayRule;
  displayIntervalDays?: number | null;
  targetNetworks?: string[];
  isSkippable?: boolean;
}

export interface CampaignKpis {
  total: number;
  active: number;
  scheduled: number;
  draft: number;
}
