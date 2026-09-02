export type GuestAuthMethod = "otp_sms" | "otp_email" | "voucher" | "username_password";

export const GUEST_AUTH_METHOD_LABEL: Record<GuestAuthMethod, string> = {
  otp_sms: "Mobile OTP",
  otp_email: "Email OTP",
  voucher: "Voucher",
  username_password: "Username/Password",
};

export type GuestSessionStatus = "active" | "disconnected" | "expired" | "terminated" | "paused";

export const GUEST_SESSION_STATUS_LABEL: Record<GuestSessionStatus, string> = {
  active: "Active",
  disconnected: "Disconnected",
  expired: "Expired",
  terminated: "Terminated",
  paused: "Paused",
};

export interface Guest {
  id: string;
  organizationId: string;
  organizationName: string;
  locationId: string | null;
  locationName: string | null;
  identifier: string;
  displayName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalVisitCount: number;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestSession {
  id: string;
  guestId: string;
  /** Absent from the backend's guest-session payload -- GuestSessionResponse
   *  carries guest_id only. Null until that response grows the field; render
   *  a fallback rather than an empty string. */
  guestIdentifier: string | null;
  deviceId: string | null;
  userAgent: string | null;
  routerId: string;
  routerName: string;
  locationId: string;
  locationName: string;
  organizationId: string;
  organizationName: string;
  authMethod: GuestAuthMethod;
  voucherId: string | null;
  status: GuestSessionStatus;
  startedAt: string;
  endedAt: string | null;
  lastActivityAt: string;
  ipAddress: string | null;
  bytesUploaded: number;
  bytesDownloaded: number;
  dataLimitMb: number | null;
  sessionTimeoutMinutes: number | null;
  disconnectReason: string | null;
  createdAt: string;
}

export interface SessionListQuery {
  search?: string;
  status?: GuestSessionStatus | "all";
  locationId?: string | "all";
  /**
   * When set, the listing goes straight to /guest-sessions with
   * X-Organization-Id and uses the endpoint's own server-side location,
   * status and pagination filters. Without it the service has to fan out
   * across every organization (GLOBAL scope only) and filter client-side,
   * which silently caps every derived count at one 100-row page per org.
   */
  organizationId?: string;
  page: number;
  pageSize: number;
}

export interface SessionListResult {
  rows: GuestSession[];
  total: number;
}

export interface GuestListQuery {
  search?: string;
  isBlocked?: boolean | "all";
  page: number;
  pageSize: number;
  // When the caller already knows their organization/location (e.g. Group
  // Policies' "Map users" guest search), skip guestService.list's
  // GLOBAL-only fan-out (fetchAllOrganizations() -- 403s for an ordinary
  // org Owner, see guest.service.ts's own comment) and hit /guests
  // directly, scoped by X-Organization-Id. Callers with no known org
  // (cross-tenant admin Guests page) omit these and keep the fan-out.
  organizationId?: string;
  locationId?: string;
}

export interface GuestListResult {
  rows: Guest[];
  total: number;
}

/** Only ever needed on a punitive/manual action. */
export interface ReconnectPayload {
  routerId: string;
  locationId: string;
  deviceMac?: string;
  ipAddress?: string;
}

export type AccessRuleType = "vip" | "temporary" | "blocklist" | "whitelist";

export const ACCESS_RULE_TYPE_LABEL: Record<AccessRuleType, string> = {
  vip: "VIP",
  temporary: "Temporary",
  blocklist: "Blocklist",
  whitelist: "Whitelist",
};

interface AccessRuleBase {
  id: string;
  organizationId: string;
  locationId: string | null;
  ruleType: AccessRuleType;
  reason: string | null;
  email: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GuestAccessRule extends AccessRuleBase {
  kind: "identifier";
  identifier: string;
}

export interface DeviceAccessRule extends AccessRuleBase {
  kind: "device";
  macAddress: string;
}

export type AnyAccessRule = GuestAccessRule | DeviceAccessRule;

export interface CreateAccessRulePayload {
  kind: "identifier" | "device";
  organizationId: string;
  locationId?: string;
  identifier?: string;
  macAddress?: string;
  ruleType: AccessRuleType;
  reason?: string;
  email?: string;
  expiresAt?: string;
}

export interface AccessCheckQuery {
  organizationId: string;
  locationId?: string;
  identifier?: string;
  macAddress?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  ruleType: AccessRuleType | null;
  matchedRuleId: string | null;
  reason: string | null;
}

export type GuestTeamStatus = "active" | "expired" | "revoked";

export const GUEST_TEAM_STATUS_LABEL: Record<GuestTeamStatus, string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export interface GuestTeam {
  id: string;
  organizationId: string;
  locationId: string | null;
  name: string;
  teamCode: string;
  status: GuestTeamStatus;
  maxMembers: number | null;
  sharedDataLimitMb: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestTeamSummary {
  memberCount: number;
  activeSessionCount: number;
  totalBandwidthBytes: number;
  sharedDataLimitMb: number | null;
  remainingSharedQuotaMb: number | null;
  quotaExceeded: boolean;
}

export interface GuestTeamMember {
  guestId: string;
  identifier: string;
  joinedAt: string;
  isActive: boolean;
}

export interface CreateGuestTeamPayload {
  organizationId: string;
  locationId?: string;
  name: string;
  maxMembers?: number;
  sharedDataLimitMb?: number;
  expiresAt?: string;
}

export interface GuestTeamRevokeResult {
  team: GuestTeam;
  memberCount: number;
  terminatedSessionIds: string[];
  failedMemberIds: string[];
}

export interface GuestAnalyticsSummary {
  visitors: number;
  uniqueGuests: number;
  returningGuests: number;
  averageSessionDurationSeconds: number;
  totalBandwidthBytes: number;
}

export interface TopLocationItem {
  locationId: string;
  locationName: string;
  sessionCount: number;
}

export interface TopDeviceItem {
  deviceId: string;
  macAddress: string;
  sessionCount: number;
  uniqueGuestCount: number;
}

export interface OtpSuccessRate {
  totalAttempts: number;
  successfulAttempts: number;
  successRate: number;
}
