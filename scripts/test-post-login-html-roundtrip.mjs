#!/usr/bin/env node
/**
 * Round-trip regression test for the venue-authored post-login page
 * (`captive_portal_configs.post_login_html` / `login.postLoginHtml`).
 *
 * Run: node scripts/test-post-login-html-roundtrip.mjs
 *
 * THE FAILURE MODE THIS LOCKS DOWN
 * --------------------------------
 * `src/services/portal.service.ts` has a serialization WHITELIST on its write
 * path: `update()` builds an explicit `body` object field by field, and
 * `create()` an explicit POST payload. A field mapped in `toPortal()` (read)
 * but missing from those two (write) renders correctly, accepts an edit, and
 * is silently discarded on save -- with a success toast. That is not
 * hypothetical: `branding.fontFamily` shipped exactly like that, a live font
 * picker bound to a field the whitelist dropped, and nobody noticed.
 *
 * "The UI renders my value" therefore proves nothing. This test drives the
 * REAL service through a REAL save and a REAL reload against an in-memory
 * backend, and asserts the value survives the whole loop -- which is the only
 * assertion that would have caught the fontFamily bug.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * Same constraint every other `scripts/test-*.mjs` in this repo works under:
 * there is no test runner here (no vitest, no jest, no `test` script), so
 * this bundles the real TypeScript source with esbuild -- already present
 * transitively via vite -- substituting exactly one module, `@/services/api`,
 * for a recording fake. Everything under test is real: the real `toPortal`,
 * the real `update()` whitelist, the real `create()` payload.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "post-login-roundtrip-"));

/* ------------------------------------------------------------------ *
 * The fake backend. One row, stored in the shape the real API returns,
 * mutated by PUT exactly the way a real PATCH-semantics backend would:
 * only the keys present in the body are touched. That "only the keys
 * present" behaviour is what makes a dropped whitelist entry invisible in
 * production, so the fake has to reproduce it faithfully or the test would
 * pass for the wrong reason.
 * ------------------------------------------------------------------ */
const API_STUB = `
const row = {
  id: "cfg-1",
  organization_id: "org-1",
  location_id: "loc-1",
  name: "Guest Portal",
  is_active: true,
  is_default: false,
  theme: "corporate",
  logo_url: null,
  background_image_url: null,
  primary_color: "#1B57F5",
  secondary_color: "#0F172A",
  default_language: "en",
  supported_languages: ["en"],
  advertisement_banner_url: null,
  advertisement_banner_link: null,
  terms_and_conditions_text: null,
  terms_and_conditions_url: null,
  privacy_policy_text: null,
  privacy_policy_url: null,
  splash_headline: null,
  splash_welcome_message: null,
  redirect_url: null,
  content_mode: "login",
  content_heading: null,
  content_body: null,
  content_image_url: null,
  content_survey: null,
  otp_sms_enabled: true,
  otp_email_enabled: false,
  otp_whatsapp_enabled: false,
  voucher_enabled: false,
  username_password_enabled: false,
  social_login_enabled: false,
  social_login_providers: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

globalThis.__BACKEND = {
  row,
  calls: [],
  /** Drop post_login_html from the stored row AND refuse to store it --
   * simulates the pre-migration backend the frontend must tolerate. */
  columnMissing: false,
  /** Mirror the real backend's write-time sanitizer closely enough to test
   * the contract that matters to the client: it STORES A DIFFERENT STRING
   * than the one sent, and every response (including this save's own echo)
   * returns the stored one. Drops <script> blocks, and forces
   * rel/target onto anchors -- which is also why it can GROW the value. */
  sanitize: false,
};

function sanitizeHtml(value) {
  if (typeof value !== "string") return value;
  // Built with new RegExp and no backslash escapes on purpose: this whole
  // stub lives inside a JS template literal, where a bare \\b or \\s is
  // consumed as a string escape before esbuild ever sees the regex.
  const scriptRe = new RegExp("<script[^>]*>[^]*?</script>", "gi");
  const anchorRe = new RegExp("<a +href=", "gi");
  return value
    .replace(scriptRe, "")
    .replace(anchorRe, '<a rel="noopener noreferrer" target="_blank" href=');
}

function respond(url) {
  if (url.startsWith("/captive-portal-configs/")) return { data: { ...visibleRow() } };
  if (url === "/captive-portal-configs")
    return { data: { items: [ { ...visibleRow() } ], page: 1, page_size: 100, total_items: 1, total_pages: 1, has_next: false, has_previous: false } };
  if (url.startsWith("/organizations/") && url.endsWith("/locations"))
    return { data: { items: [], page: 1, page_size: 100, total_items: 0, total_pages: 0, has_next: false, has_previous: false } };
  if (url.startsWith("/organizations/")) return { data: { id: "org-1", name: "Org One" } };
  if (url === "/organizations")
    return { data: { items: [{ id: "org-1", name: "Org One" }], page: 1, page_size: 100, total_items: 1, total_pages: 1, has_next: false, has_previous: false } };
  throw new Error("unstubbed GET " + url);
}

function visibleRow() {
  const out = { ...globalThis.__BACKEND.row };
  if (globalThis.__BACKEND.columnMissing) delete out.post_login_html;
  return out;
}

export const api = {
  async get(url) {
    globalThis.__BACKEND.calls.push({ method: "GET", url });
    return respond(url);
  },
  async put(url, body) {
    globalThis.__BACKEND.calls.push({ method: "PUT", url, body });
    // Merge only what was actually SENT -- the whole point of the test.
    for (const [k, v] of Object.entries(body ?? {})) {
      if (globalThis.__BACKEND.columnMissing && k === "post_login_html") continue;
      globalThis.__BACKEND.row[k] =
        k === "post_login_html" && globalThis.__BACKEND.sanitize ? sanitizeHtml(v) : v;
    }
    return { data: { ...visibleRow() } };
  },
  async post(url, body) {
    globalThis.__BACKEND.calls.push({ method: "POST", url, body });
    for (const [k, v] of Object.entries(body ?? {})) {
      if (globalThis.__BACKEND.columnMissing && k === "post_login_html") continue;
      globalThis.__BACKEND.row[k] = v;
    }
    return { data: { ...visibleRow() } };
  },
  async delete(url) {
    globalThis.__BACKEND.calls.push({ method: "DELETE", url });
    return { data: null };
  },
};
export default api;
export function toAppError(e) { return { message: String(e) }; }
export const ORG_HEADER = "X-Organization-Id";
`;

