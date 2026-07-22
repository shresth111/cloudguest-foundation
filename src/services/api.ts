import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const REFRESH_TOKEN_STORAGE_KEY = "cloudguest_refresh_token";
export const USER_STORAGE_KEY = "cloudguest_user";

export interface AppError {
  status: number | null;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
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

export function toAppError(error: AxiosError<BackendEnvelope<unknown>>): AppError {
  const status = error.response?.status ?? null;
  const envelope = error.response?.data;
  const message = envelope?.message || error.message || "Something went wrong";

  if (status === 422) {
    return {
      status,
      code: "validation_error",
      message,
      fieldErrors: fieldErrorsFromValidation(envelope?.data),
    };
  }
  if (status === 401) {
    return { status, code: "unauthorized", message };
  }
  if (status === 403) {
    return { status, code: "forbidden", message };
  }
  if (status === null) {
    return { status, code: "network_error", message: "Unable to reach the server" };
  }
  return { status, code: slugifyMessage(message), message };
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers.set?.("Authorization", `Bearer ${token}`);
    }
  }
  return config;
});

function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

function goToSessionExpired() {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/session-expired")) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/session-expired?redirect=${redirect}`);
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post<BackendEnvelope<{ access_token: string; refresh_token: string }>>(
        `${api.defaults.baseURL}/auth/refresh`,
        { refresh_token: refreshToken },
      )
      .then((response) => {
        const tokens = response.data.data;
        window.localStorage.setItem(TOKEN_STORAGE_KEY, tokens.access_token);
        window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token);
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

    if (error.response?.status === 401 && config && !config._retried && !isRefreshCall) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        config._retried = true;
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(config);
      }
      // Demo mode: skip session expiry redirect for demo tokens
      const currentToken = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;
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
