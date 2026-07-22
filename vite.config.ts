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
  },
});
