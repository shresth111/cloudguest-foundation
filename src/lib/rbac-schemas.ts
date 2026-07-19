import { z } from "zod";
import { PERMISSION_ACTIONS } from "@/types/rbac";

export const userFormSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  mobile: z.string().trim().min(6, "Enter a valid mobile").max(20),
  organizationId: z.string().min(1, "Required"),
  departmentId: z.string().min(1, "Required"),
  designation: z.string().trim().min(1, "Required").max(120),
  roleId: z.string().min(1, "Required"),
  locationIds: z.array(z.string()).min(0),
  language: z.string().min(2),
  timezone: z.string().min(2),
  sendInvite: z.boolean(),
});
export type UserFormValues = z.infer<typeof userFormSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(2, "Required").max(80),
  description: z.string().trim().max(300).optional().default(""),
  status: z.enum(["active", "archived"]),
  permissions: z.record(
    z.string(),
    z.record(z.enum(PERMISSION_ACTIONS as [string, ...string[]]), z.boolean()),
  ),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;

export const passwordPolicySchema = z.object({
  minLength: z.number().int().min(6).max(64),
  requireUppercase: z.boolean(),
  requireNumber: z.boolean(),
  requireSymbol: z.boolean(),
  expiryDays: z.number().int().min(0).max(720),
  historyCount: z.number().int().min(0).max(24),
  lockoutAttempts: z.number().int().min(1).max(20),
  lockoutMinutes: z.number().int().min(1).max(1440),
});
export type PasswordPolicyValues = z.infer<typeof passwordPolicySchema>;

export const inviteFormSchema = z.object({
  email: z.string().email("Enter a valid email"),
  roleId: z.string().min(1, "Select a role"),
});
export type InviteFormValues = z.infer<typeof inviteFormSchema>;

export const profileSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  mobile: z.string().min(6).max(20),
  language: z.string(),
  timezone: z.string(),
  notifyEmail: z.boolean(),
  notifySms: z.boolean(),
  notifyPush: z.boolean(),
});
export type ProfileValues = z.infer<typeof profileSchema>;
