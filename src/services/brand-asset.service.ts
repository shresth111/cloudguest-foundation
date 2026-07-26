import { api } from "@/services/api";
import { resolveOrgId } from "@/services/ticket.service";

/**
 * Real client for the backend's org-scoped `GET/PUT /branding` +
 * `POST/DELETE /branding/background-image` endpoints
 * (backend/app/domains/branding). Backs the customer dashboard's
 * "Background Image" page (src/components/features/BrandAssetPage.tsx) --
 * previously that page only ever called `URL.createObjectURL` on the
 * chosen file and never talked to the backend, so nothing persisted past
 * a refresh.
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
  backgroundImageUrl: string | null;
  updatedAt: string | null;
}

function toOrgBranding(b: BackendBranding): OrgBranding {
  return {
    id: b.id,
    organizationId: b.organization_id,
    companyName: b.company_name,
    backgroundImageUrl: b.background_image_url,
    updatedAt: b.updated_at,
  };
}

async function orgHeaders(): Promise<{ "X-Organization-Id": string }> {
  const orgId = await resolveOrgId();
  return { "X-Organization-Id": orgId };
}

export const brandAssetService = {
  /** Current organization's branding, including a freshly-resolved
   * `backgroundImageUrl` (the backend regenerates its presigned URL on
   * every call, so this is always fetched fresh -- never cached client
   * state). Falls back to the platform default (no background image) if
   * the organization has no branding row yet -- the backend never
   * returns null. */
  async getBranding(): Promise<OrgBranding | null> {
    const headers = await orgHeaders();
    const { data } = await api.get<BackendBranding | { is_default: true }>("/branding", {
      headers,
    });
    if ("is_default" in data) return null;
    return toOrgBranding(data);
  },

  /** Uploads (replacing any existing) the login-screen background image
   * for the current organization. Deliberately does not set a
   * Content-Type header -- letting the browser's XHR generate the
   * multipart boundary for the FormData body is the reliable way to do
   * this through axios; hand-setting "multipart/form-data" strips the
   * boundary and breaks the upload. */
  async uploadBackgroundImage(file: File): Promise<OrgBranding> {
    const headers = await orgHeaders();
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<BackendBranding>("/branding/background-image", formData, {
      headers,
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
