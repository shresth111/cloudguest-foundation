/**
 * Regression test for the TP-Link Omada network-integration frontend seam.
 *
 * WHY THIS EXISTS
 * ---------------
 * The backend for `/api/v1/network-integrations` does not exist yet: this
 * whole feature was written against `/Users/shresth/wyfy-omada/CONTRACT.md`
 * §3 in parallel with it. So nothing about it has been exercised against a
 * real API, let alone a real controller, and the two things most likely to be
 * silently wrong are exactly the two things a typecheck cannot see:
 *
 *   1. THE ORG HEADER. Every customer route in this domain resolves
 *      `CurrentOrganization` from `X-Organization-Id`. Omitting it does not
 *      loosen scoping -- it downgrades the caller to a GLOBAL-scope
 *      permission check and 403s every call, reads included. That exact bug
 *      has shipped twice in this repo (`isp.service.ts`,
 *      `mac-authorization.service.ts`), each time on a subset of methods, so
 *      "I remembered on the ones I was thinking about" is a known-insufficient
 *      standard. It is asserted here per method, in both directions: present
 *      on every customer call, ABSENT on every platform call -- attaching one
 *      there would narrow the master console to a single tenant while looking
 *      like it worked.
 *
 *   2. THE STATUS AND ERROR COPY. The contract requires all seven statuses to
 *      render with distinct, honest copy, and specifically that `auth_failed`
 *      (the credentials are rejected) and `sync_error` (the credentials are
 *      fine, a poll failed) do not read the same -- they send the reader to
 *      two different places. It also requires that a raw error code never
 *      reaches a customer. Both are one careless "tidy up the duplicate
 *      strings" commit away from being untrue, and neither breaks anything
 *      that would be noticed.
 *
 * Also pinned: credentials for the *unselected* auth mode are stripped before
 * a request leaves (the wizard holds a draft of both while the radio is
 * flipped, so without that filter an operator password gets POSTed and stored
 * as part of an Open API credential blob nothing ever reads), and no
 * credential appears in anything this module hands back to a component.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-isp-links-single-flight.mjs` for the same note). The real
 * service and the real copy tables are bundled with esbuild against a
 * counting fake of `@/services/api`, so the assertions are about the shipped
 * code rather than a restatement of it, and the mocked responses stand in for
 * the backend that is still being built.
 *
 * Run: node scripts/test-network-integration-contract.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "network-integration-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

// A recording stand-in for the axios instance. Every method the service uses
// is here; each records the URL, the body and the headers it was handed, and
// returns whatever the current test has queued.
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export const calls = [];
   let nextData = {};
   export function setNext(d) { nextData = d; }
   export function reset() { calls.length = 0; nextData = {}; }
   function record(client, method, url, body, config) {
     calls.push({
       client,
       method,
       url,
       body,
       params: config?.params,
       headers: config?.headers ?? {},
     });
     return { data: nextData };
   }
   export const api = {
     async get(url, config) { return record("api", "get", url, undefined, config); },
     async post(url, body, config) { return record("api", "post", url, body, config); },
     async patch(url, body, config) { return record("api", "patch", url, body, config); },
     async put(url, body, config) { return record("api", "put", url, body, config); },
     async delete(url, config) { return record("api", "delete", url, undefined, config); },
   };
   // The UNAUTHENTICATED client, recorded separately so a test can assert
   // which of the two a given call went out on. That distinction is the
   // point for the portal routes: \`api\` carries an admin JWT, a
   // 401-refresh-retry loop and an X-Organization-Id header read out of
   // localStorage -- and a guest's browser has none of those things and
   // must not appear to. The org header in particular would be a claim
   // about which tenant this is, sent by an unauthenticated caller, on the
   // two endpoints whose whole job is to establish that answer server-side.
   export const guestPortalApi = {
     async get(url, config) { return record("guest", "get", url, undefined, config); },
     async post(url, body, config) { return record("guest", "post", url, body, config); },
   };
   // \`guest-portal-api.ts\` imports this from \`@/services/api\`; it is never
   // called here (nothing in this suite makes a request fail), but it has
   // to exist for the module to link.
   export function toAppError(e) { return e; }
   export default api;`,
);

// The real resolver would reach for a token and issue `/me/organizations`.
// What matters here is only that the service awaits it and puts the answer in
// a header, so a fixed id is enough.
const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-under-test"; }
   export function peekOrganizationId() { return "org-under-test"; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { networkIntegrationService, guestPortalIntegrationService } from "${p("src/services/network-integration.service.ts")}";
   export * from "${p("src/types/network-integration.ts")}";
   export { calls, setNext, reset } from "${norm(apiStub)}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: {
    "@/services/api": apiStub,
    "@/services/guest-portal-api": apiStub,
    "@/types/network-integration": p("src/types/network-integration.ts"),
    "@/services/organization-id": orgStub,
  },
  plugins: [
    {
      name: "stub-relative-org-id",
      setup(b) {
        b.onResolve({ filter: /(^|\/)organization-id$/ }, () => ({ path: orgStub }));
      },
    },
  ],
  loader: { ".ts": "ts" },
});

const mod = await import(outfile);
const {
  networkIntegrationService: svc,
  calls,
  setNext,
  reset,
  NETWORK_INTEGRATION_STATUS_LABEL,
  NETWORK_INTEGRATION_STATUS_DETAIL,
  NETWORK_INTEGRATION_STATUS_TONE,
  NETWORK_INTEGRATION_ERROR_COPY,
  describeIntegrationError,
} = mod;

const ALL_STATUSES = [
  "connected",
  "connecting",
  "auth_failed",
  "connection_failed",
  "disabled",
  "sync_error",
  "unconfigured",
];

// The codes the contract's own tables list (§2 + §3's "Error payloads").
const CONTRACT_ERROR_CODES = [
  "OMADA_AUTH_FAILED",
  "OMADA_CONNECTION_FAILED",
  "OMADA_TIMEOUT",
  "OMADA_RATE_LIMITED",
  "OMADA_INVALID_CONTROLLER",
  "OMADA_SITE_NOT_FOUND",
  "OMADA_CLIENT_NOT_FOUND",
  "OMADA_AUTHORIZATION_FAILED",
  "OMADA_API_UNSUPPORTED",
  "OMADA_SESSION_EXPIRED",
  "NETWORK_INTEGRATION_NOT_FOUND",
  "NETWORK_INTEGRATION_DISABLED",
  "NETWORK_INTEGRATION_URL_REJECTED",
  "NETWORK_INTEGRATION_PROVIDER_UNSUPPORTED",
  "GUEST_SESSION_NOT_ACTIVE",
];

/** A complete `NetworkIntegration` as CONTRACT.md §3 writes it. Deliberately
 * exhaustive: a field the backend sends and the mapper forgets is invisible
 * to a typecheck (the mapped object still satisfies its interface, the value
 * is just `undefined` at runtime), and it is the whole class of bug this
 * fixture exists to catch. */
