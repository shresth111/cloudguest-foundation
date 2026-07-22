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
