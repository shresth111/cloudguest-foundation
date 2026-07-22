import axios, { type AxiosError } from "axios";
import { toAppError, type BackendEnvelope } from "@/services/api";

/**
 * A separate, unauthenticated client for the public guest captive-portal
 * flow. Deliberately does not share `api`'s auth request interceptor or
 * 401-refresh-retry logic -- this flow never carries an admin JWT, and
 * every endpoint it calls is genuinely no-auth on the backend.
 */
export const guestPortalApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

guestPortalApi.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      response.data = (response.data as BackendEnvelope<unknown>).data;
    }
    return response;
  },
  (error: AxiosError<BackendEnvelope<unknown>>) => Promise.reject(toAppError(error)),
);

export default guestPortalApi;
