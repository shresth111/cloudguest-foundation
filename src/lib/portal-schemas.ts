import { z } from "zod";
import {
  SPLASH_HEADLINE_MAX,
  SPLASH_WELCOME_MAX,
  countSplashLength,
} from "@/lib/splash-limits";

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
  whatsapp_otp: z.boolean(),
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

const seoBaseSchema = z.object({
  // The old `.max(80)` / `.max(240)` here were guesses that predate the real
  // backend limits on these two fields (they map straight onto
  // `splash_headline` / `splash_welcome_message` -- see portal.service.ts and
  // src/lib/splash-limits.ts): 26 and 78 CODE POINTS over the trimmed value.
  // Enforced via `makeSeoSchema`'s superRefine below rather than `.max()`,
  // because `.max()` counts UTF-16 units (wrong for Devanagari/Tamil/emoji)
  // and because an unchanged grandfathered over-limit value must still pass.
  pageTitle: z.string().min(2),
  metaDescription: z.string(),
  faviconUrl: z.string().url().optional().or(z.literal("")),
  socialImageUrl: z.string().url().optional().or(z.literal("")),
});
export type SeoValues = z.infer<typeof seoBaseSchema>;

/** `initial` is the form's loaded defaults: an over-limit value that is
 * still exactly what was loaded (compared trimmed, the counting basis) is
 * grandfathered -- the backend only rejects the field when it is being
 * changed, and the form mirrors that so other fields stay saveable. */
export const makeSeoSchema = (initial?: { pageTitle?: string; metaDescription?: string }) =>
  seoBaseSchema.superRefine((v, ctx) => {
    const check = (
      path: "pageTitle" | "metaDescription",
      value: string,
      max: number,
      initialValue: string | undefined,
    ) => {
      const count = countSplashLength(value);
      if (count <= max) return;
      if (initialValue !== undefined && value.trim() === initialValue.trim()) return;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `${count} / ${max} — over the ${max}-character limit. Shorten it to save.`,
      });
    };
    check("pageTitle", v.pageTitle, SPLASH_HEADLINE_MAX, initial?.pageTitle);
    check("metaDescription", v.metaDescription, SPLASH_WELCOME_MAX, initial?.metaDescription);
  });

export const seoSchema = makeSeoSchema();

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
