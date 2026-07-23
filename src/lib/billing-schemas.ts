import { z } from "zod";

export const subscriptionSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  planId: z.string().min(1, "Plan is required"),
  billingCycle: z.enum(["monthly", "annual"]),
  locations: z.coerce.number().int().min(1, "At least 1 location"),
  routers: z.coerce.number().int().min(1, "At least 1 router"),
  maxGuests: z.coerce.number().int().min(1),
  trialDays: z.coerce.number().int().min(0).max(90).optional(),
  discount: z.coerce.number().min(0).max(100).optional(),
  tax: z.coerce.number().min(0).max(100).optional(),
  autoRenewal: z.boolean(),
  notes: z.string().max(500).optional(),
});
export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export const planSchema = z.object({
  name: z.string().min(2, "Name is required"),
  tier: z.enum(["starter", "professional", "enterprise", "custom"]),
  currency: z.enum(["INR", "USD"]),
  monthlyPrice: z.coerce.number().min(0),
  annualPrice: z.coerce.number().min(0),
  includedLocations: z.coerce.number().int().min(1),
  includedRouters: z.coerce.number().int().min(1),
  includedGuests: z.coerce.number().int().min(1),
  storageLimitGb: z.coerce.number().int().min(1),
  apiAccess: z.boolean(),
  whiteLabel: z.boolean(),
  pmsIntegration: z.boolean(),
  aiFeatures: z.boolean(),
  supportLevel: z.enum(["email", "priority", "24x7", "dedicated"]),
});
export type PlanFormValues = z.infer<typeof planSchema>;

export const couponSchema = z
  .object({
    code: z.string().min(3, "Code must be at least 3 characters").max(24).toUpperCase(),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.coerce.number().min(0),
    expiryDate: z.string().min(1, "Expiry date is required"),
    maxUsage: z.coerce.number().int().min(1),
    status: z.enum(["active", "expired", "disabled"]),
  })
  .refine((v) => v.discountType !== "percentage" || v.discountValue <= 100, {
    message: "Percentage cannot exceed 100",
    path: ["discountValue"],
  });
export type CouponFormValues = z.infer<typeof couponSchema>;

export const taxRateSchema = z.object({
  name: z.string().min(2, "Name is required"),
  taxType: z.enum(["gst", "vat", "sales_tax", "none"]),
  ratePercentage: z.coerce.number().min(0).max(100),
  countryCode: z.string().length(2, "2-letter ISO country code").toUpperCase(),
  isActive: z.boolean(),
});
export type TaxRateFormValues = z.infer<typeof taxRateSchema>;

export const scheduledReportSchema = z.object({
  name: z.string().min(2),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipients: z.string().min(3, "At least one recipient email"),
  format: z.enum(["pdf", "excel", "csv"]),
  enabled: z.boolean(),
});
export type ScheduledReportFormValues = z.infer<typeof scheduledReportSchema>;
