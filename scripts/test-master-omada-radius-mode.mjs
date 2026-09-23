/**
 * The Master console's control for an Omada venue's guest-portal contract:
 * `network_integrations.portal_mode` and the RADIUS NAS registration.
 *
 * WHY THIS EXISTS
 * ---------------
 * `portal_mode` (cloud-guest #236, migration 0125) had exactly one operator
 * interface: `curl`. On 2026-09-13 an engineer moved the QA venue to RADIUS
 * mode with a raw PATCH, and registering the controller as a RADIUS client was
 * a second raw POST. Both routes are `ScopeType.GLOBAL`, so the customer
 * dashboard cannot call them (403) and must never offer them.
 *
 * WHAT A REGRESSION HERE COSTS, in the order it hurts:
 *
 *   1. A SWITCH THAT LOOKS LIKE IT WORKED AND DID NOT. A backend that predates
 *      #236 has no `portal_mode` field, and pydantic's default
 *      `extra="ignore"` answers that PATCH with 200 and changes nothing --
 *      the same shape as the `credentials: {...}` bug, which passed its test
 *      because the test read the same wrong place. So the service READS THE
 *      ANSWER BACK, and a mode it did not get is an error, not a success.
 *   2. THE SECRET IS SHOWN ONCE. `POST .../radius-nas` generates the shared
 *      secret and returns it in that one response; nothing can read it back.
 *      It may not reach a toast, a query cache or a log.
 *   3. REGISTERING TWICE ROTATES IT. router.py takes the `regenerate_secret`
 *      branch for a controller that already has a NAS row, so the value in the
 *      controller's RADIUS profile stops working the moment the call returns.
 *      That is confirmed, not discovered.
 *   4. `hub_confirmed: false` MEANS THE DATABASE IS AHEAD OF THE RADIUS
 *      SERVER -- the divergence that rejects every guest while every row looks
 *      healthy. It is rendered as the failure it is.
 *   5. AUTOMATIC SETUP HAS NO RADIUS BRANCH. `_configure_controller` always
 *      writes an External Portal Server (authType 4) portal; run on a
 *      RADIUS-mode venue it moves the controller off the contract this row
 *      claims. Preview/Apply are refused there.
 *   6. THE CUSTOMER DASHBOARD GETS NONE OF THIS.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-master-integration-repair.mjs` for the same note). The real
 * service and the real gating rules are bundled with esbuild against a
 * recording fake of `@/services/api`; the screen is asserted against its own
 * source.
 *
 * Run: node scripts/test-master-omada-radius-mode.mjs
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
/** Comments quote the defects they prevent, so assertions about what the code
 * DOES must read code. Same rule as the sibling suites. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const outdir = mkdtempSync(join(tmpdir(), "omada-radius-mode-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

// A recording stand-in for the axios instance: it records what each call was
// handed, returns what the current test queued, and can be told to reject the
// way `toAppError` does (a plain object with `status`, `code`, `data`).
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `export const calls = [];
   let nextData = {};
   let nextError = null;
   export function setNext(d) { nextData = d; nextError = null; }
   export function setNextError(e) { nextError = e; }
   export function reset() { calls.length = 0; nextData = {}; nextError = null; }
   function record(method, url, body, config) {
     calls.push({ method, url, body, headers: config?.headers ?? {}, config });
     if (nextError) { const e = nextError; nextError = null; throw e; }
     return { data: nextData };
   }
   export const api = {
     async get(url, config) { return record("get", url, undefined, config); },
     async post(url, body, config) { return record("post", url, body, config); },
     async patch(url, body, config) { return record("patch", url, body, config); },
     async put(url, body, config) { return record("put", url, body, config); },
     async delete(url, config) { return record("delete", url, undefined, config); },
   };
   export const guestPortalApi = { async get() {}, async post() {} };
   export function toAppError(e) { return e; }
   export default api;`,
);

const orgStub = join(outdir, "org-stub.mjs");
writeFileSync(
  orgStub,
  `export async function resolveOrganizationId() { return "org-under-test"; }
   export function peekOrganizationId() { return "org-under-test"; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { networkIntegrationService } from "${p("src/services/network-integration.service.ts")}";
   export * from "${p("src/lib/omada-portal-mode.ts")}";
   export { normalizeIntegrationPortalMode, INTEGRATION_PORTAL_MODE_LABEL } from "${p("src/types/network-integration.ts")}";
   export { calls, setNext, setNextError, reset } from "${norm(apiStub)}";`,
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

const mod = await import(`file://${outfile}`);
const {
  networkIntegrationService: svc,
  calls,
  setNext,
  setNextError,
  reset,
  normalizeIntegrationPortalMode,
  portalModeSwitchBlock,
  configureControllerPortalModeBlock,
  controllerIpDefaultFromBaseUrl,
  radiusNasRegisterBlock,
  describeRadiusNasFailure,
  RADIUS_MODE_PREREQUISITES,
} = mod;

const integrationRow = (over = {}) => ({
  id: "int-1",
  organization_id: "org-1",
  location_id: "loc-1",
  location_name: "Lobby",
  provider: "omada",
  name: "QA controller",
  status: "connected",
  is_enabled: true,
  base_url: "https://13.126.39.79:8043",
  auth_mode: "openapi",
  tls_mode: "strict",
  controller_id: null,
  controller_version: null,
  external_site_id: "site-1",
  external_site_name: "Default",
  guest_ssid_name: "Guest",
  guest_ssid_id: "ssid-1",
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
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
  ...over,
});

/* ── 1. The mode is read off the wire, and absence is not the default ──── */

