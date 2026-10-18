import api from "@/services/api";
import type { IpdrPage } from "@/types/ipdr";

/**
 * IPDR -- `GET /ipdr/connections` (masked) and `GET /ipdr/export.csv`
 * (unmasked), cloud-guest#423. Both are ORGANIZATION-scoped on the backend:
 * no `X-Location-Id` is sent; a location is narrowed with `location_id`.
 * `X-Organization-Id` is attached by the api interceptor.
 */
export interface IpdrExport {
  blob: Blob;
  filename: string;
}

export const ipdrService = {
  async list(params: Record<string, string>): Promise<IpdrPage> {
    const { data } = await api.get<IpdrPage>("/ipdr/connections", { params });
    return data;
  },

  /** Every audited, so only on an explicit click. Through the authenticated
   * client: a plain link would carry no token. */
  async exportCsv(params: Record<string, string>): Promise<IpdrExport> {
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
