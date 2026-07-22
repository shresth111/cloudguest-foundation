export interface QueueProfile {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  downloadRateKbps: number;
  uploadRateKbps: number;
  burstDownloadKbps: number | null;
  burstUploadKbps: number | null;
  burstThresholdKbps: number | null;
  burstTimeSeconds: number | null;
  priority: number;
  queueType: string;
  isSystemProfile: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface QueueProfileListResult {
  rows: QueueProfile[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateQueueProfilePayload {
  name: string;
  description?: string | null;
  downloadRateKbps: number;
  uploadRateKbps: number;
  burstDownloadKbps?: number | null;
  burstUploadKbps?: number | null;
  burstThresholdKbps?: number | null;
  burstTimeSeconds?: number | null;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateQueueProfilePayload {
  name?: string;
  description?: string | null;
  downloadRateKbps?: number;
  uploadRateKbps?: number;
  priority?: number;
  isActive?: boolean;
}

export type QueueTargetType =
  | "organization"
  | "location"
  | "router"
  | "guest_team"
  | "guest"
  | "voucher"
  | "device"
  | "session";

export type QueueAssignmentStatus = "pending" | "active" | "disabled" | "suspended" | "error" | "expired";

export interface QueueAssignment {
  id: string;
  organizationId: string;
  locationId: string | null;
  routerId: string | null;
  targetType: QueueTargetType;
  targetId: string | null;
  queueProfileId: string | null;
  queueScheduleId: string | null;
  status: QueueAssignmentStatus;
  priorityOverride: number | null;
  appliedAt: string | null;
  expiresAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface QueueAssignmentListResult {
  rows: QueueAssignment[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateQueueAssignmentPayload {
  targetType: QueueTargetType;
  targetId?: string | null;
  routerId?: string | null;
  locationId?: string | null;
  queueProfileId?: string | null;
  priorityOverride?: number | null;
}

export interface QueueKpis {
  totalProfiles: number;
  activeAssignments: number;
  pendingAssignments: number;
}
