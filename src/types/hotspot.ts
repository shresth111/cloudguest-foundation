export interface HotspotProfile {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  sessionTimeoutMinutes: number | null;
  idleTimeoutMinutes: number | null;
  uploadLimitKbps: number | null;
  downloadLimitKbps: number | null;
  walledGardenHosts: string[];
  isEnabled: boolean;
  createdAt: string;
}

export interface HotspotProfileListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface HotspotProfileListResult {
  rows: HotspotProfile[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateHotspotProfilePayload {
  routerId: string;
  name: string;
  sessionTimeoutMinutes?: number | null;
  idleTimeoutMinutes?: number | null;
  uploadLimitKbps?: number | null;
  downloadLimitKbps?: number | null;
  walledGardenHosts?: string[];
  isEnabled?: boolean;
}

export interface UpdateHotspotProfilePayload {
  name?: string;
  sessionTimeoutMinutes?: number | null;
  idleTimeoutMinutes?: number | null;
  uploadLimitKbps?: number | null;
  downloadLimitKbps?: number | null;
  walledGardenHosts?: string[];
  isEnabled?: boolean;
}

export interface HotspotKpis {
  total: number;
  enabled: number;
  disabled: number;
}
