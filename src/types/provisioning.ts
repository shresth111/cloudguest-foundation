export interface ProvisionJob {
  id: string;
  organizationId: string;
  locationId: string;
  routerId: string;
  provisionTemplateId: string | null;
  status: string;
  currentStep: string | null;
  progressPercent: number;
  requestedByUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  retryOfJobId: string | null;
  isRollback: boolean;
  rollbackOfJobId: string | null;
  appliedConfigVersionId: string | null;
  createdAt: string;
}

export interface ProvisionTimelineEntry {
  label: string;
  occurredAt: string;
  stepType: string | null;
  status: string | null;
  detail: string | null;
}

export interface DeviceDiscoveryResult {
  vendor: string;
  model: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  cpuLoadPercent: number | null;
  freeMemoryBytes: number | null;
  totalMemoryBytes: number | null;
  uptimeSeconds: number | null;
  interfaces: string[];
  macAddress: string | null;
}

export interface ConfigurationPreview {
  renderedContent: string;
  variablesUsed: Record<string, unknown>;
}
