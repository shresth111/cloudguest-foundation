export type GuestTeamStatus = "active" | "revoked" | "expired";

export interface GuestTeam {
  id: string;
  organizationId: string;
  organizationName: string;
  locationId: string | null;
  name: string;
  teamCode: string;
  status: GuestTeamStatus;
  maxMembers: number | null;
  sharedDataLimitMb: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestTeamSummary {
  memberCount: number;
  activeSessionCount: number;
  totalBandwidthBytes: number;
  sharedDataLimitMb: number | null;
  remainingSharedQuotaMb: number | null;
  quotaExceeded: boolean;
}

export interface GuestTeamDetail extends GuestTeam {
  summary: GuestTeamSummary;
}

export interface CreateGuestTeamPayload {
  organizationId: string;
  locationId?: string | null;
  name: string;
  maxMembers?: number | null;
  sharedDataLimitMb?: number | null;
  expiresAt?: string | null;
}

export interface GuestTeamKpis {
  total: number;
  active: number;
  revoked: number;
  totalMembers: number;
}
