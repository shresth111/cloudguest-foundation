/**
 * Which hostnames may serve the Master Console (`/master*`, `/master-login`).
 *
 * Every production hostname runs the same app, so without this check the
 * operator console and its sign-in form answer on demo., auth., portal. and
 * wifi. as well. The server applies it for a real 404; the route guards apply
 * it again for navigation inside the browser.
 *
 * Deliberately imports nothing: `src/server.ts` and the route guards share it.
 */

export const MASTER_CONSOLE_HOSTNAME = "master.wyfyguest.com";
export const CUSTOMER_APP_HOSTNAME = "app.wyfyguest.com";

const PRODUCTION_DOMAIN = "wyfyguest.com";
/** Staging has one origin for both consoles. */
const OPERATOR_HOSTNAMES = new Set([MASTER_CONSOLE_HOSTNAME, "staging.wyfyguest.com"]);
/** Hosts where people sign in, so browsers may be told to stay on HTTPS. Guest
 *  portal hosts are left out: captive-portal flows must not be pinned to it. */
const HSTS_HOSTNAMES = new Set([
  MASTER_CONSOLE_HOSTNAME,
  CUSTOMER_APP_HOSTNAME,
  "demo.wyfyguest.com",
]);

export type MasterConsoleAccess = "allow" | "bounce" | "not-found";

function normalizeHostname(hostname: string | null | undefined): string {
  return (hostname ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function isMasterConsolePath(pathname: string): boolean {
  return /^\/master(-login)?(\/|$)/.test(pathname);
}

/**
 * Local dev and previews serve both consoles from one origin, so only
 * hostnames under the production domain are ever refused. app. bounces to the
 * Master host because real operators type that address (#289).
 */
export function masterConsoleAccess(hostname: string | null | undefined): MasterConsoleAccess {
  const host = normalizeHostname(hostname);
  if (host !== PRODUCTION_DOMAIN && !host.endsWith(`.${PRODUCTION_DOMAIN}`)) return "allow";
  if (OPERATOR_HOSTNAMES.has(host)) return "allow";
  return host === CUSTOMER_APP_HOSTNAME ? "bounce" : "not-found";
}

/** The response for a Master Console path on this host, or null to serve it. */
export function refuseMasterConsoleRequest(request: Request): Response | null {
  const url = new URL(request.url);
  if (!isMasterConsolePath(url.pathname)) return null;
  const access = masterConsoleAccess(request.headers.get("host") ?? url.hostname);
  if (access === "allow") return null;
  if (access === "bounce") {
    return new Response(null, {
      status: 302,
      headers: {
        location: `https://${MASTER_CONSOLE_HOSTNAME}${url.pathname}${url.search}`,
        "cache-control": "no-store",
      },
    });
  }
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/** Baseline headers for every page. Existing values are never overridden. */
export function withSecurityHeaders(response: Response, request: Request): Response {
  const url = new URL(request.url);
  const next = new Response(response.body, response);
  const setIfMissing = (name: string, value: string) => {
    if (!next.headers.has(name)) next.headers.set(name, value);
  };
  setIfMissing("x-content-type-options", "nosniff");
  setIfMissing("referrer-policy", "strict-origin-when-cross-origin");
  // Guest portal pages stay frameable as before; everything else is not
  // embeddable by another site, which is what stops clickjacking.
  if (!/^\/portal(\/|$)/.test(url.pathname)) setIfMissing("x-frame-options", "SAMEORIGIN");
  if (HSTS_HOSTNAMES.has(normalizeHostname(request.headers.get("host") ?? url.hostname))) {
    setIfMissing("strict-transport-security", "max-age=86400");
  }
  return next;
}