const BACKEND_INTEGRATION = {
  id: "int-1",
  organization_id: "org-under-test",
  location_id: "loc-1",
  organization_name: "Marina Bay Hotel",
  location_name: "Lobby",
  provider: "omada",
  name: "Lobby controller",
  status: "connected",
  is_enabled: true,
  base_url: "https://controller.example.com:8043",
  auth_mode: "openapi",
  controller_id: "abc123",
  controller_version: "5.14.20.9",
  external_site_id: "site-1",
  external_site_name: "Default",
  guest_ssid_name: "Hotel Guest",
  guest_ssid_id: "ssid-1",
  session_duration_seconds: 3600,
  sync_interval_seconds: 300,
  last_sync_at: "2026-09-10T09:00:00Z",
  last_sync_status: "ok",
  last_error_code: null,
  last_error_message: null,
  last_error_at: null,
  device_count: 4,
  client_count: 37,
  active_authorization_count: 12,
  has_credentials: true,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-10T09:00:00Z",
};

// ---------------------------------------------------------------------------
// 1. All seven statuses, with distinct and honest copy.
// ---------------------------------------------------------------------------

console.log("\nall seven statuses render, and none of them shares another's words");

for (const s of ALL_STATUSES) {
  check(
    `${s}: has a label, a sentence and a tone`,
    !!NETWORK_INTEGRATION_STATUS_LABEL[s] &&
      !!NETWORK_INTEGRATION_STATUS_DETAIL[s] &&
      !!NETWORK_INTEGRATION_STATUS_TONE[s],
  );
}
check(
  "the copy tables cover exactly the seven contract statuses",
  Object.keys(NETWORK_INTEGRATION_STATUS_LABEL).sort().join(",") ===
    ALL_STATUSES.slice().sort().join(","),
  Object.keys(NETWORK_INTEGRATION_STATUS_LABEL).join(","),
);
{
  const labels = ALL_STATUSES.map((s) => NETWORK_INTEGRATION_STATUS_LABEL[s]);
  check(
    "no two statuses share a label",
    new Set(labels).size === labels.length,
    labels.join(" | "),
  );
  const details = ALL_STATUSES.map((s) => NETWORK_INTEGRATION_STATUS_DETAIL[s]);
  check("no two statuses share a sentence", new Set(details).size === details.length);
}
// The contract calls this one out by name, so it gets its own assertion
// rather than being covered only by the general uniqueness check above:
// wrong credentials and a failed poll are different problems with different
// fixes, and collapsing them is a plausible future "cleanup".
check(
  "auth_failed and sync_error do not read the same",
  NETWORK_INTEGRATION_STATUS_DETAIL.auth_failed !== NETWORK_INTEGRATION_STATUS_DETAIL.sync_error &&
    NETWORK_INTEGRATION_STATUS_LABEL.auth_failed !== NETWORK_INTEGRATION_STATUS_LABEL.sync_error,
);
check(
  "auth_failed says the credentials are the problem",
  /credential/i.test(NETWORK_INTEGRATION_STATUS_DETAIL.auth_failed),
);
check(
  "sync_error says the credentials are NOT the problem",
  /credentials are fine|credentials were not/i.test(NETWORK_INTEGRATION_STATUS_DETAIL.sync_error),
);
check(
  "connection_failed distinguishes itself from auth_failed",
  /not the problem|reach the controller/i.test(NETWORK_INTEGRATION_STATUS_DETAIL.connection_failed),
);

