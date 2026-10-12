/**
 * Traffic Lens Geo Location: wording and arithmetic, pure, so a script can
 * test it (scripts/test-traffic-flow-geo.mjs).
 *
 * Rules this file keeps:
 *
 *  1. Four different answers are never confused: no traffic was measured;
 *     traffic was measured but the server has no country data; traffic was
 *     measured before country data existed; and looked up with a real
 *     result (which may be a real zero). Only the last shows numbers.
 *  2. An AS name is a NETWORK. Nothing here calls it anything else.
 *  3. The data's licence (CC BY 4.0) requires a link back to its publisher
 *     wherever results are shown, so the attribution is never empty: if the
 *     response's is unusable the built-in one is used.
 *  4. "Other" and "unknown" are their own rows, so the shares add up.
 */
import { flowBytes, shareBarWidth, shareLabel } from "@/lib/traffic-flow";
import type { FlowGeoCountry, FlowGeoSummary } from "@/types/traffic-flow-geo";

export const GEO_BLOCK_TITLE = "Where traffic goes";
export const GEO_NETWORK_HEADING = "Network";

export const GEO_BLOCK_NOTE =
  "By the country of the outside address, and inside each country by network. A network is whoever announces the address on the internet (an internet provider, a cloud, a content network). It is not an application and not a site: video served from a cache inside an internet provider shows under that provider. Independent of the devices, destinations and services lists.";

export const GEO_ESTIMATE_NOTE =
  "The country is an estimate from the address. For a large shared network it is where the network is registered or one of its sites, which is not always where the traffic was served from.";

/** Used only when the response carries no usable attribution. */
export const GEO_DEFAULT_ATTRIBUTION = {
  text: "IP Geolocation by DB-IP",
  url: "https://db-ip.com",
} as const;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

let regionNames: Intl.DisplayNames | null | undefined;

/** English country name for an ISO code, from the browser's own data. The
 * code itself when the browser does not know it; never a guess. */
export function countryName(code: string | null | undefined): string {
  const text = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(text)) return text || "—";
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    const name = regionNames?.of(text);
    return name && name !== text ? name : text;
  } catch {
    return text;
  }
}

/** "AS55836". The number is shown beside the name so two networks with the
 * same name stay apart. */
export function asnLabel(asn: number | null | undefined): string {
  return isNum(asn) && asn > 0 ? `AS${Math.trunc(asn)}` : "—";
}

/** The network's name, or its AS number when the data has no name. */
export function networkLabel(asn: number | null | undefined, name: string | null | undefined) {
  const text = typeof name === "string" ? name.trim() : "";
  return text || asnLabel(asn);
}

export type GeoStateKind =
  | "feature_off"
  | "not_measured"
  | "geo_unavailable"
  | "not_recorded"
  | "ok";

export interface GeoState {
  kind: GeoStateKind;
  /** Empty for "ok". */
  title: string;
  body: string;
}

/** Which of the four answers this response is. Only "ok" may show numbers. */
export function geoState(geo: FlowGeoSummary | null | undefined): GeoState {
  if (geo && geo.feature_enabled === false)
    return {
      kind: "feature_off",
      title: "Switched off on this platform.",
      body: "Nothing is collected, so nothing was looked up.",
    };
  if (!geo || geo.measured !== true)
    return {
      kind: "not_measured",
      title: "Not measured for this period.",
      body: "No traffic records exist for this range, so there is nothing to place in a country. That is not the same as no traffic.",
    };
  if (geo.geo_measured !== true || !geo.totals) {
    if (geo.geo_available === true)
      return {
        kind: "not_recorded",
        title: "Country was not recorded for this period.",
        body: "Traffic in this range was recorded before country data was installed on the server. Newer traffic is being looked up.",
      };
    return {
      kind: "geo_unavailable",
      title: "Country data is not available on this server.",
      body: "Traffic was measured, but the country and network data files are not installed, so nothing was looked up and no country is guessed. That is not the same as no traffic.",
    };
  }
  return { kind: "ok", title: "", body: "" };
}

export interface GeoNetworkRow {
  key: string;
  name: string;
  asn: string;
  bytes: string;
  down: string;
  up: string;
  /** Share of its country. */
  share: string;
  barWidth: number;
}

export interface GeoCountryRow {
  key: string;
  code: string;
  name: string;
  bytes: string;
  down: string;
  up: string;
  share: string;
  barWidth: number;
  networks: GeoNetworkRow[];
  /** "12.4 MB" in networks not listed; null when none. */
  networksOther: string | null;
  /** "3.1 MB" whose network is not in the data; null when none. */
  networksUnknown: string | null;
  expandable: boolean;
}

export interface GeoTailRow {
  key: "other" | "unknown";
  label: string;
  hint: string;
  bytes: string;
  share: string;
  barWidth: number;
}

