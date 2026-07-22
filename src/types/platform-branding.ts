/**
 * Platform-level (Super Admin) branding -- distinct from the White Label
 * console at src/services/branding.service.ts, which manages *customer*
 * organizations' portal/dashboard brand configs. This type describes
 * CloudGuest's own operator identity: the mark shown in the Super Admin
 * shell itself (sidebar, login screen, browser tab).
 */
export interface PlatformBrandingConfig {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

/**
 * Shape a future `GET /platform/branding`-style backend response would take.
 * Not called anywhere yet -- see platform-branding.service.ts's module
 * docstring for why. Kept alongside the config type so the eventual real
 * service has a documented target to implement against.
 */
export interface PlatformBrandingApiResponse {
  company_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  updated_at: string;
}

/**
 * Shape a future asset-upload flow (logo/favicon to S3, served via
 * CloudFront) would need. Interface only -- no upload is implemented today;
 * see BrandingPanel.tsx's disabled logo/favicon upload controls.
 */
export interface BrandAssetUploadRequest {
  file: File;
  assetType: "logo" | "favicon";
}

export interface BrandAssetUploadResponse {
  /** Final CloudFront-fronted URL of the uploaded asset. */
  url: string;
  /** The S3 object key it was stored under, for later replacement/deletion. */
  storageKey: string;
}
