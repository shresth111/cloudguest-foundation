import { z } from "zod";

export const reasonSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});
export type ReasonFormValues = z.infer<typeof reasonSchema>;

export const blockGuestSchema = z.object({
  reason: z.string().trim().min(3, "Reason is required").max(500),
});
export type BlockGuestFormValues = z.infer<typeof blockGuestSchema>;

export const extendSessionSchema = z.object({
  additionalMinutes: z.coerce.number().int().min(1).max(10080),
});
export type ExtendSessionFormValues = z.infer<typeof extendSessionSchema>;

export const reconnectSchema = z.object({
  routerId: z.string().min(1, "Select a router"),
  locationId: z.string().min(1),
  deviceMac: z
    .string()
    .trim()
    .regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Invalid MAC address")
    .optional()
    .or(z.literal("")),
  ipAddress: z.string().trim().max(45).optional().or(z.literal("")),
});
export type ReconnectFormValues = z.infer<typeof reconnectSchema>;

export const accessRuleSchema = z
  .object({
    kind: z.enum(["identifier", "device"]),
    organizationId: z.string().min(1, "Select an organization"),
    locationId: z.string().optional().or(z.literal("")),
    identifier: z.string().trim().max(255).optional().or(z.literal("")),
    macAddress: z
      .string()
      .trim()
      .regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/, "Invalid MAC address")
      .optional()
      .or(z.literal("")),
    ruleType: z.enum(["vip", "temporary", "blocklist", "whitelist"]),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
    expiresAt: z.string().optional().or(z.literal("")),
  })
  .refine((v) => (v.kind === "identifier" ? !!v.identifier : !!v.macAddress), {
    message: "Required",
    path: ["identifier"],
  })
  .refine((v) => (v.ruleType === "temporary" ? !!v.expiresAt : true), {
    message: "Temporary rules require an expiry",
    path: ["expiresAt"],
  });
export type AccessRuleFormValues = z.infer<typeof accessRuleSchema>;

export const accessCheckSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  locationId: z.string().optional().or(z.literal("")),
  identifier: z.string().trim().optional().or(z.literal("")),
  macAddress: z.string().trim().optional().or(z.literal("")),
});
export type AccessCheckFormValues = z.infer<typeof accessCheckSchema>;

export const guestTeamSchema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  locationId: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name is required").max(200),
  maxMembers: z.coerce.number().int().min(1).optional().or(z.literal("")),
  sharedDataLimitMb: z.coerce.number().int().min(1).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});
export type GuestTeamFormValues = z.infer<typeof guestTeamSchema>;