// ---------------------------------------------------------------------------
// 2. Error codes become sentences, never codes.
// ---------------------------------------------------------------------------

console.log("\nnormalized error codes become sentences, and never leak the code");

for (const code of CONTRACT_ERROR_CODES) {
  check(`${code}: has human copy`, !!NETWORK_INTEGRATION_ERROR_COPY[code]);
}
check(
  "no copy string contains a raw SCREAMING_SNAKE code",
  Object.values(NETWORK_INTEGRATION_ERROR_COPY).every((s) => !/[A-Z]{3,}_[A-Z_]{3,}/.test(s)),
);
check(
  "a known code resolves to our own sentence, not the backend's",
  describeIntegrationError("OMADA_AUTH_FAILED", "raw controller said: 401 Unauthorized") ===
    NETWORK_INTEGRATION_ERROR_COPY.OMADA_AUTH_FAILED,
);
check(
  "an unknown code falls back to the backend's human-safe message",
  describeIntegrationError("OMADA_SOMETHING_NEW", "The controller rejected the request.") ===
    "The controller rejected the request.",
);
{
  const generic = describeIntegrationError(null, null);
  check(
    "nothing at all still yields a sentence",
    generic.length > 20 && /controller/i.test(generic),
  );
  check(
    "an unknown code with no message never surfaces the code",
    !describeIntegrationError("OMADA_SOMETHING_NEW", null).includes("OMADA_SOMETHING_NEW"),
  );
}

// ---------------------------------------------------------------------------
// 3. The org header: on every customer call, on no platform call.
// ---------------------------------------------------------------------------

console.log("\nX-Organization-Id is on every customer call and no platform call");

