import { z } from "zod";

export const PROPERTY_TYPES = [
  "hotel",
  "resort",
  "cafe",
  "restaurant",
  "hospital",
  "clinic",
  "office",
  "coworking",
  "mall",
  "airport",
  "school",
  "college",
  "university",
  "warehouse",
  "factory",
  "apartment",
  "hostel",
  "custom",
] as const;

export const lookupStepSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  mobile: z.string().trim().max(24).optional().or(z.literal("")),
});

export const propertyStepSchema = z.object({
  type: z.enum(PROPERTY_TYPES),
  name: z.string().trim().min(2, "Name is required").max(120),
  code: z.string().trim().min(3, "Code is required").max(32),
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().trim().min(3).max(200),
  timezone: z.string().min(1, "Timezone is required"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  logoUrl: z.string().url().optional().or(z.literal("")),
});

export const ownerStepSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  mobile: z.string().trim().min(6).max(24),
  username: z.string().trim().min(3).max(30),
  tempPassword: z.string().min(8).max(64),
  forcePasswordReset: z.boolean(),
  role: z.literal("Organization Admin"),
});

const ipv4 = z
  .string()
  .trim()
  .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter a valid IPv4 address");

export const routerStepSchema = z.object({
  serialNumber: z.string().trim().min(3).max(60),
  model: z.string().trim().min(2).max(60),
  routerOsVersion: z.string().trim().min(1).max(20),
  publicIp: ipv4,
  privateIp: ipv4,
  wireGuardEnabled: z.boolean(),
});

export const subscriptionStepSchema = z.object({
  plan: z.enum(["trial", "starter", "professional", "enterprise", "custom"]),
  billingCycle: z.enum(["monthly", "quarterly", "yearly"]),
  expiryDate: z.string().min(1, "Expiry date is required"),
  keepExisting: z.boolean().optional(),
});

export const featuresStepSchema = z.record(z.string(), z.boolean());

export const limitsStepSchema = z.object({
  locations: z.coerce.number().int().min(1).max(10000),
  routers: z.coerce.number().int().min(1).max(100000),
  guests: z.coerce.number().int().min(1),
  concurrentSessions: z.coerce.number().int().min(1),
  staffUsers: z.coerce.number().int().min(1),
  apiKeys: z.coerce.number().int().min(0),
  storageGb: z.coerce.number().int().min(1),
  smsCredits: z.coerce.number().int().min(0),
  emailCredits: z.coerce.number().int().min(0),
});

export type LookupStep = z.infer<typeof lookupStepSchema>;
export type PropertyStep = z.infer<typeof propertyStepSchema>;
export type OwnerStep = z.infer<typeof ownerStepSchema>;
export type RouterStep = z.infer<typeof routerStepSchema>;
export type SubscriptionStep = z.infer<typeof subscriptionStepSchema>;
export type LimitsStep = z.infer<typeof limitsStepSchema>;

export const FEATURE_GROUPS: Record<string, Array<{ key: string; label: string }>> = {
  Networking: [
    { key: "guestWifi", label: "Guest WiFi" },
    { key: "captivePortal", label: "Captive Portal" },
    { key: "freeradius", label: "FreeRADIUS" },
    { key: "wireguard", label: "WireGuard" },
    { key: "multiRouter", label: "Multi Router" },
  ],
  Management: [
    { key: "dashboard", label: "Dashboard" },
    { key: "organizations", label: "Organizations" },
    { key: "locations", label: "Locations" },
    { key: "users", label: "Users" },
    { key: "billing", label: "Billing" },
    { key: "reports", label: "Reports" },
  ],
  Analytics: [
    { key: "analytics", label: "Analytics" },
    { key: "aiAssistant", label: "AI Assistant" },
    { key: "monitoring", label: "Monitoring" },
    { key: "alerts", label: "Alerts" },
  ],
  Authentication: [
    { key: "qrLogin", label: "QR Login" },
    { key: "voucherLogin", label: "Voucher Login" },
    { key: "socialLogin", label: "Social Login" },
    { key: "emailLogin", label: "Email Login" },
    { key: "mobileOtp", label: "Mobile OTP" },
  ],
  Branding: [
    { key: "whiteLabel", label: "White Label" },
    { key: "pms", label: "PMS" },
  ],
  Developer: [
    { key: "apiAccess", label: "API Access" },
    { key: "auditLogs", label: "Audit Logs" },
    { key: "notificationCenter", label: "Notification Center" },
  ],
};

export function defaultFeatures(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  Object.values(FEATURE_GROUPS).forEach((group) =>
    group.forEach((f) => (out[f.key] = true)),
  );
  return out;
}

export const DEFAULT_LIMITS: LimitsStep = {
  locations: 10,
  routers: 25,
  guests: 5000,
  concurrentSessions: 1000,
  staffUsers: 25,
  apiKeys: 5,
  storageGb: 100,
  smsCredits: 1000,
  emailCredits: 10000,
};

export const PLAN_PRESETS: Record<
  "trial" | "starter" | "professional" | "enterprise" | "custom",
  Partial<LimitsStep>
> = {
  trial: { locations: 1, routers: 2, guests: 200, staffUsers: 2 },
  starter: { locations: 3, routers: 5, guests: 1000, staffUsers: 5 },
  professional: { locations: 10, routers: 25, guests: 5000, staffUsers: 25 },
  enterprise: { locations: 100, routers: 500, guests: 100000, staffUsers: 250 },
  custom: {},
};
