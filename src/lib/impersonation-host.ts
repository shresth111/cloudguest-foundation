import { getActiveImpersonationClaim } from "@/lib/jwt";

/**
 * "View as this customer" on the Master Console hostname.
 *
 * The two consoles live on two hostnames (see scripts/test-consoles-never-mix.mjs),
 * and every customer-surface guard used to send a visitor on
 * master.wyfyguest.com either to `/master` or across to app.wyfyguest.com.
 * Impersonation is the one legitimate exception to that rule, and it can only
 * happen on the master host:
 *
 *   - it is started from `/master/customers`, i.e. on master.wyfyguest.com;
 *   - the impersonation token and the operator's parked session live in
 *     localStorage, which is per-origin -- bouncing to app.wyfyguest.com
 *     arrives there signed out (or, worse, as whoever last signed in there);
 *   - `/master`'s own guard correctly refuses the impersonated (non-global)
 *     token, so bouncing to `/master` lands on `/master-login`.
 *
 * Measured on prod 2026-09-14: the session started (banner visible) and the
 * page landed on `/master-login?redirect=/master`, so the feature was unusable.
 *
 * What this exempts, and what it does not:
 *   - It only ever WIDENS the customer surface on the master host. It is never
 *     consulted by `/master`'s operator-role check, so an impersonated session
 *     cannot reach operator scope through it.
 *   - It keys on the ACTIVE token carrying the backend-minted `impersonation`
 *     claim. A normal customer token never has one; a customer who forges one
 *     into localStorage only gets their own customer dashboard rendered on the
 *     master address, and every API call on that forged token is refused by
 *     the backend (the signature no longer verifies).
 *   - It is hostname-agnostic on purpose: on localhost/previews every guard
 *     that consults it already allows the customer surface.
 */
export function isImpersonationSessionActive(): boolean {
  return getActiveImpersonationClaim() !== null;
}
