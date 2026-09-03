/**
 * The one place that answers "which organization am I?".
 *
 * ## The duplication this removes
 *
 * Seven services each declared their own `resolveOrganizationId`, each with
 * its own module-level cache, each calling `GET /me/organizations`. They
 * cache independently, so the *first* call in every module still went to
 * the network: a single page load was measured issuing `/me/organizations`
 * three times, because three of those services happened to be active on it.
 *
 * Worse, each cache was assigned only *after* its promise resolved, so two
 * concurrent callers inside the same module both saw an empty cache and both
 * fired — a plain cache stampede. React Query dedupes its own queries; these
 * were plain service functions and sat outside it entirely.
 *
 * This module holds one cached value and, crucially, one **in-flight
 * promise**. Concurrent callers await the same request; later callers get
 * the memoized id without a request at all.
 *
 * ## Why the id must not outlive the session
 *
 * Registered with `session-scope-cache`, like the caches it replaces. A
 * module variable survives `queryClient.clear()`, so without that an expired
 * token followed by a sign-in as a different account would keep sending the
 * previous tenant's `X-Organization-Id`. See that module's own docstring for
 * the full failure modes.
 *
 * ## Why `/me/organizations` and not `/organizations`
 *
 * Membership-scoped. An ordinary customer or org-owner session does not hold
 * the elevated permission the platform-wide endpoint requires and gets a
 * 403 — which is what silently broke several list endpoints before each
 * service switched, one at a time, to this one.
 */

import { api } from "./api";
import { registerSessionScopeCache } from "@/lib/session-scope-cache";

interface OrganizationMembership {
  organization_id: string;
  status: string;
}

let cachedOrganizationId: string | null = null;
let inFlight: Promise<string> | null = null;

registerSessionScopeCache(() => {
  cachedOrganizationId = null;
  // Also drop an in-flight request: it was issued for the previous identity
  // and its answer must not be handed to the next one.
  inFlight = null;
});

/**
 * The current session's organization id, fetched at most once.
 *
 * Throws when the session belongs to no organization -- callers depend on
 * that rather than a silent `null`, because every one of them is about to
 * put the value in an `X-Organization-Id` header where an empty string
 * resolves server-side to "no organization" and fails a permission check
 * with a message that names the wrong cause.
 */
export async function resolveOrganizationId(): Promise<string> {
  if (cachedOrganizationId) return cachedOrganizationId;
  if (inFlight) return inFlight;

  const request = (async () => {
    const { data } = await api.get<OrganizationMembership[]>("/me/organizations");
    const membership = data.find((m) => m.status === "active") ?? data[0];
    if (!membership) {
      throw new Error("No organization found for the current session");
    }
    cachedOrganizationId = membership.organization_id;
    return cachedOrganizationId;
  })();

  inFlight = request;
  try {
    return await request;
  } finally {
    // Cleared either way. On success the memo above serves everyone; on
    // failure a retry must be allowed to reach the network rather than
    // awaiting a promise that already rejected.
    if (inFlight === request) inFlight = null;
  }
}

/** The cached id if one has already been resolved, without issuing a
 * request. For callers that can do something sensible with "not known
 * yet" -- most cannot, and should await {@link resolveOrganizationId}. */
export function peekOrganizationId(): string | null {
  return cachedOrganizationId;
}
