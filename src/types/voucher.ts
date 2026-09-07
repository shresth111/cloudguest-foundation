export type VoucherBatchStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "active"
  | "expired"
  | "revoked";

export type VoucherStatus = "unused" | "active" | "exhausted" | "expired" | "revoked";

export interface VoucherPlan {
  id: string;
  name: string;
  organizationId: string | null;
  description: string | null;
  defaultValidityMinutes: number;
  defaultDataLimitMb: number | null;
  defaultMaxUsesPerVoucher: number;
  isActive: boolean;
}

export interface VoucherBatch {
  id: string;
  name: string;
  organizationId: string;
  locationId: string | null;
  planId: string | null;
  seriesId: string | null;
  quantity: number;
  codeLength: number;
  codePrefix: string | null;
  validityMinutes: number;
  batchExpiresAt: string | null;
  maxUsesPerVoucher: number;
  dataLimitMb: number | null;
  status: VoucherBatchStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherBatchListResult {
  rows: VoucherBatch[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateVoucherBatchPayload {
  organizationId: string;
  locationId?: string | null;
  planId?: string | null;
  name: string;
  quantity: number;
  codeLength: number;
  codePrefix?: string | null;
  validityMinutes: number;
  batchExpiresAt?: string | null;
  maxUsesPerVoucher: number;
  dataLimitMb?: number | null;
  notes?: string | null;
}

export interface Voucher {
  id: string;
  batchId: string;
  planId: string | null;
  code: string;
  status: VoucherStatus;
  useCount: number;
  redeemedAt: string | null;
  lastUsedAt: string | null;
  redeemedIdentifier: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface VoucherBatchStats {
  batchId: string;
  total: number;
  unused: number;
  active: number;
  exhausted: number;
  expired: number;
  revoked: number;
  redemptionRate: number;
}

export interface VoucherKpis {
  totalBatches: number;
  pendingApproval: number;
  activeBatches: number;
  totalVouchers: number;
}

/** What a voucher's redemption actually looked like on the network, as
 * observed by the platform -- resolved from `guest_sessions.voucher_id`,
 * the only link between a voucher and a device that exists.
 *
 * Deliberately separate from `Voucher.redeemedIdentifier`. That value is
 * whatever the guest typed at the portal (self-reported, normalized only
 * for whitespace); these are recorded by the network. They are not equally
 * trustworthy and the UI must not render them as though they were.
 *
 * `sessionCount` matters because a voucher can be multi-use: the device and
 * address here describe the MOST RECENT session only, so a count above 1 is
 * the cue not to present that one device as "the" redeemer. */
export interface VoucherRedemption {
  voucherId: string;
  sessionCount: number;
  sessionId: string | null;
  guestId: string | null;
  /** Not masked -- the backend's mask_mac is a documented no-op, mirrored
   * by this repo's own maskMac. Null means the session presented no MAC. */
  deviceMac: string | null;
  ipAddress: string | null;
  startedAt: string | null;
}