const CUSTOMER_CALLS = [
  ["list", () => svc.list()],
  ["get", () => svc.get("int-1")],
  [
    "create",
    () =>
      svc.create({
        provider: "omada",
        name: "n",
        baseUrl: "https://c:8043",
        authMode: "openapi",
        credentials: { clientId: "cid", clientSecret: "sec" },
      }),
  ],
  ["update", () => svc.update("int-1", { name: "n2" })],
  ["remove", () => svc.remove("int-1")],
  [
    "testDraftConnection",
    () =>
      svc.testDraftConnection({
        provider: "omada",
        baseUrl: "https://c:8043",
        authMode: "legacy",
        credentials: { username: "op", password: "pw" },
      }),
  ],
  ["testConnection", () => svc.testConnection("int-1")],
  [
    "replaceCredentials",
    () => svc.replaceCredentials("int-1", "openapi", { clientId: "c", clientSecret: "s" }),
  ],
  ["sync", () => svc.sync("int-1")],
  ["getStatus", () => svc.getStatus("int-1")],
  ["listSites", () => svc.listSites("int-1")],
  ["listSsids", () => svc.listSsids("int-1")],
  ["listDevices", () => svc.listDevices("int-1")],
  ["listClients", () => svc.listClients("int-1")],
  ["listEvents", () => svc.listEvents("int-1")],
];

for (const [name, run] of CUSTOMER_CALLS) {
  reset();
  setNext(BACKEND_INTEGRATION);
  await run();
  const header = calls[0]?.headers?.["X-Organization-Id"];
  check(`${name} sends X-Organization-Id`, header === "org-under-test", String(header));
}

const PLATFORM_CALLS = [
  ["getPlatformSummary", () => svc.getPlatformSummary()],
  ["listPlatformIntegrations", () => svc.listPlatformIntegrations()],
  ["getPlatformIntegration", () => svc.getPlatformIntegration("int-1")],
  ["listPlatformEvents", () => svc.listPlatformEvents("int-1")],
  ["enablePlatformIntegration", () => svc.enablePlatformIntegration("int-1")],
  ["disablePlatformIntegration", () => svc.disablePlatformIntegration("int-1")],
  ["testPlatformConnection", () => svc.testPlatformConnection("int-1")],
];

for (const [name, run] of PLATFORM_CALLS) {
  reset();
  setNext(BACKEND_INTEGRATION);
  await run();
  const header = calls[0]?.headers?.["X-Organization-Id"];
  check(
    `${name} sends NO org header (it is a GLOBAL-scope read)`,
    header === undefined,
    String(header),
  );
  check(
    `${name} hits a /platform/ path`,
    (calls[0]?.url ?? "").includes("/platform/"),
    calls[0]?.url,
  );
}

// ---------------------------------------------------------------------------
// 4. Credentials: only the selected mode's pair, and never read back.
// ---------------------------------------------------------------------------

console.log("\nonly the selected auth mode's credentials leave the browser");

reset();
setNext(BACKEND_INTEGRATION);
await svc.create({
  provider: "omada",
  name: "n",
  baseUrl: "https://c:8043",
  authMode: "openapi",
  // A draft of BOTH pairs, exactly as the wizard holds it after the radio has
  // been flipped once.
  credentials: { clientId: "cid", clientSecret: "sec", username: "op", password: "pw" },
});
{
  // Read from the body ITSELF, not from `body.credentials`. The backend's
  // `NetworkIntegrationCreateRequest` extends `_CredentialFields`, so the four
  // credential fields are siblings of `base_url`. This assertion used to read
  // `body.credentials` and passed while the service nested them there -- and
  // pydantic's default `extra="ignore"` meant the backend dropped the whole
  // object without complaining, so the wrong shape produced a 201 for an
  // integration with no credentials that could never authenticate. A test that
  // reads the same wrong place as the code cannot catch that; this one asserts
  // the shape the backend actually parses.
  const sent = calls[0]?.body ?? {};
  check(
    "openapi create sends client_id/client_secret at the TOP LEVEL",
    sent.client_id === "cid" && sent.client_secret === "sec",
  );
  // This used to assert the opposite -- "does NOT send the operator
  // password it never used" -- and that assertion encoded the defect. The
  // controller authorises guests only through its hotspot operator login, in
  // either mode, so an Open API integration saved without it synced green and
  // let nobody online. The Open API form now asks for the operator account on
  // purpose, and it has to arrive.
  check(
    "openapi create ALSO sends the hotspot operator login, which guest sign-in uses",
    sent.username === "op" && sent.password === "pw",
    JSON.stringify(Object.keys(sent)),
  );
  check(
    "create nests nothing under a `credentials` key",
    !("credentials" in sent),
    JSON.stringify(Object.keys(sent)),
  );
}

