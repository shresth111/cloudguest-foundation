import { api } from "@/services/api";
import type {
  CreateDnsRecordPayload,
  DnsRecord,
  DnsRecordListQuery,
  DnsRecordListResult,
  DnsRecordType,
  UpdateDnsRecordPayload,
} from "@/types/dns";

interface BackendDnsRecord {
  id: string;
  router_id: string;
  organization_id: string;
  location_id: string;
  name: string;
  record_type: string;
  address: string;
  ttl_seconds: number;
  comment: string | null;
  is_enabled: boolean;
  created_at: string;
}

// RequirePermission("dns.*") on every /dns-records route infers scope
// from the X-Organization-Id header (or falls back to requiring GLOBAL
// scope, which an ordinary org-owner session never holds) -- without
// it, every call here 403s for a real customer.
// Tenant scope rides on `X-Organization-Id`, which the api client attaches to
// every request from an organization-scoped session (see
// `attachOrganizationHeader` in services/api.ts) and deliberately omits for a
// GLOBAL-scope one, so a master-console view still spans every organization.
// Nothing here sets that header by hand any more and no method takes an
// `organizationId`. Do not re-add one: the caller then has to *resolve* the id
// before it can read, that resolution ends up in the React Query key, and the
// key changing once it settles fired every read on these pages twice.

interface BackendDnsRecordListResponse {
  items: BackendDnsRecord[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

function toDnsRecord(r: BackendDnsRecord): DnsRecord {
  return {
    id: r.id,
    routerId: r.router_id,
    organizationId: r.organization_id,
    locationId: r.location_id,
    name: r.name,
    recordType: r.record_type as DnsRecordType,
    address: r.address,
    ttlSeconds: r.ttl_seconds,
    comment: r.comment,
    isEnabled: r.is_enabled,
    createdAt: r.created_at,
  };
}

export const dnsService = {
  async list(q: DnsRecordListQuery): Promise<DnsRecordListResult> {
    const { data } = await api.get<BackendDnsRecordListResponse>("/dns-records", {
      params: { router_id: q.routerId, page: q.page, page_size: q.pageSize },
    });
    return {
      rows: data.items.map(toDnsRecord),
      total: data.total_items,
      totalPages: data.total_pages,
      hasNext: data.has_next,
      hasPrevious: data.has_previous,
    };
  },

  async create(payload: CreateDnsRecordPayload): Promise<DnsRecord> {
    const { data } = await api.post<BackendDnsRecord>("/dns-records", {
      router_id: payload.routerId,
      name: payload.name,
      address: payload.address,
      record_type: payload.recordType ?? "a",
      ttl_seconds: payload.ttlSeconds,
      comment: payload.comment,
      is_enabled: payload.isEnabled ?? true,
    });
    return toDnsRecord(data);
  },

  async update(id: string, payload: UpdateDnsRecordPayload): Promise<DnsRecord> {
    const { data } = await api.put<BackendDnsRecord>(`/dns-records/${id}`, {
      name: payload.name,
      address: payload.address,
      record_type: payload.recordType,
      ttl_seconds: payload.ttlSeconds,
      comment: payload.comment,
      is_enabled: payload.isEnabled,
    });
    return toDnsRecord(data);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/dns-records/${id}`);
  },
};
