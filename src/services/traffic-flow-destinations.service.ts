/**
 * Master console calls for the Traffic Lens Destinations table and the
 * service drill-down. GLOBAL-pinned on the backend (`traffic_flows.read`).
 * Shapes: wyfy-specs/flow-visibility/API.md, D-1 to D-3.
 *
 * EVERY call here writes an audit row on the server (who, which venue, the
 * filters, the row count). So nothing in this file may be called on a timer,
 * on window focus or as a retry: see `useFlowDestinations`.
 *
 * Venue-level: no request parameter and no response field names a device.
 */
import { api } from "./api";
import type {
  DestinationExport,
  DestinationSearchResult,
  ServiceDestinationsResult,
} from "@/types/traffic-flow-destinations";

const BASE = "/platform/traffic-flow";

function headerNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function filenameOf(disposition: unknown, fallback: string): string {
  const m = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
  return m ? m[1] : fallback;
}

export const trafficFlowDestinationsService = {
  async search(params: Record<string, string>): Promise<DestinationSearchResult> {
    const { data } = await api.get<DestinationSearchResult>(`${BASE}/destinations`, { params });
    return data;
  },

  /** The same filters as a CSV. The cap and the counts come back in
   * response headers, which a browser can read only when the API is on the
   * page's own origin: every one of them is `null` otherwise, and the
   * caller must then say it does not know rather than assume "complete". */
  async exportCsv(params: Record<string, string>): Promise<DestinationExport> {
    const res = await api.get<Blob>(`${BASE}/destinations/export`, {
      params,
      responseType: "blob",
      timeout: 60000,
    });
    const total = headerNumber(res.headers["x-total-rows"]);
    const rows = headerNumber(res.headers["x-export-rows"]);
    const flag = res.headers["x-export-truncated"];
    return {
      blob: res.data,
      filename: filenameOf(res.headers["content-disposition"], "traffic-lens-destinations.csv"),
      total,
      rows,
      truncated: flag === "true" ? true : total !== null && rows !== null ? total > rows : null,
    };
  },

  async serviceDestinations(params: Record<string, string>): Promise<ServiceDestinationsResult> {
    const { data } = await api.get<ServiceDestinationsResult>(`${BASE}/services/destinations`, {
      params,
    });
    return data;
  },
};
