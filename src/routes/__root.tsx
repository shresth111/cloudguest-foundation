import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth, type RouterAuthContext } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { PlatformBrandingProvider } from "@/context/PlatformBrandingContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// NOTE (deliberately not imported here): `@/lib/i18n` used to be pulled in
// at this module's top level, and its instance handed to an
// `<I18nextProvider>` wrapping the whole tree. `__root.tsx` is the one
// route module that is never code-split -- it IS the entry chunk -- so
// that single import statically dragged i18next, react-i18next and all
// eight eagerly-`import`ed locale JSON bundles (~20-25KB gzip, including
// ~420 Devanagari tokens) into the bytes every route downloads, and ran
// `i18n.init()` on every boot. The guest captive portal is the majority of
// this app's real traffic, uses none of it, and has its own dictionary in
// `src/lib/portal-i18n.ts`.
//
// The provider was also redundant: `@/lib/i18n` calls
// `i18n.use(initReactI18next).init(...)`, and `initReactI18next` registers
// that instance as react-i18next's global default. Every `useTranslation`
// call site now imports the instance itself and passes it explicitly
// (`useTranslation(ns, { i18n })`) -- see `AppSidebar`, `CustomerSidebar`,
// `users.tsx` and `_authenticated/account.tsx`. Those are all dashboard
// modules that live in their own lazily-loaded route chunks, so i18next
// and its locales now load with the dashboard, when and only when a
// dashboard screen that actually renders a translated string does.
// (Explicit instance rather than a bare `import "@/lib/i18n"` on purpose:
// this package.json declares `"sideEffects": false`, so a side-effect-only
// import would be a legal tree-shake target. A used binding is not.)

/**
 * The origin the app's API actually lives on, or `null` when it is
 * same-origin. In production the dashboard/portal and the API are served
 * from *different* hosts (`VITE_API_BASE_URL` is baked in at build time,
 * see `src/services/api.ts` and `src/services/guest-portal-api.ts`), so
 * the very first API call a page makes -- `/captive-portal/resolve`, on
 * the guest sign-in path -- has to pay a cold DNS lookup + TCP handshake
 * + TLS handshake before a single byte moves. On the captive-portal path
 * that cost lands at the worst possible moment: a guest on a fresh, often
 * congested first-hop WiFi/mobile link, staring at a spinner.
 *
 * Derived from the configured base URL rather than hardcoded so it stays
 * correct across environments, and deliberately degrading to `null` (no
 * link tags at all, rather than a wrong or wasted one) when:
 *   - the env var is unset -- `api.ts` then falls back to the relative
 *     `/api/v1`, i.e. same-origin, where a preconnect buys nothing
 *     because the document's own connection is already open;
 *   - the value is relative for the same reason;
 *   - the value isn't a parseable URL.
 *
 * Computed at module scope from `import.meta.env` only -- never from
 * `window` -- so the server and the client render byte-identical <head>
 * markup and this can't introduce a hydration mismatch.
 */
const API_PRECONNECT_ORIGIN: string | null = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  // Relative bases ("/api/v1", "") are same-origin -- nothing to preconnect to.
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
})();

/**
 * `preconnect` is the one that actually warms DNS + TCP + TLS; `crossorigin`
 * is required for the opened socket to be reusable by the API calls
 * themselves, since a cross-origin XHR/fetch is always a CORS-mode request
 * and the connection pool keys anonymous and credentialed sockets
 * separately (`api` sends its bearer token in an `Authorization` header and
 * never sets `withCredentials`, so `anonymous` is the matching mode).
 *
 * `dns-prefetch` is the fallback for browsers that ignore or drop the
 * preconnect -- it resolves DNS only, but it is the more widely honored
 * hint and browsers cap how many preconnects they will act on. Emitting
 * both is the standard belt-and-braces pairing; a browser that honors the
 * preconnect simply finds the DNS entry already in hand.
 */
const API_PRECONNECT_LINKS = API_PRECONNECT_ORIGIN
  ? [
      // `as const` matters: without it TS widens this to `string`, which
      // doesn't satisfy React's `CrossOrigin` union on <link>.
      { rel: "preconnect", href: API_PRECONNECT_ORIGIN, crossOrigin: "anonymous" as const },
      { rel: "dns-prefetch", href: API_PRECONNECT_ORIGIN },
    ]
  : [];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  auth: RouterAuthContext | undefined;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "WyFy" },
      {
        name: "description",
        content:
          "Wyfy Guest is the enterprise platform for managing guest WiFi across locations — with roles, analytics, and real-time insight.",
      },
      { name: "author", content: "Wyfy Guest" },
      { property: "og:title", content: "Wyfy Guest — Enterprise Guest WiFi Management" },
      {
        property: "og:description",
        content:
          "Provision networks, onboard guests, and monitor every location from a single pane of glass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Cross-origin API warm-up first -- these are hints the browser can
      // act on the moment it parses them, so they belong ahead of the
      // stylesheet rather than after it.
      ...API_PRECONNECT_LINKS,
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-180.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Renders synchronously with the raw HTML, before any JS bundle loads or
// React hydrates -- eliminates the blank white flash that routes with
// `ssr: false` (e.g. /portal, seen by guests on a fresh WiFi connection,
// often on slow first-hop mobile data) would otherwise show for as long as
// the JS bundle takes to arrive. `RootComponent`'s own mount effect removes
// this node once real content is ready to take over.
function InitialLoader() {
  return (
    <div
      id="initial-loader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "9999px",
          border: "3px solid rgba(79,70,229,0.15)",
          borderTopColor: "#4f46e5",
          animation: "initial-loader-spin 0.7s linear infinite",
        }}
      />
      <style>{"@keyframes initial-loader-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// Loads the Google Fonts stylesheet AFTER first paint, off the main
// render path -- a plain <link rel="stylesheet"> in <head> is
// render-blocking by spec, which is fatal on /portal: a guest hits that
// page before their device has real internet access (only the captive
// portal's own walled-garden host is reachable pre-authentication), so a
// render-blocking request to fonts.googleapis.com would hang for a full
// browser connection-timeout before anything ever painted. Injecting the
// link via script after mount means the browser never blocks on it --
// worst case (guest portal, fonts unreachable) the request just fails
// quietly in the background and the page already rendered with its
// system-font fallback.
const LOAD_FONTS_SCRIPT = `(function(){
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap";
  document.head.appendChild(l);
})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <InitialLoader />
        {children}
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: LOAD_FONTS_SCRIPT }} />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // The static InitialLoader in RootShell has no removal logic of its own
  // -- it's plain HTML rendered before React exists to remove it. Once this
  // component actually mounts, real content is ready, so the loader's job
  // is done.
  useEffect(() => {
    document.getElementById("initial-loader")?.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PlatformBrandingProvider>
          <AuthProvider>
            <AuthRouterContextSync />
            <TooltipProvider delayDuration={200}>
              <Outlet />
              <Toaster position="top-right" richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </PlatformBrandingProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Pushes `AuthContext`'s status into the router's own context so
 * `beforeLoad` guards (which run outside React) can read it, and
 * re-runs those guards whenever it changes. */
function AuthRouterContextSync() {
  const { status, roles } = useAuth();
  const router = useRouter();

  useEffect(() => {
    router.update({ context: { ...router.options.context, auth: { status, roles } } });
    void router.invalidate();
  }, [status, roles, router]);

  return null;
}
