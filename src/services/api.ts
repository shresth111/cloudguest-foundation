import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";
// Defined here rather than in AuthContext (which is where they used to
// live, and still re-exports them) so the request interceptor below can
// read them without importing AuthContext -- AuthContext imports
// auth.service.ts, which imports this module, so that would be a cycle.
export const ROLES_STORAGE_KEY = "cloudguest_roles";
export const ORGS_STORAGE_KEY = "cloudguest_organizations";
/** Which organization a multi-org member is currently acting as. There is
 * no org-picker UI yet -- this exists so that when one is built it has a
 * single place to write to, and so the value survives a reload. Ignored
 * unless it names an org the session is actually a member of. */
export const ACTIVE_ORG_STORAGE_KEY = "cg.activeOrgId";

/** Every tenant-scoped endpoint resolves its organization from this
 * header. See `attachOrganizationHeader` below for why it is a default
 * rather than something each call site remembers. */
export const ORG_HEADER = "X-Organization-Id";

/** The sentinel access token a demo session stores (see AuthContext's
 * `login`). Demo sessions never talk to the backend, so they must not
 * have a real org id attached to anything. */
const DEMO_ACCESS_TOKEN = "demo-access-token";

export interface AppError {
  status: number | null;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  /** The backend's own structured error payload (``CloudGuestError``'s
   * ``data`` field, e.g. ``{ retry_after_seconds }`` on a 429 OTP
   * rate-limit) -- passed through untouched so a caller can surface real
   * backend state (a real cooldown) instead of inventing one client-side. */
  data?: Record<string, unknown>;
}

export interface BackendEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  request_id: string;
}

function slugifyMessage(message: string): string {
  return (
    message
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "error"
  );
}

function fieldErrorsFromValidation(data: unknown): Record<string, string> | undefined {
  const errors = (data as { errors?: Array<{ loc?: unknown[]; msg?: string }> } | undefined)
    ?.errors;
  if (!Array.isArray(errors)) return undefined;
  const out: Record<string, string> = {};
  for (const err of errors) {
    const loc = Array.isArray(err.loc) ? err.loc : [];
    const field = String(loc[loc.length - 1] ?? "form");
    out[field] = err.msg ?? "Invalid value";
  }
  return out;
}

function errorData(data: unknown): Record<string, unknown> | undefined {
  return data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

export function toAppError(error: AxiosError<BackendEnvelope<unknown>>): AppError {
  const status = error.response?.status ?? null;
  const envelope = error.response?.data;
  const message = envelope?.message || error.message || "Something went wrong";
  const data = errorData(envelope?.data);

  if (status === 422) {
    return {
      status,
      code: "validation_error",
      message,
      fieldErrors: fieldErrorsFromValidation(envelope?.data),
      data,
    };
  }
  if (status === 401) {
    return { status, code: "unauthorized", message, data };
  }
  if (status === 403) {
    return { status, code: "forbidden", message, data };
  }
  if (status === null) {
    return { status, code: "network_error", message: "Unable to reach the server" };
  }
  return { status, code: slugifyMessage(message), message, data };
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

/** `api.defaults.baseURL` is relative (`/api/v1`) whenever
 * `VITE_API_BASE_URL` isn't set at build time -- fine for the browser's
 * own same-origin requests, but meaningless once copy-pasted somewhere
 * with no origin of its own to resolve against, e.g. a RouterOS
 * `/tool fetch url=...` command baked into a generated setup script
 * (RouterDetailTabs.tsx's `buildRouterSetupScript`/`buildRouterSetupScriptChunks`).
 * RouterOS has no scheme to infer there and fails outright with
 * "Mode not specified". Anything handing a base URL to a device/script
 * instead of to `api` itself should call this, not read
 * `api.defaults.baseURL` directly, so it always gets a fully-qualified
 * `https://host/api/v1`-shaped URL. */
export function getAbsoluteApiBase(): string {
  const base = api.defaults.baseURL || "/api/v1";
  if (/^https?:\/\//i.test(base)) return base;
  if (typeof window === "undefined") return base;
  return new URL(base, window.location.origin).toString().replace(/\/$/, "");
}

/**
 * `window.localStorage` access can throw, not just come back empty --
 * Apple's Captive Network Assistant (the websheet iOS opens for a WiFi
 * login) treats Web Storage like private browsing and raises a
 * SecurityError; so do storage-disabled Firefox, locked-down WebViews and
 * a full quota. The `typeof window !== "undefined"` checks around these
 * calls are SSR guards and prove nothing about the storage object itself.
 *
 * This mattered most in the request interceptor below, which runs on
 * EVERY call this app makes -- including the three the guest captive
 * portal cannot do without: the config resolve, the OTP send and the OTP
 * verify. A throw inside an axios request interceptor rejects the request
 * before it is ever sent, so on an iPhone the guest saw "Having trouble
 * connecting" and no OTP ever arrived, with no request in any log to
 * explain it. Unauthenticated guest traffic does not even need the token.
 */
function safeLocalGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing persists; the in-flight value already returned to the caller.
  }
}

function safeLocalRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing was stored, so nothing needs clearing.
  }
}