console.log("\n1. portal_mode is read, never assumed");

reset();
setNext(integrationRow({ portal_mode: "radius", router_id: "router-1" }));
let row = await svc.getPlatformIntegration("int-1");
check("a radius row maps to `radius`", row.portalMode === "radius");
check("and carries its fleet device", row.routerId === "router-1");

setNext(integrationRow({ portal_mode: "external_portal" }));
row = await svc.getPlatformIntegration("int-1");
check("an external-portal row maps to `external_portal`", row.portalMode === "external_portal");
check("a row with no fleet device reads null, not undefined", row.routerId === null);

setNext(integrationRow());
row = await svc.getPlatformIntegration("int-1");
check(
  "a backend that sends NO portal_mode reads as null, not as the default",
  row.portalMode === null,
  "treating silence as external_portal offers a switch that backend would 200 and ignore",
);

setNext(integrationRow({ portal_mode: "carrier_pigeon" }));
row = await svc.getPlatformIntegration("int-1");
check("an unrecognised mode reads as null", row.portalMode === null);

check("the wire casing is what is stored", normalizeIntegrationPortalMode("RADIUS") === "radius");
check("and nonsense is refused", normalizeIntegrationPortalMode(7) === null);

/* ── 2. Switching sends the platform route, unscoped, and reads back ───── */

console.log("\n2. the switch is a platform PATCH whose answer is checked");

reset();
setNext(integrationRow({ portal_mode: "radius" }));
await svc.setPlatformPortalMode("int-1", "radius");
const patch = calls.at(-1);
check(
  "it PATCHes the platform route",
  patch.method === "patch" && patch.url === "/network-integrations/platform/integrations/int-1",
  patch.url,
);
check(
  "with portal_mode and nothing else",
  JSON.stringify(patch.body) === JSON.stringify({ portal_mode: "radius" }),
  JSON.stringify(patch.body),
);
check(
  "and NO organization header",
  !("X-Organization-Id" in (patch.headers ?? {})),
  "a platform route with an org header narrows the master console to one tenant",
);

reset();
setNext(integrationRow()); // the pre-#236 backend: 200, field ignored
let threw = null;
try {
  await svc.setPlatformPortalMode("int-1", "radius");
} catch (e) {
  threw = e;
}
check(
  "a 200 that did not change the mode is a failure, not a success",
  threw instanceof Error && /did not report a portal mode/.test(threw.message),
  String(threw),
);

