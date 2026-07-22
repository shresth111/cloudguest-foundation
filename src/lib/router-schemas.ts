import { z } from "zod";

export const routerBasicSchema = z.object({
  name: z.string().trim().min(2, "Router name is required").max(120),
  locationId: z.string().min(1, "Select a location"),
  model: z.string().min(2, "Model is required"),
  serialNumber: z.string().trim().min(3, "Serial number is required").max(60),
  macAddress: z
    .string()
    .trim()
    .regex(/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/, "Enter a valid MAC address (AA:BB:CC:DD:EE:FF)"),
  managementIpAddress: z.string().trim().max(45).optional().or(z.literal("")),
  publicIpAddress: z.string().trim().max(45).optional().or(z.literal("")),
});

export const routerCredentialsSchema = z.object({
  apiUsername: z.string().trim().max(100).optional().or(z.literal("")),
  apiSecret: z.string().max(500).optional().or(z.literal("")),
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
  credentials: routerCredentialsSchema,
  services: routerServicesSchema,
});

export type RouterWizardValues = z.infer<typeof routerWizardSchema>;
