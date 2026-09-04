export type DnsRecordType = "a" | "aaaa" | "cname";

export interface DnsRecord {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  recordType: DnsRecordType;
  address: string;
  ttlSeconds: number;
  comment: string | null;
  isEnabled: boolean;
  createdAt: string;
}

export interface DnsRecordListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface DnsRecordListResult {
  rows: DnsRecord[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateDnsRecordPayload {
  routerId: string;
  name: string;
  address: string;
  recordType?: DnsRecordType;
  ttlSeconds?: number;
  comment?: string | null;
  isEnabled?: boolean;
}

export interface UpdateDnsRecordPayload {
  name?: string;
  address?: string;
  recordType?: DnsRecordType;
  ttlSeconds?: number;
  comment?: string | null;
  isEnabled?: boolean;
}