/** `JSON.parse` on a value that may be absent, truncated or from an older
 * schema. Uses safeLocalGet's already-guarded read, so this never throws
 * inside the request interceptor. */
function safeLocalGetJson<T>(key: string): T | null {
  const raw = safeLocalGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * True for a master-console operator, using the same predicate the
 * `/master` route guard, `authGuards.ts` and `roles.ts` already use:
 * a role assignment held at GLOBAL scope.
 *
 * This is the reason the org header below is a *conditional* default and
 * not an unconditional one. On the backend, the absence of
 * `X-Organization-Id` does not mean "no scope" -- it means PLATFORM-WIDE
 * scope, and a good deal of the master console depends on exactly that:
 * `master.health.tsx`, `master.audit.tsx`, `master.operators.tsx`,
 * `queue.service.ts` and
 * `router-provisioning.service.ts`'s enrollment queue all deliberately
 * send no org header so they see every organization at once. Attaching one
 * for those users would silently narrow the master console to a single
 * tenant -- a worse bug than the one this fixes. Operators already hold
 * their permissions at global scope, so they need nothing added.
 */
function hasGlobalScopeRole(): boolean {
  const roles = safeLocalGetJson<{ scopeType?: string }[]>(ROLES_STORAGE_KEY);
  return Array.isArray(roles) && roles.some((r) => r?.scopeType === "global");
}

/**
 * The organization the current session should be scoped to, read from the
 * membership list `AuthContext.persistSession` already stores at login --
 * no extra round trip, and available synchronously, which a request
 * interceptor needs.
 *
 * Multi-org members: prefer an explicitly chosen org, but only if the
 * session is still a member of it (a stale id left over from a previous
 * account would otherwise 403 every request). Otherwise fall back to the
 * first membership, which is the same organization `WorkspaceProvider`
 * already treats as active (`organizations[0]`), so the header agrees with
 * what the workspace UI is showing rather than contradicting it.
 */
export function resolveActiveOrganizationId(): string | null {
  const memberships = safeLocalGetJson<{ organizationId?: string }[]>(ORGS_STORAGE_KEY);
  if (!Array.isArray(memberships)) return null;
  const ids = memberships
    .map((m) => m?.organizationId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return null;
  const chosen = safeLocalGet(ACTIVE_ORG_STORAGE_KEY);
  return chosen && ids.includes(chosen) ? chosen : ids[0];
}

/** Records which organization a multi-org member is acting as. Nothing
 * calls this yet -- it is the write half of `resolveActiveOrganizationId`,
 * kept next to it so a future org picker does not re-invent the key. */
export function setActiveOrganizationId(organizationId: string): void {
  safeLocalSet(ACTIVE_ORG_STORAGE_KEY, organizationId);
}

/**
 * Sends `X-Organization-Id` by default for organization-scoped sessions.
 *
 * Without it the backend resolves those callers at GLOBAL scope, where an
 * org member holds nothing, so every tenant endpoint answers
 * `Permission denied: '<perm>' is required at global scope` -- verified
 * live against `/guests`, `/guest-sessions`, `/connected-devices`,
 * `/voucher-batches`, `/campaigns`, `/audit/entries` and
 * `/admin-logs/*`, each of which 403s bare and 200s with the header.
 *
 * Several services (customer, portal, vlan, port-forwarding, isp, ...)
 * already thread this header by hand on some of their calls. That
 * convention demonstrably does not hold: `/campaigns`, `/voucher-batches`
 * and `/guest-analytics/summary` in customer.service.ts were each missing
 * it and 403ing in production. A default closes the whole class instead of
 * one call at a time. Explicit still wins -- a call site that sets the
 * header (including the master console fanning out across organizations)
 * keeps whatever it set.
 */
function attachOrganizationHeader(config: InternalAxiosRequestConfig, token: string): void {
  if (token === DEMO_ACCESS_TOKEN) return;
  // Case-insensitive on AxiosHeaders, so a call site using the
  // `X-Organization-ID` spelling is still respected rather than doubled.
  if (config.headers.get?.(ORG_HEADER)) return;
  if (hasGlobalScopeRole()) return;
  const organizationId = resolveActiveOrganizationId();
  if (organizationId) config.headers.set?.(ORG_HEADER, organizationId);
}

/**
 * How long before a token's real `exp` we start treating it as already
 * spent. Covers clock skew between the browser and the API, plus the
 * flight time of a request that passes the check and then arrives after
 * expiry -- both of which would otherwise land as a 401 we could have
 * avoided.
 */
const TOKEN_STALE_SKEW_MS = 60_000;

/**
 * Reads a JWT's `exp` without pulling in `@/lib/jwt`.
 *
 * That module imports `TOKEN_STORAGE_KEY` from THIS one, so importing it
 * back here would close an ESM cycle in the module that every request goes
 * through. Duplicating ~6 lines is the cheaper trade. Same contract as
 * `decodeJwtPayload`: never throws -- a malformed or foreign token reads as
 * "no expiry information".
 */
function readTokenExpiryMs(token: string): number | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const exp = (JSON.parse(atob(base64)) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * A token with no readable `exp` returns false: we cannot reason about it,
 * so we leave it alone and let the 401 path handle it as before. Only a
 * token we can positively prove is spent gets refreshed ahead of time.
 */
function isTokenSpent(token: string): boolean {
  const expiresAt = readTokenExpiryMs(token);
  if (expiresAt === null) return false;
  return expiresAt - Date.now() <= TOKEN_STALE_SKEW_MS;
}

// `/auth/refresh` is issued with the bare `axios`, not this instance, so it
// cannot recurse through here -- but `/auth/login` does come through, and a
// login request must never wait on a refresh of the very session it is
// about to replace.
const NO_PROACTIVE_REFRESH_PATHS = ["/auth/refresh", "/auth/login"];

/**
 * Refresh BEFORE the request, not after a 401.
 *
 * The access token lives 15 minutes; refresh used to be purely reactive, so
 * the first render after any idle period fired its whole query fan-out with
 * a token already known to be spent, took a wall of parallel 401s, refreshed
 * once, and retried everything. Real logs showed 8 of 8 master-dashboard
 * visits opening with that burst -- and when the refresh itself failed, four
 * separate requests each independently bounced the user to /session-expired.
 *
 * Checking `exp` here removes the burst at its source rather than recovering
 * from it: the parallel requests all reach this interceptor, all see the same
 * spent token, and all await the SAME `refreshAccessToken()` promise, so one
 * refresh happens and every request leaves with a live token.
 *
 * If the refresh fails we deliberately fall through and send the stale token
 * anyway. The 401 handler below owns session teardown, and duplicating that
 * decision here would mean two places racing to tear down one session.
 */
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  let token = safeLocalGet(TOKEN_STORAGE_KEY);

  if (
    token &&
    token !== DEMO_ACCESS_TOKEN &&
    isTokenSpent(token) &&
    !NO_PROACTIVE_REFRESH_PATHS.some((p) => config.url?.includes(p))
  ) {
    token = (await refreshAccessToken()) ?? safeLocalGet(TOKEN_STORAGE_KEY);
  }

  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
    attachOrganizationHeader(config, token);
  }
  return config;
});

