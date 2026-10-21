/**
 * ISP partner API (API_CONTRACT §4). One function per endpoint.
 *
 * Every call goes through the shared `api` client, whose interceptor (plus
 * the partner shim, `lib/isp-partner/api-shim.ts`) attaches
 * `X-Organization-Id: <the ISP org>`. Nothing here ever sends a location or
 * router header: `/isp/*` refuses them with 400.
 *
 * Path ids are the contract's `isp_*` names on purpose -- see API_CONTRACT §0.
 */
import api from "@/services/api";
import type {
  CaptivePortalConfig,
  CaptivePortalConfigList,
  CaptivePortalConfigUpdate,
  IspAuthLogPage,
  IspCustomer,
  IspCustomerCreate,
  IspCustomerListQuery,
  IspCustomerUpdate,
  IspGuest,
  IspGuestQuery,
  IspIpdrPage,
  IspLocation,
  IspLocationCreate,
  IspLocationListQuery,
  IspLocationUpdate,
  IspLogScope,
  IspMe,
  IspNetLogPage,
  IspNetLogSummary,
  IspOverview,
  IspPage,
  IspReportQuery,
  IspReportSection,
  IspReportSummary,
  IspRole,
  IspRouter,
  IspRouterAsDevice,
  IspRouterCreate,
  IspRouterListQuery,
  IspRouterUpdate,
  IspSession,
  IspSessionQuery,
  IspUser,
  IspUserCreate,
  IspUserCreated,
  IspUserListQuery,
  IspUserUpdate,
} from "@/services/isp-partner/types";

/** Drops empty values so the backend sees only what was chosen. */
export function cleanParams(params: object): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

export interface FileDownload {
  blob: Blob;
  filename: string;
}

/** Filename from `Content-Disposition`, else `fallback`. */
export function filenameFromDisposition(header: unknown, fallback: string): string {
  if (typeof header !== "string") return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : fallback;
}

/** A file endpoint, fetched with the session's headers (a plain link would
 * carry no token). Error bodies are decoded from the Blob by `api.ts`. */
export async function downloadFile(
  url: string,
  params: Record<string, string>,
  fallbackName: string,
): Promise<FileDownload> {
  const res = await api.get<Blob>(url, { params, responseType: "blob", timeout: 180_000 });
  return {
    blob: res.data,
    filename: filenameFromDisposition(res.headers["content-disposition"], fallbackName),
  };
}