reset();
setNext(BACKEND_INTEGRATION);
await svc.replaceCredentials("int-1", "legacy", {
  clientId: "cid",
  clientSecret: "sec",
  username: "op",
  password: "pw",
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "legacy rotation sends username/password at the TOP LEVEL",
    sent.username === "op" && sent.password === "pw",
  );
  check(
    "legacy rotation does NOT send the client secret it never used",
    sent.client_id === undefined && sent.client_secret === undefined,
    JSON.stringify(Object.keys(sent)),
  );
  check(
    "rotation nests nothing under a `credentials` key",
    !("credentials" in sent),
    JSON.stringify(Object.keys(sent)),
  );
}

reset();
setNext(BACKEND_INTEGRATION);
await svc.update("int-1", { name: "renamed" });
check(
  "a routine PATCH carries no credential field at all",
  !("credentials" in (calls[0]?.body ?? {})),
  JSON.stringify(Object.keys(calls[0]?.body ?? {})),
);

// A response that (wrongly) carried a secret must not be handed to a
// component: the mapper is an allow-list, so anything not in the contract is
// dropped on the floor rather than passed through.
reset();
setNext({ ...BACKEND_INTEGRATION, credentials_encrypted: "gAAAAA...", client_secret: "leaked" });
{
  const mapped = await svc.get("int-1");
  const serialized = JSON.stringify(mapped);
  check(
    "the mapper drops any credential the backend should never have sent",
    !serialized.includes("leaked") && !serialized.includes("gAAAAA"),
  );
  check("but it does keep the has-credentials flag", mapped.hasCredentials === true);
}

// ---------------------------------------------------------------------------
// 5. The snake_case -> camelCase mapping is complete.
// ---------------------------------------------------------------------------

console.log("\nthe wire shape is fully mapped, so no component ever sees snake_case");

reset();
setNext(BACKEND_INTEGRATION);
{
  const i = await svc.get("int-1");
  const expected = {
    id: "int-1",
    organizationId: "org-under-test",
    locationId: "loc-1",
    organizationName: "Marina Bay Hotel",
    locationName: "Lobby",
    provider: "omada",
    name: "Lobby controller",
    status: "connected",
    isEnabled: true,
    baseUrl: "https://controller.example.com:8043",
    authMode: "openapi",
    controllerId: "abc123",
    controllerVersion: "5.14.20.9",
    externalSiteId: "site-1",
    externalSiteName: "Default",
    guestSsidName: "Hotel Guest",
    guestSsidId: "ssid-1",
    sessionDurationSeconds: 3600,
    syncIntervalSeconds: 300,
    lastSyncAt: "2026-09-10T09:00:00Z",
    lastSyncStatus: "ok",
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    deviceCount: 4,
    clientCount: 37,
    activeAuthorizationCount: 12,
    hasCredentials: true,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-10T09:00:00Z",
  };
  const wrong = Object.entries(expected).filter(([k, v]) => i[k] !== v);
  check("every documented field is mapped", wrong.length === 0, JSON.stringify(wrong));
  check(
    "and nothing snake_case survives into the mapped object",
    !Object.keys(i).some((k) => k.includes("_")),
    Object.keys(i)
      .filter((k) => k.includes("_"))
      .join(","),
  );
}

// `organization_name` is documented as platform-routes-only, so on a customer
// route it is genuinely absent. Normalised to null, not left `undefined`, so
// a component has one thing to check.
reset();
setNext({ ...BACKEND_INTEGRATION, organization_name: undefined });
check(
  "an absent organization_name normalises to null",
  (await svc.get("int-1")).organizationName === null,
);

// A controller that does not report `portal_enabled` must read as "unknown",
// never as "no": warning a customer about a portal that is in fact enabled is
// a fabricated finding.
reset();
setNext({ ssids: [{ ssid_id: "s1", name: "Guest" }] });
check(
  "an unreported portal_enabled stays null rather than becoming false",
  (await svc.listSsids("int-1"))[0].portalEnabled === null,
);

// ---------------------------------------------------------------------------
// 6. The list envelopes CONTRACT.md §3 does not pin.
// ---------------------------------------------------------------------------

console.log("\nnested list reads tolerate every envelope the contract allows");

