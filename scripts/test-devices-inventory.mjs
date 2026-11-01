/**
 * The Devices page revamp: fleet model, inventory render (filter, sort),
 * Connected Devices masking, the Overview hardware card, and the demo gate.
 *
 * WHAT IS LOAD-BEARING
 *
 *   1. ONE STATUS VOCABULARY. Inventory buckets are read off
 *      `describeLiveness` (hardware) and the Overview topology's
 *      `routerStatus` (routers); "Not measured" never folds into "Unknown",
 *      and a controller row is never green.
 *   2. FILTER + SORT are what the strip and the toolbar promise: kind,
 *      status, floor, free text, and a MAC found with or without separators;
 *      faults sort first by default; a missing timestamp sorts last both ways.
 *   3. MASKING. With masking on, the raw guest MAC appears nowhere in the
 *      rendered table, and search/sort see only the masked text -- a search
 *      box that matched the raw MAC would confirm it a character at a time.
 *   4. NO FAKE DATA IN A REAL SESSION. The demo fixtures are reached only
 *      through an `isDemo()` branch, and a non-demo render with nothing to
 *      show shows nothing -- not the demo rows.
 *   5. THE OVERVIEW CARD lists faults first, says "All devices up" only when
 *      every device is up, and hands a status to the Devices page as
 *      `?status=`, which the page reads back to the same bucket.
 *
 * Renders the REAL components with react-dom/server (which never runs a
 * query function: every read is seeded into the cache or absent). The Radix Sheet is a
 * portal (renders ""), so the drawer is not rendered here; its words come
 * from the same row fields the table renders.
 *
 * Run: node scripts/test-devices-inventory.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, b) =>
  check(name, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const outdir = mkdtempSync(join(tmpdir(), "devices-inventory-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

const routerStub = join(outdir, "router-stub.mjs");
writeFileSync(
  routerStub,
  `export const navigations = [];
   export function useNavigate() { return (o) => navigations.push(o); }
   export function Link({ children }) { return children ?? null; }`,
);
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   export * as fm from "${p("src/components/customer/devices/fleet-model.ts")}";
   export { HardwareInventory } from "${p("src/components/customer/devices/HardwareInventory.tsx")}";
   export { ConnectedDevicesPanel } from "${p("src/components/customer/devices/ConnectedDevicesPanel.tsx")}";
   export { toConnectedRows, queryConnectedRows } from "${p("src/components/customer/devices/connected-rows.ts")}";
   export { DeviceStatusCardView } from "${p("src/components/customer/dashboard/DeviceStatusCard.tsx")}";
   export { withDemoHealth, demoRouterDevices } from "${p("src/components/customer/devices/demo-fixtures.ts")}";
   export { customerKeys } from "${p("src/hooks/useCustomerDashboard.ts")}";
   export { maskMac } from "${p("src/lib/masking.ts")}";
   export { navigations } from "${routerStub.replace(/\\/g, "/")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider };`,
);
const outfile = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: { "@tanstack/react-router": routerStub },
  loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json" },
  jsx: "automatic",
  define: { "import.meta.env": "{}" },
});
const m = createRequire(import.meta.url)(outfile);
const { fm, React, renderToStaticMarkup: html } = m;

const NOW = Date.now();
const ago = (min) => new Date(NOW - min * 60_000).toISOString();

function hw(over) {
  return {
    id: over.id,
    locationId: "loc",
    name: over.name ?? over.id,
    mac: over.mac ?? "AA:BB:CC:00:00:01",
    type: over.type ?? "Access Point",
    floor: over.floor ?? "",
    status: over.status ?? "up",
    lastSeenAt: over.lastSeenAt === undefined ? ago(5) : over.lastSeenAt,
    connectedAt: null,
    uptimeSeconds: over.uptimeSeconds ?? null,
    uptimeRecordedAt: null,
    statusSource: over.statusSource ?? "measured",
    statusReason: over.statusReason ?? "liveness_probe",
    observationIssue: over.observationIssue ?? null,
    health: over.health ?? null,
    duplicateLocations: [],
    registeredElsewhere: false,
  };
}
function health(state, reason, extra = {}) {
  return {
    state,
    reason,
    since: ago(30),
    checkedAt: ago(1),
    consecutiveFailures: state === "down" ? 2 : 0,
    lastOkAt: ago(31),
    lastRttMs: 2,
    probeMethod: "icmp",
    portName: "ether3",
    portRunning: state !== "down",
    portLastLinkDownAt: state === "down" ? ago(31) : null,
    portLastLinkUpAt: null,
    linkFlaps24h: 0,
    clientsBehind: 4,
    rxBps: null,
    txBps: null,
    events24h: [],
    ...extra,
  };
}
const ROUTERS = [
  {
    key: "r1",
    label: "Lobby router",
    state: "online",
    shortLabel: "Online",
    detail: "Checking in.",
    nextStep: null,
    lastContactIso: ago(1),
    lastContactKind: "heartbeat",
    rawStatus: "online",
    vendor: "MikroTik",
    status: "live",
  },
  {
    key: "r2",
    label: "Omada",
    state: "not-applicable",
    shortLabel: "Controller",
    detail: "Run by a controller.",
    nextStep: null,
    lastContactIso: null,
    lastContactKind: "unspecified",
    rawStatus: "online",
    vendor: "tp_link_omada",
    status: "unknown",
  },
];
const HW = [
  hw({
    id: "a",
    name: "AP Lobby",
    floor: "GF",
    mac: "3C:64:CF:CE:2D:38",
    health: health("up", "liveness_probe"),
    uptimeSeconds: 7200,
  }),
  hw({
    id: "b",
    name: "AP Roof",
    floor: "3F",
    mac: "B0:19:21:73:E2:CA",
    status: "down",
    lastSeenAt: null,
    health: health("down", "port_link_down"),
  }),
  hw({
    id: "c",
    name: "Printer",
    type: "Printer",
    floor: "",
    mac: "11:22:33:44:55:66",
    status: "unknown",
    observationIssue: "router_auth_failed",
    lastSeenAt: ago(90),
  }),
  hw({
    id: "d",
    name: "Camera",
    type: "Camera",
    floor: "GF",
    mac: "AB:CD:EF:01:23:45",
    status: "unknown",
    statusSource: "unmeasured",
    statusReason: "controller_managed",
  }),
  hw({
    id: "e",
    name: "AP New",
    floor: "3F",
    mac: "AB:CD:EF:01:23:99",
    status: "unknown",
    lastSeenAt: null,
  }),
];

console.log("\n1. one status vocabulary");
const rows = fm.buildInventory({ routers: ROUTERS, routerDevices: [], hardware: HW, now: NOW });
const by = Object.fromEntries(rows.map((r) => [r.key, r]));
eq("routers come first", rows[0].key, "rt:r1");
eq("an online router is ok", by["rt:r1"].bucket, "ok");
eq("a controller router row is not measured, never green", by["rt:r2"].bucket, "unmeasured");
eq("a healthy AP is ok", by["hw:a"].bucket, "ok");
eq("a port-link-down AP is crit", by["hw:b"].bucket, "crit");
check(
  "and its detail names the port",
  /port ether3 link down/.test(by["hw:b"].detail ?? ""),
  by["hw:b"].detail,
);
eq("an unreadable router makes a device warn, not down", by["hw:c"].bucket, "warn");
eq("an unmeasured device is its own bucket", by["hw:d"].bucket, "unmeasured");
eq("an unmeasured device carries the explanation", typeof by["hw:d"].explanation, "string");
eq("a never-observed device is unknown", by["hw:e"].bucket, "unknown");
eq("uptime is the real reading, not derived", by["hw:a"].uptimeSeconds, 7200);
eq("no uptime is null, not last-seen", by["hw:c"].uptimeSeconds, null);
const counts = fm.countByKind(rows);
eq(
  "router counts",
  JSON.stringify(counts.router),
  JSON.stringify({ ok: 1, warn: 0, crit: 0, unknown: 0, unmeasured: 1 }),
);
eq(
  "AP counts",
  JSON.stringify(counts.ap),
  JSON.stringify({ ok: 1, warn: 0, crit: 1, unknown: 1, unmeasured: 0 }),
);
eq(
  "other counts",
  JSON.stringify(counts.other),
  JSON.stringify({ ok: 0, warn: 1, crit: 0, unknown: 0, unmeasured: 1 }),
);

console.log("\n2. filter and sort");
const F = fm.NO_FILTER;
const keys = (rs) => rs.map((r) => r.key).join(",");
eq("kind filter", keys(fm.filterInventory(rows, { ...F, kind: "ap" })), "hw:a,hw:b,hw:e");
eq("status filter", keys(fm.filterInventory(rows, { ...F, bucket: "crit" })), "hw:b");
eq("floor filter", keys(fm.filterInventory(rows, { ...F, floor: "3F" })), "hw:b,hw:e");
eq("no-floor filter", keys(fm.filterInventory(rows, { ...F, kind: "other", floor: "" })), "hw:c");
eq("text search", keys(fm.filterInventory(rows, { ...F, query: "roof" })), "hw:b");
eq(
  "MAC search without separators",
  keys(fm.filterInventory(rows, { ...F, query: "b01921" })),
  "hw:b",
);
eq("MAC search with dashes", keys(fm.filterInventory(rows, { ...F, query: "3c-64-cf" })), "hw:a");
const s1 = fm.sortInventory(rows, fm.DEFAULT_SORT);
eq("default sort: faults first", s1[0].key, "hw:b");
eq("then degraded", s1[1].key, "hw:c");
eq("up last", s1.at(-1).bucket, "ok");
const ls = fm.sortInventory(rows, { key: "lastSeen", dir: 1 });
check("last seen: missing timestamps sort last (asc)", ls.at(-1).lastSeenAt === null);
const lsd = fm.sortInventory(rows, { key: "lastSeen", dir: -1 });
check("last seen: missing timestamps sort last (desc)", lsd.at(-1).lastSeenAt === null);
eq("name sort", fm.sortInventory(rows, { key: "name", dir: 1 })[0].name, "AP Lobby");
eq("?status=down reads back as crit", fm.bucketFromSearch("?status=down"), "crit");
eq(
  '?status="degraded" (JSON-quoted) reads back',
  fm.bucketFromSearch("?status=%22degraded%22"),
  "warn",
);
eq("an unknown value is no filter", fm.bucketFromSearch("?status=whatever"), null);
for (const b of fm.BUCKET_ORDER)
  eq(`round trip ${b}`, fm.bucketFromSearch(`?status=${fm.BUCKET_TO_PARAM[b]}`), b);

console.log("\n3. the inventory renders what the filter and sort say");
const render = (el) => html(el);
const inv = (filter) =>
  render(
    React.createElement(m.HardwareInventory, {
      rows,
      filter,
      onFilter: () => {},
      onOpen: () => {},
      now: NOW,
    }),
  );
const all = inv(F);
const tableRows = (s) => (s.match(/<tr[^>]*data-wy="hw-row"/g) || []).length;
eq("every row is in the table", tableRows(all), rows.length);
check(
  "MACs render in mono",
  /font-\[family-name:var\(--wy-font-mono\)\][^>]*>3C:64:CF:CE:2D:38/.test(all),
);
check("the down row's reason is in the markup", all.includes("port ether3 link down"));
const firstRowName = (s) =>
  (s.match(/data-wy="hw-row"[\s\S]*?<span class="truncate">([^<]+)<\/span>/) || [])[1];
eq("first rendered row is the fault", firstRowName(all), "AP Roof");
const crit = inv({ ...F, bucket: "crit" });
eq("filtered to down: one row", tableRows(crit), 1);
check("and a clear-filters control", crit.includes("Clear filters"));
const none = inv({ ...F, query: "zzzz" });
check("no match says so", none.includes("Nothing matches these filters."));
check("sortable headers carry aria-sort", (all.match(/aria-sort=/g) || []).length >= 7);
check("floor layout toggle offered when floors exist", all.includes("By floor"));

console.log("\n4. connected devices: masking");
const RAW = [
  { m: "DE:AD:BE:EF:00:01", i: "10.0.0.20", d: "Pixel 8", fs: "Today", ls: "Just now" },
  { m: "00:11:22:33:44:55", i: "10.0.0.3", d: "iPhone", fs: "Yesterday", ls: "5 min ago" },
];
const masked = m.toConnectedRows(RAW, true);
// `maskMac` is a deliberate passthrough today (product decision: owners need
// the real MAC for support; mirrors the backend's `mask_mac`). What is
// asserted is the routing: a masked panel shows exactly maskMac(raw), and
// search/sort read only that displayed string -- so if masking is ever
// turned on again, nothing here can leak the raw value.
check(
  "masked rows show exactly maskMac(raw)",
  masked.every((r, i) => r.mac === m.maskMac(RAW[i].m)),
);
check(
  "display rows carry no other copy of the MAC",
  masked.every((r) => Object.keys(r).sort().join(",") === "device,firstSeen,idx,ip,lastSeen,mac"),
);
eq("unmasked rows carry the MAC as-is", m.toConnectedRows(RAW, false)[0].mac, RAW[0].m);
{
  // Search runs over display rows only: a row whose shown MAC is "•••" is
  // not found by the hidden digits.
  const hidden = [{ ...masked[0], mac: "DE:AD:••:••:••:01" }];
  eq(
    "search cannot find a row by MAC digits it does not show",
    m.queryConnectedRows(hidden, "BE:EF", { key: "mac", dir: 1 }).length,
    0,
  );
}
eq(
  "search by IP still works",
  m.queryConnectedRows(masked, "10.0.0.3", { key: "ip", dir: 1 }).length,
  1,
);
eq("IP sort is numeric", m.queryConnectedRows(masked, "", { key: "ip", dir: 1 })[0].ip, "10.0.0.3");
eq(
  "seen columns keep the API's order",
  m.queryConnectedRows(masked, "", { key: "lastSeen", dir: 1 })[0].device,
  "Pixel 8",
);

const qc = new m.QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
qc.setQueryData(m.customerKeys.features("devices", "loc"), {
  devices: RAW.map((r) => ({ mac: r.m, ip: r.i, device: r.d, firstSeen: r.fs, lastSeen: r.ls })),
});
const panel = (loc, isMasked) =>
  render(
    React.createElement(
      m.QueryClientProvider,
      { client: qc },
      React.createElement(m.ConnectedDevicesPanel, { locationId: loc, masked: isMasked }),
    ),
  );
const maskedHtml = panel("loc", true);
check(
  "rendered masked: the MAC shown is maskMac's",
  RAW.every((r) => maskedHtml.includes(m.maskMac(r.m))),
);
const openHtml = panel("loc", false);
check("rendered unmasked: MAC shown", openHtml.includes(RAW[0].m));

console.log("\n5. no demo rows in a real session");
qc.setQueryData(m.customerKeys.features("devices", "empty"), { devices: [] });
const emptyHtml = panel("empty", false);
check("empty real read shows the empty state", emptyHtml.includes("No connected devices yet"));
check("and none of the demo devices", !/iPhone 15|MacBook Pro|00:1A:2B:3C:4D:5E/.test(emptyHtml));
qc.setQueryData(m.customerKeys.features("devices", "bad"), { devices: "nope" });
check(
  "a wrong-shaped body is 'nothing read', not a crash",
  panel("bad", false).includes("No connected devices yet"),
);

const hook = readFileSync(join(ROOT, "src/hooks/useMonitoredHardware.ts"), "utf8");
const dh = readFileSync(join(ROOT, "src/hooks/useDeviceHealth.ts"), "utf8");
check(
  "withDemoHealth only on the demo branch",
  /demo\s*\?\s*withDemoHealth\(/.test(hook) &&
    /const devices: MonitoredDeviceRow\[\] = demo \? demoRows : realDevices;/.test(hook),
);
check(
  "demo routers only inside if (isDemo())",
  /if \(isDemo\(\)\) \{[\s\S]{0,200}demoRouterDevices\(/.test(dh) &&
    (dh.match(/demoRouterDevices\(/g) || []).length === 1,
);
check(
  "history skips the org lookup only on the demo host",
  /if \(isDemo\(\)\) return deviceHealthService\.history\(/.test(dh),
);
// Nothing else may import the fixtures.
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(full);
  }
  return out;
}
const importers = walk(join(ROOT, "src"))
  .filter((f) => /devices\/demo-fixtures/.test(readFileSync(f, "utf8")))
  .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
  .sort();
eq(
  "only the two hooks import the demo fixtures",
  importers.join(","),
  "src/hooks/useDeviceHealth.ts,src/hooks/useMonitoredHardware.ts",
);
const demoRows = m.withDemoHealth([HW[0], { ...HW[1], health: null }], NOW);
check(
  "demo health agrees with demo status",
  demoRows.every((r) => (r.status === "down") === (r.health.state === "down")),
);

// The demo routers carry the demo world's models (src/lib/demo-world.ts),
// so Devices names the same hardware as Internet Connection and Security --
// the PM review found "hAP" here and "RB5009" there for the same venue.
const worldRouters = m.demoRouterDevices("loc-1", [
  { key: "r-1", label: "Lobby router", state: "online", lastContactIso: null },
  { key: "r-1-floor2", label: "Floor 2 router", state: "online", lastContactIso: null },
]);
eq(
  "demo router models come from the demo world",
  worldRouters.map((r) => `${r.name}:${r.model}`).join("|"),
  "Lobby router:RB5009UG+S+|Floor 2 router:hAP ax³",
);
// The world's down / unstable devices read that way, not from a MAC hash.
const worldHw = m.withDemoHealth(
  [
    { ...HW[0], mac: "B0:19:21:75:11:3C", status: "up", health: null },
    { ...HW[0], mac: "3C:64:CF:CE:2D:38", status: "up", health: null },
  ],
  NOW,
);
check(
  "a device the demo world says is down reads down; unstable reads degraded",
  worldHw[0].health.state === "down" &&
    worldHw[0].status === "down" &&
    worldHw[1].health.state === "degraded",
);

console.log("\n6. the Overview card");
const card = (devices) =>
  render(React.createElement(m.DeviceStatusCardView, { devices, onManage: () => {} }));
const cardHtml = card(HW);
const cardFirst = (cardHtml.match(
  /aria-label="Devices, problems first"[\s\S]*?<span class="truncate text-\[13px\] font-medium">([^<]+)</,
) || [])[1];
eq("the card lists the fault first", cardFirst, "AP Roof");
check("with its reason", cardHtml.includes("port ether3 link down"));
check("does not claim all up", !cardHtml.includes("All devices up"));
check("down count wins the verdict line", /1 down/.test(cardHtml));
const allUp = card([HW[0]]);
check("all up only when every device is up", allUp.includes("All devices up"));
check("a never-observed device is not 'all up'", !card([HW[0], HW[4]]).includes("All devices up"));
{
  const flapping = hw({
    id: "f",
    name: "AP Flap",
    status: "up",
    health: health("degraded", "link_flapping", { linkFlaps24h: 3 }),
  });
  const html2 = card([HW[0], flapping]);
  check(
    "a degraded device (status up) is not 'all up'",
    !html2.includes("All devices up") && html2.includes("1 degraded"),
  );
}
check("the card links to the page", cardHtml.includes("View all →"));
check(
  "status strip buttons for online/degraded/down/unknown",
  ["Online", "Degraded", "Down", "Unknown"].every((w) => cardHtml.includes(`>${w}<`)),
);
check(
  "not-measured shown only when present",
  cardHtml.includes(">Not measured<") && !allUp.includes(">Not measured<"),
);
check("an empty fleet shows the empty state", card([]).includes("No hardware set up yet"));

console.log(
  failures === 0
    ? "\nall devices inventory checks passed"
    : `\n${failures} devices inventory check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
