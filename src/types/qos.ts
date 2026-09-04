// QoS & VOIP Priority traffic-classification rules -- see
// app.domains.qos (backend) for the full domain doc. A rule matches
// traffic either by protocol/port-range (e.g. SIP signaling on 5060, RTP
// media on a port range) or by a raw DSCP value (0-63, RFC 2474) --
// exactly one of the two match kinds is present per rule, never both.
export type DevicePushStatus = "pending" | "active" | "failed";

export interface QosTrafficRule {
  id: string;
  routerId: string;
  organizationId: string;
  locationId: string;
  name: string;
  protocol: string | null; // "tcp" | "udp" | null (null = DSCP-only match)
  portRangeStart: number | null;
  portRangeEnd: number | null;
  dscpValue: number | null;
  priority: number; // 1-8, real RouterOS /queue simple|tree priority
  isEnabled: boolean;
  // Real device-push state for this rule's paired router queue -- whether
  // this rule is actually doing anything on the customer's real router, or
  // just sitting as a database row. See qos.service.ts::push().
  deviceQueueId: string | null;
  devicePushStatus: DevicePushStatus;
  devicePushError: string | null;
  devicePushedAt: string | null;
  createdAt: string;
}

export interface QosListQuery {
  routerId?: string;
  page: number;
  pageSize: number;
}

export interface QosListResult {
  rows: QosTrafficRule[];
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreateQosRulePayload {
  routerId: string;
  name: string;
  protocol?: string | null;
  portRangeStart?: number | null;
  portRangeEnd?: number | null;
  dscpValue?: number | null;
  priority?: number;
  isEnabled?: boolean;
}

export interface UpdateQosRulePayload {
  name?: string;
  protocol?: string | null;
  portRangeStart?: number | null;
  portRangeEnd?: number | null;
  dscpValue?: number | null;
  priority?: number;
  isEnabled?: boolean;
}
