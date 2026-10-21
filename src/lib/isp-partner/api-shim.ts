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

let ispOrgId: string | null = null;
let installedOn: AxiosInstance | null = null;

/** Called once `/isp/me` has answered. */
export function setShimIspOrganization(id: string | null): void {
  ispOrgId = id;
}

export function getShimIspOrganization(): string | null {
  return ispOrgId;
}

function shim(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig | Promise<never> {
  const url = config.url ?? "";
  const method = (config.method ?? "get").toLowerCase();
  let rewritten: string | null;
  try {
    rewritten = rewriteIspPath(method, url);
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