function clearSession() {
  safeLocalRemove(TOKEN_STORAGE_KEY);
  safeLocalRemove(REFRESH_TOKEN_STORAGE_KEY);
  safeLocalRemove(USER_STORAGE_KEY);
}

// Pages that already show (or lead straight to) a sign-in form with no
// session to have expired -- an unauthenticated request firing from one of
// these (a shared layout component polling something on mount regardless
// of auth state, say) is not "your session just expired", it's "you were
// never logged in yet, which this page already correctly reflects".
// Routing that through /session-expired anyway produced a live, reported
// bug: landing on /login, some background call 401s, clearSession() +
// goToSessionExpired() fires, capturing window.location.pathname (= "/login"
// itself) as the ?redirect= value, landing on
// /session-expired?redirect=%2Flogin -- whose own "Return to sign in"
// button then read that same value back out and navigated to
// /login?redirect=%2Flogin, a URL with a self-referential redirect that
// (while not an infinite loop -- nothing re-triggers it on its own)
// visibly makes no sense and was reported live as exactly that URL.
const NO_SESSION_TO_EXPIRE_PREFIXES = ["/session-expired", "/login", "/master-login"];

/**
 * One expired session is one navigation.
 *
 * `window.location.replace()` does not stop JS: the page keeps running while
 * the browser tears it down, so every other in-flight request that 401s in
 * that window calls this too. Observed live as four consecutive
 * `GET /session-expired?redirect=%2Fmaster` hits from a single expiry, three
 * of them cancelled (499) -- and the last one to win the race is the one
 * whose `?redirect=` the user actually gets back.
 */
