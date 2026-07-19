import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const USER_STORAGE_KEY = "cloudguest_user";

export const api = axios.create({
  baseURL: "/api",
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

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      if (!window.location.pathname.startsWith("/session-expired")) {
        window.location.replace("/session-expired");
      }
    }
    return Promise.reject(error);
  },
);

export default api;
