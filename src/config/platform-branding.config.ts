import type { PlatformBrandingConfig } from "@/types/platform-branding";

/**
 * Static default Super Admin branding. Mirrors this theme's existing
 * `--primary`/`--secondary`/`--accent` values in src/styles.css exactly, so
 * loading this config is a visual no-op until an operator actually changes
 * it via Settings -> Branding -- it does not silently retheme the app on
 * first render.
 *
 * This is the seam a future `GET /platform/branding` call replaces (see
 * platform-branding.service.ts) -- swap `platformBrandingService.getConfig`'s
 * body for a real `api.get<PlatformBrandingApiResponse>(...)` call without
 * touching PlatformBrandingProvider, BrandLogo/BrandTitle/BrandIcon, or the
 * settings panel; all three consume the service, not this file, directly.
 */
export const DEFAULT_PLATFORM_BRANDING: PlatformBrandingConfig = {
  companyName: "ZIP WiFi",
  logoUrl: "/brand/mark-compact-blue.svg",
  faviconUrl: null,
  primaryColor: "oklch(0.52 0.115 208)",
  secondaryColor: "oklch(0.955 0.012 216)",
  accentColor: "oklch(0.945 0.022 202)",
};
