/**
 * Where the demo login (`admin@example.com` / `test`) is allowed to exist.
 *
 * The demo branch in `AuthContext.login` mints a complete session in the
 * browser -- Super Admin, global scope, the sentinel `demo-access-token` --
 * without asking the backend. #284 turned it off in production builds
 * because on the real hosts that is a console that *presents* as a global
 * admin to anyone who reads the JS, and one no `force-logout` can end.
 *
 * The product is still demonstrated with it, so it lives on its own address:
 * demo.wyfyguest.com is served by the SAME bundle as app./master. (identical
 * asset hashes), so the only thing that can tell the hosts apart at runtime
 * is the hostname. This module is the one place that decision is made; every
 * reader of the demo token goes through {@link isHonouredDemoToken}.
 *
 * On any other production host the demo credentials go to the backend and
 * fail like any others, and a `demo-access-token` found in localStorage is
 * NOT a session -- AuthContext purges it, the guards stop exempting it, and
 * `isDemo()` stops serving fixtures for it.
 *
 * Deliberately imports nothing: `services/api.ts` depends on it, and every
 * module that api.ts pulls in lands in the request path.
 */

/** Hostnames that serve the demo. `demo.localhost` resolves to loopback in
 *  Chrome/Firefox, so the demo host path can be exercised on a dev server
 *  without a hosts-file edit; it is unreachable from anyone else's machine. */
export const DEMO_HOSTNAMES: readonly string[] = ["demo.wyfyguest.com", "demo.localhost"];

/** The sentinel access token a demo session stores. The backend neither
 *  issues nor accepts it. */
export const DEMO_ACCESS_TOKEN = "demo-access-token";

export const DEMO_EMAIL = "admin@example.com";
export const DEMO_PASSWORD = "test";

function currentHostname(): string | null {
  return typeof window === "undefined" ? null : (window.location?.hostname ?? null);
}

/**
 * True when this page may mint or honour a demo session: a build that opted
 * in with `VITE_ENABLE_DEMO_LOGIN=true` (local/demo builds, unchanged from
 * #284), or the page is being served from a demo hostname.
 *
 * `hostname` is a parameter only so tests can ask about a host without
 * faking `window`; callers pass nothing.
 */
export function isDemoLoginEnabled(hostname: string | null = currentHostname()): boolean {
  if (import.meta.env.VITE_ENABLE_DEMO_LOGIN === "true") return true;
  return hostname !== null && DEMO_HOSTNAMES.includes(hostname);
}

/** The demo credential pair, and only where the demo is enabled. */
export function isDemoLogin(creds: { email: string; password: string }): boolean {
  return isDemoLoginEnabled() && creds.email === DEMO_EMAIL && creds.password === DEMO_PASSWORD;
}

/** `token` is the demo sentinel AND this host honours it. Anything else --
 *  including the sentinel planted by hand on app.wyfyguest.com -- is not a
 *  demo session. */
export function isHonouredDemoToken(token: string | null | undefined): boolean {
  return token === DEMO_ACCESS_TOKEN && isDemoLoginEnabled();
}
