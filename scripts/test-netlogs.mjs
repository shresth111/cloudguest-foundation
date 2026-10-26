/**
 * NetLogs (customer dashboard): the pure helpers and the page's wiring.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. A FILTER THAT DOES NOT SURVIVE A RELOAD. Every filter lives in the URL;
 *      filters -> search -> filters must round-trip, defaults must keep the
 *      bare URL bare, and a hand-edited URL must fall back instead of being
 *      sent and 422-ing (`NETLOGS_BAD_FILTER`).
 *   2. A STATUS IN THE WRONG COLOUR. success/accept/allowed/connected green,
 *      reject/failure/blocked red, everything else (and no status) neutral.
 *   3. AN UNKNOWN DRESSED AS A VALUE. No priority reads "Unknown", not
 *      "Info"; no status reads "—", not a guessed outcome.
 *   4. A WINDOW THAT MOVES OR OVERFLOWS. Presets are relative to a pinned
 *      `now`; a custom range covers whole local days, never runs past `now`,
 *      and is clamped to the backend's 730 days.
 *   5. A RAW BACKEND MESSAGE OR A WRONG SENTENCE ON AN ERROR CODE.
 *   6. TUNNEL INTERNALS ON THE CUSTOMER DASHBOARD. No WireGuard, tunnel
 *      address, tag or attribution anywhere in this page's code or copy.
 *   7. A CORRECT HELPER WIRED TO NOTHING. The nav row, its permission key,
 *      the route, the feature page and the service paths are checked against
 *      the real sources.
 *
 * Bundles the real module with esbuild and executes it (this repo has no
 * test runner -- see scripts/test-location-liveness.mjs).
 *
 * Run: node scripts/test-netlogs.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "netlogs-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/netlogs.ts")}";
   export { NAV_PERMISSION_KEYS, navItemAllowed } from "${p("src/lib/customerNavPermissions.ts")}";
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

// ---------------------------------------------------------------------------
console.log("\nfilters <-> URL");

const D = m.DEFAULT_NETLOGS_FILTERS;
eq("an empty URL is the default view", m.filtersFromSearch({}), D);
eq("undefined search is the default view", m.filtersFromSearch(undefined), D);
eq("the default view writes nothing to the URL", m.searchFromFilters(D), {});
check("default range is 24h", D.range === "24h");

const full = {
  ...D,
  range: "custom",
  from: "2026-09-01",
  to: "2026-09-30",
  location: "3f1c2a4e-1111-4222-8333-444455556666",
  router: "9a8b7c6d-1111-4222-8333-444455556666",
  severity: ["error", "warning"],
  category: ["dhcp", "firewall"],
  status: ["reject", "blocked"],
  q: "aa:bb:cc",
};
const fullSearch = m.searchFromFilters(full);
eq("a full filter set serialises to short keys", fullSearch, {
  range: "custom",
  from: "2026-09-01",
  to: "2026-09-30",
  loc: "3f1c2a4e-1111-4222-8333-444455556666",
  router: "9a8b7c6d-1111-4222-8333-444455556666",
  sev: "error,warning",
  cat: "dhcp,firewall",
  st: "reject,blocked",
  q: "aa:bb:cc",
});
eq("and reads back identically", m.filtersFromSearch(fullSearch), full);
for (const r of m.NETLOGS_PRESETS) {
  const f = { ...D, range: r };
  eq(`preset ${r} round-trips`, m.filtersFromSearch(m.searchFromFilters(f)), f);
}
eq(
  "presets are exactly 24h/7d/30d/90d/1y/2y",
  [...m.NETLOGS_PRESETS],
  ["24h", "7d", "30d", "90d", "1y", "2y"],
);
eq(
  "lists are lower-cased, de-duplicated and put in vocabulary order",
  m
    .filtersFromSearch({ sev: "WARNING,error,warning", cat: "firewall, dhcp" })
    .severity.concat(m.filtersFromSearch({ cat: "firewall, dhcp" }).category),
  ["error", "warning", "dhcp", "firewall"],
);
eq(
  "unknown list values are dropped, not sent",
  m.filtersFromSearch({ sev: "fatal,error", cat: "dns,bogus", st: "ok,accept" }),
  { ...D, severity: ["error"], category: ["dns"], status: ["accept"] },
);
eq("an unknown range falls back to 24h", m.filtersFromSearch({ range: "5y" }).range, "24h");
eq(
  "a custom range missing an end falls back to the default",
  m.filtersFromSearch({ range: "custom", from: "2026-09-01" }),
  D,
);
eq(
  "an impossible date is not a date",
  m.filtersFromSearch({ range: "custom", from: "2026-02-30", to: "2026-03-01" }).range,
  "24h",
);
eq(
  "a reversed custom range is put the right way round",
  [
    m.filtersFromSearch({ range: "custom", from: "2026-09-30", to: "2026-09-01" }).from,
    m.filtersFromSearch({ range: "custom", from: "2026-09-30", to: "2026-09-01" }).to,
  ],
  ["2026-09-01", "2026-09-30"],
);
eq(
  "from/to are ignored unless the range is custom",
  m.filtersFromSearch({ range: "7d", from: "2026-09-01", to: "2026-09-30" }),
  { ...D, range: "7d" },
);
eq("loc=all is kept", m.filtersFromSearch({ loc: "all" }).location, "all");
eq("a junk location is dropped", m.filtersFromSearch({ loc: "<script>" }).location, "");
eq("a junk router is dropped", m.filtersFromSearch({ router: "x" }).router, "");
eq(
  "q is trimmed and capped at 200",
  m.filtersFromSearch({ q: `  ${"a".repeat(300)}  ` }).q.length,
  200,
);
check("an empty q writes nothing", !("q" in m.searchFromFilters({ ...D, q: "   " })));
check("narrowing: none by default", !m.hasNarrowingFilters(D));
check("narrowing: the window alone does not count", !m.hasNarrowingFilters({ ...D, range: "1y" }));
check("narrowing: a status counts", m.hasNarrowingFilters({ ...D, status: ["reject"] }));

// ---------------------------------------------------------------------------
console.log("\nwhich venue a request is for");

const ACTIVE = "aaaaaaaa-1111-4222-8333-444455556666";
const OTHER = "bbbbbbbb-1111-4222-8333-444455556666";
eq(
  "nothing chosen follows the header venue",
  m.effectiveLocationId({ location: "" }, ACTIVE, true),
  ACTIVE,
);
eq("an explicit venue wins", m.effectiveLocationId({ location: OTHER }, ACTIVE, false), OTHER);
eq(
  "all venues, org-wide caller -> no location_id",
  m.effectiveLocationId({ location: "all" }, ACTIVE, true),
  null,
);
eq(
  "all venues, location-scoped caller -> stays on their venue",
  m.effectiveLocationId({ location: "all" }, ACTIVE, false),
  ACTIVE,
);

// ---------------------------------------------------------------------------
console.log("\nthe window and the params");

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const DAY = 86_400_000;
const presetMs = {
  "24h": DAY,
  "7d": 7 * DAY,
  "30d": 30 * DAY,
  "90d": 90 * DAY,
  "1y": 365 * DAY,
  "2y": 730 * DAY,
};
for (const [r, ms] of Object.entries(presetMs)) {
  const w = m.netLogsWindow({ range: r, from: "", to: "" }, NOW);
  check(
    `${r} is exactly ${ms / DAY} day(s) ending now`,
    w.until.getTime() === NOW && NOW - w.since.getTime() === ms && !w.clamped,
  );
}
{
  const w = m.netLogsWindow({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, NOW);
  check(
    "custom starts at local midnight of its first day",
    w.since.getTime() === new Date(2026, 8, 1).getTime(),
  );
  check(
    "custom ends at the end of its last day",
    w.until.getTime() === new Date(2026, 9, 1).getTime(),
  );
}
{
  const w = m.netLogsWindow({ range: "custom", from: "2026-10-18", to: "2026-10-18" }, NOW);
  check("a custom range never runs past now", w.until.getTime() <= NOW);
}
{
  const w = m.netLogsWindow({ range: "custom", from: "2020-01-01", to: "2026-10-01" }, NOW);
  check(
    "a custom range over 730 days is clamped and says so",
    w.clamped && w.until - w.since === 730 * DAY,
  );
}
{
  const f = { ...full, range: "7d", from: "", to: "" };
  const w = m.netLogsWindow(f, NOW);
  const params = m.netLogsParams(f, w, OTHER);
  eq("params carry every filter, comma-joined", params, {
    since: new Date(NOW - 7 * DAY).toISOString(),
    until: new Date(NOW).toISOString(),
    location_id: OTHER,
    router_id: full.router,
    severity: "error,warning",
    category: "dhcp,firewall",
    status: "reject,blocked",
    q: "aa:bb:cc",
  });
  check("there is never an organization_id param", !("organization_id" in params));
  eq("no location -> no location_id", "location_id" in m.netLogsParams(D, w, null), false);
  eq("list params add limit and cursor", m.netLogsListParams({ a: "1" }, "CUR"), {
    a: "1",
    limit: "100",
    cursor: "CUR",
  });
  eq("a first page sends no cursor", "cursor" in m.netLogsListParams({}, null), false);
  check("page size stays within the backend's 500", m.NETLOGS_PAGE_SIZE <= 500);
}

// ---------------------------------------------------------------------------
console.log("\nstatus and severity");

for (const s of ["success", "accept", "allowed", "connected"])
  eq(`${s} is green`, m.statusTone(s), "positive");
for (const s of ["reject", "failure", "blocked"]) eq(`${s} is red`, m.statusTone(s), "negative");
for (const s of ["disconnected", "released", null, undefined, "weird"])
  eq(`${s} is neutral`, m.statusTone(s), "neutral");
eq("status is case-insensitive", m.statusTone("ACCEPT"), "positive");
check(
  "green is green and red is red",
  /emerald/.test(m.STATUS_TONE_CLASS.positive) &&
    /red/.test(m.STATUS_TONE_CLASS.negative) &&
    !/emerald|red/.test(m.STATUS_TONE_CLASS.neutral),
);
eq("no status is a dash, not a guess", m.statusLabel(null), "—");
eq("status label", m.statusLabel("disconnected"), "Disconnected");
eq(
  "statuses mirror LogStatus",
  [...m.NETLOGS_STATUSES],
  [
    "success",
    "failure",
    "accept",
    "reject",
    "blocked",
    "allowed",
    "connected",
    "disconnected",
    "released",
  ],
);
eq(
  "categories mirror LogCategory",
  [...m.NETLOGS_CATEGORIES],
  ["dhcp", "hotspot_auth", "radius", "firewall", "dns", "system", "wireless", "other"],
);
eq(
  "severities mirror SEVERITY_NAMES",
  [...m.NETLOGS_SEVERITIES],
  ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"],
);
eq(
  "no priority is Unknown, not Info",
  m.severityLabel({ severity: null, severity_name: null }),
  "Unknown",
);
eq("severity name wins", m.severityLabel({ severity: 4, severity_name: "warning" }), "Warning");
eq("severity number alone", m.severityLabel({ severity: 3, severity_name: null }), "Error");
eq("0-3 is an error", [0, 1, 2, 3].map(m.severityTone), ["error", "error", "error", "error"]);
eq("4 is a warning", m.severityTone(4), "warning");
eq("5-7 and null stay quiet", [5, 6, 7, null].map(m.severityTone), [
  "quiet",
  "quiet",
  "quiet",
  "quiet",
]);
eq("category label", m.categoryLabel("hotspot_auth"), "Hotspot sign-in");
eq("unknown category is titled, not blank", m.categoryLabel("vpn_thing"), "Vpn thing");

// ---------------------------------------------------------------------------
console.log("\nrows");

eq(
  "Device/Host prefers the router's name",
  m.deviceHost({ router_name: "Lobby hEX", hostname: "MikroTik", location_name: "Mumbai HQ" }),
  { name: "Lobby hEX", location: "Mumbai HQ" },
);
eq(
  "and falls back to the hostname",
  m.deviceHost({ router_name: null, hostname: "MikroTik", location_name: null }),
  { name: "MikroTik", location: null },
);
eq(
  "and never renders blank",
  m.deviceHost({ router_name: " ", hostname: null, location_name: null }).name,
  "Unknown device",
);
eq(
  "Portal failures identify the portal, not an invented device",
  m.deviceHost({
    router_name: null,
    hostname: null,
    location_name: "Mumbai HQ",
    source: "captive_portal",
  }),
  { name: "WyfyGuest Portal", location: "Mumbai HQ" },
);
eq(
  "Portal failures are not labelled as router-hotspot events",
  m.eventCategoryLabel({ category: "hotspot_auth", source: "captive_portal", protocol: "PORTAL" }),
  "Portal sign-in",
);
eq(
  "Portal failure shows its exact reason without expanding",
  m.messageParts({
    summary: "Portal sign-in failed",
    message: "otp_sms sign-in failed: Invalid OTP",
    source: "captive_portal",
    status: "failure",
  }),
  {
    headline: "Portal sign-in failed — Invalid OTP",
    detail: "otp_sms sign-in failed: Invalid OTP",
  },
);
eq(
  "Message: summary first, full line on expand",
  m.messageParts({ summary: "IP assigned", message: "dhcp1 assigned 10.0.0.5 to AA:BB" }),
  { headline: "IP assigned", detail: "dhcp1 assigned 10.0.0.5 to AA:BB" },
);
eq(
  "Message: no summary shows the line itself",
  m.messageParts({ summary: null, message: "system,info router rebooted" }),
  { headline: "system,info router rebooted", detail: null },
);

// ---------------------------------------------------------------------------
console.log("\nerror codes -> sentences");

const err = (status, code, data = {}) => ({
  status,
  code: "x",
  message: "Device logging is switched off on this platform (CLOUDGUEST_DEVICE_LOGS_ENABLED).",
  data: code ? { code, ...data } : data,
});
eq(
  "location not found",
  m.netLogsErrorMessage(err(404, "NETLOGS_LOCATION_NOT_FOUND")).clear,
  "location",
);
eq("router not found", m.netLogsErrorMessage(err(404, "NETLOGS_ROUTER_NOT_FOUND")).clear, "router");
eq(
  "location forbidden",
  m.netLogsErrorMessage(err(403, "NETLOGS_LOCATION_FORBIDDEN")).clear,
  "location",
);
check(
  "location forbidden says it's about access",
  /can't view/.test(m.netLogsErrorMessage(err(403, "NETLOGS_LOCATION_FORBIDDEN")).title),
);
{
  const f = m.netLogsErrorMessage(err(422, "NETLOGS_BAD_FILTER", { field: "status" }));
  check(
    "bad filter names the field and offers to clear",
    /status/.test(f.detail) && f.clear === "filters",
  );
}
check(
  "bad cursor asks for a refresh",
  /Refresh/.test(m.netLogsErrorMessage(err(422, "DEVICE_LOGS_BAD_CURSOR")).detail),
);
check("plain 403 is about permission", /access/.test(m.netLogsErrorMessage(err(403)).title));
check("400 (no org) asks for an account", /account/.test(m.netLogsErrorMessage(err(400)).title));
check(
  "409 export is 'not switched on'",
  /switched on/.test(m.netLogsErrorMessage(err(409, "DEVICE_LOGS_DISABLED")).title),
);
check(
  "no response is a connection problem",
  /reach/.test(m.netLogsErrorMessage({ status: null, code: "network_error", message: "" }).title),
);
{
  const all = [
    err(404, "NETLOGS_LOCATION_NOT_FOUND"),
    err(409, "DEVICE_LOGS_DISABLED"),
    err(500),
    err(403),
    err(400),
  ].map((e) => JSON.stringify(m.netLogsErrorMessage(e)));
  check(
    "the backend's own message (which names a platform setting) is never shown",
    all.every((s) => !/CLOUDGUEST|switched off on this platform/.test(s)),
  );
}

// ---------------------------------------------------------------------------
console.log("\ncharts");

{
  const summary = {
    by_day: [
      {
        day: "2026-10-01",
        total: 5,
        errors: 1,
        warnings: 2,
        by_category: { dhcp: 4, firewall: 1 },
      },
      { day: "2026-10-04", total: 2, errors: 0, warnings: 0, by_category: { radius: 2 } },
    ],
    by_category: { dhcp: 4, firewall: 1, radius: 2, dns: 0 },
  };
  const rows = m.netLogsChartRows(summary);
  eq(
    "quiet days between are filled with zeros",
    rows.map((r) => r.day),
    ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
  );
  eq("a filled day is a real zero", [rows[1].total, rows[1].dhcp], [0, 0]);
  eq(
    "category counts land on their keys",
    [rows[0].dhcp, rows[0].firewall, rows[3].radius],
    [4, 1, 2],
  );
  eq("only categories that occur are drawn", m.presentCategories(summary), [
    "dhcp",
    "radius",
    "firewall",
  ]);
  eq("no summary -> no rows", m.netLogsChartRows(undefined), []);
  const long = {
    by_day: Array.from({ length: 365 }, (_, i) => ({
      day: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      total: 1,
      errors: 1,
      warnings: 0,
      by_category: { system: 1 },
    })),
  };
  const grouped = m.netLogsChartRows(long, 120);
  check("a year is grouped to at most 120 bars", grouped.length <= 120 && grouped.length > 1);
  check(
    "grouping keeps every count",
    grouped.reduce((n, r) => n + r.total, 0) === 365 &&
      grouped.reduce((n, r) => n + r.system, 0) === 365,
  );
  check("a grouped bar says what it covers", grouped[0].lastDay > grouped[0].day);
}

// ---------------------------------------------------------------------------
console.log("\nwiring");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const nav = read("src/lib/customerNav.ts");
const view = read("src/components/netlogs/NetLogsView.tsx");
const charts = read("src/components/netlogs/NetLogsCharts.tsx");
const service = read("src/services/netlogs.service.ts");
const types = read("src/types/netlogs.ts");
const lib = read("src/lib/netlogs.ts");
const route = read("src/routes/netlogs.tsx");
const featurePage = read("src/components/customer/CustomerFeaturePage.tsx");
const en = JSON.parse(read("src/lib/i18n/locales/en/nav.json"));
const hi = JSON.parse(read("src/lib/i18n/locales/hi/nav.json"));

check(
  "nav row sits in Support & Logs",
  /id: "netlogs", label: "NetLogs", icon: Logs, roles: \["owner", "agent"\]/.test(nav) &&
    nav.indexOf('id: "netlogs"') > nav.indexOf('id: "support-logs"'),
);
eq("nav row needs network_logs.read", m.NAV_PERMISSION_KEYS.netlogs, ["network_logs.read"]);
check("that key is seeded by the backend", m.BACKEND_PERMISSION_KEYS.includes("network_logs.read"));
check(
  "the Master key is not what gates it",
  !m.NAV_PERMISSION_KEYS.netlogs.includes("device_logs.read"),
);
check(
  "a staff role without the key does not see it",
  !m.navItemAllowed("netlogs", new Set(["dashboard.view"])),
);
check("a role with the key does", m.navItemAllowed("netlogs", new Set(["network_logs.read"])));
check("the view checks the same key itself", /navItemAllowed\("netlogs"/.test(view));
check("both locales name the row", !!en.customerItem?.netlogs && !!hi.customerItem?.netlogs);
check(
  "the route is /netlogs and renders the shared shell",
  /createFileRoute\("\/netlogs"\)/.test(route) && /feature="netlogs"/.test(route),
);
check(
  "the route validates every filter key",
  ["range", "from", "to", "loc", "router", "sev", "cat", "st", "q"].every((k) =>
    new RegExp(`\\b${k}: optional`).test(route),
  ),
);
check(
  "the feature page mounts the view",
  /feature === "netlogs" && <NetLogsView locationId=\{locationId\} \/>/.test(featurePage),
);
check(
  "the view reads its filters from the URL",
  /useSearch\(/.test(view) && /filtersFromSearch\(/.test(view),
);
check(
  "and writes them back to the URL",
  /navigate\(\{ to: "\/netlogs", search: searchFromFilters\(/.test(view),
);
check(
  "the service talks to the customer paths",
  /"\/device-logs"/.test(service) &&
    /"\/device-logs\/summary"/.test(service) &&
    /"\/device-logs\/export\.csv"/.test(service),
);
check(
  "not the Master viewer's platform paths",
  !/\/platform\/device-logs/.test(strip(service) + strip(view)),
);
check(
  "the export goes through the authenticated client as a blob",
  /responseType: "blob"/.test(service) && /from "@\/services\/api"/.test(service),
);
check("the export uses the page's own filters", /exportCsv\(exportParams/.test(view));
check(
  "Load more follows next_cursor",
  /next_cursor/.test(read("src/hooks/useNetLogs.ts")) && /fetchNextPage/.test(view),
);
check("the feature-off state is handled", /feature_enabled === false/.test(view));
check(
  "charts are lazy",
  /lazy\(\(\) =>\s*import\("@\/components\/netlogs\/NetLogsCharts"\)/.test(view) &&
    /from "recharts"/.test(charts) &&
    !/from "recharts"/.test(view),
);
check(
  "the table is in the owner's column order",
  (() => {
    const cols = [
      "Timestamp",
      "Device/Host",
      "Source IP",
      "Destination IP",
      "Protocol",
      "Status",
      "Message",
    ];
    const at = cols.map((c) => view.indexOf(`>${c}</TableHead>`));
    return at.every((i) => i > 0) && at.every((i, k) => k === 0 || i > at[k - 1]);
  })(),
);
{
  const code = [view, charts, service, types, lib, route].map(strip).join("\n");
  const banned = /wireguard|wire guard|tunnel|source_ip|claimed_tag|attribution|wyfy-\$/i;
  const hit = code.match(banned);
  check(
    "no WireGuard, tunnel address, tag or attribution in this page's code or copy",
    !hit,
    hit ? hit[0] : "",
  );
  check(
    "the Master service is not imported",
    !/deviceLogs\.service/.test(strip(view) + strip(service)),
  );
}

console.log(
  failures === 0
    ? `\n${passed} checks, all netlogs checks passed`
    : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
