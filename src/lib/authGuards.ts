import { redirect } from "@tanstack/react-router";
import type { RouterAuthContext } from "@/context/AuthContext";
import { TOKEN_STORAGE_KEY } from "@/services/api";

/** The customer dashboard's production hostname. */
const CUSTOMER_APP_HOSTNAME = "app.wyfyguest.com";
/** The Master Console's own production hostname -- see `src/routes/index.tsx`. */
const MASTER_CONSOLE_HOSTNAME = "master.wyfyguest.com";

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
    // Guard against a self-referential ?redirect=/login (seen live:
    // https://app.wyfyguest.com/login?redirect=%2Flogin) -- whatever the
    // exact sequence that lands this guard's check while `location.href`
    // is already `/login` itself (a re-render/re-navigation racing the
    // real auth status landing, a guard re-firing after AuthRouterContextSync
    // invalidates the router, etc.), carrying it forward as the redirect
    // target is never correct: login.tsx's own post-login handler would
    // just navigate straight back to /login instead of wherever the
    // visitor actually meant to go, or to the real home route.
    const isAlreadyOnLogin =
      location.href === "/login" ||
      location.href.startsWith("/login?") ||
      location.href.startsWith("/login#");
    throw redirect({
      to: "/login",
      search: isAlreadyOnLogin ? undefined : { redirect: location.href },
    });
  }
  // The "admin@example.com" / "test" demo bypass (see login.tsx / AuthContext's
  // login()) hardcodes a global-scope "Super Admin" role on its fake session --
  // it was never meant to represent a real operator, and login.tsx sends it
  // straight to /customer on submit. Same check customer.service.ts's own
  // isDemo() uses, so this stays in lockstep with the rest of the demo path.
  const isDemoSession =
    typeof window !== "undefined" &&
    localStorage.getItem(TOKEN_STORAGE_KEY) === "demo-access-token";

  const hasCustomerRole = auth?.roles?.some((r) => r.scopeType !== "global") ?? true;
  if (auth?.status === "authenticated" && !hasCustomerRole && !isDemoSession) {
    // Zero customer-scoped roles doesn't necessarily mean "this is an
    // operator" -- it also matches a genuinely broken/unprovisioned account
    // (e.g. an org membership created without a role ever being assigned).
    // Only redirect to the Master Console for an *actual* operator (a real
    // global-scope role); otherwise `/master`'s own guard would immediately
    // reject them too (see master.tsx's `isOperator` check) and bounce them
    // on to `/master-login` -- leaking the internal operator console's
    // existence/branding to a broken customer session instead of showing a
    // customer-appropriate "your account isn't fully set up" state here.
    const isOperator = auth?.roles?.some((r) => r.scopeType === "global") ?? false;
    if (isOperator) {
      // ...but only on the hostname the Master Console is actually served
      // from. This redirect used to fire on every host, so signing in at
      // **app.wyfyguest.com** with an operator account rendered the Master
      // Console at `app.wyfyguest.com/master`: operator branding, the whole
      // tenant list, MRR and "Add Customer", all under the address customers
      // are given. Reported from a live session: "ye kya bug hai
      // app.wyfyguest.com se master wala portal aagaya hai".
      //
      // Not a privilege escalation -- every `/master/*` route is GLOBAL-scoped
      // and this visitor holds a global role, so nothing was reachable that
      // was not already theirs, and a customer (no global role) never enters
      // this branch at all. It is a *surface* bug, and it has a second cost:
      // an operator whose only role is global can never reach the customer
      // dashboard to see what a customer sees, because every route out of
      // here leads back to /master.
      //
      // `src/routes/index.tsx` already reads the hostname for exactly this
      // distinction ("The Master Console is served from its own hostname");
      // this guard simply never asked. Same `window`-only read, and the same
      // reason it cannot be done in a render body -- but a `beforeLoad` guard
      // is already client-only here, so there is no hydration concern.
      //
      // Anything that is not definitively the customer production host still
      // redirects in-app, so local dev and previews (localhost, *.pages.dev),
      // where both consoles share one origin, behave exactly as before.
      const host = typeof window === "undefined" ? null : window.location.hostname;
      if (host === CUSTOMER_APP_HOSTNAME) {
        window.location.href = `https://${MASTER_CONSOLE_HOSTNAME}/master`;
        // Stop this navigation resolving against a page we are leaving.
        throw redirect({ to: "/login" });
      }
      throw redirect({ to: "/master" });
    }
  }
}
