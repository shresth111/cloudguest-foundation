/**
 * Login messaging (own WhatsApp/SMS API for guest login codes).
 *
 *   1. SECRETS ARE WRITE-ONLY. A secret input starts empty whatever the
 *      server stored; a blank secret (or secret header value) is left out of
 *      the PUT so the server keeps it; a required secret that was never saved
 *      is refused client-side.
 *   2. THE FORM IS THE REGISTRY'S. Fields, defaults and patterns come from
 *      the adapter schema the backend returns; nothing is vendor-specific.
 *   3. THE TWO TARGETS NEVER MIX. The customer card calls
 *      /guest-messaging/providers (org from the session header); Master calls
 *      /platform/organizations/{id}/guest-messaging/providers (org from the
 *      path), for every verb.
 *   4. COPY: the card says "Using Wyfy Guest default" and "Set up by Wyfy
 *      Guest team", says "Verify" (never "test"), and never mentions tunnel
 *      or WireGuard internals.
 *
 * Run: node scripts/test-login-messaging.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, e) =>
  check(
    name,
    JSON.stringify(a) === JSON.stringify(e),
    `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "login-messaging-"));
writeFileSync(
  join(outdir, "api-stub.mjs"),
  `globalThis.__calls = [];
   const rec = (method) => async (url, body) => { globalThis.__calls.push([method, url, body]); return { data: {} }; };
   export const api = { get: rec("GET"), put: rec("PUT"), post: rec("POST"), delete: rec("DELETE") };`,
);
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${p("src/lib/login-messaging-form.ts")}";
   export { loginMessagingService } from "${p("src/services/login-messaging.service.ts")}";`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({
          path: join(outdir, "api-stub.mjs"),
        }));
      },
    },
  ],
});
const m = await import(bundle);

const meta = {
  key: "meta_cloud",
  channel: "whatsapp",
  display_name: "WhatsApp Cloud API (Meta, direct)",
  docs_url: "https://developers.facebook.com/",
  notes: "",
  sender_field: "phone_number_id",
  fields: [
    {
      name: "phone_number_id",
      label: "Phone number id",
      kind: "text",
      required: true,
      help: "",
      placeholder: "",
      options: [],
      pattern: "\\d{1,30}",
      default: null,
      max_length: 2048,
    },
    {
      name: "access_token",
      label: "Access token",
      kind: "secret",
      required: true,
      help: "",
      placeholder: "",
      options: [],
      pattern: null,
      default: null,
      max_length: 2048,
    },
    {
      name: "template_language",
      label: "Template language",
      kind: "text",
      required: true,
      help: "",
      placeholder: "",
      options: [],
      pattern: null,
      default: "en",
      max_length: 2048,
    },
  ],
};
const custom = {
  key: "custom_http",
  channel: "sms",
  display_name: "Custom HTTP API",
  docs_url: "",
  notes: "",
  sender_field: "url",
  fields: [
    {
      name: "url",
      label: "URL",
      kind: "text",
      required: true,
      help: "",
      placeholder: "",
      options: [],
      pattern: null,
      default: null,
      max_length: 2048,
    },
    {
      name: "headers",
      label: "Headers",
      kind: "headers",
      required: false,
      help: "",
      placeholder: "",
      options: [],
      pattern: null,
      default: null,
      max_length: 2048,
    },
  ],
};
const own = {
  provider_type: "meta_cloud",
  display: {
    phone_number_id: "1234567890",
    access_token: { set: true, hint: "…0001" },
    template_language: "en",
  },
};

console.log("secrets are write-only");
const init = m.initialValues(meta, own);
eq("secret input starts empty", init.access_token, "");
eq("non-secret prefilled from display", init.phone_number_id, "1234567890");
eq(
  "placeholder carries the hint only",
  m.secretPlaceholder(own.display.access_token),
  "Saved (…0001). Leave blank to keep.",
);
const kept = m.buildPut(meta, { ...init }, own);
check("a blank saved secret is not sent", kept.body && !("access_token" in kept.body.config));
const fresh = m.buildPut(meta, m.initialValues(meta, null), null);
check(
  "a never-saved required secret is refused",
  fresh.body === null && fresh.errors.access_token === "Required",
);
const typed = m.buildPut(meta, { ...init, access_token: "new-token-value" }, own);
eq("a retyped secret is sent", typed.body?.config.access_token, "new-token-value");

console.log("the form comes from the registry schema");
eq("default fills an empty field", m.initialValues(meta, null).template_language, "en");
const bad = m.buildPut(meta, { ...init, phone_number_id: "12ab" }, own);
check("the schema pattern is enforced", bad.body === null && !!bad.errors.phone_number_id);

console.log("secret headers");
const ownCustom = {
  provider_type: "custom_http",
  display: {
    url: "https://api.vendor.example/otp",
    headers: [
      { name: "X-Api-Key", secret: true, set: true, hint: "…9999" },
      { name: "X-Client", secret: false, value: "wyfy" },
    ],
  },
};
const hv = m.initialValues(custom, ownCustom);
eq("secret header value starts empty", hv.headers[0].value, "");
const hp = m.buildPut(custom, hv, ownCustom);
eq("a blank secret header is sent without a value", hp.body?.config.headers[0], {
  name: "X-Api-Key",
  secret: true,
});
eq("a plain header is sent", hp.body?.config.headers[1], {
  name: "X-Client",
  value: "wyfy",
  secret: false,
});

console.log("customer and Master never mix");
const svc = m.loginMessagingService;
const ownT = { kind: "own" };
const plat = { kind: "platform", organizationId: "org-b" };
globalThis.__calls = [];
await svc.overview(ownT);
await svc.put(ownT, "sms", { config: {} });
await svc.startVerify(ownT, "sms", "+919876543210");
await svc.confirmVerify(ownT, "sms", "123456");
await svc.remove(ownT, "sms");
check(
  "own target only calls /guest-messaging/providers",
  globalThis.__calls.every(([, url]) => url.startsWith("/guest-messaging/providers")),
  JSON.stringify(globalThis.__calls.map((c) => c[1])),
);
globalThis.__calls = [];
await svc.overview(plat);
await svc.put(plat, "whatsapp", { config: {} });
await svc.startVerify(plat, "whatsapp", "+919876543210");
await svc.confirmVerify(plat, "whatsapp", "123456");
await svc.remove(plat, "whatsapp");
check(
  "platform target only calls the path-scoped Master route",
  globalThis.__calls.every(([, url]) =>
    url.startsWith("/platform/organizations/org-b/guest-messaging/providers"),
  ),
  JSON.stringify(globalThis.__calls.map((c) => c[1])),
);
eq("verify sends the typed number", globalThis.__calls[2][2], { to: "+919876543210" });

console.log("copy");
const dir = "src/components/login-messaging";
const sources = readdirSync(join(ROOT, dir))
  .map((f) => read(`${dir}/${f}`))
  .join("\n");
check('says "Using Wyfy Guest default"', sources.includes("Using Wyfy Guest default"));
check('says "Set up by Wyfy Guest team"', sources.includes("Set up by Wyfy Guest team"));
check("never mentions WireGuard or tunnels", !/wireguard|tunnel/i.test(sources));
check(
  'user-facing copy says "Verify", never "test"',
  !/["'>`][^"'<`]*\btest\b[^"'<`]*["'<`]/i.test(
    sources.replace(/data-testid=\{?[^}\s>]*\}?/g, "").replace(/\.test\(/g, "("),
  ),
);
check(
  "the customer Portal page mounts the card",
  read("src/components/features/PortalPage.tsx").includes(
    '<LoginMessagingCard\n        target={{ kind: "own" }}',
  ),
);
check(
  "the Master drawer mounts the card for the drawer's organization",
  read("src/components/master/CustomerAddonsPanel.tsx").includes(
    'target={{ kind: "platform", organizationId }}',
  ),
);

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall login-messaging checks passed");
