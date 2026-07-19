import { z } from "zod";

export const basicSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  businessName: z.string().trim().min(2, "Business name is required").max(160),
  industry: z.string().min(1, "Select an industry"),
  companySize: z.string().min(1, "Select a company size"),
  gstNumber: z.string().trim().max(32).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
});

export const contactSchema = z.object({
  contactName: z.string().trim().min(2, "Contact name is required").max(120),
  contactEmail: z.string().trim().email("Invalid email"),
  contactPhone: z.string().trim().min(6, "Phone is required").max(24),
  contactDesignation: z.string().trim().min(2, "Designation is required").max(80),
});

export const addressSchema = z.object({
  country: z.string().min(1, "Country is required"),
  state: z.string().min(1, "State is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().trim().min(3, "Address is required").max(200),
  zipCode: z.string().trim().min(3, "ZIP is required").max(16),
  timezone: z.string().min(1, "Timezone is required"),
});

export const subscriptionSchema = z.object({
  plan: z.enum(["starter", "growth", "business", "enterprise"]),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]),
  trial: z.boolean(),
  expiryDate: z.string().min(1, "Expiry date is required"),
});

export const adminSchema = z.object({
  adminName: z.string().trim().min(2, "Admin name is required").max(120),
  adminEmail: z.string().trim().email("Invalid email"),
  adminPhone: z.string().trim().min(6, "Phone is required").max(24),
  tempPassword: z
    .string()
    .min(8, "At least 8 characters")
    .max(64)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export const orgWizardSchema = z.object({
  basic: basicSchema,
  contact: contactSchema,
  address: addressSchema,
  subscription: subscriptionSchema,
  admin: adminSchema,
});

export type OrgWizardValues = z.infer<typeof orgWizardSchema>;