export const ispService = {
  // §4.1 ---------------------------------------------------------------
  async me(): Promise<IspMe> {
    const { data } = await api.get<IspMe>("/isp/me");
    return data;
  },

  // §4.2 ---------------------------------------------------------------
  async overview(): Promise<IspOverview> {
    const { data } = await api.get<IspOverview>("/isp/overview");
    return data;
  },

  // §4.3 ---------------------------------------------------------------
  async listCustomers(q: IspCustomerListQuery): Promise<IspPage<IspCustomer>> {
    const { data } = await api.get<IspPage<IspCustomer>>("/isp/customers", {
      params: cleanParams(q),
    });
    return data;
  },
  async getCustomer(ispCustomerId: string): Promise<IspCustomer> {
    const { data } = await api.get<IspCustomer>(`/isp/customers/${ispCustomerId}`);
    return data;
  },
  async createCustomer(body: IspCustomerCreate): Promise<IspCustomer> {
    const { data } = await api.post<IspCustomer>("/isp/customers", body);
    return data;
  },
  async updateCustomer(ispCustomerId: string, body: IspCustomerUpdate): Promise<IspCustomer> {
    const { data } = await api.patch<IspCustomer>(`/isp/customers/${ispCustomerId}`, body);
    return data;
  },
  async suspendCustomer(ispCustomerId: string, reason: string): Promise<IspCustomer> {
    const { data } = await api.post<IspCustomer>(`/isp/customers/${ispCustomerId}/suspend`, {
      reason,
    });
    return data;
  },
  async activateCustomer(ispCustomerId: string): Promise<IspCustomer> {
    const { data } = await api.post<IspCustomer>(`/isp/customers/${ispCustomerId}/activate`);
    return data;
  },

  // §4.4 ---------------------------------------------------------------
  async listCustomerLocations(ispCustomerId: string): Promise<IspPage<IspLocation>> {
    const { data } = await api.get<IspPage<IspLocation>>(
      `/isp/customers/${ispCustomerId}/locations`,
    );
    return data;
  },
  async listLocations(q: IspLocationListQuery): Promise<IspPage<IspLocation>> {
    const { data } = await api.get<IspPage<IspLocation>>("/isp/locations", {
      params: cleanParams(q),
    });
    return data;
  },
  async getLocation(ispLocationId: string): Promise<IspLocation> {
    const { data } = await api.get<IspLocation>(`/isp/locations/${ispLocationId}`);
    return data;
  },
  async createLocation(ispCustomerId: string, body: IspLocationCreate): Promise<IspLocation> {
    const { data } = await api.post<IspLocation>(
      `/isp/customers/${ispCustomerId}/locations`,
      body,
    );
    return data;
  },
  async updateLocation(ispLocationId: string, body: IspLocationUpdate): Promise<IspLocation> {
    const { data } = await api.patch<IspLocation>(`/isp/locations/${ispLocationId}`, body);
    return data;
  },
  async suspendLocation(ispLocationId: string): Promise<IspLocation> {
    const { data } = await api.post<IspLocation>(`/isp/locations/${ispLocationId}/suspend`);
    return data;
  },
  async activateLocation(ispLocationId: string): Promise<IspLocation> {
    const { data } = await api.post<IspLocation>(`/isp/locations/${ispLocationId}/activate`);
    return data;
  },

  // §4.5 ---------------------------------------------------------------
  async listRouters(q: IspRouterListQuery): Promise<IspPage<IspRouter>> {
    const { data } = await api.get<IspPage<IspRouter>>("/isp/routers", {
      params: cleanParams(q),
    });
    return data;
  },
  async getRouter(ispRouterId: string): Promise<IspRouter> {
    const { data } = await api.get<IspRouter>(`/isp/routers/${ispRouterId}`);
    return data;
  },
  async createRouter(ispLocationId: string, body: IspRouterCreate): Promise<IspRouter> {
    const { data } = await api.post<IspRouter>(`/isp/locations/${ispLocationId}/routers`, body);
    return data;
  },
  async updateRouter(ispRouterId: string, body: IspRouterUpdate): Promise<IspRouter> {
    const { data } = await api.patch<IspRouter>(`/isp/routers/${ispRouterId}`, body);
    return data;
  },
  async getRouterAsDevice(ispRouterId: string): Promise<IspRouterAsDevice> {
    const { data } = await api.get<IspRouterAsDevice>(
      `/isp/routers/${ispRouterId}/as-router-device`,
    );
    return data;
  },

  // §4.7 ---------------------------------------------------------------
  async listPortalConfigs(ispLocationId: string): Promise<CaptivePortalConfigList> {
    const { data } = await api.get<CaptivePortalConfigList>(
      `/isp/locations/${ispLocationId}/captive-portal-configs`,
    );
    return data;
  },
  async getPortalConfig(configId: string): Promise<CaptivePortalConfig> {
    const { data } = await api.get<CaptivePortalConfig>(`/isp/captive-portal-configs/${configId}`);
    return data;
  },
  async updatePortalConfig(
    configId: string,
    body: CaptivePortalConfigUpdate,
  ): Promise<CaptivePortalConfig> {
    const { data } = await api.put<CaptivePortalConfig>(
      `/isp/captive-portal-configs/${configId}`,
      body,
    );
    return data;
  },
  async activatePortalConfig(configId: string): Promise<CaptivePortalConfig> {
    const { data } = await api.post<CaptivePortalConfig>(
      `/isp/captive-portal-configs/${configId}/activate`,
    );
    return data;
  },
  /** Multipart, as the existing content-image upload. Returns the config. */
  async uploadPortalContentImage(configId: string, file: File): Promise<CaptivePortalConfig> {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<CaptivePortalConfig>(
      `/isp/captive-portal-configs/${configId}/content-image`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  // §4.8 ---------------------------------------------------------------
  async listGuests(ispCustomerId: string, q: IspGuestQuery): Promise<IspPage<IspGuest>> {
    const { data } = await api.get<IspPage<IspGuest>>(`/isp/customers/${ispCustomerId}/guests`, {
      params: cleanParams(q),
    });
    return data;
  },
  async listSessions(ispCustomerId: string, q: IspSessionQuery): Promise<IspPage<IspSession>> {
    const { data } = await api.get<IspPage<IspSession>>(
      `/isp/customers/${ispCustomerId}/sessions`,
      { params: cleanParams(q) },
    );
    return data;
  },

  // §4.9 ---------------------------------------------------------------
  async netLogs(params: Record<string, string>): Promise<IspNetLogPage> {
    const { data } = await api.get<IspNetLogPage>("/isp/logs/netlogs", { params });
    return data;
  },
  async netLogsSummary(params: Record<string, string>): Promise<IspNetLogSummary> {
    const { data } = await api.get<IspNetLogSummary>("/isp/logs/netlogs/summary", { params });
    return data;
  },
  exportNetLogs(params: Record<string, string>): Promise<FileDownload> {
    return downloadFile("/isp/logs/netlogs/export.csv", params, "isp-netlogs.csv");
  },
  async ipdrConnections(params: Record<string, string>): Promise<IspIpdrPage> {
    const { data } = await api.get<IspIpdrPage>("/isp/logs/ipdr/connections", { params });
    return data;
  },
  exportIpdr(params: Record<string, string>): Promise<FileDownload> {
    return downloadFile("/isp/logs/ipdr/export.csv", params, "isp-ipdr.csv");
  },
  async authLogs(scope: IspLogScope & { page?: number; page_size?: number }): Promise<IspAuthLogPage> {
    const { data } = await api.get<IspAuthLogPage>("/isp/logs/auth", {
      params: cleanParams(scope),
    });
    return data;
  },

  // §4.10 --------------------------------------------------------------
  async reportSummary(q: IspReportQuery): Promise<IspReportSummary> {
    const { data } = await api.get<IspReportSummary>("/isp/reports/summary", {
      params: cleanParams(q),
    });
    return data;
  },
  exportReport(
    format: "csv" | "pdf",
    section: IspReportSection,
    q: IspReportQuery,
  ): Promise<FileDownload> {
    return downloadFile(
      "/isp/reports/export",
      cleanParams({ format, section, ...q }),
      `isp-report-${section}.${format}`,
    );
  },

  // §4.11 --------------------------------------------------------------
  async listUsers(q: IspUserListQuery): Promise<IspPage<IspUser>> {
    const { data } = await api.get<IspPage<IspUser>>("/isp/users", { params: cleanParams(q) });
    return data;
  },
  async getUser(ispUserId: string): Promise<IspUser> {
    const { data } = await api.get<IspUser>(`/isp/users/${ispUserId}`);
    return data;
  },
  async createUser(body: IspUserCreate): Promise<IspUserCreated> {
    const { data } = await api.post<IspUserCreated>("/isp/users", body);
    return data;
  },
  async updateUser(ispUserId: string, body: IspUserUpdate): Promise<IspUser> {
    const { data } = await api.patch<IspUser>(`/isp/users/${ispUserId}`, body);
    return data;
  },
  async setUserCustomerScope(ispUserId: string, customerIds: string[] | null): Promise<IspUser> {
    const { data } = await api.put<IspUser>(`/isp/users/${ispUserId}/customer-scope`, {
      customer_ids: customerIds,
    });
    return data;
  },
  async disableUser(ispUserId: string): Promise<IspUser> {
    const { data } = await api.post<IspUser>(`/isp/users/${ispUserId}/disable`);
    return data;
  },
  async enableUser(ispUserId: string): Promise<IspUser> {
    const { data } = await api.post<IspUser>(`/isp/users/${ispUserId}/enable`);
    return data;
  },
  async resetUserPassword(ispUserId: string): Promise<{ temporary_password: string }> {
    const { data } = await api.post<{ temporary_password: string }>(
      `/isp/users/${ispUserId}/reset-password`,
    );
    return data;
  },
  async forceLogoutUser(ispUserId: string): Promise<void> {
    await api.post(`/isp/users/${ispUserId}/force-logout`);
  },
  /** Accepts a bare array or `{ items }`; the contract does not pin it. */
  async listRoles(): Promise<IspRole[]> {
    const { data } = await api.get<IspRole[] | { items: IspRole[] }>("/isp/roles");
    return Array.isArray(data) ? data : (data?.items ?? []);
  },
};
