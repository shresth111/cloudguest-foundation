export type AccessRuleType = "whitelist" | "blocklist" | "temporary" | "vip";

export interface GuestAccessRule {
  id: string;
  organizationId: string;
  organizationName: string;
  locationId: string | null;
  identifier: string;
  ruleType: AccessRuleType;
  reason: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceAccessRule {
  id: string;
  organizationId: string;
  organizationName: string;
  locationId: string | null;
  macAddress: string;
  ruleType: AccessRuleType;
  reason: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuestRulePayload {
  organizationId: string;
  locationId?: string | null;
  identifier: string;
  ruleType: AccessRuleType;
  reason?: string | null;
  expiresAt?: string | null;
}

export interface CreateDeviceRulePayload {
  organizationId: string;
  locationId?: string | null;
  macAddress: string;
  ruleType: AccessRuleType;
  reason?: string | null;
  expiresAt?: string | null;
}

export interface AccessCheckQuery {
  organizationId: string;
  locationId?: string | null;
  identifier?: string;
  macAddress?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  ruleType: AccessRuleType | null;
  matchedRuleId: string | null;
  reason: string | null;
}

export interface GuestAccessKpis {
  totalGuestRules: number;
  totalDeviceRules: number;
  activeRules: number;
  vipCount: number;
}
