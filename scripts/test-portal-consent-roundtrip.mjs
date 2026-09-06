#!/usr/bin/env node
/**
 * Round-trip regression test for the venue's legal copy
 * (`captive_portal_configs.terms_and_conditions_text` / `_url`,
 * `privacy_policy_text` / `_url`, exposed as `Portal.consent`).
 *
 * Run: node scripts/test-portal-consent-roundtrip.mjs
 *
 * THE FAILURE MODE THIS LOCKS DOWN
 * --------------------------------
 * Identical in shape to `test-post-login-html-roundtrip.mjs`, because it is
 * the same bug on a different field. `src/services/portal.service.ts` has a
 * serialization WHITELIST on its write path: `update()` builds an explicit
 * `body` field by field, `create()` an explicit POST payload. A field that
 * `toPortal()` maps on the way IN but neither of those maps on the way OUT
 * renders correctly, accepts an edit, and is silently discarded on save --
 * with a success toast.
 *
 * The Terms & Conditions textarea on the Portal editor shipped exactly that
 * way, and worse than `fontFamily` did: the read side pulled the textarea's
 * value out of `terms_and_conditions_url` (a URL column holding prose), the
 * save patch had no `consent` key at all, and the whitelist had no `_text`
 * entries. Net effect: all four consent columns were empty for every
 * production config. That is not cosmetic -- the backend's content hash
 * behind `guest_consents.terms_version` hashes those columns, so it returned
 * None for every venue and any backfill of `terms_version` would have
 * backfilled nothing.
 *
 * "The UI renders my value" therefore proves nothing. This drives the REAL
 * service through a REAL save and a REAL reload against an in-memory
 * backend, and asserts the value survives the whole loop.
 *
 * WHY IT LOOKS LIKE THIS
 * ----------------------
 * Same constraint every other `scripts/test-*.mjs` here works under: there is
 * no test runner in this repo, so this bundles the real TypeScript source
 * with esbuild (already present transitively via vite), substituting exactly
 * one module -- `@/services/api` -- for a recording fake. Everything under
 * test is real: the real `toPortal`, the real `update()` whitelist, the real
 * `create()` payload.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "portal-consent-roundtrip-"));

/* ------------------------------------------------------------------ *
 * The fake backend. One row, in the shape the real API returns, mutated
 * by PUT the way a real PATCH-semantics backend would: only the keys
 * present in the body are touched. That "only the keys present"
 * behaviour is precisely what makes a dropped whitelist entry invisible
 * in production, so the fake has to reproduce it or the test would pass
 * for the wrong reason.
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

globalThis.__BACKEND = { row, calls: [] };

function respond(url) {
  if (url.startsWith("/captive-portal-configs/")) return { data: { ...row } };
  if (url === "/captive-portal-configs")
    return { data: { items: [ { ...row } ], page: 1, page_size: 100, total_items: 1, total_pages: 1, has_next: false, has_previous: false } };
  if (url.startsWith("/organizations/") && url.endsWith("/locations"))
    return { data: { items: [], page: 1, page_size: 100, total_items: 0, total_pages: 0, has_next: false, has_previous: false } };
  if (url.startsWith("/organizations/")) return { data: { id: "org-1", name: "Org One" } };
  if (url === "/organizations")
    return { data: { items: [{ id: "org-1", name: "Org One" }], page: 1, page_size: 100, total_items: 1, total_pages: 1, has_next: false, has_previous: false } };
  throw new Error("unstubbed GET " + url);
}

export const api = {
  async get(url) {
    globalThis.__BACKEND.calls.push({ method: "GET", url });
    return respond(url);
  },
  async put(url, body) {
    globalThis.__BACKEND.calls.push({ method: "PUT", url, body });
    // Merge only what was actually SENT -- the whole point of the test.
    for (const [k, v] of Object.entries(body ?? {})) row[k] = v;
    return { data: { ...row } };
  },
  async post(url, body) {
    globalThis.__BACKEND.calls.push({ method: "POST", url, body });
    for (const [k, v] of Object.entries(body ?? {})) row[k] = v;
    return { data: { ...row } };
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

function guessExt(p) {
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

const TERMS = "Guest WiFi is free.\n\nKeep the volume down after 9pm.";
const PRIVACY = "We keep your number to recognize you next visit.";
const TERMS_URL = "https://venue.example/terms.pdf";

// --- 1. UPDATE: does the value actually leave the client? ----------------
B.calls.length = 0;
let portal = await portalService.update("cfg-1", { consent: { termsText: TERMS } }, "org-1");
let put = B.calls.find((c) => c.method === "PUT");
check(
  "update() puts terms_and_conditions_text on the wire",
  put && Object.prototype.hasOwnProperty.call(put.body, "terms_and_conditions_text"),
  `PUT body keys were ${put ? JSON.stringify(Object.keys(put.body)) : "(no PUT at all)"} -- the field is missing from update()'s whitelist in portal.service.ts`,
);
check(
  "update() sends the exact text",
  put?.body.terms_and_conditions_text === TERMS,
  JSON.stringify(put?.body.terms_and_conditions_text),
);

// --- 2. The other half: does it come back? -------------------------------
check(
  "update() returns the saved value (write -> read)",
  portal.consent.termsText === TERMS,
  JSON.stringify(portal.consent.termsText),
);
check(
  "the stored row really holds it",
  B.row.terms_and_conditions_text === TERMS,
  JSON.stringify(B.row.terms_and_conditions_text),
);

// --- 3. A genuinely separate reload, not update()'s own echo -------------
const reloaded = await portalService.get("cfg-1", "org-1");
check(
  "a fresh get() still has it (this is the fontFamily test)",
  reloaded.consent.termsText === TERMS,
  JSON.stringify(reloaded.consent.termsText),
);

const listed = await portalService.list({
  organizationId: "org-1",
  page: 1,
  pageSize: 100,
  sort: { key: "updatedAt", dir: "desc" },
});
check(
  "list() maps it too (the customer Portal page's own load path)",
  listed.items[0]?.consent.termsText === TERMS,
  JSON.stringify(listed.items[0]?.consent.termsText),
);

// --- 4. The text column, not the URL one --------------------------------
// The editor's control is a prose textarea; it used to round-trip through
// `terms_and_conditions_url`. Writing prose into a URL column is how the
// URL half of this feature stayed permanently unusable.
check(
  "a text save leaves terms_and_conditions_url alone",
  B.row.terms_and_conditions_url === null,
  JSON.stringify(B.row.terms_and_conditions_url),
);

// --- 5. Clearing must reach SQL NULL, not "" -----------------------------
// `/portal/terms` treats a falsy value as "this venue published nothing" and
// serves the platform's own default terms + privacy copy. An empty string
// would defeat that check and publish a blank document instead.
B.calls.length = 0;
portal = await portalService.update("cfg-1", { consent: { termsText: "   \n  " } }, "org-1");
const clearPut = B.calls.find((c) => c.method === "PUT");
check(
  "a whitespace-only value clears the column to null",
  clearPut?.body.terms_and_conditions_text === null,
  JSON.stringify(clearPut?.body.terms_and_conditions_text),
);
check(
  'and reads back as "", not " "',
  portal.consent.termsText === "",
  JSON.stringify(portal.consent.termsText),
);

// --- 6. Untouched by an unrelated save -----------------------------------
await portalService.update("cfg-1", { consent: { termsText: TERMS } }, "org-1");
B.calls.length = 0;
portal = await portalService.update("cfg-1", { seo: { pageTitle: "Hello" } }, "org-1");
const unrelated = B.calls.find((c) => c.method === "PUT");
check(
  "a save that does not touch consent does not send it",
  unrelated && !Object.prototype.hasOwnProperty.call(unrelated.body, "terms_and_conditions_text"),
  JSON.stringify(unrelated?.body),
);
check(
  "and the value survives that save",
  portal.consent.termsText === TERMS,
  JSON.stringify(portal.consent.termsText),
);

// --- 7. All four columns, both directions --------------------------------
// The backend's terms_version hash covers all four, so a venue that publishes
// only a link must be versioned as accurately as one that publishes prose.
B.calls.length = 0;
portal = await portalService.update(
  "cfg-1",
  { consent: { termsText: TERMS, privacyText: PRIVACY, termsUrl: TERMS_URL, privacyUrl: "" } },
  "org-1",
);
put = B.calls.find((c) => c.method === "PUT");
check(
  "update() sends all four consent columns",
  put?.body.terms_and_conditions_text === TERMS &&
    put?.body.privacy_policy_text === PRIVACY &&
    put?.body.terms_and_conditions_url === TERMS_URL &&
    put?.body.privacy_policy_url === null,
  JSON.stringify(put?.body),
);
check(
  "and toPortal reads all four back",
  portal.consent.termsText === TERMS &&
    portal.consent.privacyText === PRIVACY &&
    portal.consent.termsUrl === TERMS_URL &&
    portal.consent.privacyUrl === "",
  JSON.stringify(portal.consent),
);
check(
  "termsRequired/privacyRequired stay derived from whichever half is set",
  portal.consent.termsRequired === true && portal.consent.privacyRequired === true,
  JSON.stringify(portal.consent),
);

// --- 8. CREATE path ------------------------------------------------------
B.calls.length = 0;
await portalService.create({
  name: "New Portal",
  organizationId: "org-1",
  locationId: "loc-1",
  consent: { termsText: TERMS, privacyText: PRIVACY },
});
const post = B.calls.find((c) => c.method === "POST");
check(
  "create() sends the _text columns too",
  post?.body.terms_and_conditions_text === TERMS && post?.body.privacy_policy_text === PRIVACY,
  JSON.stringify(post?.body),
);
B.calls.length = 0;
await portalService.create({ name: "Bare", organizationId: "org-1", locationId: "loc-1" });
const barePost = B.calls.find((c) => c.method === "POST");
check(
  "a create with no consent leaves all four columns null",
  barePost?.body.terms_and_conditions_text === null &&
    barePost?.body.privacy_policy_text === null &&
    barePost?.body.terms_and_conditions_url === null &&
    barePost?.body.privacy_policy_url === null,
  JSON.stringify(barePost?.body),
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll portal consent round-trip checks passed.");
