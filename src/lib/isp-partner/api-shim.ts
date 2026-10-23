/**
 * The partner console's request shim (API_CONTRACT §7).
 *
 * The partner app mounts the existing `RouterSetupDrilldown` unchanged. That
 * component calls six router-setup endpoints that an ISP user cannot reach
 * (they are GLOBAL-pinned or need grants on the customer org). The backend
 * exposes ISP twins with byte-identical bodies under `/isp/routers/{id}/...`,
 * and this shim rewrites exactly those six paths to them -- on the network
 * host only. Every other path passes through untouched, so anything the
 * component starts calling later reaches the original endpoint and 403s:
 * it fails closed, and visibly (see the console warning below).
 *
 * It also pins `X-Organization-Id` to the ISP org once `/isp/me` has named
 * it. It never touches `Authorization`.
 */
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { ORG_HEADER } from "@/services/api";

const R = "([0-9a-fA-F-]{36})";

interface Rewrite {
  method: string;
  pattern: RegExp;
  to: (m: RegExpExecArray) => string;
}

export const ISP_SHIM_REWRITES: readonly Rewrite[] = [
  {
    method: "post",
    pattern: new RegExp(`^/routers/${R}/provisioning-token$`),
    to: (m) => `/isp/routers/${m[1]}/provisioning-token`,
  },
  {
    method: "post",
    pattern: new RegExp(`^/routers/${R}/agent-credential/regenerate$`),
    to: (m) => `/isp/routers/${m[1]}/agent-credential/regenerate`,
  },
  {
    method: "post",
    pattern: new RegExp(`^/routers/${R}/wireguard-peer/allocate-external(\\?.*)?$`),
    to: (m) => `/isp/routers/${m[1]}/wireguard-peer/allocate-external${m[2] ?? ""}`,
  },
  {
    method: "post",
    pattern: new RegExp(`^/radius/nas/register-external/${R}$`),
    to: (m) => `/isp/routers/${m[1]}/radius-nas/register-external`,
  },
  {
    method: "put",
    pattern: new RegExp(`^/platform/routers/${R}/management-access$`),
    to: (m) => `/isp/routers/${m[1]}/management-access`,
  },
  {
    method: "get",
    pattern: new RegExp(`^/routers/${R}$`),
    to: (m) => `/isp/routers/${m[1]}/as-router-device`,
  },
];

export const FORCE_NOT_ALLOWED_MESSAGE =
  "Forcing a new cloud link is not allowed from the partner console.";

/**
 * What the shim rejects a refused request with. A request interceptor's
 * rejection still runs through `api.ts`'s response error handler, which
 * converts it with `toAppError`; shaped like an axios error with a 422
 * envelope, it comes out the other side as an AppError whose `data.code`
 * is `ISP_FORCE_NOT_ALLOWED`, the same as the backend twin would answer.
 */
export function forceNotAllowedRejection(config?: InternalAxiosRequestConfig) {
  return {
    isIspShimRejection: true,
    message: FORCE_NOT_ALLOWED_MESSAGE,
    config,
    response: {
      status: 422,
      data: {
        success: false,
        message: FORCE_NOT_ALLOWED_MESSAGE,
        data: { code: "ISP_FORCE_NOT_ALLOWED" },
      },
    },
  };
}

export class IspForceNotAllowed extends Error {
  constructor() {
    super(FORCE_NOT_ALLOWED_MESSAGE);
  }
}

/** The rewritten path, or `null` when the path is not on the allowlist.
 * Throws `IspForceNotAllowed` for an allowlisted call ISPs may not make. */
export function rewriteIspPath(method: string, url: string): string | null {
  const verb = method.toLowerCase();
  for (const rule of ISP_SHIM_REWRITES) {
    if (rule.method !== verb) continue;
    const m = rule.pattern.exec(url);
    if (!m) continue;
    if (/[?&]force=true(&|$)/.test(url)) throw new IspForceNotAllowed();
    return rule.to(m);
  }
  return null;
}

/** Paths the partner console calls as they are (API_CONTRACT §8). */
const PASS_THROUGH_PREFIXES = ["/isp/", "/auth/", "/me/", "/routers/provisioning/check-in"];

function passesThrough(url: string): boolean {
  return url === "/me" || PASS_THROUGH_PREFIXES.some((p) => url.startsWith(p));
}

// ---------------------------------------------------------------------------
// Venue surfaces (API_CONTRACT §10)
// ---------------------------------------------------------------------------
//
// The venue workspace mounts the customer app's OWN pages (Network Zones, IP
// addresses, port forwarding, QoS, allow-list, access rules, WAN links, open
// hours) with only their `locationId` prop supplied. Those pages call the
// customer paths they always called. Every one of them is rewritten to the
// `/isp/venue/...` twin, which resolves the customer and location from the two
// headers below and calls the original handler scoped to that customer.
//
// Only an ALLOWLIST of customer prefixes is rewritten. An unmapped customer
// path keeps its current behaviour (it goes out untouched and 403s), which is
// the same fail-closed rule the six router-setup rules already follow: a page
// that starts calling something new is visibly broken rather than silently
// mis-scoped.

