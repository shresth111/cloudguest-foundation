/**
 * Regression test for the Devices screen at a TP-Link Omada venue.
 *
 * ## WHAT WENT WRONG
 *
 * A monitored-hardware row's up/down is derived from `connected_devices`,
 * and both writers of that table reach a venue by opening a RouterOS session
 * against its uplink router. An Omada controller has no RouterOS, so at a
 * venue whose network it runs, nothing ever probes a registered access
 * point: the row is `unknown` on the day it is added and `unknown` forever
 * after. The screen rendered that as "Never observed" -- which reads as *we
 * looked and never saw it*, a device to go and check. Nothing here ever
 * looked.
 *
 * ## LOAD-BEARING ASSERTIONS, WORST-FIRST
 *
 *   1. AN UNMEASURED ROW NEVER BORROWS MEASURED VOCABULARY. Not "Never
 *      observed", not "Down", not a status dot, and not a bare duration.
 *      It says "Not measured" and carries the reason.
 *   2. A MIKROTIK VENUE IS UNCHANGED. Every existing shape -- including a
 *      row whose `statusSource` is absent entirely, which is what an older
 *      backend and the demo fixture both send -- renders exactly as it did
 *      before this field existed. This is the assertion that would catch a
 *      well-meaning default flipping the whole fleet to "Not measured".
 *   3. A NULL CLIENT COUNT IS NEVER PRINTED AS ZERO. TP-Link's Open API
 *      `DeviceInfo` has no client-count field at all (measured against
 *      Omada Software Controller 5.15.24.19, 2026-09-18), so `clientCount`
 *      arrives `null` for every device. "This API does not report it" and
 *      "this AP has no clients" are different facts, and `0 clients` under
 *      an EAP245 serving forty guests is the worse of the two.
 *   4. THE AP INVENTORY STAYS READ-ONLY. No radio, channel, power or
 *      firmware control, and no write call, anywhere on that card.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-device-liveness.mjs` for the same note). The pure derivation
 * is bundled with esbuild and executed for real; the wiring and the
 * never-promise rules are checked against the real component sources.
 *
 * Run: node scripts/test-ap-inventory-honesty.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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
  check(name, a === e, `expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);

// ---------------------------------------------------------------------------
// Bundle the real derivation and the real service mapper.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "ap-inventory-"));

writeFileSync(
  join(outdir, "api-stub.mjs"),
  `globalThis.__ap ??= { next: null };
   export const api = { get: async () => ({ data: globalThis.__ap.next }) };`,
);
writeFileSync(
  join(outdir, "cust-stub.mjs"),
  `export async function resolveOrgId() { return "org-1"; }
   export function isDemo() { return false; }`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { describeLiveness, hardwareLivenessIsMeasured, UNMEASURED_REASON_COPY }
     from "${p("src/lib/device-liveness.ts")}";
   export { deviceHardwareService } from "${p("src/services/deviceHardware.service.ts")}";`,
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

const {
  describeLiveness,
  hardwareLivenessIsMeasured,
  UNMEASURED_REASON_COPY,
  deviceHardwareService,
} = await import(`file://${bundle}`);

const NOW = Date.parse("2026-09-18T11:00:00Z");
const MIN = 60_000;
const ago = (ms) => new Date(NOW - ms).toISOString();

// ---------------------------------------------------------------------------
// 1. The defect: a row nothing probes must not speak as though it were probed.
// ---------------------------------------------------------------------------

console.log("\nan access point at a controller-managed venue says nothing measures it");

const omadaAp = describeLiveness(
  {
    status: "unknown",
    lastSeenAt: null,
    connectedAt: null,
    uptimeSeconds: null,
    uptimeRecordedAt: null,
    statusSource: "unmeasured",
    statusReason: "controller_managed",
  },
  NOW,
);
eq("the status word is not a measurement word", omadaAp.state, "Not measured");
check(
  '"Never observed" -- the claim that we looked -- is nowhere in the output',
  !JSON.stringify(omadaAp).includes("Never observed"),
  JSON.stringify(omadaAp),
);
eq("no duration is attached to a row nothing measured", omadaAp.detail, null);
eq("the kind says it is an absence, not a reading", omadaAp.detailKind, "unmeasured");
check(
  "an explanation names the controller as the source of truth",
  typeof omadaAp.explanation === "string" && /controller/i.test(omadaAp.explanation),
  String(omadaAp.explanation),
);
check(
  "and the predicate agrees",
  hardwareLivenessIsMeasured({ statusSource: "unmeasured" }) === false,
);

// ---------------------------------------------------------------------------
// 2. A MikroTik venue is untouched -- including the absent-field case.
// ---------------------------------------------------------------------------

console.log("\na MikroTik venue renders exactly as it did before the field existed");

const measuredUp = describeLiveness(
  {
    status: "up",
    lastSeenAt: ago(2 * MIN),
    connectedAt: null,
    uptimeSeconds: 26931,
    uptimeRecordedAt: ago(3 * MIN),
    statusSource: "measured",
    statusReason: "liveness_probe",
  },
  NOW,
);
eq("an explicitly measured row still says Up", measuredUp.state, "Up");
eq("with its uptime", measuredUp.detail, "up 7h 28m");
eq("and no explanation to show", measuredUp.explanation, null);

// The one that matters most: no `statusSource` at all.
const legacyRow = {
  status: "unknown",
  lastSeenAt: null,
  connectedAt: null,
  uptimeSeconds: null,
  uptimeRecordedAt: null,
};
const legacy = describeLiveness(legacyRow, NOW);
eq("an absent statusSource keeps the pre-existing words", legacy.state, "Never observed");
check("and reads as measured", hardwareLivenessIsMeasured(legacyRow) === true);

const legacyDown = describeLiveness(
  {
    status: "down",
    lastSeenAt: ago(9 * MIN),
    connectedAt: null,
    uptimeSeconds: null,
    uptimeRecordedAt: null,
  },
  NOW,
);
eq("a down row with no source is still Down", legacyDown.state, "Down");
eq("with its heartbeat age, named", legacyDown.detail, "last seen 9m ago");

// ---------------------------------------------------------------------------
// 3. The service carries the two codes across the JSON boundary, and an
//    older backend that sends neither degrades to "measured", not to
//    "Not measured" for the whole fleet.
// ---------------------------------------------------------------------------

console.log("\nthe hardware service maps the honesty fields and defaults safely");

const baseRaw = {
  id: "d1",
  location_id: "loc-1",
  name: "Lobby AP",
  mac_address: "AA:BB:CC:DD:EE:01",
  device_type: "Access Point",
  floor: "GF",
  status: "unknown",
  last_seen_at: null,
  connected_at: null,
  uptime_seconds: null,
  uptime_recorded_at: null,
};

globalThis.__ap.next = {
  items: [{ ...baseRaw, status_source: "unmeasured", status_reason: "controller_managed" }],
};
let rows = await deviceHardwareService.list("loc-1");
eq("status_source -> statusSource", rows[0].statusSource, "unmeasured");
eq("status_reason -> statusReason", rows[0].statusReason, "controller_managed");

globalThis.__ap.next = { items: [baseRaw] };
rows = await deviceHardwareService.list("loc-1");
eq("a backend without the fields reads as measured", rows[0].statusSource, "measured");
check(
  "so an older API does not turn every row into 'Not measured'",
  describeLiveness(rows[0], NOW).state === "Never observed",
);

// ---------------------------------------------------------------------------
// 4. Source rules -- what the two cards on the screen may and may not say.
// ---------------------------------------------------------------------------

console.log("\nthe screen's two cards keep their sources apart and promise nothing extra");

const card = read("src/components/customer/ControllerDevicesCard.tsx");
const hardwareView = read("src/components/customer/BasicFeatureViews.tsx");
// The same rows are rendered a second time by the location picker's
// cross-location hardware panel. A screen that says "Not measured" in one
// column and "UNKNOWN" beside a status dot in the next contradicts itself.
const locationPicker = read("src/routes/switch-location.tsx");

check(
  "a null client count is never coalesced to a number",
  !/clientCount\s*(\?\?|\|\|)\s*0/.test(card),
  "found a `clientCount ?? 0` / `|| 0` -- that prints 'no clients' for 'not reported'",
);
check("the card says whose word the status is", /reported by your (omada )?controller/i.test(card));
check(
  "the AP table carries the fields the brief asked for",
  ["ipAddress", "uptimeSeconds", "firmwareVersion", "device.mac", "device.model", "status"].every(
    (field) => card.includes(field),
  ),
);
// Comments are stripped first: this file's own header explains at length
// what the card deliberately does NOT do, and that prose must not be read as
// the card doing it.
const cardCode = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check(
  "the AP inventory carries no control surface at all",
  !/(onClick|onChange|onSubmit)=/.test(cardCode) &&
    !/<(Button|Input|Select|Switch|Slider|form)\b/.test(cardCode),
  "a read-only inventory grew an interactive element",
);
check("and issues no write call", !/\bapi\.(post|put|patch|delete)\b/.test(cardCode));
check(
  "it does not restate the Access Points stub's configuration promises",
  !/(radio\s*&?\s*channel|channel planning|tx power|power level|firmware roll)/i.test(cardCode),
  "the capability matrix backs none of these on this surface",
);
check(
  "one fetch serves both cards -- the card takes the inventory, it does not fetch it",
  /inventory:\s*ReturnType<typeof useControllerDevices>/.test(card) &&
    !/=\s*useControllerDevices\(/.test(card),
);
check(
  "the manual hardware list styles an unmeasured row apart",
  /hardwareLivenessIsMeasured/.test(hardwareView),
);
check("and shows the explanation rather than dropping it", /live\.explanation/.test(hardwareView));
check(
  "the empty state stops promising monitoring at a venue that gets none",
  /controllerManaged\s*\n?\s*\?/.test(hardwareView) && /keep a record of it/i.test(hardwareView),
);

const dashboardTile = read("src/components/customer/dashboard/DeviceStatusCard.tsx");
check(
  "the dashboard tile neither promises a 'yet' nor claims all devices are up",
  /hardwareLivenessIsMeasured/.test(dashboardTile) &&
    /not measured here/i.test(dashboardTile) &&
    // the "not yet observed" branch must no longer swallow unmeasured rows
    /status === "unknown" && hardwareLivenessIsMeasured\(d\)/.test(dashboardTile),
);
check(
  "the cross-location hardware panel does not print a raw UNKNOWN for an unmeasured row",
  /hardwareLivenessIsMeasured/.test(locationPicker) && /NOT MEASURED/.test(locationPicker),
);

// The copy map must not leave a reason code rendering as `undefined`.
for (const reason of ["controller_managed", "never_observed", "liveness_probe"]) {
  check(`reason ${reason} has words`, typeof UNMEASURED_REASON_COPY[reason] === "string");
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nPASS: the AP inventory says where each status came from");
