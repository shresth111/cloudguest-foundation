import { z } from "zod";

// Kept to exactly what POST /subscriptions actually accepts (see
// billing.service.ts's createSubscription() comment) -- billing cycle,
// locations/routers/guest limits, discount, tax and auto-renewal all come
// from the selected Plan (or a coupon, or a separate renewal-settings
// call) server-side, never from the create request itself.
export const subscriptionSchema = z.object({
  organizationId: z.string().min(1, "Organization is required"),
  planId: z.string().min(1, "Plan is required"),
  couponCode: z.string().max(50).optional(),
});
export type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

export const planSchema = z.object({
  name: z.string().min(2, "Name is required"),
  tier: z.enum(["starter", "professional", "enterprise", "custom"]),
  // INR only -- the real GST tax engine (compute_tax_breakdown, backend/
  // app/domains/billing/validators.py) is India-specific by construction
  // (CGST/SGST vs IGST is a purely Indian-jurisdiction distinction), so a
  // USD-priced plan never actually got a coherent tax treatment. This
  // platform's plans/invoices are INR-only, not "INR by default."
  currency: z.literal("INR"),
  monthlyPrice: z.coerce.number().min(0),
  // No annualPrice field -- the real backend Plan model has one base_price
  // per plan, never a separate monthly and annual price (see
  // PlanManagement.tsx's onSubmit comment). It used to be an editable
  // input here that silently did nothing on save.
  // -1 is the app-wide "Unlimited" sentinel for these four fields (see
  // PlanManagement.tsx's Unlimited toggle) -- translated to/from the real
  // backend's own null-means-unlimited PlanFeatureCreateRequest.limit_value
  // at the API boundary (billing.service.ts's n()/savePlan()). Any other
  // value must be a real positive count.
  includedLocations: z.coerce.number().int().refine((v) => v === -1 || v >= 1, "Must be -1 (Unlimited) or at least 1"),
  includedRouters: z.coerce.number().int().refine((v) => v === -1 || v >= 1, "Must be -1 (Unlimited) or at least 1"),
  includedGuests: z.coerce.number().int().refine((v) => v === -1 || v >= 1, "Must be -1 (Unlimited) or at least 1"),
  storageLimitGb: z.coerce.number().int().refine((v) => v === -1 || v >= 1, "Must be -1 (Unlimited) or at least 1"),
  apiAccess: z.boolean(),
  whiteLabel: z.boolean(),
  pmsIntegration: z.boolean(),
  aiFeatures: z.boolean(),
  supportLevel: z.enum(["basic", "priority", "dedicated"]),
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
