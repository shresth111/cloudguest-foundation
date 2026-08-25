import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
//
// The original version of this guard only recognized that one exact
// hardcoded body shape. Field-confirmed bug (recurred 3x for real guests):
// the moment right after hotspot login is a genuine top-level browser
// navigation into a fresh SSR pass (see portal.success.tsx's form-post
// login flow -> router 302 -> /portal/session), at exactly the instant the
// backend/network is least stable (guest flipping from unauthenticated to
// authenticated on the router). Any SSR failure whose JSON body doesn't
// match the one hardcoded shape sailed straight past this guard and got
// rendered to the guest as a raw, unstyled JSON blob with no page and no
// error boundary -- there's no React tree at all for a top-level nav.
//
// Fix: any 5xx JSON response from a page route (not /api/*, which is our
// own AppError envelope that real callers deserialize) is swallowed and
// replaced with the friendly error page, regardless of its exact shape.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  // Genuine /api/* JSON 5xx responses are our own AppError envelope,
  // meant to be read by fetch/axios callers -- never swap those.
  if (new URL(request.url).pathname.startsWith("/api/")) return response;

  const body = await response.clone().text();
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// Confirmed live: a browser that had already visited a portal.* URL kept
// serving its own cached copy of the page on a repeat visit, with no
// request ever reaching the server, because this SSR document response
// carried no Cache-Control header at all -- so browsers fell back to their
// own (often long) heuristic freshness lifetime for a page with none set.
// That is the wrong default for every route this fetch handler serves:
// every page is a live SSR render of the request's own current backend
// state (venue branding, session, RBAC-gated dashboard data), never a
// static document, so a stale cached copy is a guest or operator looking
// at data days old with no way to know it. `/assets/*` bundle files never
// reach this function at all -- nitro's node-server preset serves those
// from its own static middleware ahead of this handler, so they keep
// their normal long-cache treatment; only real page/API responses do.
// `no-store`, not `no-cache`: `no-cache` still permits the browser to
// serve its cache after a revalidation round trip, which needs the
// server to have sent a `Last-Modified`/`ETag` for these SSR responses to
// revalidate against -- it does not, so `no-cache` would silently behave
// like an always-stale cache with no request ever confirming that. Only
// added when a response doesn't already set its own Cache-Control, so an
// explicit route-level choice (e.g. a static asset response that does
// reach this function) is never overridden.
function withNoStoreForUncachedResponses(response: Response): Response {
  if (response.headers.has("cache-control")) return response;
  const next = new Response(response.body, response);
  next.headers.set("cache-control", "no-store");
  return next;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withNoStoreForUncachedResponses(
        await normalizeCatastrophicSsrResponse(response, request),
      );
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
