import { z } from "zod";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const basicSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(150)
    .regex(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only"),
  legalName: z.string().trim().max(255).optional().or(z.literal("")),
  orgType: z.enum(["standard", "msp"]),
});

export const contactSchema = z.object({
  contactEmail: z.string().trim().email("Invalid email"),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
});

export const settingsSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
  defaultLocale: z.string().min(1, "Locale is required"),
  subscriptionTier: z.string().trim().max(50).optional().or(z.literal("")),
});

export const orgWizardSchema = z.object({
  basic: basicSchema,
  contact: contactSchema,
  settings: settingsSchema,
});

export type OrgWizardValues = z.infer<typeof orgWizardSchema>;