let sessionExpiredNavigationStarted = false;

function goToSessionExpired() {
  if (typeof window === "undefined") return;
  if (sessionExpiredNavigationStarted) return;
  if (NO_SESSION_TO_EXPIRE_PREFIXES.some((p) => window.location.pathname.startsWith(p))) return;
  sessionExpiredNavigationStarted = true;
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/session-expired?redirect=${redirect}`);
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = safeLocalGet(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<BackendEnvelope<{ access_token: string; refresh_token: string }>>(
        `${api.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
      )
      .then((response) => {
        const tokens = response.data.data;
        safeLocalSet(TOKEN_STORAGE_KEY, tokens.access_token);
        safeLocalSet(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token);
        return tokens.access_token;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => {
    // Unwrap the backend's { success, message, data, request_id } envelope.
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = (response.data as BackendEnvelope<unknown>).data;
    }
    return response;
  },
  async (error: AxiosError<BackendEnvelope<unknown>>) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const isRefreshCall = config?.url?.includes("/auth/refresh");
    // A failed login attempt (wrong credentials, account doesn't exist on
    // this environment, etc.) also 401s -- without this exclusion it was
    // being treated as an expired *existing* session (clearSession +
    // redirect to /session-expired) instead of letting the login form's
    // own catch block show "invalid email or password".
    const isLoginCall = config?.url?.includes("/auth/login");

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !isRefreshCall &&
      !isLoginCall
    ) {
      // Someone else may already have refreshed while this request was in
      // flight. Refresh tokens are single-use and rotate server-side
      // (`auth/service.py` overwrites `refresh_token_jti`), so spending a
      // second one here would 401 the racer and tear down a session that is
      // in fact perfectly healthy. If storage no longer holds the token this
      // request actually sent, a newer one exists -- just use it.
      const sentToken = String(
        (config.headers as Record<string, unknown> | undefined)?.Authorization ?? "",
      ).replace(/^Bearer /, "");
      const storedToken = safeLocalGet(TOKEN_STORAGE_KEY);
      const alreadyRefreshed = Boolean(storedToken) && storedToken !== sentToken;

      const newToken = alreadyRefreshed ? storedToken : await refreshAccessToken();
      if (newToken) {
        config._retried = true;
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(config);
      }
      // Demo mode: skip session expiry redirect for demo tokens
      const currentToken = safeLocalGet(TOKEN_STORAGE_KEY);
      if (currentToken === "demo-access-token") {
        return Promise.reject(toAppError(error));
      }
      clearSession();
      goToSessionExpired();
    }

    return Promise.reject(toAppError(error));
  },
);

export default api;