for (const [shape, payload] of [
  [
    "a bare array",
    [{ mac: "AA", name: "AP 1", device_type: "ap", model: "EAP", status: "connected" }],
  ],
  [
    "{ items: [...] }",
    { items: [{ mac: "AA", name: "AP 1", device_type: "ap", model: "EAP", status: "connected" }] },
  ],
  [
    "{ devices: [...] }",
    {
      devices: [{ mac: "AA", name: "AP 1", device_type: "ap", model: "EAP", status: "connected" }],
    },
  ],
]) {
  reset();
  setNext(payload);
  const rows = await svc.listDevices("int-1");
  check(`devices from ${shape}`, rows.length === 1 && rows[0].mac === "AA");
}
reset();
setNext({ nothing: true });
check(
  "an unrecognisable payload yields an empty list, not a throw",
  (await svc.listDevices("int-1")).length === 0,
);

reset();
setNext({
  items: [
    {
      id: "e1",
      event_type: "sync",
      status: "error",
      error_code: "OMADA_TIMEOUT",
      message: "x",
      created_at: "2026-09-10T09:00:00Z",
    },
  ],
  page: 2,
  page_size: 20,
  total_items: 44,
  total_pages: 3,
  has_next: true,
  has_previous: true,
});
{
  const res = await svc.listEvents("int-1", { page: 2 });
  check(
    "the paginated envelope is carried through",
    res.rows.length === 1 &&
      res.total === 44 &&
      res.totalPages === 3 &&
      res.hasNext &&
      res.hasPrevious,
  );
  check(
    "and the event itself is mapped to camelCase",
    res.rows[0].eventType === "sync" && res.rows[0].errorCode === "OMADA_TIMEOUT",
  );
}

// ---------------------------------------------------------------------------
// 7. Source-level invariants the runtime cannot show.
// ---------------------------------------------------------------------------

console.log("\nno credential can reach storage, a cache key, or a log");