const stubPath = join(work, "api-stub.mjs");
writeFileSync(stubPath, API_STUB);

const outfile = join(work, "bundle.mjs");
await build({
  entryPoints: [join(ROOT, "src/services/portal.service.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "neutral",
  mainFields: ["module", "main"],
  // `@/services/api` -> the recording fake above; every other `@/...` import
  // resolves to the real source, so the code under test is genuinely real.
  alias: { "@/services/api": stubPath },
  plugins: [
    {
      name: "alias-src",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          if (args.path === "@/services/api") return { path: stubPath };
          return { path: join(ROOT, "src", args.path.slice(2)) + guessExt(args.path) };
        });
      },
    },
  ],
  logLevel: "silent",
});

async function buildOne(entry, outfile) {
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
  });
  return outfile;
}

function guessExt(p) {
  // Every `@/...` import portal.service.ts pulls in is a .ts module.
  return p.endsWith(".ts") || p.endsWith(".tsx") ? "" : ".ts";
}

const { portalService } = await import(pathToFileURL(outfile).href);
const B = globalThis.__BACKEND;

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    console.log(`  FAIL ${name}: ${detail}`);
    failures.push(name);
  }
};

const HTML = "<h2>Welcome!</h2>\n<p>Show this screen at the desk for a free coffee.</p>";

// --- 1. UPDATE: does the value actually leave the client? --------------
B.calls.length = 0;
let portal = await portalService.update("cfg-1", { login: { postLoginHtml: HTML } }, "org-1");
const put = B.calls.find((c) => c.method === "PUT");
check(
  "update() puts post_login_html on the wire",
  put && Object.prototype.hasOwnProperty.call(put.body, "post_login_html"),
  `PUT body keys were ${put ? JSON.stringify(Object.keys(put.body)) : "(no PUT at all)"} -- the field is missing from update()'s whitelist in portal.service.ts`,
);
check(
  "update() sends the exact HTML",
  put?.body.post_login_html === HTML,
  JSON.stringify(put?.body.post_login_html),
);

// --- 2. The other half: does it come back? ------------------------------
check(
  "update() returns the saved value (write -> read)",
  portal.login.postLoginHtml === HTML,
  JSON.stringify(portal.login.postLoginHtml),
);
check(
  "the stored row really holds it",
  B.row.post_login_html === HTML,
  JSON.stringify(B.row.post_login_html),
);

// --- 3. A genuinely separate reload, not the update()'s own echo --------
const reloaded = await portalService.get("cfg-1", "org-1");
check(
  "a fresh get() still has it (this is the fontFamily test)",
  reloaded.login.postLoginHtml === HTML,
  JSON.stringify(reloaded.login.postLoginHtml),
);
const listed = await portalService.list({
  organizationId: "org-1",
  page: 1,
  pageSize: 100,
  sort: { key: "updatedAt", dir: "desc" },
});
check(
  "list() maps it too (the customer Portal page's own load path)",
  listed.items[0]?.login.postLoginHtml === HTML,
  JSON.stringify(listed.items[0]?.login.postLoginHtml),
);

// --- 4. Clearing must reach SQL NULL, not "" ----------------------------
B.calls.length = 0;
portal = await portalService.update("cfg-1", { login: { postLoginHtml: "   \n  " } }, "org-1");
const clearPut = B.calls.find((c) => c.method === "PUT");
check(
  "a whitespace-only value clears the column to null",
  clearPut?.body.post_login_html === null,
  JSON.stringify(clearPut?.body.post_login_html),
);
check(
  'and reads back as "", not " "',
  portal.login.postLoginHtml === "",
  JSON.stringify(portal.login.postLoginHtml),
);

