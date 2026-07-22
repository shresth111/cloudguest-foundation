export type NasStatus = "pending" | "active" | "disabled" | "suspended" | "deleted";

export const NAS_STATUS_LABEL: Record<NasStatus, string> = {
  pending: "Pending",
  active: "Active",
  disabled: "Disabled",
  suspended: "Suspended",
  deleted: "Deleted",
};

export interface NasClient {
  id: string;
  nasCode: string | null;
  routerId: string;
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  nasIdentifier: string;
  status: NasStatus;
  isActive: boolean;
  name: string | null;
  description: string | null;
  ipAddress: string | null;
  vendor: string;
  createdAt: string;
  updatedAt: string;
}

/** Only ever returned once, at the moment a NAS is registered or its secret is rotated. */
export interface NasClientSecretReveal extends NasClient {
  sharedSecret: string;
}

export interface CreateNasPayload {
  routerId: string;
  nasIdentifier: string;
  sharedSecret?: string;
  name?: string;
  description?: string;
  ipAddress?: string;
}

export interface UpdateNasPayload {
  name?: string;
  description?: string;
  ipAddress?: string;
}
