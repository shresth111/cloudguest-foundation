import { api } from "@/services/api";
import { rbacService } from "@/services/rbac.service";
import type {
  AuditExportQuery,
  AuditExportResult,
  AuditKpis,
  AuditListQuery,
  AuditListResult,
  AuditLogEntry,
} from "@/types/audit";

interface BackendAuditLogEntry {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  organization_id: string | null;
  location_id: string | null;
  created_at: string;
}

interface BackendAuditListResponse {
  items: BackendAuditLogEntry[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toAuditLogEntry(e: BackendAuditLogEntry): AuditLogEntry {
  return {
    id: e.id,
    actorUserId: e.actor_user_id,
    action: e.action,
    entityType: e.entity_type,
    entityId: e.entity_id,
    description: e.description,
    organizationId: e.organization_id,
    locationId: e.location_id,
    createdAt: e.created_at,
  };
}

function toParams(q: Partial<AuditListQuery>) {
  return {
    actor_user_id: q.actorUserId,
    action: q.action,
    entity_type: q.entityType,
    location_id: q.locationId,
    start: q.start,
    end: q.end,
    page: q.page,
    page_size: q.pageSize,
  };
}

export const auditService = {
  async list(q: AuditListQuery): Promise<AuditListResult> {
    const { data } = await api.get<BackendAuditListResponse>("/audit/entries", {
      params: toParams(q),
    });
    return {
      rows: data.items.map(toAuditLogEntry),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async getKpis(): Promise<AuditKpis> {
    const today = new Date();
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    ).toISOString();
    const [totalPage, todayPage, failedLoginsPage] = await Promise.all([
      auditService.list({ page: 1, pageSize: 1 }),
      auditService.list({ page: 1, pageSize: 1, start: startOfToday }),
      rbacService.listLoginAttempts({ success: false, page: 1, pageSize: 1 }),
    ]);
    return {
      totalEntries: totalPage.total,
      entriesToday: todayPage.total,
      failedLogins: failedLoginsPage.totalItems,
    };
  },

  /** Real CSV export -- capped server-side at 10,000 rows; `X-Export-Truncated`
   * is present (== "true") only when the cap was hit, absent otherwise. */
  async exportCsv(q: AuditExportQuery): Promise<AuditExportResult> {
    const res = await api.get<Blob>("/audit/entries/export", {
      params: {
        actor_user_id: q.actorUserId,
        action: q.action,
        entity_type: q.entityType,
        location_id: q.locationId,
        start: q.start,
        end: q.end,
      },
      responseType: "blob",
    });
    return {
      blob: res.data,
      truncated: res.headers["x-export-truncated"] === "true",
    };
  },
};
