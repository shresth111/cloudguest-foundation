/**
 * NetLogs -> "Connections (IPDR)": the pure helpers and the page's wiring.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. COLUMNS IN THE WRONG ORDER. The table shows the backend's 18 IPDR
 *      columns, exactly and in order (cloud-guest#423 IPDR_COLUMNS).
 *   2. A PERMISSION THAT FAILS OPEN. The tab and the export appear only when
 *      the grant list has arrived and names `ipdr.read` / `ipdr.export`, and
 *      both keys exist in the backend's seeded set.
 *   3. PII IN THE URL. Phone / user id / MAC / IP searches never reach the
 *      route's search params.
 *   4. A RAW BACKEND MESSAGE ON AN ERROR CODE.
 *   5. A CORRECT HELPER WIRED TO NOTHING. The tab, the route param, the
 *      service paths and the export button label are checked in the sources.
 *
 * Run: node scripts/test-ipdr.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let passed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);

const outdir = mkdtempSync(join(tmpdir(), "ipdr-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/ipdr.ts")}";
   export { BACKEND_PERMISSION_KEYS } from "${p("src/lib/backendPermissionKeys.generated.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": p("src") },
});
const m = await import(`file://${outfile}`);
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
console.log("\ncolumns");
const BACKEND_ORDER = [
  "Time Stamp (IST)",
  "Name of Person/Organization",
  "Contact No.",
  "Alternate Contact No.",
  "E-mail Address",
  "User ID for Internet Access",
  "Source IP Address",
  "Source Port",
  "Translated IP Address",
  "Translated Port",
  "Static/Dynamic IP Address Allocation",
  "Destination IP Address",
  "Destination Port",
  "Protocol",
  "IST Start Time & Date of IP Allocation",
  "IST End Time & Date of IP Allocation",
  "Total Online Time",
  "Source MAC Address/IMEI/Device ID",
];
eq(
  "the table shows the 18 IPDR columns in the backend's order",
  m.IPDR_TABLE_COLUMNS.map((c) => c.label),
  BACKEND_ORDER,
);
check("no Address column", !m.IPDR_TABLE_COLUMNS.some((c) => c.label === "Address"));
eq(
  "column keys are unique",
  new Set(m.IPDR_TABLE_COLUMNS.map((c) => c.key)).size,
  m.IPDR_TABLE_COLUMNS.length,
);

// ---------------------------------------------------------------------------
console.log("\npermissions");
check("read key is seeded by the backend", m.BACKEND_PERMISSION_KEYS.includes(m.IPDR_READ));
check("export key is seeded by the backend", m.BACKEND_PERMISSION_KEYS.includes(m.IPDR_EXPORT));
eq("keys", [m.IPDR_READ, m.IPDR_EXPORT], ["ipdr.read", "ipdr.export"]);
check("unknown grants (in flight) fail closed", !m.hasIpdrPermission(undefined, m.IPDR_READ));
check("an empty grant list fails closed", !m.hasIpdrPermission([], m.IPDR_READ));
check(
  "network_logs.read alone is not enough",
  !m.hasIpdrPermission(["network_logs.read"], m.IPDR_READ),
);
check("ipdr.read opens the tab", m.hasIpdrPermission(["ipdr.read"], m.IPDR_READ));
check("ipdr.read does not grant export", !m.hasIpdrPermission(["ipdr.read"], m.IPDR_EXPORT));

// ---------------------------------------------------------------------------
console.log("\nparams");
const win = { since: new Date("2026-10-17T00:00:00Z"), until: new Date("2026-10-18T00:00:00Z") };
eq("bare window", m.ipdrParams(win, null, "", m.EMPTY_IPDR_SEARCH), {
  since: "2026-10-17T00:00:00.000Z",
  until: "2026-10-18T00:00:00.000Z",
});
eq(
  "location, router and trimmed searches",
  m.ipdrParams(win, "loc-1", "rtr-1", {
    phone: " 9000000011 ",
    userId: "guest@example.com",
    mac: "02:00:00:00:00:11",
    ip: "192.0.2.5",
  }),
  {
    since: "2026-10-17T00:00:00.000Z",
    until: "2026-10-18T00:00:00.000Z",
    location_id: "loc-1",
    router_id: "rtr-1",
    phone: "9000000011",
    user_id: "guest@example.com",
    mac: "02:00:00:00:00:11",
    ip: "192.0.2.5",
  },
);
eq("cursor and page size", m.ipdrListParams({ since: "a" }, "c1"), {
  since: "a",
  limit: "100",
  cursor: "c1",
});
eq("first page has no cursor", m.ipdrListParams({ since: "a" }, null), {
  since: "a",
  limit: "100",
});

// ---------------------------------------------------------------------------
console.log("\nerrors and coverage");
for (const code of [
  "IPDR_RANGE_TOO_LONG",
  "IPDR_LOCATION_NOT_FOUND",
  "IPDR_ROUTER_NOT_FOUND",
  "IPDR_BAD_FILTER",
  "IPDR_BAD_CURSOR",
]) {
  const f = m.ipdrErrorMessage({ status: 422, data: { code } });
  check(`${code} has its own sentence`, !f.title.startsWith("Couldn't load"), f.title);
}
check(
  "403 names the owner/admin rule",
  /owner or an admin/.test(m.ipdrErrorMessage({ status: 403, data: null }).detail),
);
eq(
  "no gaps, no note",
  m.coverageNote([{ day: "d", status: "archived", records_incomplete: false, unreadable: 0 }]),
  null,
);
check(
  "missing and incomplete days are said",
  /1 day has no connection records.*1 day is incomplete/.test(
    m.coverageNote([
      { day: "a", status: "missing", records_incomplete: false, unreadable: 0 },
      { day: "b", status: "archived", records_incomplete: true, unreadable: 0 },
    ]) ?? "",
  ),
);
check(
  "derived translation is labelled derived",
  /Derived/.test(m.translatedSourceLabel("derived")),
);
check("unknown source reads not known", /Not known/.test(m.translatedSourceLabel(undefined)));

// ---------------------------------------------------------------------------
console.log("\nwiring");
const view = src("src/components/netlogs/NetLogsView.tsx");
const tab = src("src/components/netlogs/IpdrConnections.tsx");
const route = src("src/routes/netlogs.tsx");
const service = src("src/services/ipdr.service.ts");
check("NetLogs renders the IPDR tab", view.includes("<IpdrConnections"));
check("the tab is labelled", view.includes("Connections (IPDR)"));
check("the tab is gated on ipdr.read", /hasIpdrPermission\(permissions, IPDR_READ\)/.test(view));
check(
  "the export is gated on ipdr.export",
  /hasIpdrPermission\(permissions, IPDR_EXPORT\)/.test(view),
);
check("the route accepts view", /view: optional/.test(route));
check("the export button is labelled", tab.includes("IPDR Export (CERT-In format)"));
check("the export is only rendered with canExport", /\{canExport && \(/.test(tab));
check("list path", service.includes('"/ipdr/connections"'));
check("export path", service.includes('"/ipdr/export.csv"'));
check("no location header (ORGANIZATION-scoped)", !service.includes('X-Location-Id"'));
check("searches are not written to the URL", !/search:\s*\{[^}]*phone/.test(view + tab));
check(
  "no tunnel internals on this page",
  !/wireguard|tunnel address/i.test(tab.replace(/\/\*[\s\S]*?\*\//g, "")),
);

console.log(`\n${passed} passed, ${failures} failed`);
if (failures) process.exit(1);
console.log("all ipdr checks passed");
