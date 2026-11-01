/**
 * GAP-SWEEP: which nav items hide while their feature flag is off, and how a
 * probe's error says "off". Used by hooks/isp-partner/useNavFlags.ts.
 */
import { ispErrorCode, ispErrorStatus } from "@/lib/isp-partner/errors";

/** Nav path -> the key its probe route needs (no key = no probe = item stays). */
export const NAV_FLAG_PATHS = {
  "/partner/collections": "isp_collections.read",
  "/partner/incidents": "isp_incidents.read",
  "/partner/referrals": "isp_referrals.read",
  "/partner/pppoe": "isp_partner.read",
  "/partner/fiber": "isp_partner.read",
  // P3-SWEEP: answers 404 ISP_QUEUED_RENEWAL_DISABLED while off.
  "/partner/queued-renewals": "isp_subscribers.read",
} as const;

export type NavFlagPath = keyof typeof NAV_FLAG_PATHS;

/** The flag-off answer: a 404 with no code (PPPoE, fiber answer a bare
 * "Not Found") or a *_DISABLED code (collections, incidents, referrals).
 * A stale zone (404 ISP_ZONE_NOT_FOUND), any other 404 code, a 403, a 5xx or
 * a network error does not count, so the item stays. */
export function isFlagOff(err: unknown): boolean {
  if (ispErrorStatus(err) !== 404) return false;
  const code = ispErrorCode(err);
  return code === null || code.endsWith("_DISABLED");
}
