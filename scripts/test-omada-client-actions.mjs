/**
 * The wire contract for the customer dashboard's per-device controller
 * actions (`src/services/omada-client-controls.service.ts`), driven against a
 * stubbed `api` so the REAL mapping runs.
 *
 * WHAT THIS LOCKS DOWN, in order of how badly a regression would hurt:
 *
 *  1. NO REQUEST CARRIES AN INTEGRATION ID, A SITE ID OR A CONTROLLER
 *     ADDRESS. Every path is `/network-integrations/locations/{id}/clients/*`
 *     and the only other thing sent is a MAC. That is the backend's tenancy
 *     design, not a URL style: the integration is resolved with the caller's
 *     own organization AND the location in the WHERE clause, so a location
 *     belonging to another tenant resolves to nothing. A path that grew an id
 *     would be this console reintroducing the defect class the codebase has
 *     found in fourteen endpoints.
 *  2. NO CUSTOMER ROUTE IS A MASTER ROUTE. `network_integrations.*` is
 *     ScopeType.GLOBAL and a venue admin holds none of it, so
 *     `/network-integrations/{integration_id}/...` from here would ship a 403
 *     to a paying customer.
 *  3. `performed` DEFAULTS TO FALSE AND IS READ, NEVER ASSUMED. It arrives
 *     false on an HTTP 200 -- the request was fine and the controller did not
 *     do the thing. PR #279 shipped a green tick over exactly that.
 *  4. EVERY CAPABILITY DEFAULTS TO FALSE. A field nobody sent is "we cannot",
 *     never "we can": defaulting to true puts a live button in front of an
 *     owner on the strength of nothing.
 *  5. THE ENVELOPE IS UNWRAPPED EXACTLY ONCE. `api`'s interceptor already
 *     strips `{success, message, data, request_id}`; reading `data.data` here
 *     would find `undefined` and every field would fall back to its "we
 *     cannot" default -- silently, and looking exactly like a refusal.
 *  6. A SPEED IS EITHER A PROFILE OR RATES, NEVER BOTH. The backend 422s on
 *     both-or-neither, so what goes on the wire is asserted directly.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-controller-devices-service.mjs` for the same note).
 *
 * Run: node scripts/test-omada-client-actions.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, e) =>
  check(name, a === e, `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);

const outdir = mkdtempSync(join(tmpdir(), "omada-client-actions-"));

// The stub records every call and hands back whatever the test queued. It
// throws the shape `toAppError` produces (a plain object carrying `status`),
// because that is what the real service's 404 branch has to recognise.
writeFileSync(
  join(outdir, "api-stub.mjs"),
  `
globalThis.__cc ??= { calls: [], next: null, error: null };
function record(method) {
  return async (url, a, b) => {
    const body = method === "get" ? undefined : a;
    const opts = method === "get" ? a : b;
    globalThis.__cc.calls.push({ method, url, body, opts });
    if (globalThis.__cc.error) { const e = globalThis.__cc.error; globalThis.__cc.error = null; throw e; }
    return { data: globalThis.__cc.next };
  };
}
export const api = { get: record("get"), post: record("post"), put: record("put") };
`,
);
writeFileSync(
  join(outdir, "orgid-stub.mjs"),
  `export async function resolveOrganizationId() { return "org-42"; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from "${p("src/services/omada-client-controls.service.ts")}";`);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /services\/api$|^\.\/api$/ }, () => ({
          path: join(outdir, "api-stub.mjs"),
        }));
        b.onResolve({ filter: /organization-id$/ }, () => ({
          path: join(outdir, "orgid-stub.mjs"),
        }));
      },
    },
  ],
});

const { omadaClientControlsService: svc, CUSTOMER_CLIENT_ROUTES_LANDED } = await import(
  `file://${outfile}`
);
const st = globalThis.__cc;
const LOC = "11111111-2222-3333-4444-555555555555";
const MAC = "AA:BB:CC:DD:EE:01";
const reset = () => {
  st.calls.length = 0;
  st.next = null;
  st.error = null;
};

// =====================================================================
console.log("\n1. the switch is on");
// =====================================================================
eq("the org-scoped routes are declared landed", CUSTOMER_CLIENT_ROUTES_LANDED, true);

// =====================================================================
console.log("\n2. capabilities: every field defaults to false, reasons come through unedited");
// =====================================================================
const LEGACY_REASON =
  "This venue's controller is connected with a hotspot operator login, which can let guests on " +
  "and disconnect them but cannot change a device's settings. Add Open API credentials to the " +
  "controller (Settings > Platform Integration > Open API) to turn this on.";

reset();
st.next = {
  set_rate_limit: { supported: false, reason: LEGACY_REASON },
  clear_rate_limit: { supported: false, reason: LEGACY_REASON },
  block: { supported: false, reason: LEGACY_REASON },
  unblock: { supported: false, reason: LEGACY_REASON },
  list_blocked: { supported: false, reason: "not readable through this connection" },
  disconnect: { supported: true, reason: null },
  client_stats: { supported: false, reason: LEGACY_REASON },
};
let caps = await svc.readCapabilities(LOC);
eq(
  "the capabilities path is venue-scoped",
  st.calls[0].url,
  `/network-integrations/locations/${LOC}/clients/capabilities`,
);
eq("it is a GET", st.calls[0].method, "get");
check(
  "it is org-scoped",
  st.calls[0].opts?.headers?.["X-Organization-Id"] === "org-42",
  JSON.stringify(st.calls[0].opts?.headers),
);
eq("set_rate_limit -> setRateLimit", caps.setRateLimit.supported, false);
eq("the backend's reason is carried unedited", caps.setRateLimit.reason, LEGACY_REASON);
eq("disconnect survives a hotspot-operator login", caps.disconnect.supported, true);
eq("a supported capability carries no reason", caps.disconnect.reason, null);
eq("list_blocked is reported, and false", caps.listBlocked.supported, false);

// A body that says nothing at all. Every answer must be "we cannot".
reset();
st.next = {};
caps = await svc.readCapabilities(LOC);
for (const key of [
  "setRateLimit",
  "clearRateLimit",
  "block",
  "unblock",
  "listBlocked",
  "disconnect",
  "clientStats",
]) {
  eq(`${key} defaults to unsupported when nobody said`, caps[key].supported, false);
}

// Truthy-but-not-true must not read as supported either.
reset();
st.next = { block: { supported: "yes" }, disconnect: { supported: 1 } };
caps = await svc.readCapabilities(LOC);
eq("a string does not count as supported", caps.block.supported, false);
eq("a number does not count as supported", caps.disconnect.supported, false);

// THE DOUBLE-UNWRAP. If this module read `data.data`, a real payload would
// come back as an empty object and every capability would silently be false.
reset();
st.next = {
  data: { block: { supported: true, reason: null } },
  success: true,
  message: "Client capabilities",
};
caps = await svc.readCapabilities(LOC);
eq(
  "the envelope is not unwrapped a second time",
  caps.block.supported,
  false, // `data.block` is undefined on this (already-unwrapped-looking) body
);

// A 404 is "this location has no controller", which the backend makes
// deliberately indistinguishable from "that location is not yours". Neither is
// an error to report; both are "nothing has told us".
reset();
st.error = { status: 404, message: "This location has no network controller connected" };
eq("a 404 reads as nothing-has-told-us", await svc.readCapabilities(LOC), null);
reset();
st.error = { response: { status: 404 } };
eq("an axios-shaped 404 reads the same", await svc.readCapabilities(LOC), null);
// Anything else is a real failure and must not be laundered into `null`,
// which the ladder renders as a calm sentence about the venue.
reset();
st.error = { status: 500, message: "boom" };
let threw = false;
try {
  await svc.readCapabilities(LOC);
} catch {
  threw = true;
}
check("a 500 is not laundered into a calm null", threw);

// =====================================================================
console.log("\n3. the five writes: path, verb, body");
// =====================================================================
const ok = (over) => ({
  action: "block",
  performed: true,
  client_mac: "AA:BB:CC:**:**:01",
  rate_limit: null,
  ...over,
});

for (const [label, call, method, suffix, action] of [
  ["block", () => svc.blockClient(LOC, MAC), "post", "/block", "block"],
  ["unblock", () => svc.unblockClient(LOC, MAC), "post", "/unblock", "unblock"],
  ["disconnect", () => svc.disconnectClient(LOC, MAC), "post", "/disconnect", "disconnect"],
  ["clear speed", () => svc.clearSpeed(LOC, MAC), "post", "/speed/clear", "clear_rate_limit"],
]) {
  reset();
  st.next = ok({ action });
  const facts = await call();
  const sent = st.calls[0];
  eq(`${label} path`, sent.url, `/network-integrations/locations/${LOC}/clients${suffix}`);
  eq(`${label} verb`, sent.method, method);
  eq(`${label} sends the MAC exactly as held`, sent.body.client_mac, MAC);
  eq(`${label} sends nothing else`, Object.keys(sent.body).join(","), "client_mac");
  eq(`${label} reads performed`, facts.performed, true);
  eq(`${label} echoes the masked MAC the backend returned`, facts.clientMac, "AA:BB:CC:**:**:01");
}

// The speed write is a PUT and takes EITHER a profile OR rates.
reset();
st.next = ok({ action: "set_rate_limit" });
await svc.setSpeed(LOC, MAC, { queueProfileId: "prof-1" });
eq("speed path", st.calls[0].url, `/network-integrations/locations/${LOC}/clients/speed`);
eq("speed is a PUT", st.calls[0].method, "put");
eq("a profile goes as its id", st.calls[0].body.queue_profile_id, "prof-1");
check(
  "a profile does NOT also send rates -- the backend 422s on both",
  !("down_kbps" in st.calls[0].body) && !("up_kbps" in st.calls[0].body),
  JSON.stringify(st.calls[0].body),
);

reset();
st.next = ok({ action: "set_rate_limit" });
await svc.setSpeed(LOC, MAC, { downKbps: 2000, upKbps: 0 });
eq("explicit rates go as kbps", st.calls[0].body.down_kbps, 2000);
eq(
  "zero on a direction is sent, not dropped -- it means do not limit it",
  st.calls[0].body.up_kbps,
  0,
);
check(
  "explicit rates do NOT also send a profile",
  !("queue_profile_id" in st.calls[0].body),
  JSON.stringify(st.calls[0].body),
);

reset();
st.next = ok({ action: "set_rate_limit" });
await svc.setSpeed(LOC, MAC, { downKbps: 5000 });
check(
  "an unnamed direction is omitted, not sent as null",
  !("up_kbps" in st.calls[0].body),
  JSON.stringify(st.calls[0].body),
);

// =====================================================================
console.log("\n4. performed:false, and the rate limit that comes back with it");
// =====================================================================
reset();
st.next = ok({ action: "block", performed: false });
eq("performed:false on a 200 is read as false", (await svc.blockClient(LOC, MAC)).performed, false);

reset();
st.next = {}; // a body we could not read at all
eq(
  "a body with no `performed` is not cheerful about it",
  (await svc.blockClient(LOC, MAC)).performed,
  false,
);
eq(
  "and falls back to the MAC we sent rather than to nothing in particular",
  (await svc.blockClient(LOC, MAC)).clientMac,
  MAC,
);

reset();
st.next = ok({
  action: "set_rate_limit",
  rate_limit: {
    enabled: true,
    applied_down_kbps: 2000,
    applied_up_kbps: null,
    requested_down_kbps: 1500,
    requested_up_kbps: null,
    clamped: true,
  },
});
const rl = (await svc.setSpeed(LOC, MAC, { downKbps: 1500 })).rateLimit;
eq("applied_down_kbps -> appliedDownKbps", rl.appliedDownKbps, 2000);
eq("requested is carried but is not the number to render", rl.requestedDownKbps, 1500);
eq("null on a direction stays null -- unlimited, not zero", rl.appliedUpKbps, null);
eq("clamped comes through", rl.clamped, true);

reset();
st.next = ok({ action: "block", rate_limit: null });
eq("an action with no rate limit has none", (await svc.blockClient(LOC, MAC)).rateLimit, null);

// =====================================================================
console.log("\n5. nothing here is a Master route, and nothing here names a controller");
// =====================================================================
const source = readFileSync(p("src/services/omada-client-controls.service.ts"), "utf8");
// Comments stripped: this file's header DESCRIBES the Master route in order to
// say it must not be called, and a grep that cannot tell prose from code would
// make that explanation unwritable.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check(
  "no path interpolates an integration id",
  !/network-integrations\/\$\{/.test(code),
  "`/network-integrations/{integration_id}/...` is ScopeType.GLOBAL",
);
for (const forbidden of [
  "site_id",
  "siteId",
  "controller_url",
  "integration_id",
  "integrationId",
]) {
  check(
    `the service never sends \`${forbidden}\``,
    !new RegExp(forbidden).test(code),
    "the caller names a location and a MAC, and nothing else",
  );
}
// Every URL every call in this file produced, checked as a set rather than one
// at a time -- a sixth method added later is covered without touching this.
const allUrls = new Set(st.calls.map((c) => c.url));
check(
  "every request went to the venue-scoped clients namespace",
  [...allUrls].every((u) => u.startsWith(`/network-integrations/locations/${LOC}/clients`)),
  [...allUrls].join(" "),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