function countryRow(item: FlowGeoCountry): GeoCountryRow {
  const networks = (item.networks?.items ?? []).map((n) => ({
    key: `${item.country_code}-${n.asn}`,
    name: networkLabel(n.asn, n.network_name),
    asn: asnLabel(n.asn),
    bytes: flowBytes(n.bytes),
    down: flowBytes(n.bytes_down),
    up: flowBytes(n.bytes_up),
    share: shareLabel(n.share),
    barWidth: shareBarWidth(n.share),
  }));
  const other = item.networks?.other_bytes;
  const unknown = item.networks?.unknown_bytes;
  const networksOther = isNum(other) && other > 0 ? flowBytes(other) : null;
  const networksUnknown = isNum(unknown) && unknown > 0 ? flowBytes(unknown) : null;
  return {
    key: item.country_code,
    code: item.country_code,
    name: countryName(item.country_code),
    bytes: flowBytes(item.bytes),
    down: flowBytes(item.bytes_down),
    up: flowBytes(item.bytes_up),
    share: shareLabel(item.share),
    barWidth: shareBarWidth(item.share),
    networks,
    networksOther,
    networksUnknown,
    expandable: networks.length > 0 || !!networksOther || !!networksUnknown,
  };
}

/** The listed countries, largest first as the API sent them. Empty unless
 * the state is "ok". */
export function geoCountryRows(geo: FlowGeoSummary | null | undefined): GeoCountryRow[] {
  if (geoState(geo).kind !== "ok") return [];
  return (geo?.countries?.items ?? []).map(countryRow);
}

/** "Other countries" and "Country not known": their own rows, never folded
 * into a listed country, so the shares add up. A row is left out only when
 * it is a true zero. */
export function geoTailRows(geo: FlowGeoSummary | null | undefined): GeoTailRow[] {
  if (geoState(geo).kind !== "ok" || !geo) return [];
  const rows: GeoTailRow[] = [];
  const other = geo.countries?.other_bytes;
  if (isNum(other) && other > 0)
    rows.push({
      key: "other",
      label: "Other countries",
      hint: "Countries below this list, added together.",
      bytes: flowBytes(other),
      share: shareLabel(geo.countries?.other_share),
      barWidth: shareBarWidth(geo.countries?.other_share),
    });
  const unknown = geo.unknown;
  if (unknown && isNum(unknown.bytes) && unknown.bytes > 0)
    rows.push({
      key: "unknown",
      label: "Country not known",
      hint: "Outside addresses the country data has no entry for. Not guessed.",
      bytes: flowBytes(unknown.bytes),
      share: shareLabel(unknown.share),
      barWidth: shareBarWidth(unknown.share),
    });
  return rows;
}

/** True when the range was looked up and really had no outside traffic. */
export function geoMeasuredEmpty(geo: FlowGeoSummary | null | undefined): boolean {
  return geoState(geo).kind === "ok" && geo?.totals?.bytes === 0;
}

/** Said when only part of the range was looked up; null when all of it was. */
export function geoCoverageNote(geo: FlowGeoSummary | null | undefined): string | null {
  if (geoState(geo).kind !== "ok" || !geo || geo.exact === true) return null;
  if (!isNum(geo.windows) || !isNum(geo.windows_measured)) return null;
  return `Covers ${geo.windows_measured} of ${geo.windows} five-minute periods in this range. The rest were recorded without country data and are not in these figures.`;
}

/** Said when stored results are shown but the server can no longer look
 * new traffic up. */
export function geoStaleNote(geo: FlowGeoSummary | null | undefined): string | null {
  if (geoState(geo).kind !== "ok" || geo?.geo_available !== false) return null;
  return "Country data is no longer available on this server. These figures were looked up when the traffic was recorded; traffic arriving now is not being looked up.";
}

/** The link the licence requires. Never empty, and only ever an https link:
 * a response is data, and data does not get to choose a script URL. */
export function geoAttribution(geo: FlowGeoSummary | null | undefined): {
  text: string;
  url: string;
} {
  const text = typeof geo?.attribution?.text === "string" ? geo.attribution.text.trim() : "";
  const url = typeof geo?.attribution?.url === "string" ? geo.attribution.url.trim() : "";
  if (text && /^https:\/\/[a-z0-9.-]+(\/[^\s"'<>]*)?$/i.test(url)) return { text, url };
  return { ...GEO_DEFAULT_ATTRIBUTION };
}

/** "Country data from 1 Oct 2026." -- null when the server has none loaded. */
export function geoDataDateNote(geo: FlowGeoSummary | null | undefined): string | null {
  const built = geo?.source?.country_data_built;
  if (typeof built !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(built)) return null;
  const date = new Date(`${built}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Country data from ${label}.`;
}
