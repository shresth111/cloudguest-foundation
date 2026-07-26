import { api } from "@/services/api";
import { resolveOrgId } from "@/services/ticket.service";

/**
 * Real client for the backend's org-scoped `GET/PUT /branding` +
 * `POST/DELETE /branding/background-image` +
 * `GET /branding/background-image/raw` endpoints
 * (backend/app/domains/branding). Backs the customer dashboard's
 * "Background Image" page (src/components/features/BrandAssetPage.tsx) --
 * previously that page only ever called `URL.createObjectURL` on the
 * chosen file and never talked to the backend, so nothing persisted past
 * a refresh.
 *
 * `background_image_url` from the backend is a same-API proxy *path*
 * (`/branding/background-image/raw`), not a directly-linkable image URL --
 * the object storage backing it (MinIO) isn't reachable from the browser
 * on this platform's actual deployment, only the API's own port is public.
 * An `<img>` tag can't attach the Authorization/X-Organization-Id headers
 * that path needs, so this fetches the bytes itself (same auth as every
 * other branding call) and hands back a local blob URL to render instead.
 *
 * One background image per organization (no per-location concept exists
 * in the `brandings` table -- see BrandAssetPage.tsx's own note on this).
 */

interface BackendBranding {
  id: string;
  organization_id: string;
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  theme: string;
  background_image_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OrgBranding {
  id: string;
  organizationId: string;
  companyName: string | null;
  /** True when the organization has a background image set on the
   * backend. Use `brandAssetService.fetchBackgroundImageBlobUrl()` to
   * actually render it -- this flag alone doesn't hand back the bytes. */
  hasBackgroundImage: boolean;
  updatedAt: string | null;
  // Added for the Portal Preview page (src/routes/_authenticated/preview.portal.$locationId.tsx),
  // which falls back to these organization-level branding fields when a
  // location has no captive_portal_configs row of its own -- the backend
  // response already carries them, `toOrgBranding` just wasn't mapping
  // them yet since BrandAssetPage.tsx (the only other caller) never
  // needed them.
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  theme: string;
}

function toOrgBranding(b: BackendBranding): OrgBranding {
  return {
    id: b.id,
    organizationId: b.organization_id,
    companyName: b.company_name,
    hasBackgroundImage: b.background_image_url != null,
    updatedAt: b.updated_at,
    logoUrl: b.logo_url,
    primaryColor: b.primary_color,
    secondaryColor: b.secondary_color,
    accentColor: b.accent_color,
    theme: b.theme,
  };
}

/**
 * `organizationId` is optional and defaults to the caller's own org
 * (`resolveOrgId()`, i.e. "/me/organizations") -- the shape every existing
 * call site (BrandAssetPage.tsx) relies on. Passing it explicitly lets a
 * caller resolve a *different* organization's branding -- e.g. the Portal
 * Preview page, reached both by an org owner (whose own org is implicit
 * anyway) and by a Master-console operator previewing an arbitrary
 * customer's location, who has no "own org" to resolve at all.
 */
async function orgHeaders(organizationId?: string): Promise<{ "X-Organization-Id": string }> {
  const orgId = organizationId ?? (await resolveOrgId());
  return { "X-Organization-Id": orgId };
}

export const brandAssetService = {
  /** Current organization's branding. Falls back to `null` (the platform
   * default -- no background image) if the organization has no branding
   * row yet -- the backend never returns a bare null body, but there's
   * nothing organization-specific to show here either way. */
  async getBranding(organizationId?: string): Promise<OrgBranding | null> {
    const headers = await orgHeaders(organizationId);
    const { data } = await api.get<BackendBranding | { is_default: true }>("/branding", {
      headers,
    });
    if ("is_default" in data) return null;
    return toOrgBranding(data);
  },

  /** Fetches the actual background image bytes and returns a local blob
   * URL ready to use as an `<img src>` -- caller owns the URL's lifetime
   * and must `URL.revokeObjectURL` it when done (see BrandAssetPage.tsx's
   * cleanup effect). Returns `null` on any failure (e.g. no image set)
   * rather than throwing -- this backs a passive preview render, not a
   * user-initiated action that needs its own error toast. */
  async fetchBackgroundImageBlobUrl(organizationId?: string): Promise<string | null> {
    try {
      const headers = await orgHeaders(organizationId);
      const { data } = await api.get<Blob>("/branding/background-image/raw", {
        headers,
        responseType: "blob",
      });
      return URL.createObjectURL(data);
    } catch {
      return null;
    }
  },

  /** Uploads (replacing any existing) the login-screen background image
   * for the current organization.
   *
   * `Content-Type: undefined` is load-bearing, not decorative: the shared
   * `api` instance (src/services/api.ts) sets a default
   * `Content-Type: application/json` header on every request. Left in
   * place, that default header wins over the browser's own multipart
   * boundary generation for this `FormData` body -- confirmed live
   * against production, this shipped as a real bug once (a 422 "field
   * 'file' required", because the backend received a body claiming to be
   * JSON with no multipart boundary to parse at all). Setting it to
   * `undefined` here removes the header for this call only, letting the
   * browser fill in `multipart/form-data; boundary=...` itself. */
  async uploadBackgroundImage(file: File): Promise<OrgBranding> {
    const headers = await orgHeaders();
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<BackendBranding>("/branding/background-image", formData, {
      headers: { ...headers, "Content-Type": undefined },
    });
    return toOrgBranding(data);
  },

  async deleteBackgroundImage(): Promise<OrgBranding> {
    const headers = await orgHeaders();
    const { data } = await api.delete<BackendBranding>("/branding/background-image", {
      headers,
    });
    return toOrgBranding(data);
  },
};