// --- 5. Untouched by an unrelated save ----------------------------------
await portalService.update("cfg-1", { login: { postLoginHtml: HTML } }, "org-1");
B.calls.length = 0;
portal = await portalService.update("cfg-1", { seo: { pageTitle: "Hello" } }, "org-1");
const unrelated = B.calls.find((c) => c.method === "PUT");
check(
  "a save that does not touch the field does not send it",
  unrelated && !Object.prototype.hasOwnProperty.call(unrelated.body, "post_login_html"),
  JSON.stringify(unrelated?.body),
);
check(
  "and the value survives that save",
  portal.login.postLoginHtml === HTML,
  JSON.stringify(portal.login.postLoginHtml),
);

// --- 6. CREATE path -----------------------------------------------------
B.calls.length = 0;
await portalService.create({
  name: "New Portal",
  organizationId: "org-1",
  locationId: "loc-1",
  login: { postLoginHtml: HTML },
});
const post = B.calls.find((c) => c.method === "POST");
check(
  "create() sends post_login_html too",
  post?.body.post_login_html === HTML,
  JSON.stringify(post?.body),
);

// --- 7. Backend not merged yet: absent column must read as "" -----------
// Set a redirect URL alongside the HTML first, so the assertion below can
// tell "the field degraded to empty" apart from "the whole read broke".
await portalService.update(
  "cfg-1",
  { login: { redirectUrl: "https://example.com/welcome", postLoginHtml: HTML } },
  "org-1",
);
B.columnMissing = true;
const preMigration = await portalService.get("cfg-1", "org-1");
check(
  'an absent post_login_html reads as "" (backend gap tolerated)',
  preMigration.login.postLoginHtml === "",
  JSON.stringify(preMigration.login.postLoginHtml),
);
check(
  "and the rest of the row is unaffected by the gap",
  preMigration.login.redirectUrl === "https://example.com/welcome",
  JSON.stringify(preMigration.login.redirectUrl),
);

// --- 8. The sanitized echo: the save's OWN response carries the stored,
//        sanitized value, and that is what the editor repaints from. If this
//        ever stopped holding, PortalPage's repaint would silently show the
//        venue markup that is not in the database.
B.columnMissing = false;
B.sanitize = true;
const DIRTY = '<a href="/menu">Menu</a><script>steal()</script>';
const echoed = await portalService.update("cfg-1", { login: { postLoginHtml: DIRTY } }, "org-1");
check(
  "the save response returns the SANITIZED value, not what was sent",
  echoed.login.postLoginHtml !== DIRTY && echoed.login.postLoginHtml.length > 0,
  JSON.stringify(echoed.login.postLoginHtml),
);
check(
  "the sanitized echo dropped the script",
  !echoed.login.postLoginHtml.includes("<script"),
  JSON.stringify(echoed.login.postLoginHtml),
);
check(
  'the sanitized echo forced target="_blank" on the anchor (why allow-popups is required)',
  echoed.login.postLoginHtml.includes('target="_blank"'),
  JSON.stringify(echoed.login.postLoginHtml),
);
check(
  "a later get() agrees with the echo (no drift between the two reads)",
  (await portalService.get("cfg-1", "org-1")).login.postLoginHtml === echoed.login.postLoginHtml,
  "echo and reload disagreed",
);
B.sanitize = false;

// --- 9. The limits module: bytes, the exact cap, and the 400 envelope ----
const limits = await import(
  pathToFileURL(await buildOne(join(ROOT, "src/lib/post-login-html.ts"), join(work, "limits.mjs")))
    .href
);
check(
  "the cap is exactly the backend's 65536",
  limits.POST_LOGIN_HTML_MAX_BYTES === 65536,
  String(limits.POST_LOGIN_HTML_MAX_BYTES),
);
check(
  "the counter counts UTF-8 BYTES, not characters",
  limits.postLoginHtmlByteLength("नमस्ते") === 18 &&
    limits.postLoginHtmlByteLength("\u{1F600}") === 4,
  `got ${limits.postLoginHtmlByteLength("नमस्ते")} and ${limits.postLoginHtmlByteLength("\u{1F600}")}`,
);
check(
  "the 400 envelope {field, max_bytes, actual_bytes} is recognized",
  /70,000/.test(
    limits.postLoginHtmlLimitErrorMessage({
      status: 400,
      data: { field: "post_login_html", max_bytes: 65536, actual_bytes: 70000 },
    }) ?? "",
  ),
  JSON.stringify(
    limits.postLoginHtmlLimitErrorMessage({
      status: 400,
      data: { field: "post_login_html", max_bytes: 65536, actual_bytes: 70000 },
    }),
  ),
);
check(
  "and the splash envelope is left alone (the two helpers do not collide)",
  limits.postLoginHtmlLimitErrorMessage({
    status: 400,
    data: { field: "splash_headline", max_length: 26, actual_length: 40 },
  }) === null,
  "post-login helper claimed a splash error",
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll post-login HTML round-trip checks passed.");
