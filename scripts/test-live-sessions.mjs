/**
 * Regression test for the Live Session explorer — the READ screen that used
 * to fabricate 45 rows in the browser (random SSIDs, routers, devices,
 * signal, byte counts and usernames) under a "real-time view" heading.
 *
 * The load-bearing assertions:
 *
 *   1. THE SERVICE READS THE REAL ENDPOINT AND MAPS IT. `liveSessionService
 *      .list` bundles against a stubbed `api`, so the actual snake→camel
 *      mapping runs; it must hit `GET /sessions/live` and pass the
 *      status/search/paging params through.
 *   2. ssid / signal ARE NEVER SURFACED. This fleet has no radio, so those
 *      fields are always empty on the session path (see
 *      LiveSessionExplorer's docstring). The mapping must not carry them and
 *      the screen must not render them — the whole reason the fabrication
 *      was caught. Pinned here so no future edit reintroduces them.
 *   3. MISSING BYTES/DURATION DEFAULT SANELY, ids/nullable fields survive.
 *   4. THE SCREEN IS WIRED to the hook, not to invented data.
 *
 * No test runner in this repo (see test-campaign-results.mjs for the same
 * note); the service is bundled with esbuild against a stubbed api.
 *
 * Run: node scripts/test-live-sessions.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "live-sessions-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

const stubModule = `
globalThis.__stub ??= { calls: [], response: null };
export const api = {
  get: async (url, config) => {
    globalThis.__stub.calls.push({ url, params: config?.params });
    return { data: globalThis.__stub.response };
  },
};
`;
writeFileSync(join(outdir, "api-stub.mjs"), stubModule);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { liveSessionService } from "${p("src/services/live-session.service.ts")}";`,
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
        b.onResolve({ filter: /services\/api$/ }, () => ({ path: join(outdir, "api-stub.mjs") }));
      },
    },
  ],
});

const { liveSessionService } = await import(`file://${outfile}`);
const state = globalThis.__stub;

// A payload exactly as the backend serialises it — note it INCLUDES ssid,
// signal, nas and router-name, which the mapping must drop.
state.response = {
  items: [
    {
      id: "sess-1",
      guest_id: "guest-1",
      mac: "AA:BB:CC:DD:EE:FF",
      ip: "10.0.1.5",
      router_id: "router-1",
      ssid: "SHOULD-NOT-APPEAR",
      nas: "nas-should-not-appear",
      router: "GW-01 (fabricated name)",
      signal: 73,
      device: "iPhone",
      session_time_seconds: 1234,
      download_bytes: 5000,
      upload_bytes: 900,
      status: "active",
      location_id: "loc-1",
      started_at: "2026-09-13T10:00:00Z",
    },
    { id: "sess-2" }, // sparse row: everything else absent
  ],
  total: 42,
  page: 2,
  page_size: 25,
};

console.log("\nthe service reads the real endpoint and maps it");
const list = await liveSessionService.list({ status: "active", search: "10.0", page: 2 });
eq("calls GET /sessions/live", state.calls.at(-1).url, "/sessions/live");
eq("passes the status param", state.calls.at(-1).params.status, "active");
eq("passes the search param", state.calls.at(-1).params.search, "10.0");
eq("passes the page param", state.calls.at(-1).params.page, 2);
eq("maps the envelope total", list.total, 42);
eq("maps the envelope page", list.page, 2);

const s1 = list.items[0];
eq("id survives", s1.id, "sess-1");
eq("guest_id → guestId", s1.guestId, "guest-1");
eq("ip survives", s1.ip, "10.0.1.5");
eq("router_id → routerId", s1.routerId, "router-1");
eq("session_time_seconds → sessionTimeSeconds", s1.sessionTimeSeconds, 1234);
eq("download_bytes → downloadBytes", s1.downloadBytes, 5000);

console.log("\nssid / signal / nas / router-name are NEVER carried");
check("no ssid field on the mapped row", !("ssid" in s1), "this fleet has no radio to name");
check("no signal field on the mapped row", !("signal" in s1));
check("no nas field on the mapped row", !("nas" in s1));
check("no router-name field on the mapped row", !("router" in s1));

console.log("\nsparse rows default sanely, never fabricated");
const s2 = list.items[1];
eq("absent guest_id → null", s2.guestId, null);
eq("absent mac → null", s2.mac, null);
eq("absent download_bytes → 0", s2.downloadBytes, 0);
eq("absent session_time → 0", s2.sessionTimeSeconds, 0);
eq("absent status → active default", s2.status, "active");

console.log("\nthe screen is wired to the real hook, not invented data");
const explorer = readFileSync(
  join(ROOT, "src/components/sessions/LiveSessionExplorer.tsx"),
  "utf8",
);
check("explorer uses the useLiveSessions hook", /useLiveSessions\(/.test(explorer));
check(
  "explorer no longer renders an empty 'no data source' stub only",
  /useLiveSessions/.test(explorer) && /<Table>/.test(explorer),
);
// Strip comments first: this component's docstring DOCUMENTS the old
// fabricated ssid/signal/Math.random in prose, so matching the raw file
// would pass/fail on a comment rather than on rendered code (same technique
// as test-campaign-results.mjs).
const explorerCode = explorer.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
check(
  "explorer renders no SSID column",
  !/SSID/i.test(explorerCode),
  "SSID is unobtainable on this fleet",
);
check("explorer renders no Signal column", !/Signal/i.test(explorerCode));
check(
  "explorer has no Math.random fabrication",
  !/Math\.random/.test(explorerCode),
  "the old version invented every field",
);

const service = readFileSync(join(ROOT, "src/services/live-session.service.ts"), "utf8");
check("service maps no ssid", !/ssid/i.test(service.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")));
check("service maps no signal", !/signal/i.test(service.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")));

console.log(
  failures === 0
    ? `\nall live session checks passed\n`
    : `\n${failures} live session check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