reset();
setNext(integrationRow({ portal_mode: "external_portal" }));
threw = null;
try {
  await svc.setPlatformPortalMode("int-1", "radius");
} catch (e) {
  threw = e;
}
check(
  "and so is a 200 carrying the other mode",
  threw instanceof Error && /"external_portal"/.test(threw.message),
  String(threw),
);

/* ── 3. The NAS registration ───────────────────────────────────────────── */

console.log("\n3. the RADIUS NAS registration");

reset();
setNext({
  integration_id: "int-1",
  nas_identifier: "cg-omada-abcd1234",
  controller_ip: "13.126.39.79",
  shared_secret: "s3cret",
  hub_confirmed: true,
});
let reg = await svc.registerPlatformControllerRadiusNas("int-1", {
  controllerIp: " 13.126.39.79 ",
});
let post = calls.at(-1);
check(
  "it POSTs the platform radius-nas route",
  post.method === "post" &&
    post.url === "/network-integrations/platform/integrations/int-1/radius-nas",
  post.url,
);
check(
  "the typed address is trimmed and sent as controller_ip",
  JSON.stringify(post.body) === JSON.stringify({ controller_ip: "13.126.39.79" }),
  JSON.stringify(post.body),
);
check("no organization header", !("X-Organization-Id" in (post.headers ?? {})));
check("the one-time secret is returned to the caller", reg.sharedSecret === "s3cret");
check("and the hub's own answer is carried", reg.hubConfirmed === true);

reset();
setNext({ nas_identifier: "cg-omada-abcd1234", controller_ip: "1.2.3.4", shared_secret: "x" });
reg = await svc.registerPlatformControllerRadiusNas("int-1", { controllerIp: "   " });
check(
  "a blank address sends NO controller_ip, so the backend's own default applies",
  JSON.stringify(calls.at(-1).body) === "{}",
  JSON.stringify(calls.at(-1).body),
);
check(
  "a missing hub_confirmed is NOT read as confirmed",
  reg.hubConfirmed === false,
  "an absent field is not the hub saying yes",
);

reset();
setNext({
  id: "nas-1",
  nas_identifier: "cg-omada-abcd1234",
  status: "active",
  ip_address: "13.126.39.79",
  hub_client_synced_ip: "13.126.39.79",
  hub_client_synced_at: "2026-09-13T10:00:00Z",
});
const existing = await svc.getPlatformControllerNas("router-1");
check("the existing registration is read off the router's NAS row", existing.id === "nas-1");
check("it reads /routers/{router_id}/nas", calls.at(-1).url === "/routers/router-1/nas");
check(
  "and what the HUB confirmed, separately from the stored address",
  existing.hubClientSyncedIp === "13.126.39.79",
);

reset();
setNextError({ status: 404, code: "not_found", message: "no NAS" });
check(
  "a controller with no NAS row reads as null, not as an error",
  (await svc.getPlatformControllerNas("router-1")) === null,
);

reset();
setNextError({ status: 500, code: "server_error", message: "boom" });
threw = null;
try {
  await svc.getPlatformControllerNas("router-1");
} catch (e) {
  threw = e;
}
check("any other failure is not swallowed", threw !== null);

/* ── 4. The gating rules, executed ─────────────────────────────────────── */

console.log("\n4. what may be offered, and when");

check("a backend with no portal mode cannot be switched", portalModeSwitchBlock(null) !== null);
check("a known mode can be", portalModeSwitchBlock("external_portal") === null);
check(
  "automatic controller setup is refused in RADIUS mode",
  /External Portal Server/.test(configureControllerPortalModeBlock("radius") ?? ""),
  "configure-controller always writes authType 4 and would move the controller off RADIUS",
);
check(
  "and allowed on the contract it was written for",
  configureControllerPortalModeBlock("external_portal") === null,
);

check(
  "a literal-IP controller address supplies the default NAS address",
  controllerIpDefaultFromBaseUrl("https://13.126.39.79:8043") === "13.126.39.79",
);
check(
  "a hostname supplies none, because clients.conf cannot be keyed on one",
  controllerIpDefaultFromBaseUrl("https://omada.example.com:8043") === null,
);
check(
  "and a malformed address does not throw",
  controllerIpDefaultFromBaseUrl("nonsense") === null,
);

