import api from "@/services/api";
import type { NetLogPage, NetLogSummary } from "@/types/netlogs";

/**
 * Customer NetLogs -- `GET /device-logs`, `/device-logs/summary`,
 * `/device-logs/export.csv` (cloud-guest#420). Read-only.
 *
 * `X-Organization-Id` is attached by the api interceptor. `X-Location-Id` is
 * passed per call by the page: a location-scoped caller always names their
 * venue (the backend's `RequirePermission(..., scope=LOCATION)` checks the
 * venue in the request context), an organisation-wide caller sends none.
 *
 * Not to be confused with `deviceLogs.service.ts`, the Master viewer on
 * `/platform/device-logs`, which is GLOBAL-only and carries tunnel details
 * this surface must never show.
 */

function scoped(locationHeader: string | null | undefined): Record<string, string> | undefined {
  return locationHeader ? { "X-Location-Id": locationHeader } : undefined;
}

export interface NetLogsExport {
  blob: Blob;
  filename: string;
}

export const netLogsService = {
  async list(params: Record<string, string>, locationHeader: string | null): Promise<NetLogPage> {
    const { data } = await api.get<NetLogPage>("/device-logs", {
      params,
      headers: scoped(locationHeader),
    });
    return data;
  },

  async summary(
    params: Record<string, string>,
    locationHeader: string | null,
  ): Promise<NetLogSummary> {
    const { data } = await api.get<NetLogSummary>("/device-logs/summary", {
      params,
      headers: scoped(locationHeader),
    });
    return data;
  },

  /** The list's filters as a CSV, newest first, at most 100,000 rows. Goes
   * through the authenticated client (a plain link would carry no token);
   * a 409 means logging is switched off and arrives as an AppError whose
   * body the api interceptor has already decoded from the Blob. */
  async exportCsv(
    params: Record<string, string>,
    locationHeader: string | null,
  ): Promise<NetLogsExport> {
    const res = await api.get<Blob>("/device-logs/export.csv", {
      params,
      headers: scoped(locationHeader),
      responseType: "blob",
      timeout: 120_000,
    });
    const disposition = res.headers["content-disposition"];
    const named = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
    return { blob: res.data, filename: named ? named[1] : "netlogs.csv" };
  },
};
