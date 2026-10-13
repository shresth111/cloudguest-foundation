import { api } from "./api";
import type { FlowRecordsExport, FlowRecordsResult } from "@/types/traffic-flow-records";

/**
 * Master flow table: GET /platform/traffic-flow/flows and its CSV export
 * (API.md F-1, F-2). Read-only, GLOBAL-pinned on the backend, and every call
 * writes an audit row, so nothing here is called except when a person asks.
 */
const BASE = "/platform/traffic-flow";

function headerNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function filenameOf(disposition: unknown, fallback: string): string {
  const m = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
  return m ? m[1] : fallback;
}

export const trafficFlowRecordsService = {
  async search(params: Record<string, string>): Promise<FlowRecordsResult> {
    const { data } = await api.get<FlowRecordsResult>(`${BASE}/flows`, { params });
    return data;
  },

  async exportCsv(params: Record<string, string>): Promise<FlowRecordsExport> {
    const res = await api.get<Blob>(`${BASE}/flows/export`, {
      params,
      responseType: "blob",
      timeout: 60000,
    });
    const total = headerNumber(res.headers["x-total-rows"]);
    const rows = headerNumber(res.headers["x-export-rows"]);
    const flag = res.headers["x-export-truncated"];
    const since = res.headers["x-records-incomplete-since"];
    return {
      blob: res.data,
      filename: filenameOf(res.headers["content-disposition"], "traffic-lens-flows.csv"),
      total,
      rows,
      truncated: flag === "true" ? true : total !== null && rows !== null ? total > rows : null,
      incompleteSince: typeof since === "string" && since.trim() !== "" ? since.trim() : null,
    };
  },
};
