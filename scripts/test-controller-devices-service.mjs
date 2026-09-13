/**
 * Regression test for the customer controller-device read
 * (`controllerDevices.service.ts`).
 *
 * WHAT THIS LOCKS DOWN:
 *  1. STATUS IS NEVER GUESSED UP. An unrecognised status from the backend
 *     must degrade to `no_controller` (show nothing), never be assumed `ok`
 *     -- inventing a device list from a state we don't understand is the
 *     same class of fabrication this codebase forbids elsewhere.
 *  2. EMPTY OK ≠ NO CONTROLLER. An `ok` with no devices stays `ok` (the
 *     controller manages nothing yet); it must not collapse into
 *     `no_controller` (no controller at all). The card shows different,
 *     honest copy for each.
 *  3. snake_case → camelCase mapping survives the JSON boundary, and a
 *     missing/absent `devices` becomes `[]`, never `undefined`.
 *  4. The request is org-scoped: `X-Organization-Id` goes out and the URL
 *     is the customer endpoint, not a GLOBAL network-integrations route.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs`). The real service is bundled
 * with esbuild against a stubbed `api`/`resolveOrgId`, so the actual mapping
 * runs.
 *
 * Run: node scripts/test-controller-devices-service.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "controller-devices-"));

const apiStub = `
globalThis.__cd ??= { calls: [], next: null };
export const api = {
  get: async (url, opts) => {
    globalThis.__cd.calls.push({ url, headers: opts && opts.headers });
    return { data: globalThis.__cd.next };
  },
};
`;
writeFileSync(join(outdir, "api-stub.mjs"), apiStub);

const custStub = `
export async function resolveOrgId() { return "org-42"; }
export function isDemo() { return false; }
`;
writeFileSync(join(outdir, "cust-stub.mjs"), custStub);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { controllerDevicesService } from "${p("src/services/controllerDevices.service.ts")}";`,
);
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
        b.onResolve({ filter: /services\/customer\.service$/ }, () => ({
          path: join(outdir, "cust-stub.mjs"),
        }));
      },
    },
  ],
});

const { controllerDevicesService } = await import(`file://${outfile}`);
const st = globalThis.__cd;

const rawDevice = {
  mac: "AA-BB-CC-DD-EE-01",
  name: "EAP245",
  device_type: "ap",
  model: "EAP245(EU)",
  status: "CONNECTED",
  ip_address: "192.168.1.20",
  firmware_version: "5.1.0",
  uptime_seconds: 3600,
  client_count: 4,
};

// 1. ok with a device -> mapped, org-scoped request
st.calls.length = 0;
st.next = { status: "ok", devices: [rawDevice] };
let r = await controllerDevicesService.list("loc-1");
eq("status ok passes through", r.status, "ok");
eq("device count", r.devices.length, 1);
eq("device_type -> deviceType", r.devices[0].deviceType, "ap");
eq("ip_address -> ipAddress", r.devices[0].ipAddress, "192.168.1.20");
eq("uptime_seconds -> uptimeSeconds", r.devices[0].uptimeSeconds, 3600);
eq("client_count -> clientCount", r.devices[0].clientCount, 4);
check(
  "org header sent",
  st.calls[0].headers && st.calls[0].headers["X-Organization-Id"] === "org-42",
);
check(
  "hits the customer controller-devices endpoint",
  st.calls[0].url === "/network-integrations/locations/loc-1/controller-devices",
  st.calls[0].url,
);

// 2. unknown status -> no_controller (never guessed up to ok)
st.next = { status: "weird_state", devices: [rawDevice] };
r = await controllerDevicesService.list("loc-1");
eq("unknown status coerced to no_controller", r.status, "no_controller");

// 3. empty ok stays ok, not no_controller
st.next = { status: "ok", devices: [] };
r = await controllerDevicesService.list("loc-1");
eq("empty ok stays ok", r.status, "ok");
eq("empty ok has zero devices", r.devices.length, 0);

// 4. absent devices -> [] not undefined
st.next = { status: "unreachable" };
r = await controllerDevicesService.list("loc-1");
eq("unreachable status", r.status, "unreachable");
check("absent devices become []", Array.isArray(r.devices) && r.devices.length === 0);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nPASS: controller-devices service maps and guards correctly");