/** The customer-path prefixes a venue twin exists for. */
const VENUE_PREFIXES: readonly RegExp[] = [
  /^\/vlans(\/|$)/,
  /^\/dhcp-pools(\/|$)/,
  /^\/port-forwarding(\/|$)/,
  /^\/qos-rules(\/|$)/,
  /^\/mac-authorization(\/|$)/,
  /^\/guest-access(\/|$)/,
  /^\/policies(\/|$)/,
  /^\/isp\/links(\/|$)/,
  /^\/captive-portal\/resolve$/,
];

/**
 * Query keys the customer pages send under a scope-alias name. The backend twin
 * cannot expose those names (they are RBAC scope aliases -- see
 * `test_isp_partner_guards.py`), so the shim renames the key to the `isp_`-
 * prefixed twin parameter. A path parameter needs no such help: a template's
 * parameter name never appears on the wire.
 */
const VENUE_QUERY_RENAMES: Record<string, string> = {
  router_id: "isp_router_id",
  location_id: "isp_location_id",
  customer_id: "isp_customer_id",
};

function renameVenueQuery(query: string): string {
  if (!query) return "";
  const params = new URLSearchParams(query);
  const out = new URLSearchParams();
  for (const [key, value] of params) out.append(VENUE_QUERY_RENAMES[key] ?? key, value);
  const encoded = out.toString();
  return encoded ? `?${encoded}` : "";
}

/** The `/isp/venue/...` twin path, or `null` when no twin covers this path. */
export function rewriteVenuePath(url: string): string | null {
  const cut = url.indexOf("?");
  const path = cut === -1 ? url : url.slice(0, cut);
  const query = cut === -1 ? "" : url.slice(cut + 1);
  if (!VENUE_PREFIXES.some((prefix) => prefix.test(path))) return null;
  return `/isp/venue${path}${renameVenueQuery(query)}`;
}

/** The header names the backend twin resolves its target from. Kept in step
 * with `app/domains/isp_partner/twin_headers.py`. */
export const HEADER_ISP_CUSTOMER = "X-Isp-Customer-Id";
export const HEADER_ISP_LOCATION = "X-Isp-Location-Id";

let ispOrgId: string | null = null;
let venueCustomerId: string | null = null;
let venueLocationId: string | null = null;
let installedOn: AxiosInstance | null = null;

/** Called once `/isp/me` has answered. */
export function setShimIspOrganization(id: string | null): void {
  ispOrgId = id;
}

export function getShimIspOrganization(): string | null {
  return ispOrgId;
}

/**
 * Pins the venue the workspace is acting on, for as long as a venue page is
 * mounted. `null` (or a null location) clears it, which also turns the venue
 * rewrite off: with no venue named there is no customer to scope a twin to, so
 * the customer path must reach its original endpoint (and 403) rather than be
 * rewritten into a twin that cannot resolve a target.
 */
export function setShimVenue(customerId: string | null, locationId: string | null): void {
  venueCustomerId = customerId;
  venueLocationId = locationId;
}

export function getShimVenue(): { customerId: string | null; locationId: string | null } {
  return { customerId: venueCustomerId, locationId: venueLocationId };
}

function shim(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig | Promise<never> {
  const url = config.url ?? "";
  const method = (config.method ?? "get").toLowerCase();
  let rewritten: string | null;
  try {
    rewritten = rewriteIspPath(method, url);
    if (!rewritten && venueCustomerId) {
      rewritten = rewriteVenuePath(url);
    }
  } catch (err) {
    if (err instanceof IspForceNotAllowed) return Promise.reject(forceNotAllowedRejection(config));
    throw err;
  }
  if (rewritten) {
    config.url = rewritten;
  } else if (!passesThrough(url)) {
    // Not ours and not twinned: it goes out as is and will most likely 403.
    // Say so where QA will see it. The status check keeps axios's default.
    config.validateStatus = (status) => {
      if (status === 403) console.warn(`isp-shim: unmapped path ${method.toUpperCase()} ${url}`);
      return status >= 200 && status < 300;
    };
  }
  if (ispOrgId) config.headers.set?.(ORG_HEADER, ispOrgId);
  if (venueCustomerId) {
    config.headers.set?.(HEADER_ISP_CUSTOMER, venueCustomerId);
    if (venueLocationId) config.headers.set?.(HEADER_ISP_LOCATION, venueLocationId);
  }
  return config;
}

/**
 * Installs the shim on `client`, once. The caller decides whether this is
 * the network host; the layout only calls it when `isNetworkHost()` holds.
 * axios runs request interceptors last-registered-first, so this runs
 * before `api.ts`'s own, which then sees the org header already set and
 * leaves it alone.
 */
export function installIspApiShim(client: AxiosInstance): void {
  if (installedOn === client) return;
  installedOn = client;
  client.interceptors.request.use(shim);
}
