import { api } from "./api";
import type { FlowRecordBase, FlowRecordsExport, FlowRecordsPage } from "@/types/flow-records";

/**
 * Customer dashboard: a venue's connection records and their CSV download
 * (API.md, F-1c and F-2c). Read-only. The venue is the path's; the
 * organisation is the caller's and is never sent. Behind the second add-on,
 * which the backend checks on every call; every call is audited there, so
 * nothing here is called except when a person asks.
 */
const base = (locationId: string) =>
  `/traffic-flow/locations/${encodeURIComponent(locationId)}/flows`;

function headerNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function filenameOf(disposition: unknown, fallback: string): string {
  const m = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
  return m ? m[1] : fallback;
}

export type LensFlowRecords = FlowRecordsPage<FlowRecordBase>;

export const trafficLensFlowRecordsService = {
  async search(locationId: string, params: Record<string, string>): Promise<LensFlowRecords> {
    const { data } = await api.get<LensFlowRecords>(base(locationId), { params });
    return data;
  },

  async exportCsv(locationId: string, params: Record<string, string>): Promise<FlowRecordsExport> {
    const res = await api.get<Blob>(`${base(locationId)}/export`, {
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
