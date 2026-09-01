export interface ConfigVersion {
  id: string;
  routerId: string;
  profileId: string | null;
  versionNumber: number;
  status: string;
  isBackup: boolean;
  rollbackOfVersionId: string | null;
  createdByUserId: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface ConfigVersionListResult {
  rows: ConfigVersion[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ProvisioningJob {
  id: string;
  routerId: string;
  jobType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface ConfigProfile {
  id: string;
  routerId: string;
  templateId: string;
  assignedByUserId: string | null;
  assignedAt: string;
}

export interface ProvisioningStatus {
  routerId: string;
  routerStatus: string;
  profile: ConfigProfile | null;
  latestVersion: ConfigVersion | null;
  activeJobs: ProvisioningJob[];
}

export interface SecretRotationResult {
  routerId: string;
  apiUsername: string | null;
  newSecret: string;
  rotatedAt: string;
}

export interface RouterEnrollment {
  id: string;
  serialNumber: string;
  macAddress: string;
  model: string;
  status: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  approvedRouterId: string | null;
}

export interface RouterEnrollmentListResult {
  rows: RouterEnrollment[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** `apiUsername`/`apiSecret` are deliberately absent: approving an
 * enrollment no longer sets the platform's RouterOS management credential
 * (the backend's `RouterEnrollmentApproveRequest` dropped both fields --
 * `router_provisioning.approve` is held at ORGANIZATION scope by every
 * provisioned venue owner). Set them afterwards with
 * `PUT /platform/routers/{routerId}/management-access`, using the
 * `routerId` the approve call returns. */
export interface ApproveEnrollmentPayload {
  locationId: string;
  name: string;
  managementIpAddress?: string;
  publicIpAddress?: string;
}
