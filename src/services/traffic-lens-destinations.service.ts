/**
 * Customer-dashboard calls for the Traffic Lens Destinations view and the
 * drill-down from a service: one venue, read-only. Shapes: "Destinations"
 * in wyfy-specs/flow-visibility/API.md (customer routes).
 *
 * The venue is in the path and the server checks it is the caller's; the
 * organisation comes from the usual context `api` already sends. The server
 * also applies the small-venue rule (windows with fewer than five devices
 * contribute no record) and says so in `windows_withheld`.
 *
 * EVERY call here writes an audit row on the server. Nothing in this file
 * may be called on a timer, on window focus or as a retry: see
 * `useLensDestinations`.
 *
 * For the venue as a whole: no request parameter and no response field
 * names a device.
 */
import { api } from "./api";
import type {
  DestinationExport,
  DestinationSearchResult,
  ServiceDestinationsResult,
} from "@/types/traffic-flow-destinations";

const base = (locationId: string) => `/traffic-flow/locations/${encodeURIComponent(locationId)}`;

/** The shared request builder names the venue as a parameter; here the
 * venue is the path, so it is taken out of the query. */
function withoutVenue(params: Record<string, string>): Record<string, string> {
  const { location_id: _venue, ...rest } = params;
  return rest;
}

function headerNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export const trafficLensDestinationsService = {
  async search(
    locationId: string,
    params: Record<string, string>,
  ): Promise<DestinationSearchResult> {
    const { data } = await api.get<DestinationSearchResult>(`${base(locationId)}/destinations`, {
      params: withoutVenue(params),
    });
    return data;
  },

  /** The same filters as a CSV. The counts come back in response headers,
   * which a browser can read only on the page's own origin: each is `null`
   * otherwise, and the caller then says it does not know. */
  async exportCsv(locationId: string, params: Record<string, string>): Promise<DestinationExport> {
    const res = await api.get<Blob>(`${base(locationId)}/destinations/export`, {
      params: withoutVenue(params),
      responseType: "blob",
      timeout: 60000,
    });
    const total = headerNumber(res.headers["x-total-rows"]);
    const rows = headerNumber(res.headers["x-export-rows"]);
    const disposition = res.headers["content-disposition"];
    const named = typeof disposition === "string" ? /filename="([^"]+)"/.exec(disposition) : null;
    return {
      blob: res.data,
      filename: named ? named[1] : "traffic-lens-destinations.csv",
      total,
      rows,
      truncated:
        res.headers["x-export-truncated"] === "true"
          ? true
          : total !== null && rows !== null
            ? total > rows
            : null,
    };
  },

  async serviceDestinations(
    locationId: string,
    params: Record<string, string>,
  ): Promise<ServiceDestinationsResult> {
    const { data } = await api.get<ServiceDestinationsResult>(
      `${base(locationId)}/services/destinations`,
      { params: withoutVenue(params) },
    );
    return data;
  },
};
