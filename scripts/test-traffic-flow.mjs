/**
 * Master "Traffic Flow" (NetFlow/IPFIX) page: honesty and scope guards.
 *
 * What this pins, worst-first:
 *
 *   1. NO CUSTOMER SURFACE. Guest traffic metadata is operator-only
 *      (~/wyfy-ops/netflow/DESIGN.md §7). Only the Master route may import
 *      the traffic-flow service; the nav item is cap-gated on
 *      `traffic_flows.read`, the backend's GLOBAL-only module.
 *   2. AN UNKNOWN STATE IS NEVER SHOWN AS HEALTHY. An unrecognised state from
 *      the wire maps to `no_windows`, not `ok`; every state has a label, a
 *      tone and an explanation, so no router renders as a bare empty table.
 *   3. NO APPLICATION CLAIM. IPFIX gives addresses, not apps; the page must
 *      say so and must not render an "Application" column.
 *   4. TALKERS AND DESTINATIONS STAY SEPARATE. The mapper must not invent a
 *      talker->destination pairing the backend deliberately never stores.
 *
 * Run: node scripts/test-traffic-flow.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

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
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "traffic-flow-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/traffic-flow.ts"))};
   export { TRAFFIC_FLOW_STATE_LABEL, TRAFFIC_FLOW_STATE_TONE, TRAFFIC_FLOW_STATE_HELP }
     from ${JSON.stringify(join(ROOT, "src/types/traffic-flow.ts"))};`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});
const lib = await import(bundle);

// ---------------------------------------------------------------------------
console.log("\nunknown or missing values never read as healthy");
eq("unknown state -> no_windows", lib.toTrafficFlowState("weird"), "no_windows");
eq("missing state -> no_windows", lib.toTrafficFlowState(undefined), "no_windows");
eq("ok stays ok", lib.toTrafficFlowState("ok"), "ok");
const emptyOverview = lib.toTrafficFlowOverview({});
eq("missing enabled -> false", emptyOverview.enabled, false);
eq("missing last_pull_ok -> null (unknown), not true", emptyOverview.lastPullOk, null);
eq("missing routers -> []", emptyOverview.routers, []);
const t = lib.toTalker({ ip: "192.168.95.10", match: "bogus" });
eq("unknown talker match -> none", t.match, "none");
eq("missing session id -> null", t.guestSessionId, null);
const r = lib.toTrafficFlowRouter({ router_id: "x" });
eq("approximate defaults true (merged top-N)", r.approximate, true);

// ---------------------------------------------------------------------------
console.log("\nevery state has a label, a tone and an explanation");
const STATES = [
  "disabled",
  "not_allowlisted",
  "collector_unreachable",
  "no_windows",
  "stale",
  "ok",
];
const typesSrc = readFileSync(join(ROOT, "src/types/traffic-flow.ts"), "utf8");
const unionStates = [
  ...typesSrc.match(/export type TrafficFlowState =([^;]+);/)[1].matchAll(/"([a-z_]+)"/g),
].map((m) => m[1]);
eq("the test's state list matches the type union", unionStates.sort(), [...STATES].sort());
for (const s of STATES) {
  check(`${s} has a label`, typeof lib.TRAFFIC_FLOW_STATE_LABEL[s] === "string");
  check(`${s} has a tone`, typeof lib.TRAFFIC_FLOW_STATE_TONE[s] === "string");
  check(`${s} has an explanation`, (lib.TRAFFIC_FLOW_STATE_HELP[s] ?? "").length > 20);
}
check(
  "collector_unreachable is explicitly not 'no traffic'",
  /not 'no traffic'/.test(lib.TRAFFIC_FLOW_STATE_HELP.collector_unreachable),
);

// ---------------------------------------------------------------------------
console.log("\ntalkers and destinations stay independent");
const mapped = lib.toTrafficFlowRouter({
  talkers: [{ ip: "192.168.95.10", bytes_up: 1, bytes_down: 2, flows: 1, match: "session" }],
  destinations: [{ ip: "142.250.1.1", bytes: 3, flows: 1 }],
});
eq("talker keys", Object.keys(mapped.talkers[0]).sort(), [
  "bytesDown",
  "bytesUp",
  "flows",
  "guestSessionId",
  "ip",
  "match",
]);
eq("destination keys", Object.keys(mapped.destinations[0]).sort(), ["bytes", "flows", "ip"]);

// ---------------------------------------------------------------------------
console.log("\nbytes format");
eq("0", lib.formatBytes(0), "0 B");
eq("1536", lib.formatBytes(1536), "1.5 KB");
eq("negative", lib.formatBytes(-5), "0 B");

// ---------------------------------------------------------------------------
console.log("\nno customer surface, no application claim");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const importers = walk(join(ROOT, "src"))
  .filter((p) => /traffic-flow\.service/.test(readFileSync(p, "utf8")))
  .map((p) => relative(ROOT, p))
  .filter((p) => p !== "src/services/traffic-flow.service.ts");
eq("only the Master route imports the service", importers, ["src/routes/master.traffic-flow.tsx"]);
const shell = readFileSync(join(ROOT, "src/components/master/MasterShell.tsx"), "utf8");
check("nav item is cap-gated", /to: "\/master\/traffic-flow",[^}]*cap: "traffic-flow"/.test(shell));
check(
  "cap maps to the backend's GLOBAL-only read key",
  /"traffic-flow": \["traffic_flows\.read"\]/.test(shell),
);
check(
  "apply cap maps to the update key",
  /"traffic-flow\.apply": \["traffic_flows\.update"\]/.test(shell),
);
const page = readFileSync(join(ROOT, "src/routes/master.traffic-flow.tsx"), "utf8");
check("page states there is no DPI", /no DPI/.test(page));
check("page renders no Application column", !/<MTh>\s*App/i.test(page));
check("real writes ask for confirmation", /window\.confirm\(/.test(page));
check("dry run is offered", /run\(true, true\)/.test(page));

console.log(
  failures === 0
    ? `\nall traffic flow checks passed\n`
    : `\n${failures} traffic flow check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