const page = readFileSync(
  join(ROOT, "src/components/features/NetworkIntegrationsPage.tsx"),
  "utf8",
);
const master = readFileSync(join(ROOT, "src/routes/master.integrations.tsx"), "utf8");
const service = readFileSync(join(ROOT, "src/services/network-integration.service.ts"), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

for (const [name, src] of [
  ["the customer page", strip(page)],
  ["the master console page", strip(master)],
  ["the service", strip(service)],
]) {
  check(
    `${name} never touches localStorage or sessionStorage`,
    !/(local|session)Storage/.test(src),
  );
  check(`${name} logs nothing`, !/console\.(log|info|warn|error|debug)/.test(src));
}
check(
  "no cache key in either page mentions a credential or a secret",
  !/(queryKey|keys\.)[\s\S]{0,200}?(clientSecret|client_secret|password|credential)/i.test(
    strip(page) + strip(master),
  ),
);
check(
  "the customer page's own keys carry no organization id",
  !/keys\s*=\s*\{[\s\S]*?\};/.exec(strip(page))?.[0].match(/org/i),
);
// The browser must never open a connection to a customer's controller: all
// controller traffic is server-side. The only URL either page may talk to is
// our own API, through the service.
check(
  "neither page fetches anything itself",
  !/\b(fetch|XMLHttpRequest|axios)\s*\(/.test(strip(page) + strip(master)),
);
// Both pages may name `AppError` (they map its `code` to human copy) but
// neither may hold the axios instance itself: a page that can reach `api`
// directly is a page that can quietly grow a request bypassing the service
// layer -- which is exactly how `customer.service.ts`'s SLA leg came to issue
// its own inline `GET /isp/links` with no org header and no shared key.
for (const [name, src] of [
  ["the customer page", page],
  ["the master console page", master],
]) {
  const apiImports = [...src.matchAll(/import\s+(type\s+)?\{[^}]*\}\s+from\s+"@\/services\/api"/g)];
  check(
    `${name} imports @/services/api as a type only, and calls the API through the service`,
    /networkIntegrationService\./.test(src) && apiImports.every((m) => !!m[1]),
    `${apiImports.length} import(s)`,
  );
}

// ---------------------------------------------------------------------------
// 8. CR-001: there is no per-guest deauthorization, so there is no control.
// ---------------------------------------------------------------------------

console.log("\nCR-001: no per-guest disconnect control exists, because no such API does");

{
  // TP-Link publishes no client-deauthorization endpoint in any generation of
  // the Omada API, and Open API's `clients/{mac}/block` was deliberately not
  // repurposed (a blocklist is more punitive and longer-lived than ending a
  // portal session, and it keys on a MAC phones rotate per SSID). A button
  // here could therefore only report a success it did not achieve.
  //
  // Asserted against the clients table specifically -- the integration-level
  // "Disconnect" is a different, real operation (DELETE the integration) and
  // must keep working.
  const clientsTable = /function ClientsTable\(([\s\S]*?)\n}\n/.exec(page)?.[1] ?? "";
  check("the clients table was found to inspect", clientsTable.length > 500);
  check(
    "no deauthorize/kick/block/disconnect action in the clients table",
    !/(deauthoriz|deauthoriz|kickClient|\bblock\b|Disconnect|Sign out)/i.test(
      clientsTable.replace(/\/\*[\s\S]*?\*\//g, ""),
    ),
  );
  check(
    "the service exposes no deauthorize method at all",
    !/deauthoriz/i.test(service) && typeof svc.deauthorizeClient !== "function",
  );
  check(
    "and the table says out loud that access ends on expiry",
    /no way to sign a guest out early/.test(page),
  );
  check(
    "the integration-level Disconnect is still present",
    /networkIntegrationService\.remove\(/.test(page),
  );
}

// ---------------------------------------------------------------------------
// 9. CR-002: legacy mode cannot read inventory, and says so.
// ---------------------------------------------------------------------------

console.log("\nCR-002: legacy auth mode is honest about what it cannot read");

check(
  "openapi supports inventory, legacy does not",
  mod.authModeSupportsInventory("openapi") === true &&
    mod.authModeSupportsInventory("legacy") === false,
);
check(
  "the legacy notice says what is missing",
  /cannot read sites, access points or connected clients/i.test(mod.LEGACY_INVENTORY_BODY),
);
check(
  "...says the captive portal is unaffected, which is the point of legacy mode",
  /sign-in is unaffected and fully supported/i.test(mod.LEGACY_INVENTORY_BODY),
);
check(
  "...and says what to do about it",
  /Open API/.test(mod.LEGACY_INVENTORY_BODY) &&
    /replace the credentials/i.test(mod.LEGACY_INVENTORY_BODY),
);
check(
  "the notice does not blame the customer's credentials",
  /not a problem with your credentials/i.test(mod.LEGACY_INVENTORY_BODY),
);
check(
  "the auth-mode summaries make the trade-off legible at the point of choosing",
  /list your sites, access points and connected clients/i.test(
    mod.CONTROLLER_AUTH_MODE_SUMMARY.openapi,
  ) &&
    /Guest sign-in only/i.test(mod.CONTROLLER_AUTH_MODE_SUMMARY.legacy) &&
    /cannot read/i.test(mod.CONTROLLER_AUTH_MODE_SUMMARY.legacy),
);
check(
  "OMADA_API_UNSUPPORTED copy covers the legacy case, not only an old controller",
  /hotspot operator account covers guest sign-in only/i.test(
    NETWORK_INTEGRATION_ERROR_COPY.OMADA_API_UNSUPPORTED,
  ),
);
// The gating has to be on the capability, not on a hardcoded string compare
// in three places that can drift.
check(
  "the customer page gates the device and client reads on the capability",
  /enabled: tab === "devices" && inventoryAvailable/.test(page) &&
    /enabled: tab === "clients" && inventoryAvailable/.test(page),
);
check(
  "the wizard gates the site and SSID reads on the same capability",
  /enabled: step === 2 && !!integrationId && canListInventory/.test(page) &&
    /enabled: step === 4 && !!integrationId && canListInventory/.test(page),
);
check(
  "the wizard offers a typed site ID in legacy mode instead of a picker that cannot populate",
  /step === 2 && !canListInventory/.test(page) && /omada-site-id/.test(page),
);
// The field collects an ID, never a display name. A name stored here is
// passed through as `site_id` into every controller call and compared
// against the `site=` on Omada's own redirect -- which carries the id -- so
// it turns away every guest at the venue with an opaque 403. Refused at the
// field rather than stored. See src/lib/omada-site-id.ts.
check(
  "the typed site field refuses a display name",
  /isOmadaSiteId\(siteId\)/.test(page) && /omadaSiteIdError\(siteId\)/.test(page),
);
check(
  "and a typed SSID name",
  /step === 4 && !canListInventory/.test(page) && /omada-ssid-name/.test(page),
);
check(
  "the typed site field points at the redirect parameter Omada itself sends",
  /site=/.test(page) && /ssidName=/.test(page),
);
check(
  "the master console does not print a fabricated zero device count for legacy rows",
  /authModeSupportsInventory\(r\.authMode\) \? r\.deviceCount : "—"/.test(master),
);

// ---------------------------------------------------------------------------
// 10. An Omada venue has no MikroTik router in the path.
// ---------------------------------------------------------------------------

console.log("\nnothing in the Omada views assumes a router exists behind the integration");

{
  // MikroTik and Omada are separate, parallel deployments. An Omada
  // integration's parent is a LOCATION; there is no router row to link to, no
  // router health to show, and no NAS/RADIUS in the path. A "view router"
  // affordance here would send an operator chasing hardware that was never
  // installed -- during an incident, which is when it would be clicked.
  //
  // Comments are stripped first: both files legitimately cite
  // `master.nas.tsx` as the precedent for the *wording* of a destructive
  // confirmation, and `types/nas.ts` for the precedent of a label table.
  // Those are references to a file, not an assumption about a topology.
  for (const [name, src] of [
    ["the customer page", strip(page)],
    ["the master console page", strip(master)],
    ["the service", strip(service)],
    ["the types", strip(readFileSync(join(ROOT, "src/types/network-integration.ts"), "utf8"))],
  ]) {
    // Still an absolute rule, and now for a better reason than the one
    // originally written here.
    //
    // The old premise was "an Omada integration's parent is a LOCATION;
    // there is no router row to link to". CONTRACT §11.3 settled the
    // opposite: `guest_sessions.router_id` is NOT NULL, so an Omada-only
    // venue keeps a SYNTHETIC fleet row, and the guest portal URL really
    // does carry a `routerId`.
    //
    // The rule survives anyway, because that URL is assembled SERVER-side
    // (`validators.build_external_portal_url`) and reaches this repo as an
    // opaque pair of strings. So no frontend module has any business
    // naming a router id -- and a module that starts to is one that has
    // begun rebuilding the URL locally, which is the drift this catches.
    check(`${name} never mentions a routerId`, !/routerId|router_id/.test(src));
    check(
      `${name} does not reach for the router service`,
      !/router\.service|routerService/.test(src),
    );
    check(
      `${name} makes no NAS or RADIUS reference`,
      !/\bNAS\b|RADIUS|nasIdentifier|sharedSecret/.test(src),
    );
  }
  // The Router glyph means "a MikroTik box in Router Fleet" everywhere else in
  // this console, so drawing a controller with it would say the wrong thing
  // before a word is read.
  check(
    "neither view draws a controller with the Router icon",
    !/Router as RouterIcon|<Router[\s/>]/.test(page + master),
  );
  check(
    "a controller is drawn as an appliance and its APs as radio hardware",
    /Server[,\s]/.test(page) && /RadioTower/.test(page) && /RadioTower/.test(master),
  );
  // The live MikroTik portal flow is the one carrying real guests today, and
  // it has already had a production incident where it silently no-oped. This
  // work must not have touched it.
  check(
    "the guest portal route was left alone",
    !/portal\.tsx/.test(page + master + service) &&
      // Anchored on `validateSearch`, the route option itself, rather than
      // on the name of the schema passed to it. This previously matched the
      // identifier `searchSchema` and broke the moment that variable was
      // renamed to `portalSearchSchema` -- a rename that changed nothing
      // about whether the portal route was touched, which is the only thing
      // this assertion is trying to say.
      /validateSearch/.test(readFileSync(join(ROOT, "src/routes/portal.tsx"), "utf8")),
  );
}

console.log(
  failures === 0
    ? "\nall network-integration contract checks passed"
    : `\n${failures} network-integration contract check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
