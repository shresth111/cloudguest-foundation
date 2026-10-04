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
 * THE RULE: only an Aruba Instant On (NAS-only) venue's snapshot is ever
 * refreshed or replaced here. A MikroTik or Omada snapshot is never written
 * and never causes a request, so those venues behave exactly as before.
 *  - Refreshed when the stored snapshot is NAS-only (to pick up the access
 *    points' latest activity) or is a failed read (it may be an Aruba venue
 *    we could not see).
 *  - Replaced only when the stored or the fresh verdict is NAS-only.
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
  return locationIsNasOnly(stored) || livenessIsFailedRead(stored);
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
  if (locationIsNasOnly(fresh)) return fresh;
  // The venue stopped being Aruba-only (its routers changed): the stored
  // NAS-only verdict is wrong now, so it goes.
  if (locationIsNasOnly(stored)) return fresh;
  // A failed snapshot and a fresh non-Aruba answer: left alone, exactly as
  // before this change (that venue is re-read when it is next picked).
  return null;
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
