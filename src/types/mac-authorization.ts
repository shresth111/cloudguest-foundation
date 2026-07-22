export type MacAuthorizationType = "permanent" | "temporary";

export interface MacAuthorizationEntry {
  id: string;
  organizationId: string;
  locationId: string | null;
  macAddress: string;
  authorizationType: MacAuthorizationType;
  expiresAt: string | null;
  comment: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface MacAuthorizationListQuery {
  locationId?: string;
  page: number;
  pageSize: number;
}

export interface MacAuthorizationListResult {
  rows: MacAuthorizationEntry[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateMacAuthorizationPayload {
  macAddress: string;
  authorizationType: MacAuthorizationType;
  locationId?: string | null;
  expiresAt?: string | null;
  comment?: string | null;
  isEnabled?: boolean;
}

export interface UpdateMacAuthorizationPayload {
  macAddress?: string;
  authorizationType?: MacAuthorizationType;
  locationId?: string | null;
  expiresAt?: string | null;
  comment?: string | null;
  isEnabled?: boolean;
}

export interface MacAuthorizationKpis {
  total: number;
  enabled: number;
  disabled: number;
}
