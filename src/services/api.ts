import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";

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

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = safeLocalGet(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.set?.("Authorization", `Bearer ${token}`);
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

function goToSessionExpired() {
  if (typeof window === "undefined") return;
  if (NO_SESSION_TO_EXPIRE_PREFIXES.some((p) => window.location.pathname.startsWith(p))) return;
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
      const newToken = await refreshAccessToken();
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
