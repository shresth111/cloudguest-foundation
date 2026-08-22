/**
 * Pure decision logic for the fleet wizard's Discovery pre-flight.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * Both of the functions here are load-bearing safety guards, and both sit
 * on paths that are otherwise hard to test: one lives inside a service
 * module that pulls in axios, the other inside a large React component.
 * Extracting them keeps them dependency-free so `npm run
 * test:discovery-preflight` can exercise them directly, and so a
 * regression in either shows up as a named failing check rather than as a
 * button that quietly goes green again.
 *
 * The defect that motivated them (2026-08-22): the wizard offered a
 * Discover button for a router whose preconditions could not possibly be
 * met, then surfaced `Could not connect to device at '10.20.0.64' for
 * discovery: timed out` -- a message naming an IP and a symptom but none
 * of the four independent things that must be true first.
 */

import type { DiscoveryPreconditionStatus, DiscoveryPreflight } from "@/types/router-fleet-wizard";

/**
 * Map a backend precondition status onto the three the UI understands.
 *
 * Anything unrecognized becomes `unknown`, never `pass`. This is the
 * fail-safe direction on purpose: a backend that grows a new status must
 * not be able to turn a blocked Discover button green in an older
 * frontend build.
 */
export function normalizePreconditionStatus(value: string): DiscoveryPreconditionStatus {
  return value === "pass" || value === "fail" ? value : "unknown";
}

/**
 * Whether the Discover action must be refused outright.
 *
 * True only when the backend affirmatively reports a *known* unmet
 * precondition. A null pre-flight (still loading, or the check itself
 * failed) does NOT block -- refusing on an unknown would strand an
 * operator whenever the diagnostic is broken. The UI's job in that case
 * is to say the preconditions are unknown, which is a separate signal
 * from this one; see `discoveryPreflightIsReassuring`.
 */
export function isDiscoveryBlocked(preflight: DiscoveryPreflight | null | undefined): boolean {
  return preflight ? !preflight.canAttempt : false;
}

/**
 * Whether the pre-flight actually constitutes a clean bill of health.
 *
 * Distinct from `!isDiscoveryBlocked(...)` on purpose: a report with
 * unverified preconditions is *not* reassuring even though it does not
 * block. The UI uses this to decide whether it may imply readiness, so
 * "unknown" can never be rendered as "fine".
 */
export function discoveryPreflightIsReassuring(
  preflight: DiscoveryPreflight | null | undefined,
): boolean {
  if (!preflight) return false;
  return preflight.canAttempt && preflight.unverifiedCount === 0;
}
