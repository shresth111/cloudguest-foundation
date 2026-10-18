import type { IpdrCoverageDay, IpdrItem } from "@/types/ipdr";

/**
 * NetLogs -> "Connections (IPDR)": pure helpers. See
 * `components/netlogs/IpdrConnections.tsx` and cloud-guest#423.
 *
 * Permission split (backend `app/domains/ipdr`, both ORGANIZATION-scoped,
 * Organization Owner / Admin only):
 *   - `ipdr.read`   -> the tab and its masked table;
 *   - `ipdr.export` -> the unmasked CSV download.
 */
export const IPDR_READ = "ipdr.read";
export const IPDR_EXPORT = "ipdr.export";

/** The CSV's 18 columns, in the backend's exact order; the table shows the
 * same ones, in the same order. */
export const IPDR_TABLE_COLUMNS: readonly { key: keyof IpdrItem; label: string }[] = [
  { key: "time_stamp_ist", label: "Time Stamp (IST)" },
  { key: "name", label: "Name of Person/Organization" },
  { key: "contact_no", label: "Contact No." },
  { key: "alternate_contact_no", label: "Alternate Contact No." },
  { key: "email", label: "E-mail Address" },
  { key: "user_id", label: "User ID for Internet Access" },
  { key: "source_ip", label: "Source IP Address" },
  { key: "source_port", label: "Source Port" },
  { key: "translated_ip", label: "Translated IP Address" },
  { key: "translated_port", label: "Translated Port" },
  { key: "allocation", label: "Static/Dynamic IP Address Allocation" },
  { key: "destination_ip", label: "Destination IP Address" },
  { key: "destination_port", label: "Destination Port" },
  { key: "protocol", label: "Protocol" },
  { key: "allocation_start_ist", label: "IST Start Time & Date of IP Allocation" },
  { key: "allocation_end_ist", label: "IST End Time & Date of IP Allocation" },
  { key: "total_online_time", label: "Total Online Time" },
  { key: "mac", label: "Source MAC Address/IMEI/Device ID" },
];

export const IPDR_PAGE_SIZE = 100;
export const IPDR_EXPORT_MAX_ROWS = 1_000_000;

/** Searches kept in component state, never in the URL: a phone number in a
 * URL ends up in browser history and access logs. */
export interface IpdrSearch {
  phone: string;
  userId: string;
  mac: string;
  ip: string;
}

export const EMPTY_IPDR_SEARCH: IpdrSearch = { phone: "", userId: "", mac: "", ip: "" };

export function hasIpdrPermission(permissions: unknown, key: string): boolean {
  // Fail CLOSED (unlike the sidebar): law-enforcement data is only offered
  // once the grant list has actually arrived and names the key.
  return Array.isArray(permissions) && permissions.includes(key);
}

export function ipdrParams(
  window: { since: Date; until: Date },
  locationId: string | null,
  routerId: string,
  search: IpdrSearch,
): Record<string, string> {
  const params: Record<string, string> = {
    since: window.since.toISOString(),
    until: window.until.toISOString(),
  };
  if (locationId) params.location_id = locationId;
  if (routerId) params.router_id = routerId;
  const phone = search.phone.trim();
  const userId = search.userId.trim();
  const mac = search.mac.trim();
  const ip = search.ip.trim();
  if (phone) params.phone = phone.slice(0, 32);
  if (userId) params.user_id = userId.slice(0, 255);
  if (mac) params.mac = mac.slice(0, 32);
  if (ip) params.ip = ip.slice(0, 64);
  return params;
}

export function ipdrListParams(
  base: Record<string, string>,
  cursor: string | null | undefined,
): Record<string, string> {
  const params: Record<string, string> = { ...base, limit: String(IPDR_PAGE_SIZE) };
  if (cursor) params.cursor = cursor;
  return params;
}

export const TRANSLATED_SOURCE_LABEL: Record<string, string> = {
  nat_event: "Reported by the router",
  derived: "Derived: router's public IP and the same port",
  ambiguous: "Derived, ambiguous: another device may have used this port",
  none: "Not known: the router has no public IP on record",
};

export function translatedSourceLabel(source: string | null | undefined): string {
  return TRANSLATED_SOURCE_LABEL[source ?? "none"] ?? TRANSLATED_SOURCE_LABEL.none;
}

/** One sentence about gaps in the days the page has looked at, or null. */
export function coverageNote(days: IpdrCoverageDay[]): string | null {
  const missing = days.filter((d) => d.status === "missing").length;
  const incomplete = days.filter((d) => d.records_incomplete).length;
  const unreadable = days.reduce((n, d) => n + (d.unreadable || 0), 0);
  const parts: string[] = [];
  if (missing)
    parts.push(
      `${missing} day${missing === 1 ? " has" : "s have"} no connection records (not collected, or older than what was archived)`,
    );
  if (incomplete)
    parts.push(
      `${incomplete} day${incomplete === 1 ? " is" : "s are"} incomplete (a router hit its daily record limit)`,
    );
  if (unreadable)
    parts.push(`${unreadable} archived file${unreadable === 1 ? "" : "s"} could not be read`);
  return parts.length ? `${parts.join("; ")}.` : null;
}

export interface IpdrErrorLike {
  status?: number | null;
  data?: { code?: unknown } | null;
}

export function ipdrErrorMessage(error: IpdrErrorLike | null | undefined): {
  title: string;
  detail: string;
} {
  const code = typeof error?.data?.code === "string" ? error.data.code : "";
  switch (code) {
    case "IPDR_RANGE_TOO_LONG":
      return { title: "That range is too long", detail: "Pick at most 2 years at a time." };
    case "IPDR_LOCATION_NOT_FOUND":
      return {
        title: "That location isn't in your account",
        detail: "Pick another location to see its connections.",
      };
    case "IPDR_ROUTER_NOT_FOUND":
      return {
        title: "That router isn't in your account",
        detail: "Pick another router, or show all routers.",
      };
    case "IPDR_BAD_FILTER":
      return {
        title: "Check the search fields",
        detail: "A phone number, MAC address or IP address wasn't in a format we recognise.",
      };
    case "IPDR_BAD_CURSOR":
      return { title: "The list moved on", detail: "Refresh to start from the newest rows." };
    default:
      break;
  }
  if (error?.status === 403)
    return {
      title: "You don't have access to connection records",
      detail: "Only the account owner or an admin can view or export IPDR. Ask your account owner.",
    };
  return { title: "Couldn't load connection records", detail: "Something went wrong. Try again." };
}
