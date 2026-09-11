/**
 * Regression test for three ways an Omada venue could be set up "correctly"
 * and still sign nobody in -- found writing the operator runbook
 * (cloud-guest `docs/network_integration/OMADA_OPERATOR_RUNBOOK.md` §2).
 *
 *   1. AN OPEN API INTEGRATION COULD NEVER AUTHORISE A GUEST. The controller
 *      lets a guest online only through its hotspot *operator* login, in
 *      either auth mode. This frontend stripped the operator pair from every
 *      Open API request and the backend refused to store one, while the
 *      dashboard marked Open API "Recommended" and said guest sign-in was
 *      enforced. The recommended setup synced green and turned every guest
 *      away. Pinned here: the Open API form sends the operator pair, the
 *      form will not call an app-only draft complete, and the copy no longer
 *      claims enforcement without it.
 *
 *   2. A CUSTOMER-CREATED INTEGRATION NEVER GOT A FLEET ROW, so it sat on
 *      `fleet_device_missing` with no portal link and copy telling the
 *      operator to contact support. The backend now registers the device
 *      when a venue is mapped; this pins the repair action for rows created
 *      before that, and that the wizard does not register the device at the
 *      page's venue before the operator has chosen one.
 *
 *   3. CERTIFICATE TRUST AND THE OMADA ID HAD NO FORM. A self-hosted
 *      controller (self-signed) and a TP-Link cloud controller both need
 *      them. Pinned: the fields reach the wire on create, probe and PATCH;
 *      the fingerprint rule matches the backend's; and the TLS error codes
 *      -- plus `NETWORK_INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED` from
 *      cloud-guest #224 -- have operator-facing copy.
 *
 * Same harness as `test-network-integration-contract.mjs`: the real service,
 * types, readiness module and wizard schema are bundled with esbuild against
 * a recording fake of `@/services/api`, so every assertion is about shipped
 * code rather than a restatement of it.
 *
 * Run: node scripts/test-omada-onboarding-gaps.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "omada-onboarding-gaps-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export const calls = [];
   let nextData = {};
   export function setNext(d) { nextData = d; }
   export function reset() { calls.length = 0; nextData = {}; }
   function record(method, url, body, config) {
     calls.push({ method, url, body, headers: config?.headers ?? {} });
     return { data: nextData };
   }
   export const api = {
     async get(url, config) { return record("get", url, undefined, config); },
     async post(url, body, config) { return record("post", url, body, config); },
     async patch(url, body, config) { return record("patch", url, body, config); },
     async put(url, body, config) { return record("put", url, body, config); },
     async delete(url, config) { return record("delete", url, undefined, config); },
   };
   export const guestPortalApi = api;
   export function toAppError(e) { return e; }
   export default api;`,
);
const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-under-test"; }
   export function peekOrganizationId() { return "org-under-test"; }`,
);
const customerStub = join(outdir, "customer-stub.mjs");
writeFileSync(customerStub, `export function isDemo() { return false; }`);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { networkIntegrationService } from "${p("src/services/network-integration.service.ts")}";
   export { routerService } from "${p("src/services/router.service.ts")}";
   export * from "${p("src/types/network-integration.ts")}";
   export { deriveIntegrationSetup, CREDENTIAL_GAP_KEYS } from "${p("src/lib/network-integration-readiness.ts")}";
   export { routerWizardSchema } from "${p("src/lib/router-schemas.ts")}";
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
    "@/services/customer.service": customerStub,
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
const { networkIntegrationService: svc, routerService, calls, setNext, reset } = mod;

const BACKEND_INTEGRATION = {
  id: "int-1",
  organization_id: "org-under-test",
  location_id: "loc-1",
  location_name: "Lobby",
  provider: "omada",
  name: "Lobby controller",
  status: "connected",
  is_enabled: true,
  base_url: "https://c.example.com:8043",
  auth_mode: "openapi",
  tls_mode: "pinned",
  tls_pinned_sha256: "ab".repeat(32),
  controller_id: "abc123",
  controller_version: "5.15.24",
  external_site_id: "site-1",
  external_site_name: "Default",
  guest_ssid_name: "Guest",
  guest_ssid_id: null,
  session_duration_seconds: 3600,
  sync_interval_seconds: 300,
  last_sync_at: null,
  last_sync_status: "never",
  last_error_code: null,
  last_error_message: null,
  last_error_at: null,
  device_count: 0,
  client_count: 0,
  active_authorization_count: 0,
  has_credentials: true,
  portal_readiness_gaps: [],
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
};
const DRAFT = { clientId: "cid", clientSecret: "sec", username: "op", password: "pw" };
const PIN = "AB:CD:" + "ef:".repeat(29) + "01";
const PIN_CANONICAL = "abcd" + "ef".repeat(29) + "01";

// ---------------------------------------------------------------------------
// 1. Open API carries the operator login
// ---------------------------------------------------------------------------

console.log("\n1. an Open API integration carries the hotspot operator login");

reset();
setNext(BACKEND_INTEGRATION);
await svc.create({
  provider: "omada",
  name: "n",
  baseUrl: "https://c:8043",
  authMode: "openapi",
  credentials: DRAFT,
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "openapi create sends the app pair",
    sent.client_id === "cid" && sent.client_secret === "sec",
  );
  check(
    "...AND the operator pair guest sign-in needs",
    sent.username === "op" && sent.password === "pw",
    JSON.stringify(Object.keys(sent)),
  );
}

reset();
setNext(BACKEND_INTEGRATION);
await svc.replaceCredentials("int-1", "openapi", DRAFT);
{
  const sent = calls[0]?.body ?? {};
  check(
    "openapi rotation sends all four -- how an app-only integration is repaired",
    sent.client_id === "cid" &&
      sent.client_secret === "sec" &&
      sent.username === "op" &&
      sent.password === "pw",
  );
}

reset();
setNext(BACKEND_INTEGRATION);
await svc.create({
  provider: "omada",
  name: "n",
  baseUrl: "https://c:8043",
  authMode: "legacy",
  credentials: DRAFT,
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "legacy still strips the app pair it never reads",
    sent.client_id === undefined && sent.client_secret === undefined,
  );
}

check(
  "an app-only Open API draft is NOT complete",
  mod.credentialsCompleteForMode("openapi", { clientId: "cid", clientSecret: "sec" }) === false,
);
check(
  "an Open API draft with the operator login is complete",
  mod.credentialsCompleteForMode("openapi", DRAFT),
);
check(
  "half an operator login is incomplete in either mode",
  !mod.credentialsCompleteForMode("openapi", { ...DRAFT, password: "" }) &&
    !mod.credentialsCompleteForMode("legacy", { username: "op" }),
);
check(
  "a legacy draft needs only the operator login",
  mod.credentialsCompleteForMode("legacy", { username: "op", password: "pw" }),
);

check(
  "the Open API summary names the operator account",
  /hotspot operator account/i.test(mod.CONTROLLER_AUTH_MODE_SUMMARY.openapi),
);
check(
  "...and no longer opens by claiming guest sign-in is enforced by the app alone",
  !/^Everything: guest sign-in is enforced/.test(mod.CONTROLLER_AUTH_MODE_SUMMARY.openapi),
);
check(
  "the operator note says where to create the account",
  /Hotspot Manager/.test(mod.GUEST_OPERATOR_REQUIRED_NOTE),
);

console.log("\n   the readiness module surfaces the backend's guest_operator_missing");
{
  const base = {
    status: "unconfigured",
    isEnabled: true,
    hasCredentials: true,
    locationId: "loc-1",
    externalSiteId: "site-1",
    externalSiteName: "Default",
    guestSsidId: null,
    guestSsidName: "Guest",
  };
  const withGap = mod.deriveIntegrationSetup({
    ...base,
    portalReadinessGaps: ["guest_operator_missing"],
  });
  check(
    "an app-only integration is half-configured, with the operator account named",
    withGap.isHalfConfigured && withGap.gaps.some((g) => g.key === "guestOperator"),
  );
  check(
    "...and is sent to Replace credentials, not to a wizard that cannot re-ask for a secret",
    withGap.nextStep === "Use Replace credentials on this integration." &&
      mod.CREDENTIAL_GAP_KEYS.includes("guestOperator"),
  );
  const noField = mod.deriveIntegrationSetup(base);
  check(
    "a surface that does not carry the gaps invents nothing",
    !noField.gaps.some((g) => g.key === "guestOperator"),
  );
}

// ---------------------------------------------------------------------------
// 2. Fleet device
// ---------------------------------------------------------------------------

console.log("\n2. a customer-created integration can get its fleet device");

reset();
setNext(BACKEND_INTEGRATION);
await svc.ensureFleetDevice("int-1");
check(
  "Register controller POSTs to /{id}/fleet-device",
  calls[0]?.method === "post" && calls[0]?.url === "/network-integrations/int-1/fleet-device",
  JSON.stringify(calls[0]),
);
check(
  "...with the org header, like every customer route",
  calls[0]?.headers?.["X-Organization-Id"] === "org-under-test",
);

const page = src("src/components/features/NetworkIntegrationsPage.tsx");
check(
  "the page offers Register controller for fleet_device_missing",
  /ensureFleetDevice/.test(page) && /Register controller/.test(page),
);
check(
  "...only once a venue is mapped, since there is nowhere to register it otherwise",
  /gaps\.includes\("fleet_device_missing"\) && !!integration\.locationId/.test(page),
);
check(
  "the fleet gap no longer tells the operator they cannot fix it",
  !/you cannot complete this step yourself/.test(page),
);
check(
  "the page names the guest_operator_missing gap and offers the fix",
  /guest_operator_missing:/.test(page) && /Add operator account/.test(page),
);
check(
  "the wizard does not register the device at the page's venue before one is chosen",
  /locationId: null,/.test(page) && !/locationId: defaultLocationId \?\? null/.test(page),
);
check(
  "the wizard only claims enforcement when the backend reports no gaps",
  /portalReadinessGaps \?\? \[\]\)\.length === 0/.test(page),
);

// ---------------------------------------------------------------------------
// 3. Certificate trust and the Omada ID
// ---------------------------------------------------------------------------

console.log("\n3. certificate trust and the Omada ID reach the wire");

reset();
setNext(BACKEND_INTEGRATION);
await svc.create({
  provider: "omada",
  name: "n",
  baseUrl: "https://c:8043",
  authMode: "legacy",
  credentials: { username: "op", password: "pw" },
  controllerId: " omada-id-1 ",
  tlsMode: "pinned",
  tlsPinnedSha256: PIN,
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "create sends controller_id, tls_mode and tls_pinned_sha256",
    sent.controller_id === "omada-id-1" &&
      sent.tls_mode === "pinned" &&
      sent.tls_pinned_sha256 === PIN,
    JSON.stringify(sent),
  );
}

reset();
setNext(BACKEND_INTEGRATION);
await svc.create({
  provider: "omada",
  name: "n",
  baseUrl: "https://c:8043",
  authMode: "legacy",
  credentials: { username: "op", password: "pw" },
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "...and omits all three when unset, so the backend's strict default stands",
    !("controller_id" in sent) && !("tls_mode" in sent) && !("tls_pinned_sha256" in sent),
  );
}

reset();
setNext({ ok: false, error_code: "OMADA_TLS_UNTRUSTED", tls_fingerprint_sha256: PIN_CANONICAL });
const probe = await svc.testDraftConnection({
  provider: "omada",
  baseUrl: "https://c:8043",
  authMode: "legacy",
  credentials: { username: "op", password: "pw" },
  tlsMode: "pinned",
  tlsPinnedSha256: PIN,
});
check(
  "the pre-save probe carries the trust decision it is testing",
  calls[0]?.body?.tls_mode === "pinned" && calls[0]?.body?.tls_pinned_sha256 === PIN,
);
check(
  "a failed probe hands back the fingerprint the controller presented",
  probe.ok === false && probe.tlsFingerprintSha256 === PIN_CANONICAL,
);

reset();
setNext(BACKEND_INTEGRATION);
await svc.update("int-1", { tlsMode: "strict" });
{
  const sent = calls[0]?.body ?? {};
  check("a PATCH carries tls_mode when set", sent.tls_mode === "strict");
  check(
    "...and leaves the Omada ID and fingerprint alone when not",
    !("controller_id" in sent) && !("tls_pinned_sha256" in sent),
  );
}

reset();
setNext(BACKEND_INTEGRATION);
{
  const got = await svc.get("int-1");
  check(
    "the mapper reads the trust decision off the row",
    got.tlsMode === "pinned" && got.tlsPinnedSha256 === "ab".repeat(32),
  );
}
reset();
setNext({ ...BACKEND_INTEGRATION, tls_mode: undefined, tls_pinned_sha256: undefined });
{
  const got = await svc.get("int-1");
  check("an older backend without the field reads as strict", got.tlsMode === "strict");
}

console.log("\n   the fingerprint rule matches the backend's normalize_tls_fingerprint");
check("colon-separated uppercase is accepted", mod.normalizeTlsFingerprint(PIN) === PIN_CANONICAL);
check(
  "space-separated pairs are accepted",
  mod.normalizeTlsFingerprint(PIN_CANONICAL.match(/../g).join(" ")) === PIN_CANONICAL,
);
check("63 characters is refused", mod.normalizeTlsFingerprint("a".repeat(63)) === null);
check("non-hex is refused", mod.normalizeTlsFingerprint("g".repeat(64)) === null);
check(
  "empty is refused",
  mod.normalizeTlsFingerprint("") === null && mod.normalizeTlsFingerprint(null) === null,
);

console.log("\n   the admin onboarding wizard applies the same rules");
{
  const base = {
    vendor: "tplink_omada",
    basic: { name: "Lobby", locationId: "loc-1", model: "OC200", serialNumber: "", macAddress: "" },
    credentials: { apiUsername: "", apiSecret: "" },
    services: {
      freeradius: false,
      wireguard: false,
      captivePortal: false,
      guestWifi: false,
      monitoring: false,
      analytics: false,
    },
    omada: {
      baseUrl: "https://c:8043",
      authMode: "openapi",
      clientId: "cid",
      clientSecret: "sec",
      username: "op",
      password: "pw",
      controllerId: "",
      tlsMode: "strict",
      tlsPinnedSha256: "",
      siteId: "",
      siteName: "",
      ssidId: "",
      ssidName: "",
    },
  };
  const parse = (omada) =>
    mod.routerWizardSchema.safeParse({ ...base, omada: { ...base.omada, ...omada } });
  check("an Open API controller with the operator login onboards", parse({}).success);
  const appOnly = parse({ username: "", password: "" });
  check(
    "an Open API controller WITHOUT the operator login is refused",
    !appOnly.success && appOnly.error.issues.some((i) => i.path.join(".") === "omada.username"),
  );
  check("pinned without a fingerprint is refused", !parse({ tlsMode: "pinned" }).success);
  check(
    "pinned with a real fingerprint onboards",
    parse({ tlsMode: "pinned", tlsPinnedSha256: PIN }).success,
  );
}

reset();
setNext({
  integration: { id: "int-1", name: "Lobby", status: "connecting" },
  router_id: "r-1",
  router_serial_number: "OMADA-1",
  router_vendor: "tplink_omada",
  synthetic_identity: true,
});
await routerService.onboardController({
  organizationId: "org-1",
  locationId: "loc-1",
  name: "Lobby",
  controllerModel: "OC200",
  baseUrl: "https://c:8043",
  authMode: "openapi",
  clientId: "cid",
  clientSecret: "sec",
  username: "op",
  password: "pw",
  controllerId: "omada-id-1",
  tlsMode: "pinned",
  tlsPinnedSha256: PIN,
});
{
  const sent = calls[0]?.body ?? {};
  check(
    "admin onboarding sends the operator login with an Open API app",
    sent.client_id === "cid" && sent.username === "op" && sent.password === "pw",
    JSON.stringify(Object.keys(sent)),
  );
  check(
    "...and the trust decision and Omada ID",
    sent.controller_id === "omada-id-1" &&
      sent.tls_mode === "pinned" &&
      sent.tls_pinned_sha256 === PIN,
  );
}

console.log("\n   every new error code has an operator-facing sentence");
for (const code of [
  "OMADA_TLS_UNTRUSTED",
  "OMADA_TLS_PIN_MISMATCH",
  "NETWORK_INTEGRATION_TLS_PIN_REQUIRED",
  "NETWORK_INTEGRATION_LOCATION_REQUIRED",
  "NETWORK_INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED",
]) {
  const text = mod.describeIntegrationError(code, "backend sentence");
  check(
    `${code}: our own copy, not the backend's and not the code`,
    text !== "backend sentence" && !text.includes(code),
  );
}
check(
  "an untrusted certificate is not reported as a bad address",
  /address and port are fine/i.test(mod.describeIntegrationError("OMADA_TLS_UNTRUSTED")),
);
check(
  "a changed certificate is NOT met with 're-pin it'",
  /before trusting the new one/i.test(mod.describeIntegrationError("OMADA_TLS_PIN_MISMATCH")),
);
check(
  "the encryption-key refusal says nothing was saved and who to contact",
  /Nothing was saved/.test(
    mod.describeIntegrationError("NETWORK_INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED"),
  ) &&
    /support/i.test(
      mod.describeIntegrationError("NETWORK_INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED"),
    ),
);

check(
  "the page has a Certificate & Omada ID control for existing integrations",
  /TrustSettingsDialog/.test(page) && /Certificate &amp; Omada ID/.test(page),
);
check(
  "a failed test offers the observed fingerprint as a one-click pin",
  /Use this fingerprint/.test(page) &&
    /setObservedFingerprint\(result\.tlsFingerprintSha256\)/.test(page),
);

console.log("");
if (failures > 0) {
  console.log(`${failures} omada onboarding-gap check(s) FAILED`);
  process.exit(1);
}
console.log("all omada onboarding-gap checks passed");
