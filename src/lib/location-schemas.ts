import { z } from "zod";

export const locationBasicSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  organizationId: z.string().min(1, "Select an organization"),
  siteType: z.enum([
    "hotel",
    "cafe",
    "restaurant",
    "hospital",
    "school",
    "office",
    "mall",
    "airport",
    "other",
  ]),
});

export const locationAddressSchema = z.object({
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().trim().min(3, "Address is required").max(200),
  zipCode: z.string().trim().min(3, "ZIP is required").max(16),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  timezone: z.string().min(1, "Timezone is required"),
});

export const locationNetworkSchema = z.object({
  isp: z.string().trim().min(2, "ISP is required").max(80),
  primaryWan: z.string().trim().min(2, "Primary WAN is required").max(80),
  secondaryWan: z.string().trim().max(80).optional().or(z.literal("")),
  internetSpeedMbps: z.coerce.number().int().min(1, "Speed is required").max(100000),
  publicIp: z
    .string()
    .trim()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter a valid IPv4 address"),
  dns: z.string().trim().min(3, "DNS is required").max(120),
});

export const locationSettingsSchema = z.object({
  guestWifiEnabled: z.boolean(),
  captivePortalEnabled: z.boolean(),
  voucherLogin: z.boolean(),
  otpLogin: z.boolean(),
  pmsIntegration: z.boolean(),
  socialLogin: z.boolean(),
});

export const locationWizardSchema = z.object({
  basic: locationBasicSchema,
  address: locationAddressSchema,
  network: locationNetworkSchema,
  settings: locationSettingsSchema,
});

export type LocationWizardValues = z.infer<typeof locationWizardSchema>;
