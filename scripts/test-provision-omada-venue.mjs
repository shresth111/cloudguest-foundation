/**
 * Regression test: a NEW customer whose venue has only a TP-Link Omada
 * controller could not be provisioned.
 *
 * Master -> Customers -> Add Customer opens the Smart Location Provisioning
 * wizard, whose first-device step demanded a router serial number and MAC,
 * and the backend's provisioning request demanded a router. The only way
 * through was to invent both -- and the MAC is the join key for client
 * lookups, MAC authorization and DHCP leases, so an invented one can collide
 * with a real device.
 *
 * The step is now "First device": a MikroTik router or a TP-Link Omada
 * controller. Pinned here, against shipped code:
 *
 *   * the controller branch validates with the SAME rules as Routers -> Add
 *     router (`omadaControllerIssues`, via `routerWizardSchema`), and sends
 *     the SAME body (`controllerOnboardBody`) -- one controller form, not two;
 *   * exactly one first device reaches the wire, and a software controller
 *     sends no serial or MAC at all;
 *   * the router path is unchanged;
 *   * a controller failure reads as the Network Integrations page's own copy
 *     and says nothing was saved.
 *
 * Same harness as `test-omada-onboarding-gaps.mjs`: the real services, types
 * and libs are bundled with esbuild against a recording fake of
 * `@/services/api`.
 *
 * Needs cloud-guest's `network_controller` provisioning change deployed
 * first; see that PR.
 *
 * Run: node scripts/test-provision-omada-venue.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "provision-omada-venue-"));
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
const customerStub = join(outdir, "customer-stub.mjs");
writeFileSync(customerStub, `export function isDemo() { return false; }`);
const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-under-test"; }
   export function peekOrganizationId() { return "org-under-test"; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { locationService } from "${p("src/services/location.service.ts")}";
   export { routerService } from "${p("src/services/router.service.ts")}";
   export { controllerOnboardBody } from "${p("src/lib/controller-onboard-body.ts")}";
   export * from "${p("src/lib/provision-first-device.ts")}";
   export { routerWizardSchema, EMPTY_OMADA_DRAFT } from "${p("src/lib/router-schemas.ts")}";
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
const { locationService, routerService, calls, setNext, reset } = mod;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const clone = (v) => JSON.parse(JSON.stringify(v));

function routerDevice(overrides = {}) {
  const d = clone(mod.EMPTY_FIRST_DEVICE);
  d.kind = "router";
  d.router = {
    name: "Lobby Router",
    serialNumber: "SN-00001",
    macAddress: "AA:BB:CC:DD:EE:01",
    model: "RB5009",
    managementIpAddress: "",
    ...overrides,
  };
  return d;
}

function controllerDevice({ omada = {}, ...identity } = {}) {
  const d = clone(mod.EMPTY_FIRST_DEVICE);
  d.kind = "network_controller";
  d.controller = {
    name: "Lobby Controller",
    model: "Omada Software Controller",
    serialNumber: "",
    macAddress: "",
    ...identity,
    omada: {
      ...clone(mod.EMPTY_OMADA_DRAFT),
      baseUrl: "https://controller.example.com:8043",
      authMode: "legacy",
      username: "hotspot-op",
      password: "op-secret-value",
      ...omada,
    },
  };
  return d;
}

const BASE_PAYLOAD = {
  newOrganization: { name: "Grand Plaza", slug: "grand-plaza", contactEmail: "ops@gp.example" },
  location: {
    name: "Downtown",
    slug: "downtown",
    addressLine1: "1 Plaza Way",
    city: "Austin",
    stateProvince: "TX",
    postalCode: "78701",
    country: "US",
  },
  owner: { firstName: "Priya", lastName: "Shah", email: "priya@example.com" },
  planId: "plan-1",
};

const PROVISION_RESPONSE = {
  organization_id: "org-1",
  organization_name: "Grand Plaza",
  location_id: "loc-1",
  location_name: "Downtown",
  location_code: "LOC-0001",
  plan_id: "plan-1",
  plan_name: "Growth",
  device_kind: "network_controller",
  router_id: "fleet-1",
  router_name: "Lobby Controller",
  network_integration_id: "int-1",
  owner_user_id: "user-1",
  owner_name: "Priya Shah",
  owner_username: "priya@example.com",
  owner_email: "priya@example.com",
  owner_temporary_password: "Temp!Pass2026",
  login_url: "https://app.example/login",
  provisioned_at: "2026-09-11T00:00:00Z",
};

async function provisionBody(device) {
  reset();
  setNext(PROVISION_RESPONSE);
  await locationService.provisionLocation({ ...BASE_PAYLOAD, ...mod.firstDevicePayload(device) });
  const call = calls.find((c) => c.url === "/locations/provision");
  return call?.body;
}

// ---------------------------------------------------------------------------
// 1. Validation: router path unchanged, controller path needs no serial/MAC
// ---------------------------------------------------------------------------

console.log("first-device validation");
{
  const errors = mod.validateFirstDevice(routerDevice({ serialNumber: "", macAddress: "" }));
  check(
    "a router still needs a serial number and MAC",
    errors["router.serialNumber"] === "Required" && errors["router.macAddress"] === "Required",
    JSON.stringify(errors),
  );
  check(
    "a complete router is valid",
    Object.keys(mod.validateFirstDevice(routerDevice())).length === 0,
  );
  check(
    "a software controller needs no serial or MAC",
    Object.keys(mod.validateFirstDevice(controllerDevice())).length === 0,
    JSON.stringify(mod.validateFirstDevice(controllerDevice())),
  );
  const empty = clone(mod.EMPTY_FIRST_DEVICE);
  empty.kind = "network_controller";
  const emptyErrors = mod.validateFirstDevice(empty);
  check(
    "an empty controller needs a name, model, address and operator login",
    ["controller.name", "controller.model", "controller.omada.baseUrl"].every(
      (k) => emptyErrors[k],
    ) &&
      emptyErrors["controller.omada.username"] &&
      emptyErrors["controller.omada.password"],
    JSON.stringify(emptyErrors),
  );
  check(
    "Open API needs the app pair AND the operator login",
    (() => {
      const e = mod.validateFirstDevice(
        controllerDevice({ omada: { authMode: "openapi", username: "", password: "" } }),
      );
      return (
        e["controller.omada.clientId"] &&
        e["controller.omada.clientSecret"] &&
        e["controller.omada.username"] &&
        e["controller.omada.password"]
      );
    })(),
  );
  check(
    "half a hardware identity is refused",
    Boolean(
      mod.validateFirstDevice(controllerDevice({ serialNumber: "Y2330A000001" }))[
        "controller.macAddress"
      ],
    ),
  );
  check(
    "a hardware controller with both identifiers is valid",
    Object.keys(
      mod.validateFirstDevice(
        controllerDevice({ serialNumber: "Y2330A000001", macAddress: "50:91:E3:00:00:01" }),
      ),
    ).length === 0,
  );
  check(
    "pinned without a real fingerprint is refused",
    Boolean(
      mod.validateFirstDevice(controllerDevice({ omada: { tlsMode: "pinned" } }))[
        "controller.omada.tlsPinnedSha256"
      ],
    ),
  );
  check(
    "a scheme-less address is caught before the round trip",
    Boolean(
      mod.validateFirstDevice(controllerDevice({ omada: { baseUrl: "controller.example.com" } }))[
        "controller.omada.baseUrl"
      ],
    ),
  );
}

// The same rules as Routers -> Add router: for each draft, the set of Omada
// fields flagged here equals the set routerWizardSchema flags.
console.log("same rules as Routers -> Add router");
{
  const drafts = [
    {},
    { authMode: "openapi" },
    { authMode: "openapi", clientId: "cid", clientSecret: "sec" },
    { username: "" },
    { tlsMode: "pinned" },
    { tlsMode: "pinned", tlsPinnedSha256: "ab".repeat(32) },
    { baseUrl: "" },
    { baseUrl: "controller.example.com" },
  ];
  for (const omada of drafts) {
    const device = controllerDevice({ omada });
    const provisioning = Object.keys(mod.validateFirstDevice(device))
      .filter((k) => k.startsWith("controller.omada."))
      .map((k) => k.slice("controller.omada.".length))
      .sort();
    const parsed = mod.routerWizardSchema.safeParse({
      vendor: "tplink_omada",
      basic: { name: "Lobby Controller", locationId: "loc-1", model: "OC200" },
      credentials: {},
      services: {
        freeradius: true,
        wireguard: true,
        captivePortal: true,
        guestWifi: true,
        monitoring: true,
        analytics: false,
      },
      omada: device.controller.omada,
    });
    const wizard = parsed.success
      ? []
      : [
          ...new Set(
            parsed.error.issues.filter((i) => i.path[0] === "omada").map((i) => String(i.path[1])),
          ),
        ].sort();
    check(
      `draft ${JSON.stringify(omada)}: same fields flagged on both paths`,
      JSON.stringify(provisioning) === JSON.stringify(wizard),
      `provisioning=${JSON.stringify(provisioning)} wizard=${JSON.stringify(wizard)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The wire: exactly one first device
// ---------------------------------------------------------------------------

console.log("provisioning request body");
{
  const body = await provisionBody(controllerDevice());
  check("a controller request carries network_controller", Boolean(body?.network_controller));
  check("...and no router key at all", body && !("router" in body), JSON.stringify(body));
  const nc = body?.network_controller ?? {};
  check("provider is omada", nc.provider === "omada");
  check("controller_model is sent", nc.controller_model === "Omada Software Controller");
  check("auth_mode is sent", nc.auth_mode === "legacy");
  check(
    "the operator login is sent",
    nc.username === "hotspot-op" && nc.password === "op-secret-value",
  );
  check(
    "a software controller sends NO serial_number or mac_address",
    !("serial_number" in nc) && !("mac_address" in nc),
    JSON.stringify(nc),
  );
  check("legacy mode sends no app pair", !("client_id" in nc) && !("client_secret" in nc));
  check("tls_mode defaults to strict on the wire", nc.tls_mode === "strict");
  check("no fingerprint unless pinned", !("tls_pinned_sha256" in nc));

  const openapi = await provisionBody(
    controllerDevice({
      omada: { authMode: "openapi", clientId: "cid", clientSecret: "csecret" },
    }),
  );
  const onc = openapi?.network_controller ?? {};
  check(
    "Open API sends the app pair AND the operator login",
    onc.client_id === "cid" &&
      onc.client_secret === "csecret" &&
      onc.username === "hotspot-op" &&
      onc.password === "op-secret-value",
  );

  const hardware = await provisionBody(
    controllerDevice({
      serialNumber: "Y2330A000001",
      macAddress: "50:91:E3:00:00:01",
      omada: { tlsMode: "pinned", tlsPinnedSha256: "ab".repeat(32), controllerId: "  omadac1  " },
    }),
  );
  const hnc = hardware?.network_controller ?? {};
  check(
    "a hardware controller sends its label identity",
    hnc.serial_number === "Y2330A000001" && hnc.mac_address === "50:91:E3:00:00:01",
  );
  check(
    "pinned sends the fingerprint and a trimmed Omada ID",
    hnc.tls_mode === "pinned" &&
      hnc.tls_pinned_sha256 === "ab".repeat(32) &&
      hnc.controller_id === "omadac1",
  );

  const routerBody = await provisionBody(routerDevice());
  check(
    "a router request carries router and no network_controller key",
    Boolean(routerBody?.router) && !("network_controller" in routerBody),
  );
  check(
    "the router body is unchanged",
    routerBody?.router?.serial_number === "SN-00001" &&
      routerBody?.router?.mac_address === "AA:BB:CC:DD:EE:01" &&
      routerBody?.router?.model === "RB5009",
  );
}

// One serializer for both registration paths.
console.log("one controller body for both registration paths");
{
  const fields = mod.firstDevicePayload(
    controllerDevice({
      omada: {
        authMode: "openapi",
        clientId: "cid",
        clientSecret: "csecret",
        tlsMode: "pinned",
        tlsPinnedSha256: "cd".repeat(32),
      },
    }),
  ).networkController;
  reset();
  setNext({
    integration: { id: "int-1", name: "Lobby Controller", status: "connecting" },
    router_id: "fleet-1",
    router_serial_number: "SYN-1",
    router_vendor: "tplink_omada",
    synthetic_identity: true,
  });
  await routerService.onboardController({
    organizationId: "org-1",
    locationId: "loc-1",
    ...fields,
  });
  const onboard = calls.find((c) => c.url === "/network-integrations/platform/onboard")?.body ?? {};
  const { organization_id, location_id, ...onboardController } = onboard;
  const provision = (
    await provisionBody(
      controllerDevice({
        omada: {
          authMode: "openapi",
          clientId: "cid",
          clientSecret: "csecret",
          tlsMode: "pinned",
          tlsPinnedSha256: "cd".repeat(32),
        },
      }),
    )
  )?.network_controller;
  check(
    "Master onboarding still names the tenant and venue",
    organization_id === "org-1" && location_id === "loc-1",
  );
  check(
    "provisioning's network_controller is exactly Master onboarding's controller body",
    JSON.stringify(onboardController) === JSON.stringify(provision),
    `onboard=${JSON.stringify(onboardController)} provision=${JSON.stringify(provision)}`,
  );
}

// ---------------------------------------------------------------------------
// 3. The response
// ---------------------------------------------------------------------------

console.log("provisioning response");
{
  reset();
  setNext(PROVISION_RESPONSE);
  const result = await locationService.provisionLocation({
    ...BASE_PAYLOAD,
    ...mod.firstDevicePayload(controllerDevice()),
  });
  check("device_kind is mapped", result.deviceKind === "network_controller");
  check("network_integration_id is mapped", result.networkIntegrationId === "int-1");

  reset();
  const { device_kind: _k, network_integration_id: _i, ...older } = PROVISION_RESPONSE;
  setNext(older);
  const legacy = await locationService.provisionLocation({
    ...BASE_PAYLOAD,
    ...mod.firstDevicePayload(routerDevice()),
  });
  check(
    "a response without the new fields reads as a router with no integration",
    legacy.deviceKind === "router" && legacy.networkIntegrationId === null,
  );
}

// ---------------------------------------------------------------------------
// 4. Failures and secrets
// ---------------------------------------------------------------------------

console.log("failure copy and secrets");
{
  const keyRefusal = mod.describeProvisioningFailure(
    {
      status: 503,
      message: "backend sentence",
      data: { code: "NETWORK_INTEGRATION_ENCRYPTION_KEY_NOT_CONFIGURED" },
    },
    "network_controller",
  );
  check(
    "the default-key refusal uses the integrations page's copy",
    /encryption key/i.test(keyRefusal) && !keyRefusal.includes("backend sentence"),
  );
  check(
    "...and says nothing was saved exactly once",
    (keyRefusal.match(/nothing was saved/gi) ?? []).length === 1,
    keyRefusal,
  );
  const tls = mod.describeProvisioningFailure(
    { status: 502, message: "raw", data: { code: "OMADA_TLS_UNTRUSTED" } },
    "network_controller",
  );
  check(
    "a controller error says nothing was saved",
    /address and port are fine/i.test(tls) && /nothing was saved/i.test(tls),
  );
  const urlRejected = mod.describeProvisioningFailure(
    {
      status: 400,
      message: "Open API mode requires both client_id and client_secret.",
      data: { code: "NETWORK_INTEGRATION_URL_REJECTED" },
    },
    "network_controller",
  );
  check(
    "a credential refusal filed as URL_REJECTED keeps the backend's specific sentence",
    urlRejected.startsWith("Open API mode requires both client_id") &&
      !/address was rejected/i.test(urlRejected),
    urlRejected,
  );
  check(
    "a 403 names the missing permission",
    /network integrations permission/i.test(
      mod.describeProvisioningFailure({ status: 403, message: "Forbidden" }, "network_controller"),
    ),
  );
  check(
    "a router failure keeps the backend message verbatim",
    mod.describeProvisioningFailure(
      { status: 502, message: "Could not allocate a WireGuard tunnel ... NOT provisioned" },
      "router",
    ) === "Could not allocate a WireGuard tunnel ... NOT provisioned",
  );

  const device = controllerDevice({
    omada: { authMode: "openapi", clientId: "cid", clientSecret: "app-secret-value" },
  });
  const cleared = mod.withoutControllerSecrets(device);
  check(
    "secrets are dropped after provisioning",
    cleared.controller.omada.clientSecret === "" && cleared.controller.omada.password === "",
  );
  check(
    "...and nothing else is",
    cleared.controller.omada.username === "hotspot-op" &&
      cleared.controller.name === device.controller.name,
  );
  const review = JSON.stringify(mod.describeFirstDevice(device));
  check(
    "the review summary never shows a secret",
    !review.includes("app-secret-value") && !review.includes("op-secret-value"),
  );
  check(
    "the review says a software controller's identity is generated",
    review.includes("Generated (software controller)"),
  );
}

// ---------------------------------------------------------------------------
// 5. One Omada form, rendered from both wizards
// ---------------------------------------------------------------------------

console.log("one Omada form");
{
  const provisioningWizard = src("src/components/locations/PlatformLocationWizard.tsx");
  const deviceWizard = src("src/components/routers/RouterWizard.tsx");
  check(
    "the provisioning wizard renders the shared OmadaConnectionFields",
    /<OmadaConnectionFields/.test(provisioningWizard),
  );
  check(
    "Routers -> Add router renders the same component",
    /<OmadaConnectionFields/.test(deviceWizard),
  );
  check(
    "the device wizard no longer carries its own copy of the Omada choices",
    !/const AUTH_MODE_CHOICES/.test(deviceWizard) && !/const TLS_MODE_CHOICES/.test(deviceWizard),
  );
  check(
    "the step is First device, not Router",
    /title: "First device"/.test(provisioningWizard) &&
      !/title: "Router", desc/.test(provisioningWizard),
  );
  check(
    "the provisioning wizard no longer requires a router serial for every location",
    /validateFirstDevice\(state\.device\)/.test(provisioningWizard) &&
      !/\["name", "serialNumber", "macAddress", "model"\] as const\)\.forEach\(\(k\) => \{\s*if \(!state\.router/.test(
        provisioningWizard,
      ),
  );
  check(
    "a controller result names the one step left",
    /One step left before guests can get online/.test(provisioningWizard) &&
      /Finish setup/.test(provisioningWizard),
  );
}

console.log("");
if (failures > 0) {
  console.log(`${failures} provision-omada-venue check(s) FAILED`);
  process.exit(1);
}
console.log("all provision-omada-venue checks passed");
