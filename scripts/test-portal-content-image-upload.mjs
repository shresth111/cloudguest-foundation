#!/usr/bin/env node
// =====================================================================
// PORTAL CONTENT-IMAGE UPLOAD MUST READ THE URL AT THE RIGHT DEPTH
// =====================================================================
// WHAT WENT WRONG. `portalService.uploadContentImage` posted the image to
// `POST /captive-portal-configs/{id}/content-image` and then returned
// `data.data.content_image_url`. That reached one level too deep.
//
// The backend endpoint responds with `ApiResponse[CaptivePortalConfigResponse]`
// -- the `{success, message, data, request_id}` envelope wrapping the FULL
// config object, on which `content_image_url` is a TOP-LEVEL field
// (`app/domains/captive_portal/router.py`, the `content-image` POST returns
// `data=_config_response(updated)`). The shared axios response interceptor
// (`src/services/api.ts`) already unwraps that envelope exactly once, so the
// value the service receives is the config object itself. `data.data` was
// therefore `undefined`, and `.content_image_url` on it threw a TypeError:
// the backend stored the image, but the UI reported the upload as failed
// (bug: "uploading a before-sign-in content image does nothing").
//
// WHAT THIS CHECKS. It bundles the REAL `portal.service.ts` with esbuild
// against a stubbed `services/api` whose `post` returns exactly what the
// interceptor hands downstream -- the already-unwrapped config object -- and
// asserts `uploadContentImage` returns the URL from that single level. It
// also asserts the service never re-reaches into a second `.data` level, so
// the double-unwrap cannot silently return. Mirrors the bundle-the-real-code
// design of scripts/test-campaign-results.mjs.

import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// ---------------------------------------------------------------------------
// Bundle the real service against a stubbed API client.
// ---------------------------------------------------------------------------
const outdir = mkdtempSync(join(tmpdir(), "portal-content-image-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

// The stub's `post` returns `{ data }` where `data` is the value the shared
// interceptor produces: the envelope's inner `data`, i.e. the full config
// object. This is exactly the shape the real code sees at runtime.
const stubModule = `
globalThis.__stub ??= { calls: [], response: null };
export const api = {
  post: async (url, body, config) => {
    globalThis.__stub.calls.push({ url, body, config });
    return { data: globalThis.__stub.response };
  },
  get: async () => ({ data: null }),
  put: async () => ({ data: null }),
  delete: async () => ({ data: null }),
};
export function toAppError(e) { return { message: String(e), status: null, data: null }; }
`;
writeFileSync(join(outdir, "api-stub.mjs"), stubModule);

const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export { portalService } from "${p("src/services/portal.service.ts")}";`);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /services\/api$/ }, () => ({
          path: join(outdir, "api-stub.mjs"),
        }));
      },
    },
  ],
});

const { portalService } = await import(`file://${outfile}`);
const state = globalThis.__stub;

// FastAPI serialises the config with `content_image_url` at the TOP level of
// the object that reaches the service (post-interceptor). No second `data`.
const CONFIG = {
  id: "cfg-1",
  organization_id: "org-1",
  content_image_url: "https://cdn.example/api/v1/captive-portal-configs/cfg-1/content-image.png",
  content_mode: "image",
};

// --- 1. Returns the stored URL from the single-unwrapped response ----------
state.response = CONFIG;
const file = { name: "banner.png", type: "image/png" };
const returned = await portalService.uploadContentImage("cfg-1", file, "org-1");
eq(
  "uploadContentImage returns the top-level content_image_url",
  returned,
  CONFIG.content_image_url,
);

// --- 2. It hit the right path and forwarded the org header -----------------
const call = state.calls.at(-1);
check(
  "posts to /captive-portal-configs/{id}/content-image",
  call?.url === "/captive-portal-configs/cfg-1/content-image",
  `got ${call?.url}`,
);
check(
  "forwards X-Organization-Id when given",
  call?.config?.headers?.["X-Organization-Id"] === "org-1",
);

// --- 3. A null URL degrades to "" rather than throwing ---------------------
state.response = { ...CONFIG, content_image_url: null };
const emptied = await portalService.uploadContentImage("cfg-1", file);
eq("null content_image_url resolves to empty string", emptied, "");

// --- 4. The double-unwrap regression cannot come back ----------------------
// If the service ever re-reads a second `.data` level, feeding it the
// post-interceptor object (which has no `.data`) would throw or yield
// undefined -- assertion 1 already fails in that case. Belt-and-braces:
// pin the source so a refactor cannot silently reintroduce `data.data`.
const src = readFileSync(join(ROOT, "src/services/portal.service.ts"), "utf8");
check(
  "source does not read data.data.content_image_url (double-unwrap)",
  !/data\.data\.content_image_url/.test(src),
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
