import { z } from "zod";

export const portalBasicsSchema = z.object({
  name: z.string().min(3, "Name is required"),
  organizationId: z.string().min(1, "Organization is required"),
  locationId: z.string().min(1, "Location is required"),
  description: z.string().max(280).optional(),
});

export const portalBrandingSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  backgroundUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#([0-9a-f]{6})$/i, "Enter a hex color"),
  secondaryColor: z.string().regex(/^#([0-9a-f]{6})$/i, "Enter a hex color"),
  fontFamily: z.string().min(1),
  borderRadius: z.number().min(0).max(32),
});

export const portalLoginMethodSchema = z.object({
  mobile_otp: z.boolean(),
  email_otp: z.boolean(),
  voucher: z.boolean(),
  pms: z.boolean(),
  social: z.boolean(),
  click_through: z.boolean(),
});

export const portalConsentSchema = z.object({
  termsRequired: z.boolean(),
  privacyRequired: z.boolean(),
  marketingConsent: z.boolean(),
  gdprConsent: z.boolean(),
  termsUrl: z.string().url().optional().or(z.literal("")),
  privacyUrl: z.string().url().optional().or(z.literal("")),
});

export const portalWizardSchema = z.object({
  basics: portalBasicsSchema,
  branding: portalBrandingSchema,
  methods: portalLoginMethodSchema,
  consent: portalConsentSchema,
});
export type PortalWizardValues = z.infer<typeof portalWizardSchema>;

export const loginSettingsSchema = z.object({
  sessionTimeoutMinutes: z.number().min(1).max(1440),
  idleTimeoutMinutes: z.number().min(1).max(240),
  deviceLimit: z.number().min(1).max(50),
  redirectUrl: z.string().url().optional().or(z.literal("")),
  successPage: z.string().url().optional().or(z.literal("")),
  failurePage: z.string().url().optional().or(z.literal("")),
  autoLogin: z.boolean(),
  rememberDevice: z.boolean(),
});
export type LoginSettingsValues = z.infer<typeof loginSettingsSchema>;

export const seoSchema = z.object({
  pageTitle: z.string().min(2).max(80),
  metaDescription: z.string().max(240),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  socialImageUrl: z.string().url().optional().or(z.literal("")),
});
export type SeoValues = z.infer<typeof seoSchema>;

export const adSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["banner", "video"]),
  mediaUrl: z.string().url("Enter a media URL"),
  clickUrl: z.string().url("Enter a click URL"),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  active: z.boolean(),
});
export type AdValues = z.infer<typeof adSchema>;
