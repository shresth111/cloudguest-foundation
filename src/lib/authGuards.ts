import { redirect } from "@tanstack/react-router";
import type { RouterAuthContext } from "@/context/AuthContext";

/**
 * Auth boundary for the `/customer/*` surface -- the mirror image of
 * `/master`'s own `beforeLoad` guard (see that route file's comment for
 * the full rationale). Being "authenticated" only proves *someone* is
 * logged in, not that they have a customer identity to show here.
 *
 * Before this existed, `/customer/*` had NO guard at all: a platform
 * operator (Super Admin, global-scope role only) who was still logged
 * into the Master Console and simply navigated to `/customer` -- no need
 * to log out or go through `/login` -- got the customer dashboard shell
 * rendered using their own real, live operator session: their name/email
 * in the header, and every API call the page made went out on the wire
 * carrying their actual operator access token. Not a stale display flag
 * (`cg_login_role` in localStorage) -- a genuinely wrong session being
 * used to drive a surface it was never meant to authenticate.
 */
export function requireCustomerSession(
  auth: RouterAuthContext | undefined,
  location: { href: string },
) {
  // Mirrors /master's own guard exactly: `auth` starts `undefined` until
  // AuthRouterContextSync's effect (see __root.tsx) pushes the real,
  // client-only (localStorage-derived) status into router context on
  // mount/hydration -- treating "not yet synced" the same as "anonymous"
  // would bounce every real, already-authenticated customer straight to
  // /login on first navigation/refresh. Only redirect on a *definitive*
  // anonymous/wrong-identity read; router.invalidate() re-runs this guard
  // the instant the real status lands, so the window where a stale
  // operator session could render here closes on the very next tick, same
  // as it does for /master today.
  if (auth?.status === "anonymous") {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }
  const hasCustomerRole = auth?.roles?.some((r) => r.scopeType !== "global") ?? true;
  if (auth?.status === "authenticated" && !hasCustomerRole) {
    // A pure operator has no organization/location-scoped role at all --
    // nothing to legitimately view on this surface. Send them back to
    // their own console instead of silently rendering as them here.
    throw redirect({ to: "/master" });
  }
}
