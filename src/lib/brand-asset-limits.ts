/**
 * Shared client-side guards for the org-level branding asset uploads
 * (`POST /branding/logo`, `POST /branding/background-image`).
 *
 * These mirror the backend's own ceilings exactly -- see
 * `backend/app/domains/branding/service.py`'s `LOGO_MAX_BYTES` /
 * `BACKGROUND_IMAGE_MAX_BYTES` (both 5 MiB) and
 * `BACKGROUND_IMAGE_ALLOWED_CONTENT_TYPES` (`LOGO_ALLOWED_CONTENT_TYPES`
 * is a copy of the same dict). Checking here is a courtesy, not the
 * enforcement: it turns a 5-second upload of a 40 MB camera JPEG that
 * ends in a 413 into an instant, readable message. The backend still
 * rejects anything that gets past this.
 *
 * Lives in `lib/` rather than in either component because two separate
 * surfaces now upload the same assets against the same limits: the
 * standalone Background Image page (`BrandAssetPage.tsx`) and the Portal
 * page's own Design tab (`PortalPage.tsx`).
 */

export const BRAND_ASSET_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const BRAND_ASSET_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Ready for a file input's `accept` attribute. */
export const BRAND_ASSET_ACCEPT_ATTR = BRAND_ASSET_ACCEPTED_TYPES.join(",");

/**
 * Returns a human-readable reason the file can't be uploaded, or `null`
 * when it passes. Same two messages both call sites already showed, so
 * this changes no copy.
 */
export function brandAssetRejectionReason(file: File): string | null {
  if (!(BRAND_ASSET_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Use a PNG, JPEG, WEBP, or GIF file.";
  }
  if (file.size > BRAND_ASSET_MAX_UPLOAD_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`;
  }
  return null;
}
