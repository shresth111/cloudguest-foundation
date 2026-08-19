// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Local-dev-only proxy so the frontend can call the real backend at
  // /api/v1 without CORS setup. Stripped automatically inside the Lovable
  // sandbox (see @lovable.dev/vite-tanstack-config's cleanServerConfig) —
  // that environment has no route to a developer's local backend anyway.
  vite: {
    server: {
      proxy: {
        "/api/v1": {
          target: process.env.VITE_BACKEND_ORIGIN || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
    // captive-portal-v5-design-spec.md §2.2 (UX/Perf): with no manualChunks,
    // Rollup's default shared-chunk algorithm merges `recharts` (and its
    // d3-*/react-smooth dependents) into the same catch-all shared chunk as
    // ordinary low-level utilities (cn, icon primitives, etc) purely because
    // both happen to be reachable from 2+ route chunks. Every route --
    // /portal/* guest routes included -- that imports so much as `cn` from
    // that shared chunk then also downloads recharts, even though the guest
    // sign-in flow never renders a chart. Confirmed directly against a real
    // `.output/` build: that shared chunk was 1.16MB raw / ~327KB gzip, and
    // `grep`ping it for `recharts` hit 14 times. (The spec's "xlsx"
    // attribution doesn't hold on inspection -- there's no `xlsx`/SheetJS
    // package anywhere in this app's dependency tree; the string match was
    // `billing.service.ts`'s own `revenue-report-....xlsx` filename-fallback
    // literal, not bundled library code. Noted here since the brief asked
    // this to be verified against the codebase directly, not carried
    // forward unchecked.)
    //
    // Forcing recharts + its real transitive chart-rendering deps into their
    // own `vendor-2-charts` chunk keeps them out of the chunk portal routes
    // actually depend on. Two non-obvious wrinkles, both found by rebuilding
    // and grepping the *real* `.output/` chunk graph rather than trusting
    // the config in the abstract (a naive "just force recharts/d3-*" pass
    // still left GuestSignInCard/PortalShell pulling in the whole chart
    // chunk):
    //
    // 1. `react` itself ships as CJS, and Rollup's commonjs interop wraps
    //    it in a single `require_react()` helper shared by every consumer
    //    app-wide. With two same-tier manual chunks both needing it, Rollup
    //    broke the tie by *alphabetical chunk name* and hosted that shared
    //    helper inside the chart chunk purely because its name sorted
    //    first -- so anything needing basic React interop (virtually every
    //    chunk, portal included) pulled the whole ~427KB chart chunk in
    //    along with it. The same tie-break bit `clsx`/`react-is`/
    //    `prop-types` (recharts's own CJS-style requires of them) and
    //    `lucide-react`/`zod`/`axios`/`tailwind-merge`/
    //    `class-variance-authority`/this app's own `src/components/ui/*`
    //    primitives (all genuinely shared with whatever in `src/routes/`
    //    also happens to import recharts). Pinning all of these -- every
    //    one an unavoidable baseline dependency of the portal flow anyway,
    //    `ui/chart.tsx` (the actual recharts wrapper) deliberately excluded
    //    -- into a chunk named to sort before "vendor-2-charts" resolves
    //    Rollup's tie-break in the direction that keeps shared interop
    //    plumbing out of the chart-only chunk.
    // 2. Four admin-only route files (`c.index.tsx`, `master.index.tsx`,
    //    `subscription.index.tsx`, `workspace.locations.$locationId.tsx`)
    //    import recharts at module top level, and this was originally
    //    (mis)diagnosed as one shared problem: TanStack Router's automatic
    //    per-route code-splitting only extracts each route's own
    //    `component`/`loader`/etc. into a lazy chunk, and the file's other
    //    top-level code supposedly stayed attached to the route's
    //    "registration" module that `routeTree.gen.ts` imports statically
    //    for every route. That theory doesn't actually hold for three of
    //    the four: `master.index.tsx`, `subscription.index.tsx`, and
    //    `workspace.locations.$locationId.tsx` only ever export `Route`,
    //    so their own `component` (recharts included) genuinely does get
    //    split into its own lazy chunk -- confirmed directly against the
    //    real `.output/` build (grepping the compiled entry chunk finds no
    //    static `import ... from "./vendor-2-charts-*.js"`, only inert
    //    `__vite__mapDeps` string entries used for other routes' own lazy
    //    prefetch resolution).
    //
    //    `c.index.tsx` was the real, distinct bug: alongside its own
    //    `Route` (a bare `beforeLoad` redirect to `/`, no `component` at
    //    all), it used to *also* export `CustomerDashboardPage` -- a
    //    ~1000-line, recharts-heavy component with no relationship to the
    //    "/c/" route's own registration, imported cross-file by
    //    `index.tsx` ("/", the app's real dashboard route) instead. Since
    //    JS modules execute as a whole unit, `routeTree.gen.ts`'s static
    //    import of `c.index.tsx` (just to register the "/c/" redirect)
    //    pulled that entire unrelated component -- recharts import
    //    included -- into the root/entry chunk every route loads, guest
    //    captive portal included. The code-splitter has no visibility into
    //    an export it was never asked to split; only `component`/`loader`/
    //    `pendingComponent`/`errorComponent`/`notFoundComponent` on that
    //    file's own `Route` are ever candidates. Fixed by moving
    //    `CustomerDashboardPage` to its own file
    //    (`src/components/customer/CustomerDashboardPage.tsx`, not a route
    //    file, so nothing statically imports it except `index.tsx`'s own
    //    already-correctly-split `component`) -- `c.index.tsx` is now
    //    genuinely just the redirect, nothing else.
    //
    //    Forcing all four files' registration modules into
    //    `vendor-2-charts` directly (as a blunter fix, before this was
    //    root-caused) was tried and reverted -- it re-triggered wrinkle #1
    //    one layer up (their own broadly-shared bindings, e.g.
    //    `useQuery`/`useNavigate`, then got hosted in the chart chunk by
    //    the same tie-break), which was a worse regression than the gap it
    //    closed.
    //
    // Net, verified against the real build AND a real browser network
    // trace (not static bundle analysis alone -- see this repo's own
    // history for why that distinction matters here): `/portal/welcome`
    // (the actual guest sign-in landing page) and its full component tree
    // (GuestSignInCard/PortalShell/PortalGuestUi), plus every other
    // /portal/* route, load zero requests for `vendor-2-charts-*.js`. The
    // admin dashboard's own chart-bearing pages (customer dashboard at
    // "/", Master Console analytics, Subscription, Workspace location
    // detail) are unaffected -- same component code, same lazy chunk,
    // just relocated off of a route-registered file.
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-is|clsx|prop-types|lucide-react|zod|axios|tailwind-merge|class-variance-authority)[\\/]/.test(
                id,
              ) ||
              /[\\/]node_modules[\\/]@tanstack[\\/](react-query|query-core|react-router|router-core|history)[\\/]/.test(
                id,
              ) ||
              (/[\\/]src[\\/]components[\\/]ui[\\/]/.test(id) && !id.includes("/ui/chart.tsx"))
            ) {
              return "vendor-1-react";
            }
            if (
              /[\\/]node_modules[\\/](recharts|d3-[^/]+|react-smooth|victory-vendor)[\\/]/.test(id)
            ) {
              return "vendor-2-charts";
            }
            return undefined;
          },
        },
      },
    },
  },
});
