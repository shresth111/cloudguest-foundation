/**
 * NetLogs, Connections (IPDR) and Traffic Lens in the DEMO workspace.
 *
 * The real services are bundled and called with the demo session the way
 * demo.wyfyguest.com has it (sentinel token in localStorage, demo hostname).
 * Every XMLHttpRequest / fetch is recorded.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. A DEMO CALL THAT REACHES THE BACKEND. Every list, summary, export,
 *      status, summary, geo, findings and records call answers with zero
 *      network requests.
 *   2. FIXTURES ON A REAL HOST. Off the demo host the same calls go to the
 *      network: the fixtures are behind the host check, not always on.
 *   3. FILTERS THAT DO NOTHING. Category, severity, status, search, location,
 *      router, "Load more", guests-only and the IPDR searches all narrow.
 *   4. A SUMMARY THAT DISAGREES WITH THE LIST, or rows that change between
 *      renders (the fixtures are seeded, not random).
 *   5. PII OR TUNNEL DETAIL. Masked phones in the table, full fake phones
 *      only in the CSV; no 10.20.x address and no WireGuard/tunnel word.
 *
 * Run: node scripts/test-netlogs-demo.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
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

// --- a browser-shaped global, before the bundle loads ----------------------
const requests = [];
const store = new Map([["cloudguest_token", "demo-access-token"]]);
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const location = {
  hostname: "demo.wyfyguest.com",
  href: "https://demo.wyfyguest.com/netlogs",
  pathname: "/netlogs",
  origin: "https://demo.wyfyguest.com",
  search: "",
};
class RecordingXHR {
  constructor() {
    this.readyState = 0;
    this.headers = {};
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  getAllResponseHeaders() {
    return "";
  }
  send() {
    requests.push(`${this.method} ${this.url}`);
    setTimeout(() => this.onerror?.(new Error("network disabled in test")), 0);
  }
  abort() {}
  addEventListener() {}
  removeEventListener() {}
}
globalThis.window = globalThis;
globalThis.localStorage = localStorage;
globalThis.sessionStorage = localStorage;
globalThis.location = location;
globalThis.document = { cookie: "", createElement: () => ({}) };
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node" },
  configurable: true,
});
globalThis.XMLHttpRequest = RecordingXHR;
globalThis.fetch = async (url) => {
  requests.push(`fetch ${url}`);
  throw new Error("network disabled in test");
};

const outdir = mkdtempSync(join(tmpdir(), "netlogs-demo-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.ts");
writeFileSync(
  entry,
  `export { netLogsService } from "${p("src/services/netlogs.service.ts")}";
   export { ipdrService } from "${p("src/services/ipdr.service.ts")}";
   export { trafficLensService } from "${p("src/services/traffic-lens.service.ts")}";
   export { trafficLensDestinationsService } from "${p("src/services/traffic-lens-destinations.service.ts")}";
   export { IPDR_TABLE_COLUMNS } from "${p("src/lib/ipdr.ts")}";
   export * as demo from "${p("src/lib/netlogs-demo.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile,
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: { "@": p("src") },
  define: {
    // Not opted in by build flag: the demo is on because of the hostname.
    "import.meta.env": JSON.stringify({
      MODE: "test",
      DEV: false,
      PROD: true,
      VITE_API_BASE_URL: "/api/v1",
    }),
    "process.env.NODE_ENV": '"production"',
  },
});
const m = await import(`file://${outfile}`);
const { netLogsService, ipdrService, trafficLensService, trafficLensDestinationsService } = m;

const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const DAY = 86_400_000;
const w24 = { since: iso(NOW - DAY), until: iso(NOW) };
const w7 = { since: iso(NOW - 7 * DAY), until: iso(NOW) };
const blobText = async (b) => (typeof b.text === "function" ? b.text() : String(b));

// ---------------------------------------------------------------------------
console.log("\nNetLogs: list");
const day = await netLogsService.list({ ...w24, limit: "100" }, null);
check(
  "feature on, rows in the last 24h",
  day.feature_enabled && day.items.length >= 50 && day.items.length <= 70,
  String(day.items.length),
);
check(
  "newest first",
  day.items.every((e, i, a) => i === 0 || a[i - 1].received_at >= e.received_at),
);
const again = await netLogsService.list({ ...w24, limit: "100" }, null);
check(
  "stable: the same rows on a second call",
  JSON.stringify(again.items) === JSON.stringify(day.items),
);
const cats = new Set(day.items.map((e) => e.category));
for (const c of ["dhcp", "hotspot_auth", "radius", "firewall", "wireless", "system"])
  check(`category ${c} present`, cats.has(c));
check("two locations", new Set(day.items.map((e) => e.location_name)).size === 2);
check("three routers", new Set(day.items.map((e) => e.router_id)).size === 3);
check(
  "Invalid OTP and Traffic denied lines exist",
  day.items.some((e) => e.summary === "Invalid OTP") &&
    day.items.some((e) => e.summary === "Traffic denied" && e.protocol === "tcp"),
);
check(
  "severities and statuses match: a blocked line is not info",
  day.items.filter((e) => e.status === "blocked").every((e) => e.severity <= 5),
);

const p1 = await netLogsService.list({ ...w7, limit: "100" }, null);
check("7 days has a next page", p1.items.length === 100 && p1.next_cursor !== null);
const p2 = await netLogsService.list({ ...w7, limit: "100", cursor: p1.next_cursor }, null);
const ids = new Set(p1.items.map((e) => e.id));
check(
  "Load more continues with no overlap",
  p2.items.length > 0 && p2.items.every((e) => !ids.has(e.id)),
);
check("Load more ends", p2.next_cursor === null);

const only = async (params, pred, name) => {
  const r = await netLogsService.list({ ...w7, limit: "500", ...params }, null);
  check(name, r.items.length > 0 && r.items.every(pred), String(r.items.length));
  return r.items.length;
};
await only({ category: "firewall" }, (e) => e.category === "firewall", "category filter");
await only(
  { severity: "error,warning" },
  (e) => e.severity === 3 || e.severity === 4,
  "severity filter",
);
await only({ status: "blocked" }, (e) => e.status === "blocked", "status filter");
await only({ q: "invalid otp" }, (e) => /invalid otp/i.test(e.message), "search");
await only({ location_id: "loc-1-cafe" }, (e) => e.location_id === "loc-1-cafe", "location filter");
await only({ router_id: "r-1-floor2" }, (e) => e.router_id === "r-1-floor2", "router filter");

console.log("\nNetLogs: summary agrees with the list");
const all7 = (await netLogsService.list({ ...w7, limit: "1000" }, null)).items;
const sum = await netLogsService.summary({ ...w7, tz: "Asia/Kolkata" }, null);
check(
  "totals.events = rows",
  sum.totals.events === all7.length,
  `${sum.totals.events} vs ${all7.length}`,
);
check(
  "errors = severity 0-3",
  sum.totals.errors === all7.filter((e) => e.severity <= 3).length && sum.totals.errors > 0,
);
check(
  "warnings = severity 4",
  sum.totals.warnings === all7.filter((e) => e.severity === 4).length && sum.totals.warnings > 0,
);
check(
  "by_day spans 7 or 8 local days, ascending",
  sum.by_day.length >= 7 &&
    sum.by_day.length <= 8 &&
    sum.by_day.every((d, i, a) => i === 0 || a[i - 1].day < d.day),
);
check("by_day adds up", sum.by_day.reduce((a, d) => a + d.total, 0) === sum.totals.events);
check(
  "by_category adds up",
  Object.values(sum.by_category).reduce((a, b) => a + b, 0) === sum.totals.events,
);
check(
  "by_severity adds up",
  Object.values(sum.by_severity).reduce((a, b) => a + b, 0) === sum.totals.events,
);
check(
  "top_routers: 3, busiest first, adds up",
  sum.top_routers.length === 3 &&
    sum.top_routers[0].total >= sum.top_routers[2].total &&
    sum.top_routers.reduce((a, r) => a + r.total, 0) === sum.totals.events,
);
const fwSum = await netLogsService.summary({ ...w7, category: "firewall" }, null);
check(
  "the summary takes the same filters",
  fwSum.totals.events === all7.filter((e) => e.category === "firewall").length,
);

console.log("\nNetLogs: export");
const nlCsv = await netLogsService.exportCsv({ ...w24 }, null);
const nlText = await blobText(nlCsv.blob);
check(
  "CSV with the backend's columns",
  nlText.startsWith("received_at,device_time,location,router,host,category,"),
);
check("one CSV line per row", nlText.trim().split(/\r\n/).length === day.items.length + 1);
check("a .csv filename", /^netlogs-demo-\d{8}\.csv$/.test(nlCsv.filename));

// ---------------------------------------------------------------------------
console.log("\nIPDR");
const guests = await ipdrService.list({ ...w24, guests_only: "true", limit: "100" });
const everyone = await ipdrService.list({ ...w24, limit: "100" });
check(
  "about 50 rows",
  everyone.items.length >= 40 && everyone.items.length <= 60,
  String(everyone.items.length),
);
check(
  "Guests only shows fewer than All devices",
  guests.items.length < everyone.items.length &&
    guests.items.every((r) => r.user_class === "guest"),
);
check(
  "device rows exist",
  everyone.items.some((r) => r.user_class === "device" && r.user_id === "device" && r.device_kind),
);
check(
  "18 columns on every row",
  everyone.items.every((r) => m.IPDR_TABLE_COLUMNS.every((c) => typeof r[c.key] === "string")),
);
const srcs = new Set(everyone.items.map((r) => r.translated_source));
check(
  "nat_event, derived and ambiguous all present",
  srcs.has("nat_event") && srcs.has("derived") && srcs.has("ambiguous"),
);
check(
  "translated IP is the router's public address",
  everyone.items.every(
    (r) => r.translated_ip === "203.0.113.10" || r.translated_ip === "203.0.113.20",
  ),
);
check(
  "derived rows keep the same port",
  everyone.items
    .filter((r) => r.translated_source === "derived" && r.source_port)
    .every((r) => r.translated_port === r.source_port),
);
check(
  "phones masked as 98xxxxxx21",
  guests.items.every((r) => /^98x{6}\d{2}$/.test(r.contact_no) && /^98x{6}\d{2}$/.test(r.user_id)),
);
check(
  "e-mail masked",
  guests.items.every((r) => /^[a-z]\*\*\*@example\.com$/.test(r.email)),
);
check(
  "IST minute timestamps",
  everyone.items.every((r) => /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/.test(r.time_stamp_ist)),
);
check(
  "guest rows carry session start/end and online time",
  guests.items.every(
    (r) => r.allocation_start_ist && r.allocation_end_ist && /\d+[hms]/.test(r.total_online_time),
  ),
);
check(
  "no gap notice",
  everyone.coverage.every((d) => d.status === "live" && !d.records_incomplete),
);
const one = guests.items[0];
const full = (await ipdrService.list({ ...w24, phone: `98000001${one.contact_no.slice(-2)}` }))
  .items;
check(
  "phone search narrows",
  full.length > 0 && full.every((r) => r.contact_no === one.contact_no),
);
const byMac = (await ipdrService.list({ ...w24, mac: one.mac.toLowerCase() })).items;
check("MAC search narrows (any case)", byMac.length > 0 && byMac.every((r) => r.mac === one.mac));
const byIp = (await ipdrService.list({ ...w24, ip: "8.8.8.8" })).items;
check(
  "IP search narrows",
  byIp.every((r) => [r.source_ip, r.translated_ip, r.destination_ip].includes("8.8.8.8")),
);
const cafe = (await ipdrService.list({ ...w24, location_id: "loc-1-cafe" })).items;
check("location narrows", cafe.length > 0 && cafe.every((r) => r.location_id === "loc-1-cafe"));
const ipdrCsv = await ipdrService.exportCsv({ ...w24 });
const ipdrText = await blobText(ipdrCsv.blob);
const lines = ipdrText.trim().split(/\r\n/);
check(
  "CSV header is the 18 CERT-In columns",
  lines[0] ===
    m.IPDR_TABLE_COLUMNS.map((c) => (/[",]/.test(c.label) ? `"${c.label}"` : c.label)).join(","),
);
check("CSV rows = every row (not just guests)", lines.length === everyone.items.length + 1);
check(
  "CSV carries the full fake phones",
  /,98000001\d{2},/.test(ipdrText) && !/98x{6}/.test(ipdrText),
);

// ---------------------------------------------------------------------------
console.log("\nTraffic Lens");
const status = await trafficLensService.status("loc-1");
check("collecting, with latest data", status.collection === "collecting" && !!status.latest_data);
const s7 = await trafficLensService.summary("loc-1", { ...w7, limit: "10", series: "4" });
check(
  "7 days measured",
  s7.measured && s7.windows > 1900 && s7.totals.bytes_down > s7.totals.bytes_up,
);
check(
  "services are port labels, no app names",
  s7.services.items.length >= 5 &&
    s7.services.items.every(
      (s) =>
        !/youtube|instagram|whatsapp|netflix|google|icloud|windows/i.test(String(s.service_name)),
    ),
);
check(
  "timeline has steps and 4 series",
  s7.timeline.steps.length > 40 && s7.timeline.series.length === 4,
);
check("one device used about 40%", s7.devices.items[0].share_at_least >= 0.4);
check(
  "devices are guest addresses",
  s7.devices.items.every((d) => /^10\.5\.(50|60)\./.test(d.ip)),
);
const s1 = await trafficLensService.summary("loc-1", {
  since: iso(NOW - 3_600_000),
  until: iso(NOW),
  limit: "10",
  series: "4",
});
check(
  "1 hour: 5-minute steps",
  s1.measured && s1.step_seconds === 300 && s1.timeline.steps.length >= 10,
);
const geo = await trafficLensService.geo("loc-1", { ...w7, limit: "10", networks: "5" });
check(
  "countries with networks",
  geo.geo_measured &&
    geo.countries.items.length >= 4 &&
    geo.countries.items[0].networks.items.length > 0 &&
    !!geo.attribution,
);
const findings = await trafficLensService.findings("loc-1", w7);
const dom = findings.findings.find((f) => f.id === "dominant_device");
check("dominant device flagged", dom?.state === "flagged" && dom.parts.share_at_least >= 0.4);
check(
  "a quiet-hours finding is flagged in 7 days",
  findings.findings.some((f) => f.id === "quiet_hours_traffic" && f.state === "flagged"),
);
check(
  "counts agree",
  findings.counts.flagged + findings.counts.clear + findings.counts.could_not_check ===
    findings.findings.length,
);
const recs = await trafficLensDestinationsService.search("loc-1", {
  location_id: "loc-1",
  ...w24,
  sort: "bytes",
  order: "desc",
});
check(
  "records: rows, sorted by bytes",
  recs.measured &&
    recs.rows.length > 20 &&
    recs.rows.every((r, i, a) => i === 0 || a[i - 1].bytes >= r.bytes),
);
const recs443 = await trafficLensDestinationsService.search("loc-1", {
  location_id: "loc-1",
  ...w24,
  sort: "time",
  order: "desc",
  port: "443",
  protocol: "6",
});
check(
  "records: port/protocol filter",
  recs443.rows.length > 0 && recs443.rows.every((r) => r.port === 443 && r.protocol === 6),
);
const recsPrefix = await trafficLensDestinationsService.search("loc-1", {
  location_id: "loc-1",
  ...w24,
  sort: "time",
  order: "desc",
  address: "203.0.113.0/24",
});
check(
  "records: address prefix filter",
  recsPrefix.rows.length > 0 && recsPrefix.rows.every((r) => r.address.startsWith("203.0.113.")),
);
const svc = await trafficLensDestinationsService.serviceDestinations("loc-1", {
  location_id: "loc-1",
  ...w24,
  protocol: "6",
  port: "443",
  limit: "10",
});
check("service drill-down lists destinations", svc.service?.port === 443 && svc.items.length > 0);
const recCsv = await trafficLensDestinationsService.exportCsv("loc-1", {
  location_id: "loc-1",
  ...w24,
  sort: "time",
  order: "desc",
});
check(
  "records export",
  recCsv.rows === recs.total && /^window_start,/.test(await blobText(recCsv.blob)),
);

// ---------------------------------------------------------------------------
console.log("\nnothing leaves the browser, nothing leaks");
check("zero network requests in demo", requests.length === 0, requests.join(", "));
const everything =
  JSON.stringify([all7, everyone.items, s7, geo, findings, recs]) + nlText + ipdrText;
check("no 10.20.x address", !/\b10\.20\./.test(everything));
check("no WireGuard / tunnel wording", !/wireguard|\bwg\d*\b|tunnel/i.test(everything));
{
  const phones =
    (JSON.stringify([all7, everyone.items]) + nlText + ipdrText).match(/\b9\d{9}\b/g) ?? [];
  check(
    "only fake phones",
    phones.every((ph) => ph.startsWith("98000001")),
    [...new Set(phones.filter((ph) => !ph.startsWith("98000001")))].slice(0, 5).join(" "),
  );
}

console.log("\noff the demo host the fixtures are not served");
location.hostname = "app.wyfyguest.com";
const before = requests.length;
await netLogsService.list({ ...w24 }, null).catch(() => {});
await ipdrService.list({ ...w24 }).catch(() => {});
await trafficLensService.status("loc-1").catch(() => {});
check(
  "the same calls go to the network on app.wyfyguest.com",
  requests.length - before === 3,
  requests.slice(before).join(", "),
);

console.log(
  failures === 0
    ? `\nall ${passed} netlogs/traffic-lens demo checks passed\n`
    : `\n${failures} netlogs/traffic-lens demo check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
