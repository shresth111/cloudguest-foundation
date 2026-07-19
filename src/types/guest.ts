export type LoginMethod = "otp_mobile" | "otp_email" | "voucher" | "pms" | "social" | "click_through";
export type GuestType = "visitor" | "customer" | "hotel_guest" | "employee" | "student" | "vip" | "contractor";
export type GuestStatus = "online" | "offline" | "blocked" | "expired";
export type DeviceType = "mobile" | "laptop" | "tablet" | "desktop" | "iot" | "other";
export type DeviceStatus = "online" | "offline" | "blocked";
export type SignalStrength = "excellent" | "good" | "fair" | "poor";

export const LOGIN_METHOD_LABEL: Record<LoginMethod, string> = {
  otp_mobile: "Mobile OTP",
  otp_email: "Email OTP",
  voucher: "Voucher",
  pms: "PMS",
  social: "Social",
  click_through: "Click-through",
};

export const GUEST_TYPE_LABEL: Record<GuestType, string> = {
  visitor: "Visitor",
  customer: "Customer",
  hotel_guest: "Hotel Guest",
  employee: "Employee",
  student: "Student",
  vip: "VIP",
  contractor: "Contractor",
};

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  mobile: "Mobile",
  laptop: "Laptop",
  tablet: "Tablet",
  desktop: "Desktop",
  iot: "IoT",
  other: "Other",
};

export interface GuestSession {
  id: string;
  guestId: string;
  guestName: string;
  mobile: string;
  email: string;
  loginMethod: LoginMethod;
  guestType: GuestType;
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  routerId: string;
  routerName: string;
  apName: string;
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  macAddress: string;
  ipAddress: string;
  connectedSince: string;
  sessionEnd?: string;
  durationMinutes: number;
  downloadMb: number;
  uploadMb: number;
  signal: SignalStrength;
  status: GuestStatus;
  disconnectReason?: string;
}

export interface GuestDevice {
  id: string;
  guestId: string;
  name: string;
  type: DeviceType;
  mac: string;
  vendor: string;
  os: string;
  browser: string;
  firstSeen: string;
  lastSeen: string;
  status: DeviceStatus;
}

export interface Guest {
  id: string;
  name: string;
  email: string;
  mobile: string;
  organizationId: string;
  organizationName: string;
  locationId: string;
  locationName: string;
  guestType: GuestType;
  loginMethod: LoginMethod;
  lastLogin: string;
  totalVisits: number;
  totalSessions: number;
  totalDataMb: number;
  status: GuestStatus;
  createdAt: string;
}

export interface BlacklistEntry {
  id: string;
  guestId?: string;
  guestName: string;
  mac: string;
  mobile: string;
  email: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
}

export interface WhitelistEntry {
  id: string;
  guestId?: string;
  guestName: string;
  mac: string;
  mobile: string;
  email: string;
  note: string;
  addedAt: string;
}

export interface AccessPolicy {
  id: string;
  name: string;
  guestType: GuestType;
  internetTimeLimitMin: number;
  dailyLimitMb: number;
  speedLimitKbps: number;
  downloadLimitMb: number;
  uploadLimitMb: number;
  deviceLimit: number;
  sessionTimeoutMin: number;
  idleTimeoutMin: number;
  updatedAt: string;
}

export interface LoginMethodConfig {
  method: LoginMethod;
  enabled: boolean;
  description: string;
}

export interface SessionListQuery {
  search?: string;
  status?: GuestStatus | "all";
  loginMethod?: LoginMethod | "all";
  locationId?: string | "all";
  deviceType?: DeviceType | "all";
  page: number;
  pageSize: number;
  sortBy?: keyof GuestSession;
  sortDir?: "asc" | "desc";
}

export interface SessionListResult {
  rows: GuestSession[];
  total: number;
}

export interface GuestKpis {
  totalGuests: number;
  activeGuests: number;
  onlineUsers: number;
  todaysLogins: number;
  otpLogins: number;
  voucherLogins: number;
  socialLogins: number;
  pmsLogins: number;
  avgSessionMin: number;
  totalBandwidthGb: number;
}

export interface GuestAnalyticsData {
  dailyGuests: { date: string; guests: number; sessions: number }[];
  loginMethodDist: { method: string; value: number }[];
  returningVsNew: { name: string; value: number }[];
  deviceTypes: { name: string; value: number }[];
  topLocations: { name: string; guests: number }[];
  peakHours: { hour: string; logins: number }[];
  bandwidth: { date: string; downloadGb: number; uploadGb: number }[];
}
