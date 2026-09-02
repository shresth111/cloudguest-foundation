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

/**
 * What a *rotation* returns, as opposed to a registration.
 *
 * `deviceActionRequired`/`deviceAction` are not decoration. Rotating a
 * shared secret changes two of the three places that must agree -- the
 * platform's record and the FreeRADIUS hub's `client{}` stanza -- and
 * cannot change the third: there is no write path from this platform to a
 * RouterOS RADIUS client, so the router keeps the old secret until someone
 * pastes the new one in over WinBox. Until they do, every guest login at
 * that venue is rejected. A successful rotate therefore means the venue is
 * DOWN, which is very nearly the opposite of what a success toast reads
 * as, so the backend states it as data and the UI must render it.
 */
export interface NasSecretRotation extends NasClientSecretReveal {
  deviceActionRequired: boolean;
  deviceAction: string;
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
