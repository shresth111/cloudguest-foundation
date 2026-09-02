/**
 * Registry for module-level caches that are scoped to the signed-in
 * identity.
 *
 * Several services resolve "which organization am I?" once and cache the
 * answer in a module variable, so it survives `queryClient.clear()` — which
 * only clears React Query, not module state. That id then outlives the
 * session that produced it.
 *
 * The failure modes this closes:
 *  - a token expires and the user signs in as a different account without an
 *    explicit sign-out;
 *  - an operator impersonates a venue and then ends impersonation.
 *
 * In both cases the next request carries an explicit `X-Organization-Id` for
 * the *previous* tenant. That header wins over the interceptor's default
 * (`attachOrganizationHeader` returns early when one is already set), so an
 * account that belongs to both organizations silently reads the wrong one,
 * and the restored operator — who bypasses the membership check via the
 * global-scope path — reads the impersonated tenant's data.
 *
 * Register from the service module; call `resetSessionScopeCaches()` on
 * every identity transition. A registry rather than five separate exports so
 * that adding a sixth cache doesn't mean remembering four call sites.
 */
const resetters = new Set<() => void>();

export function registerSessionScopeCache(reset: () => void): void {
  resetters.add(reset);
}

export function resetSessionScopeCaches(): void {
  for (const reset of resetters) {
    try {
      reset();
    } catch {
      // One misbehaving resetter must not strand the others.
    }
  }
}
