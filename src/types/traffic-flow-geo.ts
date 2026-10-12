/**
 * Traffic Lens Geo Location: GET /platform/traffic-flow/geo.
 * Shape: wyfy-specs/flow-visibility/API.md, "Geo Location API".
 *
 * A fourth list beside devices, destinations and services, and as
 * independent as they are: no address, and no pairing with a device or a
 * service. Sums are exact ("other" and "unknown" are explicit).
 */

export interface FlowGeoVolume {
  bytes_up: number;
  bytes_down: number;
  bytes: number;
  flows: number;
  /** 0..1. A country's is of the range total; a network's is of ITS country. */
  share: number;
}

/** A network is the autonomous system announcing the address. Never an
 * application. `network_name` null = number known, name not. */
export interface FlowGeoNetwork extends FlowGeoVolume {
  asn: number;
  network_name: string | null;
}

export interface FlowGeoCountry extends FlowGeoVolume {
  /** ISO 3166-1 alpha-2, upper case. The API sends no country name. */
  country_code: string;
  networks: {
    items: FlowGeoNetwork[];
    /** Networks below the list, plus what a window folded. */
    other_bytes: number;
    /** In this country, network not in the data. */
    unknown_bytes: number;
  } | null;
}

export interface FlowGeoAttribution {
  text: string;
  url: string;
  license?: string;
  license_url?: string;
}

export interface FlowGeoSummary {
  feature_enabled: boolean;
  /** false = no traffic window in the range at all. */
  measured: boolean;
  /** The server has the country data files NOW. */
  geo_available: boolean;
  /** At least one window in the RANGE was looked up. */
  geo_measured: boolean;
  /** Every window in the range was looked up. */
  exact: boolean;
  since: string;
  until: string;
  window_seconds: number;
  windows: number;
  windows_measured: number;
  data_oldest: string | null;
  data_newest: string | null;
  /** null unless `geo_measured`. */
  totals: { bytes_up: number; bytes_down: number; bytes: number; flows: number } | null;
  countries: { items: FlowGeoCountry[]; other_bytes: number; other_share: number } | null;
  /** Outside addresses with no country in the data. null unless `geo_measured`. */
  unknown: FlowGeoVolume | null;
  /** Must be shown, as a link, wherever this response is shown (CC BY 4.0). */
  attribution: FlowGeoAttribution | null;
  source: {
    name: string;
    country_data_built: string | null;
    network_data_built: string | null;
  } | null;
}
