import { z } from "zod";

export const routerBasicSchema = z.object({
  name: z.string().trim().min(2, "Router name is required").max(120),
  organizationId: z.string().min(1, "Select an organization"),
  locationId: z.string().min(1, "Select a location"),
  model: z.string().min(2, "Model is required"),
  serialNumber: z.string().trim().min(3, "Serial number is required").max(60),
  mikrotikIdentity: z.string().trim().min(2, "MikroTik identity is required").max(60),
});

const ipv4 = z.string().trim().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Enter a valid IPv4 address");

export const routerNetworkSchema = z.object({
  wanIp: ipv4,
  lanIp: ipv4,
  dns: z.string().trim().min(3, "DNS is required").max(120),
  gateway: ipv4,
  timezone: z.string().min(1, "Timezone is required"),
});

export const routerAuthSchema = z.object({
  nasId: z.string().trim().min(2, "NAS ID is required").max(60),
  sharedSecret: z.string().min(6, "Shared secret must be at least 6 chars").max(80),
  apiPort: z.coerce.number().int().min(1).max(65535),
  apiUsername: z.string().trim().min(2, "API username is required").max(60),
  apiPassword: z.string().min(6, "API password must be at least 6 chars").max(80),
});

export const routerServicesSchema = z.object({
  freeradius: z.boolean(),
  wireguard: z.boolean(),
  captivePortal: z.boolean(),
  guestWifi: z.boolean(),
  monitoring: z.boolean(),
  analytics: z.boolean(),
});

export const routerWizardSchema = z.object({
  basic: routerBasicSchema,
  network: routerNetworkSchema,
  auth: routerAuthSchema,
  services: routerServicesSchema,
});

export type RouterWizardValues = z.infer<typeof routerWizardSchema>;
