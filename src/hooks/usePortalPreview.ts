import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalRuntimeService } from "@/services/portal-runtime.service";
import { brandAssetService, type OrgBranding } from "@/services/brand-asset.service";
import type { AppError } from "@/services/api";
import type { RuntimePortalConfig } from "@/types/portal-runtime";

/**
 * Backs the Portal Preview page (src/routes/preview.portal.$locationId.tsx).
 *
 * Two real, independent backend sources exist for what a location's guest
 * WiFi login screen looks like, and neither alone is the full picture:
 *
 *  - `captive_portal_configs` (app.domains.captive_portal), resolved via
 *    the exact same `GET /captive-portal/resolve` a real guest's device
 *    hits: most-specific-wins (this location's own config, else the
 *    organization's active default, else "not configured"). This is the
 *    authoritative source for theme/colors/login-method toggles/legal
 *    text/splash copy -- reused as-is here, not reimplemented, so this
 *    preview can never drift from what a guest actually gets asked.
 *  - `brandings` (app.domains.branding), one row per organization (no
 *    per-location concept -- see PortalBackgroundImage.tsx's own note). Holds
 *    the org's logo/background image/colors, entirely independent of
 *    whether anyone has ever created a captive_portal_configs row.
 *
 * Plenty of real locations (e.g. a freshly onboarded one) have branding
 * assets but no captive portal config yet -- `resolveConfig` 404s for
 * those, which is expected, not a bug, so it's read from `.error`
 * (`retry: false`) rather than thrown. This hook merges the two: the
 * resolved config's own fields win when present, the organization's
 * branding fills in everything else, and `configSource` tells the caller
 * which case it's looking at so the UI can be honest about it instead of
 * quietly presenting a synthesized mockup as the real configured portal.
 */

export type PortalPreviewConfigSource = "location" | "organization-default" | "branding-only";

export interface PortalPreviewData {
  isLoading: boolean;
  /** The real resolved captive_portal_configs row, exactly as a guest's
   * device receives it from GET /captive-portal/resolve. Null when the
   * organization has never configured one -- see `configSource`. */
  config: RuntimePortalConfig | null;
  configError: AppError | null;
  branding: OrgBranding | null;
  backgroundImageUrl: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  name: string;
  /** "location": this location has its own active config.
   *  "organization-default": no location override, but the organization
   *    has an active default config used across all its locations.
   *  "branding-only": no captive portal config exists at all yet --
   *    everything shown comes from the organization's branding assets. */
  configSource: PortalPreviewConfigSource;
}

const FALLBACK_PRIMARY = "#2563EB";
const FALLBACK_SECONDARY = "#1E293B";

export function usePortalPreview(organizationId: string, locationId: string): PortalPreviewData {
  const configQuery = useQuery({
    queryKey: ["portal-preview-config", organizationId, locationId],
    queryFn: () => portalRuntimeService.resolveConfig({ organizationId, locationId }),
    retry: false,
  });

  const brandingQuery = useQuery({
    queryKey: ["portal-preview-branding", organizationId],
    queryFn: () => brandAssetService.getBranding(organizationId),
    retry: false,
  });

  // Mirrors PortalBackgroundImage.tsx's own plain-effect pattern for the same
  // endpoint: the image bytes need an authenticated fetch (an <img> tag
  // can't attach the headers /branding/background-image/raw needs), so
  // they're fetched separately as a blob URL, only once `hasBackgroundImage`
  // is known -- skips a guaranteed 404 for the common no-image case.
  const [orgBackgroundBlobUrl, setOrgBackgroundBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!brandingQuery.data?.hasBackgroundImage) {
      setOrgBackgroundBlobUrl(null);
      return;
    }
    let cancelled = false;
    brandAssetService.fetchBackgroundImageBlobUrl(organizationId).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setOrgBackgroundBlobUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, brandingQuery.data?.hasBackgroundImage, brandingQuery.data?.updatedAt]);

  useEffect(() => {
    return () => {
      if (orgBackgroundBlobUrl) URL.revokeObjectURL(orgBackgroundBlobUrl);
    };
  }, [orgBackgroundBlobUrl]);

  // Same pattern as the background image, for the organization's
  // *uploaded* logo specifically -- a plain-text logoUrl (logoIsUploaded
  // false) is already directly hotlinkable and needs no blob fetch here.
  const [orgLogoBlobUrl, setOrgLogoBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!brandingQuery.data?.logoIsUploaded) {
      setOrgLogoBlobUrl(null);
      return;
    }
    let cancelled = false;
    brandAssetService.fetchLogoBlobUrl(organizationId).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setOrgLogoBlobUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, brandingQuery.data?.logoIsUploaded, brandingQuery.data?.updatedAt]);

  useEffect(() => {
    return () => {
      if (orgLogoBlobUrl) URL.revokeObjectURL(orgLogoBlobUrl);
    };
  }, [orgLogoBlobUrl]);

  const config = configQuery.data ?? null;
  const branding = brandingQuery.data ?? null;

  const configSource: PortalPreviewConfigSource = config
    ? config.resolvedViaLocationOverride
      ? "location"
      : "organization-default"
    : "branding-only";

  return {
    isLoading: configQuery.isLoading || brandingQuery.isLoading,
    config,
    configError: (configQuery.error as unknown as AppError | undefined) ?? null,
    branding,
    // A configured captive portal's own background image (what a real
    // guest sees) wins when set; the organization's branding-table image
    // is the fallback for a location with no config of its own.
    backgroundImageUrl: config?.backgroundImageUrl ?? orgBackgroundBlobUrl,
    // The org's uploaded logo needs the blob URL; a plain-text logoUrl
    // (no upload) is already a directly-usable <img src>.
    logoUrl:
      config?.logoUrl ?? (branding?.logoIsUploaded ? orgLogoBlobUrl : (branding?.logoUrl ?? null)),
    primaryColor: config?.primaryColor ?? branding?.primaryColor ?? FALLBACK_PRIMARY,
    secondaryColor: config?.secondaryColor ?? branding?.secondaryColor ?? FALLBACK_SECONDARY,
    name: config?.name ?? branding?.companyName ?? "Guest WiFi",
    configSource,
  };
}
