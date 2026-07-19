import { z } from "zod";

const hexColor = z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Must be a valid hex color");

export const brandingColorsSchema = z.object({
  primary: hexColor,
  secondary: hexColor,
  accent: hexColor,
  success: hexColor,
  warning: hexColor,
  error: hexColor,
  sidebar: hexColor,
  navbar: hexColor,
  buttonBg: hexColor,
  buttonText: hexColor,
  cardBg: hexColor,
  cardBorder: hexColor,
});
export type BrandingColorsFormValues = z.infer<typeof brandingColorsSchema>;

export const typographySchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.coerce.number().min(12).max(20),
  headingWeight: z.coerce.number().min(400).max(900),
  buttonWeight: z.coerce.number().min(400).max(900),
  borderRadius: z.coerce.number().min(0).max(32),
  cardRadius: z.coerce.number().min(0).max(32),
  shadow: z.enum(["none", "sm", "md", "lg", "xl"]),
});
export type TypographyFormValues = z.infer<typeof typographySchema>;

export const brandInfoSchema = z.object({
  name: z.string().min(2, "Brand name is required"),
  companyName: z.string().min(2, "Company name is required"),
  language: z.enum(["en", "hi", "ar", "fr", "es"]),
});
export type BrandInfoFormValues = z.infer<typeof brandInfoSchema>;

export const loginBrandingSchema = z.object({
  background: z.string().url().or(z.literal("")),
  banner: z.string().url().or(z.literal("")),
  illustration: z.string().url().or(z.literal("")),
  heading: z.string().min(1),
  description: z.string().min(1),
  footer: z.string().min(1),
});
export type LoginBrandingFormValues = z.infer<typeof loginBrandingSchema>;

export const emailBrandingSchema = z.object({
  header: z.string().min(1),
  footer: z.string().min(1),
  companyLogo: z.string().url().or(z.literal("")),
  companyAddress: z.string().min(1),
});
export type EmailBrandingFormValues = z.infer<typeof emailBrandingSchema>;

export const smsBrandingSchema = z.object({
  senderName: z.string().min(3).max(11),
  footer: z.string().min(1),
});
export type SmsBrandingFormValues = z.infer<typeof smsBrandingSchema>;

export const domainSchema = z.object({
  domain: z
    .string()
    .min(4)
    .regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/i, "Enter a valid domain"),
});
export type DomainFormValues = z.infer<typeof domainSchema>;

export const portalBrandingSchema = z.object({
  logo: z.string().url().or(z.literal("")),
  background: z.string().url().or(z.literal("")),
  primary: hexColor,
  accent: hexColor,
  font: z.string().min(1),
  welcomeMessage: z.string().min(1),
  footer: z.string().min(1),
  terms: z.string().min(1),
  privacy: z.string().min(1),
});
export type PortalBrandingFormValues = z.infer<typeof portalBrandingSchema>;
