/**
 * The persisted venue snapshot (`useCustomerStore.activeLocation.liveness`)
 * and when it may be replaced -- DASHBOARD_PLAN P1-J. Pure so
 * `scripts/test-aruba-venue-snapshot.mjs` can drive every case.
 *
 * Every Aruba gate outside the dashboard reads that snapshot, and it used to
 * be written only when the owner picked a venue. A routers read that failed
 * at that moment stored "can't tell" -- and every gate then handed the venue
 * the MikroTik screens until it was picked again.
 *
 * THE RULE (owner: zero change at MikroTik/Omada, requests included): only
 * a snapshot that is ALREADY Aruba Instant On (NAS-only) is ever refreshed or
 * replaced here. A MikroTik, Omada or failed-read snapshot is never re-read
 * and never written, so those venues behave exactly as on origin/staging.
 *  - Refreshed on app load only when the stored snapshot is NAS-only.
 *  - Replaced only when the stored snapshot is NAS-only and the fresh read
 *    succeeded.
 *  - A FAILED fresh read never replaces a NAS-only snapshot: Aruba gates
 *    stay applied, never falling back to the MikroTik UI.
 */
import { locationIsNasOnly, type LocationLiveness } from "@/lib/location-liveness";

/** The routers read failed, was never made, or predates `liveness`. */
export function livenessIsFailedRead(liveness: LocationLiveness | null | undefined): boolean {
  if (!liveness) return true;
  return liveness.routersTotal === null && liveness.routers.length === 0;
}

/** Whether to read the venue's routers again on app load. */
export function venueSnapshotNeedsRefresh(stored: LocationLiveness | null | undefined): boolean {
  return locationIsNasOnly(stored);
}

/**
 * What to write into the store after a fresh read, or `null` to leave the
 * stored snapshot exactly as it is.
 */
export function reconcileVenueLiveness(
  stored: LocationLiveness | null | undefined,
  fresh: LocationLiveness | null | undefined,
): LocationLiveness | null {
  if (!fresh || livenessIsFailedRead(fresh)) return null;
  // Only an Aruba snapshot is ever replaced (by a fresh Aruba verdict, or by
  // the venue's new verdict if its routers changed). Any other snapshot --
  // MikroTik, Omada, or a failed read -- is left exactly as it is.
  return locationIsNasOnly(stored) ? fresh : null;
}

/**
 * The liveness a page should render with: the fresh read, except that a
 * failed fresh read never overrides a NAS-only snapshot. Anything else is the
 * fresh read unchanged.
 */
export function effectiveVenueLiveness<T extends LocationLiveness | null | undefined>(
  fresh: T,
  stored: LocationLiveness | null | undefined,
): T | LocationLiveness {
  if (fresh && livenessIsFailedRead(fresh) && locationIsNasOnly(stored)) {
    return stored as LocationLiveness;
  }
  return fresh;
}
