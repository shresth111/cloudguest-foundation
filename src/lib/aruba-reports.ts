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

/** The Guest Connection Records note, Aruba wording. */
export const ARUBA_CONNECTION_RECORDS_NOTE =
  "This shows session-level connection and login records, not destination-level traffic (what " +
  "site a guest visited). Private IP is the guest's address on your WiFi. Venue public IP is not " +
  "reported by Aruba Instant On access points, so that column says so. The platform does not " +
  "currently guarantee a specific data-retention period for these records.";

/** Security Score with no Wyfy-managed gateway, at an Aruba Instant On venue
 * (P2-M): nothing to connect -- the access points are managed in their app. */
export const ARUBA_SECURITY_EMPTY = {
  title: "Security checks run on Wyfy-managed routers",
  description:
    "Your Aruba Instant On access points are managed in the Instant On app, so there is " +
    "nothing to score here. Guest sign-in rules still apply under Access Rules.",
};
