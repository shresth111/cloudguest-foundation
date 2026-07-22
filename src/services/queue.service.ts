import { api } from "@/services/api";
import type {
  CreateQueueAssignmentPayload,
  CreateQueueProfilePayload,
  QueueAssignment,
  QueueAssignmentListResult,
  QueueKpis,
  QueueProfile,
  QueueProfileListResult,
  UpdateQueueProfilePayload,
} from "@/types/queue";

interface BackendQueueProfile {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  download_rate_kbps: number;
  upload_rate_kbps: number;
  burst_download_kbps: number | null;
  burst_upload_kbps: number | null;
  burst_threshold_kbps: number | null;
  burst_time_seconds: number | null;
  priority: number;
  queue_type: string;
  is_system_profile: boolean;
  is_active: boolean;
  created_at: string;
}

interface BackendQueueProfileListResponse {
  items: BackendQueueProfile[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendQueueAssignment {
  id: string;
  organization_id: string;
  location_id: string | null;
  router_id: string | null;
  target_type: string;
  target_id: string | null;
  queue_profile_id: string | null;
  queue_schedule_id: string | null;
  status: string;
  priority_override: number | null;
  applied_at: string | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface BackendQueueAssignmentListResponse {
  items: BackendQueueAssignment[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toProfile(p: BackendQueueProfile): QueueProfile {
  return {
    id: p.id,
    organizationId: p.organization_id,
    name: p.name,
    description: p.description,
    downloadRateKbps: p.download_rate_kbps,
    uploadRateKbps: p.upload_rate_kbps,
    burstDownloadKbps: p.burst_download_kbps,
    burstUploadKbps: p.burst_upload_kbps,
    burstThresholdKbps: p.burst_threshold_kbps,
    burstTimeSeconds: p.burst_time_seconds,
    priority: p.priority,
    queueType: p.queue_type,
    isSystemProfile: p.is_system_profile,
    isActive: p.is_active,
    createdAt: p.created_at,
  };
}

function toAssignment(a: BackendQueueAssignment): QueueAssignment {
  return {
    id: a.id,
    organizationId: a.organization_id,
    locationId: a.location_id,
    routerId: a.router_id,
    targetType: a.target_type as QueueAssignment["targetType"],
    targetId: a.target_id,
    queueProfileId: a.queue_profile_id,
    queueScheduleId: a.queue_schedule_id,
    status: a.status as QueueAssignment["status"],
    priorityOverride: a.priority_override,
    appliedAt: a.applied_at,
    expiresAt: a.expires_at,
    errorMessage: a.error_message,
    createdAt: a.created_at,
  };
}

// Queue profiles/assignments are platform-wide here (no org selector on
// this page) -- omitting X-Organization-Id resolves CurrentOrganization to
// null server-side, same justified choice as policy.service.ts.
export const queueService = {
  async listProfiles(page = 1, pageSize = 100): Promise<QueueProfileListResult> {
    const { data } = await api.get<BackendQueueProfileListResponse>("/queue/profiles", {
      params: { page, page_size: pageSize },
    });
    return {
      rows: data.items.map(toProfile),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async createProfile(payload: CreateQueueProfilePayload): Promise<QueueProfile> {
    const { data } = await api.post<BackendQueueProfile>("/queue/profiles", {
      name: payload.name,
      description: payload.description ?? null,
      download_rate_kbps: payload.downloadRateKbps,
      upload_rate_kbps: payload.uploadRateKbps,
      burst_download_kbps: payload.burstDownloadKbps ?? null,
      burst_upload_kbps: payload.burstUploadKbps ?? null,
      burst_threshold_kbps: payload.burstThresholdKbps ?? null,
      burst_time_seconds: payload.burstTimeSeconds ?? null,
      priority: payload.priority ?? 8,
      is_active: payload.isActive ?? true,
    });
    return toProfile(data);
  },

  async updateProfile(id: string, payload: UpdateQueueProfilePayload): Promise<QueueProfile> {
    const { data } = await api.put<BackendQueueProfile>(`/queue/profiles/${id}`, {
      name: payload.name,
      description: payload.description,
      download_rate_kbps: payload.downloadRateKbps,
      upload_rate_kbps: payload.uploadRateKbps,
      priority: payload.priority,
      is_active: payload.isActive,
    });
    return toProfile(data);
  },

  async deleteProfile(id: string): Promise<void> {
    await api.delete(`/queue/profiles/${id}`);
  },

  async listAssignments(page = 1, pageSize = 50): Promise<QueueAssignmentListResult> {
    const { data } = await api.get<BackendQueueAssignmentListResponse>("/queue/assignments", {
      params: { page, page_size: pageSize },
    });
    return {
      rows: data.items.map(toAssignment),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async createAssignment(payload: CreateQueueAssignmentPayload): Promise<QueueAssignment> {
    const { data } = await api.post<BackendQueueAssignment>("/queue/assign", {
      target_type: payload.targetType,
      target_id: payload.targetId ?? null,
      router_id: payload.routerId ?? null,
      location_id: payload.locationId ?? null,
      queue_profile_id: payload.queueProfileId ?? null,
      priority_override: payload.priorityOverride ?? null,
    });
    return toAssignment(data);
  },

  async expireAssignment(id: string): Promise<void> {
    await api.delete(`/queue/assign/${id}`);
  },

  async applyQueue(assignmentId: string): Promise<QueueAssignment> {
    const { data } = await api.post<BackendQueueAssignment>("/queue/apply", {
      assignment_id: assignmentId,
    });
    return toAssignment(data);
  },

  async removeQueue(assignmentId: string): Promise<QueueAssignment> {
    const { data } = await api.post<BackendQueueAssignment>("/queue/remove", {
      assignment_id: assignmentId,
    });
    return toAssignment(data);
  },

  async getKpis(): Promise<QueueKpis> {
    const [profiles, assignments] = await Promise.all([
      queueService.listProfiles(1, 100),
      queueService.listAssignments(1, 100),
    ]);
    return {
      totalProfiles: profiles.total,
      activeAssignments: assignments.rows.filter((a) => a.status === "active").length,
      pendingAssignments: assignments.rows.filter((a) => a.status === "pending").length,
    };
  },
};