const base = {
  portalMode: "radius",
  routerId: "router-1",
  baseUrl: "https://13.126.39.79:8043",
  controllerIpInput: "",
};
check(
  "registering is refused off the RADIUS contract",
  /RADIUS mode first/.test(
    radiusNasRegisterBlock({ ...base, portalMode: "external_portal" }) ?? "",
  ),
);
check(
  "and with no fleet device",
  /fleet device/.test(radiusNasRegisterBlock({ ...base, routerId: null }) ?? ""),
);
check(
  "a hostname controller with an empty field is refused before the click",
  radiusNasRegisterBlock({ ...base, baseUrl: "https://omada.example.com:8043" }) !== null,
);
check(
  "typing the public IP unblocks it",
  radiusNasRegisterBlock({
    ...base,
    baseUrl: "https://omada.example.com:8043",
    controllerIpInput: "13.126.39.79",
  }) === null,
);
check("a literal-IP controller needs nothing typed", radiusNasRegisterBlock(base) === null);

/* The backend's refusals, as the operator reads them. */
const precondition = describeRadiusNasFailure({
  status: 400,
  code: "setup-incomplete",
  message: "This integration has no fleet device. A RADIUS NAS client is registered against one.",
  data: { code: "NETWORK_INTEGRATION_SETUP_INCOMPLETE" },
});
check(
  "a 400 shows the backend's own sentence, which names the one missing thing",
  /no fleet device/.test(precondition.detail),
  "a generic 'preconditions not met' makes an operator check all three",
);
const hub = describeRadiusNasFailure({
  status: 502,
  code: "bad-gateway",
  message: "the hub agent refused: freeradius -CX failed",
});
check("a 502 is named as the hub refusing", /hub refused/i.test(hub.title));
check(
  "and says the row may exist without a stanza, and that re-running converges",
  /without a stanza/.test(hub.detail) && /converge/.test(hub.detail),
);
check(
  "a 403 is a permission problem, not a controller problem",
  /permission/.test(describeRadiusNasFailure({ status: 403, message: "nope" }).detail),
);
check(
  "an unknown failure claims nothing about the hub",
  /Nothing on this screen confirms/.test(describeRadiusNasFailure(new Error("x")).detail),
);

/* ── 5. The prerequisites an operator confirms ─────────────────────────── */

console.log("\n5. switching to RADIUS states what it does not arrange");

const prereqText = RADIUS_MODE_PREREQUISITES.map((x) => `${x.title} ${x.detail}`).join(" ");
check("there is more than one thing to confirm", RADIUS_MODE_PREREQUISITES.length >= 4);
check("the inbound UDP path is one of them", /1812/.test(prereqText) && /1813/.test(prereqText));
check(
  "keyed on the controller's PUBLIC address",
  /public/i.test(prereqText) && /arrive/i.test(prereqText),
);
check(
  "the guest-visible failure mode is stated",
  /errorCode/.test(prereqText) && /JSON/.test(prereqText),
  "on this contract every failure renders as a raw JSON blob in the guest's browser",
);
check("and the accounting finding", /accounting/i.test(prereqText) && /-41501/.test(prereqText));
check(
  "the catch-all RADIUS client is named as a prerequisite of opening the port",
  /0\.0\.0\.0\/0/.test(prereqText),
);

/* ── 6. The screen ─────────────────────────────────────────────────────── */

console.log("\n6. the control lives in the Master drawer, and only there");

const master = read("src/routes/master.integrations.tsx");
const masterCode = strip(master);
/** The preview/apply buttons this route mounts now live in the shared panel. */
const previewPanelCode = strip(read("src/components/network-integrations/PreviewThenApply.tsx"));
const customer = strip(read("src/components/features/NetworkIntegrationsPage.tsx"));

