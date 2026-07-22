import { z } from "zod";

// ============================================================================
// Users
// ============================================================================

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  username: z.string().trim().min(3, "At least 3 characters").max(50),
  temporaryPassword: z.string().min(12, "At least 12 characters").max(128),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  employeeId: z.string().trim().max(60).optional().or(z.literal("")),
  timezone: z.string().min(2),
  language: z.string().min(2),
  organizationId: z.string().optional().or(z.literal("")),
  initialRoleId: z.string().optional().or(z.literal("")),
});
export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  employeeId: z.string().trim().max(60).optional().or(z.literal("")),
  timezone: z.string().min(2),
  language: z.string().min(2),
});
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

export const inviteUserSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Enter a valid email").max(255),
  username: z.string().trim().min(3, "At least 3 characters").max(50),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  organizationId: z.string().optional().or(z.literal("")),
  initialRoleId: z.string().optional().or(z.literal("")),
});
export type InviteUserFormValues = z.infer<typeof inviteUserSchema>;

// ============================================================================
// Roles
// ============================================================================

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Required").max(150),
  slug: z
    .string()
    .trim()
    .min(1, "Required")
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  scopeType: z.enum(["global", "organization", "location", "router", "device"]),
  organizationId: z.string().optional().or(z.literal("")),
  isTemplate: z.boolean(),
  permissionKeys: z.array(z.string()),
});
export type RoleFormValues = z.infer<typeof roleSchema>;

export const cloneRoleSchema = z.object({
  newName: z.string().trim().min(1, "Required").max(150),
  newSlug: z
    .string()
    .trim()
    .min(1, "Required")
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  targetOrganizationId: z.string().optional().or(z.literal("")),
});
export type CloneRoleFormValues = z.infer<typeof cloneRoleSchema>;

// ============================================================================
// Role assignment (scoped, per user)
// ============================================================================

export const assignRoleSchema = z
  .object({
    roleId: z.string().min(1, "Select a role"),
    scopeType: z.enum(["global", "organization", "location", "router", "device"]),
    organizationId: z.string().optional().or(z.literal("")),
    locationId: z.string().optional().or(z.literal("")),
    routerId: z.string().optional().or(z.literal("")),
    expiresAt: z.string().optional().or(z.literal("")),
  })
  .refine((v) => v.scopeType !== "organization" || !!v.organizationId, {
    message: "Required for organization scope",
    path: ["organizationId"],
  })
  .refine((v) => v.scopeType !== "location" || !!v.locationId, {
    message: "Required for location scope",
    path: ["locationId"],
  })
  .refine((v) => v.scopeType !== "router" || !!v.routerId, {
    message: "Required for router scope",
    path: ["routerId"],
  });
export type AssignRoleFormValues = z.infer<typeof assignRoleSchema>;

// ============================================================================
// Self-service security (MFA, password) -- see the /account route
// ============================================================================

export const mfaVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
export type MfaVerifyFormValues = z.infer<typeof mfaVerifySchema>;

export const mfaDisableSchema = z.object({
  password: z.string().min(1, "Required"),
  code: z.string().trim().min(1, "Enter a code"),
});
export type MfaDisableFormValues = z.infer<typeof mfaDisableSchema>;

export const mfaRegenerateSchema = z.object({
  code: z.string().trim().min(1, "Enter a code"),
});
export type MfaRegenerateFormValues = z.infer<typeof mfaRegenerateSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(12, "At least 12 characters").max(128),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
