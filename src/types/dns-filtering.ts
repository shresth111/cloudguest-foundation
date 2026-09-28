/**
 * Security -> Web Filtering: Cloudflare Gateway category filtering
 * (cloud-guest#307, `/dns-filtering/*`). Shapes are the backend's, in
 * camelCase; see `services/dns-filtering.service.ts` for the mapping.
 */

/** One Cloudflare category. `categoryClass` "noBlock" / "removalPending"
 * cannot be chosen (the backend refuses them with a 400). */
export interface WebCategory {
  id: number;
  name: string;
  description: string;
  categoryClass: string;
  beta: boolean;
  /** Cloudflare's "Security threats" group (malware, phishing, ...). */
  isSecurity: boolean;
  subcategories: WebCategory[];
}

/**
 * The category catalogue, or the answer that there is none to show.
 *
 * `not_configured` is a 503 from the backend (no Cloudflare account is
 * connected on this deployment) or a 404 (a backend without #307). Either
 * way nothing on the page can work, so the page shows no controls.
 */
export type WebCategoryCatalogue =
  | { state: "ready"; items: WebCategory[] }
  | { state: "not_configured" };

/** Where a venue's effective list comes from. */
export type WebFilterPolicySource = "location" | "organization" | "none";

export interface WebFilterLocationPolicy {
  locationId: string;
  organizationId: string;
  /** What this venue actually blocks. */
  effectiveCategoryIds: number[];
  source: WebFilterPolicySource;
  /** The venue's own list, or null when it has never had one. */
  locationCategoryIds: number[] | null;
  /** The account (organization) default, or null when there is none. */
  organizationCategoryIds: number[] | null;
}

/** `pending` / `active` / `failed` / `disabled` (the backend's
 * `RouterFilteringState`). A router with no row reads `disabled`. */
export type WebFilterRouterState = "pending" | "active" | "failed" | "disabled";

export interface WebFilterRouterStatus {
  routerId: string;
  enabled: boolean;
  state: WebFilterRouterState;
  /** Result of the last switch attempt; null when there has never been one. */
  devicePushStatus: "pending" | "active" | "failed" | null;
  devicePushError: string | null;
  devicePushedAt: string | null;
  effectiveCategoryIds: number[];
  policySource: WebFilterPolicySource;
  bypassHardeningEnabled: boolean;
  bypassHardeningStatus: "off" | "active" | "failed";
  bypassHardeningError: string | null;
  routerosVersion: string | null;
  /** The backend's own list of what this cannot do. Shown as sent. */
  limitations: string[];
}
