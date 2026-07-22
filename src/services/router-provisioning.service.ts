import { api } from "@/services/api";
import type {
  ApproveEnrollmentPayload,
  ConfigProfile,
  ConfigVersion,
  ConfigVersionListResult,
  ProvisioningJob,
  ProvisioningStatus,
  RouterEnrollment,
  RouterEnrollmentListResult,
  SecretRotationResult,
} from "@/types/router-provisioning";

interface BackendConfigVersion {
  id: string;
  router_id: string;
  profile_id: string | null;
  version_number: number;
  status: string;
  is_backup: boolean;
  rollback_of_version_id: string | null;
  created_by_user_id: string | null;
  applied_at: string | null;
  created_at: string;
}

interface BackendConfigVersionListResponse {
  items: BackendConfigVersion[];
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendConfigProfile {
  id: string;
  router_id: string;
  template_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
}

interface BackendProvisioningJob {
  id: string;
  router_id: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface BackendProvisioningStatus {
  router_id: string;
  router_status: string;
  profile: BackendConfigProfile | null;
  latest_version: BackendConfigVersion | null;
  active_jobs: BackendProvisioningJob[];
}

interface BackendSecretRotation {
  router_id: string;
  api_username: string | null;
  new_secret: string;
  rotated_at: string;
}

interface BackendEnrollment {
  id: string;
  serial_number: string;
  mac_address: string;
  model: string;
  status: string;
  requested_at: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  approved_router_id: string | null;
}

interface BackendEnrollmentListResponse {
  items: BackendEnrollment[];
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toConfigVersion(v: BackendConfigVersion): ConfigVersion {
  return {
    id: v.id,
    routerId: v.router_id,
    profileId: v.profile_id,
    versionNumber: v.version_number,
    status: v.status,
    isBackup: v.is_backup,
    rollbackOfVersionId: v.rollback_of_version_id,
    createdByUserId: v.created_by_user_id,
    appliedAt: v.applied_at,
    createdAt: v.created_at,
  };
}

function toProfile(p: BackendConfigProfile): ConfigProfile {
  return {
    id: p.id,
    routerId: p.router_id,
    templateId: p.template_id,
    assignedByUserId: p.assigned_by_user_id,
    assignedAt: p.assigned_at,
  };
}

function toJob(j: BackendProvisioningJob): ProvisioningJob {
  return {
    id: j.id,
    routerId: j.router_id,
    jobType: j.job_type,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.max_attempts,
    scheduledAt: j.scheduled_at,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    errorMessage: j.error_message,
    createdAt: j.created_at,
  };
}

function toEnrollment(e: BackendEnrollment): RouterEnrollment {
  return {
    id: e.id,
    serialNumber: e.serial_number,
    macAddress: e.mac_address,
    model: e.model,
    status: e.status,
    requestedAt: e.requested_at,
    reviewedByUserId: e.reviewed_by_user_id,
    reviewedAt: e.reviewed_at,
    rejectionReason: e.rejection_reason,
    approvedRouterId: e.approved_router_id,
  };
}

export const routerProvisioningService = {
  async getStatus(routerId: string): Promise<ProvisioningStatus> {
    const { data } = await api.get<BackendProvisioningStatus>(
      `/routers/${routerId}/provisioning-status`,
    );
    return {
      routerId: data.router_id,
      routerStatus: data.router_status,
      profile: data.profile ? toProfile(data.profile) : null,
      latestVersion: data.latest_version ? toConfigVersion(data.latest_version) : null,
      activeJobs: data.active_jobs.map(toJob),
    };
  },

  async listVersions(routerId: string): Promise<ConfigVersionListResult> {
    const { data } = await api.get<BackendConfigVersionListResponse>(
      `/routers/${routerId}/config-versions`,
      { params: { page: 1, page_size: 50 } },
    );
    return {
      rows: data.items.map(toConfigVersion),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async rollback(routerId: string, versionId: string): Promise<ConfigVersion> {
    const { data } = await api.post<{ version: BackendConfigVersion }>(
      `/routers/${routerId}/config-versions/${versionId}/rollback`,
    );
    return toConfigVersion(data.version);
  },

  async createBackup(routerId: string): Promise<ProvisioningJob> {
    const { data } = await api.post<BackendProvisioningJob>(`/routers/${routerId}/backup`);
    return toJob(data);
  },

  async restoreBackup(routerId: string, backupVersionId: string): Promise<ProvisioningJob> {
    const { data } = await api.post<BackendProvisioningJob>(
      `/routers/${routerId}/restore/${backupVersionId}`,
    );
    return toJob(data);
  },

  async factoryReset(routerId: string): Promise<ProvisioningJob> {
    const { data } = await api.post<BackendProvisioningJob>(
      `/routers/${routerId}/factory-reset`,
    );
    return toJob(data);
  },

  async rotateSecret(routerId: string): Promise<SecretRotationResult> {
    const { data } = await api.post<BackendSecretRotation>(
      `/routers/${routerId}/rotate-secret`,
    );
    return {
      routerId: data.router_id,
      apiUsername: data.api_username,
      newSecret: data.new_secret,
      rotatedAt: data.rotated_at,
    };
  },

  // Enrollment queue -- platform-wide, no X-Organization-Id: pending
  // enrollments have no organization yet (that's assigned at approval
  // time), matching backend/app/domains/router_provisioning/router.py's
  // list_pending_enrollments taking no organization filter at all.
  async listPendingEnrollments(): Promise<RouterEnrollmentListResult> {
    const { data } = await api.get<BackendEnrollmentListResponse>("/router-enrollment", {
      params: { page: 1, page_size: 50 },
    });
    return {
      rows: data.items.map(toEnrollment),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async approveEnrollment(
    enrollmentId: string,
    payload: ApproveEnrollmentPayload,
  ): Promise<{ enrollment: RouterEnrollment; routerId: string }> {
    const { data } = await api.post<{ enrollment: BackendEnrollment; router_id: string }>(
      `/router-enrollment/${enrollmentId}/approve`,
      {
        location_id: payload.locationId,
        name: payload.name,
        management_ip_address: payload.managementIpAddress ?? null,
        public_ip_address: payload.publicIpAddress ?? null,
        api_username: payload.apiUsername ?? null,
        api_secret: payload.apiSecret ?? null,
      },
    );
    return { enrollment: toEnrollment(data.enrollment), routerId: data.router_id };
  },

  async rejectEnrollment(enrollmentId: string, rejectionReason: string): Promise<RouterEnrollment> {
    const { data } = await api.post<BackendEnrollment>(
      `/router-enrollment/${enrollmentId}/reject`,
      { rejection_reason: rejectionReason },
    );
    return toEnrollment(data);
  },
};
