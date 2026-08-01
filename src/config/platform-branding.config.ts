import type { PlatformBrandingConfig } from "@/types/platform-branding";

/**
 * Static default Super Admin branding. Mirrors this theme's existing
 * `--primary`/`--secondary`/`--accent` values in src/styles.css exactly, so
 * loading this config is a visual no-op until an operator actually changes
 * it via Settings -> Branding -- it does not silently retheme the app on
 * first render.
 *
 * `primaryColor` previously stayed on the OLD teal `--primary` (hue 208)
 * after src/styles.css's `:root` was migrated to indigo (hue 265) --
 * PlatformBrandingProvider applies this value onto `document.documentElement`
 * on every mount via `setProperty`, which is an inline style and therefore
 * wins over the stylesheet's `:root` rule for every page, and (since it's
 * set on the root element, not a page-level div) it reaches Radix
 * Dialog/Popover/Select portals too -- so every button/switch across the
 * whole app kept rendering the old teal no matter what styles.css said,
 * while non-`--primary` surfaces (backgrounds, sidebar) looked correct.
 * This was the real root cause behind repeated "green/teal button" reports
 * that survived every styles.css-level fix, a global CSS audit, and cache
 * clears -- bug report "aur jagah sahi hai inside saare buttons mai same
 * hai" (everywhere else fine, but every button has the same [wrong] color)
 * pinpointed exactly this: only `--primary`-driven elements were affected.
 *
 * This is the seam a future `GET /platform/branding` call replaces (see
 * platform-branding.service.ts) -- swap `platformBrandingService.getConfig`'s
 * body for a real `api.get<PlatformBrandingApiResponse>(...)` call without
 * touching PlatformBrandingProvider, BrandLogo/BrandTitle/BrandIcon, or the
 * settings panel; all three consume the service, not this file, directly.
 */
export const DEFAULT_PLATFORM_BRANDING: PlatformBrandingConfig = {
  companyName: "Wyfy Guest",
  logoUrl: "/brand/mark-compact-blue.svg",
  faviconUrl: null,
  primaryColor: "oklch(0.47 0.2 265)",
  secondaryColor: "oklch(0.955 0.012 216)",
  accentColor: "oklch(0.945 0.022 202)",
};
