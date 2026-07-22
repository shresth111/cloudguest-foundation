export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  organizationId: string | null;
  locationId: string | null;
  createdAt: string;
}

export interface AuditListQuery {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  locationId?: string;
  start?: string;
  end?: string;
  page: number;
  pageSize: number;
}

export interface AuditListResult {
  rows: AuditLogEntry[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/** Filters accepted by both `/audit/entries` and `/audit/entries/export`. */
export type AuditExportQuery = Omit<AuditListQuery, "page" | "pageSize">;

export interface AuditExportResult {
  blob: Blob;
  truncated: boolean;
}

export interface AuditKpis {
  totalEntries: number;
  entriesToday: number;
  failedLogins: number;
}
