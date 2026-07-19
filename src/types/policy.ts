export type PolicyScope = "location" | "user" | "group";
export type PolicyStatus = "active" | "draft" | "archived";
export type AuthMethod = "otp_sms" | "otp_email" | "voucher" | "social" | "pms" | "click_through" | "radius";

export interface BandwidthCap {
  downloadKbps: number;
  uploadKbps: number;
  burstDownloadKbps?: number;
  burstUploadKbps?: number;
}

export interface Quota {
  dailyMB?: number;
  weeklyMB?: number;
  monthlyMB?: number;
  sessionMinutes?: number;
  dailyMinutes?: number;
}

export interface DevicePolicy {
  maxDevicesPerGuest: number;
  allowBYOD: boolean;
  blockedOSes: string[];
}

export interface Policy {
  id: string;
  scope: PolicyScope;
  name: string;
  description?: string;
  status: PolicyStatus;
  priority: number;
  bandwidth: BandwidthCap;
  quota: Quota;
  device: DevicePolicy;
  authMethods: AuthMethod[];
  timeWindow?: { start: string; end: string; days: number[] };
  locationIds: string[];   // when scope === "location"
  userIds: string[];       // when scope === "user"
  groupIds: string[];      // when scope === "group"
  vlanIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PolicyKpis {
  total: number;
  active: number;
  draft: number;
  assignedTargets: number;
}