check("the Master drawer has a portal-contract section", /PortalContractSection/.test(masterCode));
check("it calls the platform portal-mode switch", /setPlatformPortalMode\(/.test(masterCode));
check(
  "and the platform NAS registration",
  /registerPlatformControllerRadiusNas\(/.test(masterCode),
);
check(
  "THE CUSTOMER DASHBOARD GETS NONE OF IT",
  !/portalMode|portal_mode|radius-nas|RadiusNas|setPlatformPortalMode/.test(customer),
  "these routes are GLOBAL-scoped and 403 for a venue owner; TP-Link controls are Master-only",
);
check(
  "no tunnel or WireGuard internals reach either surface",
  !/WireGuard|wireguard/.test(masterCode + customer),
);

check(
  "moving to RADIUS is confirmed item by item, not with an 'are you sure?'",
  /RADIUS_MODE_PREREQUISITES\.map/.test(masterCode) && /allAcknowledged/.test(masterCode),
);
check(
  "the confirm button stays disabled, and says why, until every item is ticked",
  /disabled=\{!allAcknowledged/.test(masterCode) && /title=\{\s*allAcknowledged/.test(masterCode),
);
check(
  "switching back is confirmed too",
  /confirmExternal/.test(masterCode) && /setMode\.mutate\("external_portal"\)/.test(masterCode),
);
check(
  "and says the controller keeps its RADIUS portal and the NAS client its secret",
  /keeps whatever RADIUS portal/.test(master) && /stays registered/.test(master),
);

check(
  "the existing registration is read before the button is offered",
  /getPlatformControllerNas\(/.test(masterCode),
);
check(
  "re-registering is confirmed, because it rotates a live secret",
  /confirmRotate/.test(masterCode) &&
    /if \(nas\.data \|\| nas\.isError\) setConfirmRotate\(true\)/.test(masterCode),
  "a read that could not answer is treated as 'it may exist', not as 'it does not'",
);
check(
  "the rotation warning says the controller stops working until the new secret is typed in",
  /stops working the moment this\s*\n?\s*returns/.test(master.replace(/\s+/g, " ")) ||
    /stops working the moment this returns/.test(master.replace(/\s+/g, " ")),
);

check(
  "the one-time secret is rendered from component state",
  /registration\.sharedSecret/.test(masterCode) && /setRegistration\(result\)/.test(masterCode),
);
check("and never put in a toast", !/toast\.[a-z]+\([^)]*sharedSecret/.test(masterCode));
check(
  "nor in a query key or cache",
  !/queryKey:[^}]*sharedSecret/.test(masterCode) && !/setQueryData\(/.test(masterCode),
);
check("the operator is told it is shown once", /Shown once and never readable again/.test(master));

check(
  "hub_confirmed false is rendered as the divergence it is",
  /registration\.hubConfirmed \?/.test(masterCode) &&
    /database is ahead of the RADIUS server/.test(master),
);
check(
  "the switch does not claim the venue is live",
  /Nothing on the controller changed/.test(master),
  "a green toast with nothing behind it is this codebase's characteristic bug",
);

// The two buttons moved into `<PreviewThenApply>` when that machinery was
// extracted out of this route; the refusal did not change. The route still
// derives the block from `portal_mode` and now hands it over as `blocked`, and
// the shared panel gates BOTH buttons on it -- which is what this check has
// always been about.
check(
  "Preview and Apply are refused on the RADIUS contract",
  /configureBlock = configureControllerPortalModeBlock\(integration\.portalMode\)/.test(
    masterCode,
  ) &&
    /blocked=\{configureBlock\}/.test(masterCode) &&
    /const stopped = busy \|\| blocked !== null/.test(previewPanelCode) &&
    /disabled=\{stopped\}/.test(previewPanelCode) &&
    /disabled=\{!previewed \|\| stopped\}/.test(previewPanelCode),
);
check(
  "the portal setup steps say they describe the other contract",
  /External Web Portal/.test(master) && /integration\.portalMode === "radius"/.test(masterCode),
);
check(
  "these writes make the rest of the drawer busy, like every other write here",
  /onBusyChange/.test(masterCode) && /contractBusy \|\|/.test(masterCode),
);

console.log(
  failures === 0
    ? "\nall master Omada RADIUS-mode checks passed"
    : `\n${failures} master Omada RADIUS-mode check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
