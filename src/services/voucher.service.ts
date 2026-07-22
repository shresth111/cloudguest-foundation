import { api } from "@/services/api";
import type {
  CreateVoucherBatchPayload,
  Voucher,
  VoucherBatch,
  VoucherBatchListResult,
  VoucherBatchStats,
  VoucherKpis,
  VoucherPlan,
} from "@/types/voucher";

// Real backend integration -- backend/app/domains/voucher. Scope covers the
// core operator workflow (view batches, generate a batch, approve/revoke,
// view a batch's vouchers, export CSV / download PDF, stats). Plan/series
// management, pre-printed code import, and guest-facing validate/redeem are
// out of scope for this admin page -- see voucher/schemas.py for the full
// surface if those are ever needed here too.

interface BackendVoucherPlan {
  id: string;
  name: string;
  organization_id: string | null;
  description: string | null;
  default_validity_minutes: number;
  default_data_limit_mb: number | null;
  default_max_uses_per_voucher: number;
  is_active: boolean;
}

interface BackendVoucherPlanListResponse {
  items: BackendVoucherPlan[];
}

interface BackendVoucherBatch {
  id: string;
  name: string;
  organization_id: string;
  location_id: string | null;
  plan_id: string | null;
  series_id: string | null;
  quantity: number;
  code_length: number;
  code_prefix: string | null;
  validity_minutes: number;
  batch_expires_at: string | null;
  max_uses_per_voucher: number;
  data_limit_mb: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendVoucherBatchListResponse {
  items: BackendVoucherBatch[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendVoucher {
  id: string;
  batch_id: string;
  plan_id: string | null;
  code: string;
  status: string;
  use_count: number;
  redeemed_at: string | null;
  last_used_at: string | null;
  redeemed_identifier: string | null;
  expires_at: string | null;
  created_at: string;
}

interface BackendVoucherListResponse {
  items: BackendVoucher[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface BackendVoucherBatchStats {
  batch_id: string;
  total: number;
  unused: number;
  active: number;
  exhausted: number;
  expired: number;
  revoked: number;
  redemption_rate: number;
}

function toPlan(p: BackendVoucherPlan): VoucherPlan {
  return {
    id: p.id,
    name: p.name,
    organizationId: p.organization_id,
    description: p.description,
    defaultValidityMinutes: p.default_validity_minutes,
    defaultDataLimitMb: p.default_data_limit_mb,
    defaultMaxUsesPerVoucher: p.default_max_uses_per_voucher,
    isActive: p.is_active,
  };
}

function toBatch(b: BackendVoucherBatch): VoucherBatch {
  return {
    id: b.id,
    name: b.name,
    organizationId: b.organization_id,
    locationId: b.location_id,
    planId: b.plan_id,
    seriesId: b.series_id,
    quantity: b.quantity,
    codeLength: b.code_length,
    codePrefix: b.code_prefix,
    validityMinutes: b.validity_minutes,
    batchExpiresAt: b.batch_expires_at,
    maxUsesPerVoucher: b.max_uses_per_voucher,
    dataLimitMb: b.data_limit_mb,
    status: b.status as VoucherBatch["status"],
    notes: b.notes,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

function toVoucher(v: BackendVoucher): Voucher {
  return {
    id: v.id,
    batchId: v.batch_id,
    planId: v.plan_id,
    code: v.code,
    status: v.status as Voucher["status"],
    useCount: v.use_count,
    redeemedAt: v.redeemed_at,
    lastUsedAt: v.last_used_at,
    redeemedIdentifier: v.redeemed_identifier,
    expiresAt: v.expires_at,
    createdAt: v.created_at,
  };
}

function toStats(s: BackendVoucherBatchStats): VoucherBatchStats {
  return {
    batchId: s.batch_id,
    total: s.total,
    unused: s.unused,
    active: s.active,
    exhausted: s.exhausted,
    expired: s.expired,
    revoked: s.revoked,
    redemptionRate: s.redemption_rate,
  };
}

export const voucherService = {
  // Platform-wide "Voucher Master" view -- omits X-Organization-Id so
  // CurrentOrganization resolves to null server-side and every
  // organization's batches are returned (same convention as
  // policyService.list -- see backend/app/domains/rbac/dependencies.py).
  async listBatches(page = 1, pageSize = 25): Promise<VoucherBatchListResult> {
    const { data } = await api.get<BackendVoucherBatchListResponse>("/voucher-batches", {
      params: { page, page_size: pageSize },
    });
    return {
      rows: data.items.map(toBatch),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async kpis(): Promise<VoucherKpis> {
    const { data } = await api.get<BackendVoucherBatchListResponse>("/voucher-batches", {
      params: { page: 1, page_size: 100 },
    });
    const batches = data.items.map(toBatch);
    return {
      totalBatches: data.total_items,
      pendingApproval: batches.filter((b) => b.status === "pending_approval").length,
      activeBatches: batches.filter((b) => b.status === "active").length,
      totalVouchers: batches.reduce((sum, b) => sum + b.quantity, 0),
    };
  },

  async listPlans(organizationId?: string): Promise<VoucherPlan[]> {
    const { data } = await api.get<BackendVoucherPlanListResponse>("/voucher-plans", {
      params: { page_size: 100 },
      headers: organizationId ? { "X-Organization-Id": organizationId } : undefined,
    });
    return data.items.map(toPlan);
  },

  async createBatch(payload: CreateVoucherBatchPayload): Promise<VoucherBatch> {
    const { data } = await api.post<BackendVoucherBatch>(
      "/voucher-batches",
      {
        name: payload.name,
        organization_id: payload.organizationId,
        location_id: payload.locationId ?? null,
        plan_id: payload.planId ?? null,
        quantity: payload.quantity,
        code_length: payload.codeLength,
        code_prefix: payload.codePrefix ?? null,
        validity_minutes: payload.validityMinutes,
        batch_expires_at: payload.batchExpiresAt ?? null,
        max_uses_per_voucher: payload.maxUsesPerVoucher,
        data_limit_mb: payload.dataLimitMb ?? null,
        notes: payload.notes ?? null,
      },
      { headers: { "X-Organization-Id": payload.organizationId } },
    );
    return toBatch(data);
  },

  // A batch always leaves create_batch as either PENDING_APPROVAL or
  // (if the caller holds voucher.manage) already ACTIVE -- see
  // voucher/service.py's module docstring. approve/revoke are still real,
  // separate calls for the PENDING_APPROVAL case.
  async approveBatch(id: string, organizationId: string): Promise<VoucherBatch> {
    const { data } = await api.post<BackendVoucherBatch>(
      `/voucher-batches/${id}/approve`,
      {},
      { headers: { "X-Organization-Id": organizationId } },
    );
    return toBatch(data);
  },

  async revokeBatch(id: string, organizationId: string, reason?: string): Promise<VoucherBatch> {
    const { data } = await api.post<BackendVoucherBatch>(
      `/voucher-batches/${id}/revoke`,
      { reason: reason ?? null },
      { headers: { "X-Organization-Id": organizationId } },
    );
    return toBatch(data);
  },

  async listVouchers(
    batchId: string,
    organizationId: string,
    page = 1,
    pageSize = 100,
  ): Promise<{ rows: Voucher[]; total: number }> {
    const { data } = await api.get<BackendVoucherListResponse>(
      `/voucher-batches/${batchId}/vouchers`,
      { params: { page, page_size: pageSize }, headers: { "X-Organization-Id": organizationId } },
    );
    return { rows: data.items.map(toVoucher), total: data.total_items };
  },

  async getStats(batchId: string, organizationId: string): Promise<VoucherBatchStats> {
    const { data } = await api.get<BackendVoucherBatchStats>(
      `/voucher-batches/${batchId}/stats`,
      { headers: { "X-Organization-Id": organizationId } },
    );
    return toStats(data);
  },

  async exportCsv(batchId: string, organizationId: string): Promise<Blob> {
    const res = await api.get<Blob>(`/voucher-batches/${batchId}/export`, {
      headers: { "X-Organization-Id": organizationId },
      responseType: "blob",
    });
    return res.data;
  },

  async downloadPdf(batchId: string, organizationId: string): Promise<Blob> {
    const res = await api.get<Blob>(`/voucher-batches/${batchId}/download`, {
      headers: { "X-Organization-Id": organizationId },
      responseType: "blob",
    });
    return res.data;
  },
};
