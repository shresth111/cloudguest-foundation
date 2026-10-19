import api from "@/services/api";
import { isDemoSession } from "@/lib/demo-host";
import { IPDR_TABLE_COLUMNS } from "@/lib/ipdr";
import { demoCsvFilename, demoIpdrCsv, demoIpdrPage } from "@/lib/netlogs-demo";
import type { IpdrPage } from "@/types/ipdr";

/**
 * IPDR -- `GET /ipdr/connections` (masked) and `GET /ipdr/export.csv`
 * (unmasked), cloud-guest#423. Both are ORGANIZATION-scoped on the backend:
 * no `X-Location-Id` is sent; a location is narrowed with `location_id`.
 * `X-Organization-Id` is attached by the api interceptor.
 *
 * On the demo host both are answered from `lib/netlogs-demo.ts` fixtures
 * (the CSV carries the fixtures' full fake phones); nothing reaches the
 * backend.
 */
export interface IpdrExport {
  blob: Blob;
  filename: string;
}

export const ipdrService = {
  async list(params: Record<string, string>): Promise<IpdrPage> {
    if (isDemoSession()) return demoIpdrPage(params);
    const { data } = await api.get<IpdrPage>("/ipdr/connections", { params });
    return data;
  },

  /** Every audited, so only on an explicit click. Through the authenticated
   * client: a plain link would carry no token. */
  async exportCsv(params: Record<string, string>): Promise<IpdrExport> {
    if (isDemoSession()) {
      const header = IPDR_TABLE_COLUMNS.map((c) => c.label);
      return {
        blob: new Blob([demoIpdrCsv(params, header)], { type: "text/csv;charset=utf-8" }),
        filename: demoCsvFilename("ipdr"),
      };
    }
    const res = await api.get<Blob>("/ipdr/export.csv", {
      params,
      responseType: "blob",
      timeout: 600_000,
    });
    const disposition = res.headers["content-disposition"];
    const named = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
    return { blob: res.data, filename: named ? named[1] : "ipdr.csv" };
  },
};
