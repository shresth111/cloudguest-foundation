/**
 * Reports / Guest Connection Records at an Aruba Instant On venue
 * (DASHBOARD_PLAN P2-N), the pure half.
 *
 * "Venue public IP" comes from a router heartbeat; an Instant On venue has
 * none, so the column was always blank -- it now says why. A session whose
 * upload AND download are both 0 has had no accounting recorded (the same
 * "not reported vs 0" rule as the Guests page, `NAS_ONLY_DATA_USAGE_UNREPORTED`),
 * so it reads "—", never a measured "0 MB". Real byte counts (Instant On does
 * send accounting interims) are kept exactly.
 *
 * Applied ONLY to rows of a NAS-only location; every other venue's rows are
 * returned untouched.
 */
export const ARUBA_PUBLIC_IP_UNREPORTED = "Not reported by Instant On";

type Row = Record<string, string | number | null>;

export function arubaGuestSessionLogRows<T extends Row>(rows: T[]): T[] {
  return rows.map((r) => {
    const out: Row = { ...r };
    if (out.publicIp == null || out.publicIp === "") out.publicIp = ARUBA_PUBLIC_IP_UNREPORTED;
    if (out.bytesUp === 0 && out.bytesDown === 0) {
      out.bytesUp = null;
      out.bytesDown = null;
    }
    return out as T;
  });
}

/**
 * Usage reports at an Aruba Instant On venue. Same rule as the session log: a
 * total of 0 means no accounting was recorded, so it reads "—", not a measured
 * 0 MB. A row with some real bytes keeps them. Other venues never call this.
 */
export const ARUBA_USAGE_REPORTS: ReadonlySet<string> = new Set([
  "data-consumption",
  "data-by-location",
  "user-data",
  "user-sessions",
  "top-users",
  "daywise-data",
]);

export function arubaUsageReportRows<T extends Row>(reportType: string, rows: T[]): T[] {
  const blank = (row: Row, zeroKey: string, keys: string[]): T => {
    if (row[zeroKey] !== 0) return row as T;
    const out: Row = { ...row };
    for (const key of keys) out[key] = null;
    return out as T;
  };
  switch (reportType) {
    case "user-data":
    case "user-sessions":
    case "top-users":
      return rows.map((r) => blank(r, "data", ["data"]));
    case "daywise-data":
      return rows.map((r) => blank(r, "totalData", ["totalData", "avgPerUser"]));
    case "data-consumption":
      return rows.map((r) => blank(r, "totalGB", ["uploadGB", "downloadGB", "totalGB", "cost"]));
    case "data-by-location":
      return rows.map((r) => blank(r, "totalData", ["totalData", "avgPerUser", "cost"]));
    default:
      return rows;
  }
}

/** The Guest Connection Records note, Aruba wording. */
export const ARUBA_CONNECTION_RECORDS_NOTE =
  "This shows session-level connection and login records, not destination-level traffic (what " +
  "site a guest visited). Private IP is the guest's address on your WiFi. Venue public IP is not " +
  "reported by Aruba Instant On access points, so that column says so. The platform does not " +
  "currently guarantee a specific data-retention period for these records.";

/** Security Score with no Wyfy-managed gateway, at an Aruba Instant On venue
 * (P2-M): nothing to connect. Never names another vendor's app. */
export const ARUBA_SECURITY_EMPTY = {
  title: "Security checks run on Wyfy-managed routers",
  description:
    "This venue has Aruba Instant On access points and no Wyfy-managed router, so there is " +
    "nothing to score here. Guest sign-in rules still apply under Usage Limits.",
};
