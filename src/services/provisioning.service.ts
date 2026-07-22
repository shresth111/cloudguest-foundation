import { api } from "@/services/api";
import type {
  ConfigurationPreview,
  DeviceDiscoveryResult,
  ProvisionJob,
  ProvisionTimelineEntry,
} from "@/types/provisioning";

interface BackendProvisionJob {
  id: string;
  organization_id: string;
  location_id: string;
  router_id: string;
  provision_template_id: string | null;
  status: string;
  current_step: string | null;
  progress_percent: number;
  requested_by_user_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  retry_of_job_id: string | null;
  is_rollback: boolean;
  rollback_of_job_id: string | null;
  applied_config_version_id: string | null;
  created_at: string;
}

interface BackendDeviceDiscoveryResult {
  vendor: string;
  model: string | null;
  serial_number: string | null;
  firmware_version: string | null;
  cpu_load_percent: number | null;
  free_memory_bytes: number | null;
  total_memory_bytes: number | null;
  uptime_seconds: number | null;
  interfaces: string[];
  mac_address: string | null;
}

interface BackendTimelineEntry {
  label: string;
  occurred_at: string;
  step_type: string | null;
  status: string | null;
  detail: string | null;
}

interface BackendConfigurationPreview {
  rendered_content: string;
  variables_used: Record<string, unknown>;
}

function toJob(j: BackendProvisionJob): ProvisionJob {
  return {
    id: j.id,
    organizationId: j.organization_id,
    locationId: j.location_id,
    routerId: j.router_id,
    provisionTemplateId: j.provision_template_id,
    status: j.status,
    currentStep: j.current_step,
    progressPercent: j.progress_percent,
    requestedByUserId: j.requested_by_user_id,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    errorMessage: j.error_message,
    retryCount: j.retry_count,
    maxRetries: j.max_retries,
    retryOfJobId: j.retry_of_job_id,
    isRollback: j.is_rollback,
    rollbackOfJobId: j.rollback_of_job_id,
    appliedConfigVersionId: j.applied_config_version_id,
    createdAt: j.created_at,
  };
}

function toDiscovery(d: BackendDeviceDiscoveryResult): DeviceDiscoveryResult {
  return {
    vendor: d.vendor,
    model: d.model,
    serialNumber: d.serial_number,
    firmwareVersion: d.firmware_version,
    cpuLoadPercent: d.cpu_load_percent,
    freeMemoryBytes: d.free_memory_bytes,
    totalMemoryBytes: d.total_memory_bytes,
    uptimeSeconds: d.uptime_seconds,
    interfaces: d.interfaces,
    macAddress: d.mac_address,
  };
}

function toTimelineEntry(e: BackendTimelineEntry): ProvisionTimelineEntry {
  return {
    label: e.label,
    occurredAt: e.occurred_at,
    stepType: e.step_type,
    status: e.status,
    detail: e.detail,
  };
}

export const provisioningService = {
  async discover(routerId: string): Promise<DeviceDiscoveryResult> {
    const { data } = await api.post<BackendDeviceDiscoveryResult>("/provision/discover", {
      router_id: routerId,
    });
    return toDiscovery(data);
  },

  /** Throws (via api.ts's toAppError) on validation failure -- there is no
   * boolean pass/fail field, a 200 response IS the pass. */
  async validate(routerId: string, provisionTemplateId?: string): Promise<void> {
    await api.post("/provision/validate", {
      router_id: routerId,
      provision_template_id: provisionTemplateId ?? null,
    });
  },

  async previewConfiguration(
    routerId: string,
    provisionTemplateId: string,
  ): Promise<ConfigurationPreview> {
    const { data } = await api.post<BackendConfigurationPreview>("/provision/configuration", {
      router_id: routerId,
      provision_template_id: provisionTemplateId,
    });
    return { renderedContent: data.rendered_content, variablesUsed: data.variables_used };
  },

  async createJob(
    routerId: string,
    provisionTemplateId?: string,
    maxRetries = 3,
  ): Promise<ProvisionJob> {
    const { data } = await api.post<BackendProvisionJob>("/provision", {
      router_id: routerId,
      provision_template_id: provisionTemplateId ?? null,
      max_retries: maxRetries,
    });
    return toJob(data);
  },

  async startJob(jobId: string): Promise<ProvisionJob> {
    const { data } = await api.post<BackendProvisionJob>(`/provision/${jobId}/start`);
    return toJob(data);
  },

  async retryJob(jobId: string): Promise<ProvisionJob> {
    const { data } = await api.post<BackendProvisionJob>(`/provision/${jobId}/retry`);
    return toJob(data);
  },

  async rollbackJob(jobId: string): Promise<ProvisionJob> {
    const { data } = await api.post<BackendProvisionJob>(`/provision/${jobId}/rollback`);
    return toJob(data);
  },

  async cancelJob(jobId: string, reason?: string): Promise<ProvisionJob> {
    const { data } = await api.post<BackendProvisionJob>(`/provision/${jobId}/cancel`, {
      reason: reason ?? null,
    });
    return toJob(data);
  },

  async getJob(jobId: string): Promise<ProvisionJob> {
    const { data } = await api.get<BackendProvisionJob>(`/provision/${jobId}`);
    return toJob(data);
  },

  async getTimeline(jobId: string): Promise<ProvisionTimelineEntry[]> {
    const { data } = await api.get<{ job_id: string; entries: BackendTimelineEntry[] }>(
      `/provision/${jobId}/timeline`,
    );
    return data.entries.map(toTimelineEntry);
  },
};
