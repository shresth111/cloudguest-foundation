/**
 * Master "Traffic Lens" Destinations: the search, its download, the custom
 * time range and the drill-down from a service. Shapes are
 * wyfy-specs/flow-visibility/API.md (D-1 to D-3); the fixtures below exist
 * ONLY in this file -- the app ships no fixture data.
 *
 * What this pins, worst-first:
 *
 *   1. NO DEVICE ANYWHERE. A destination record is venue-level. No wire
 *      type, request parameter, form field, column or sort key names a
 *      device, a MAC, a guest, a session or a client, and no Destinations
 *      file imports anything that does.
 *   2. NOTHING IS FETCHED BEHIND THE OPERATOR'S BACK. Every request writes
 *      an audit row, so the hooks never retry, refetch on focus or go stale,
 *      and nothing is requested before Search is pressed.
 *   3. UNMEASURED IS NEVER ZERO. No window in range, windows without
 *      protocol and port, windows withheld for too few devices, and a
 *      search that matched nothing are four different sentences.
 *   4. WHAT IS MISSING IS SAID. A capped page states the total; "unlisted"
 *      is shown, and `null` reads "not known", never nothing. A download
 *      whose completeness could not be read is not called complete.
 *   5. A CUSTOM RANGE IS REFUSED IN WORDS, never shortened, and every
 *      request on the page reads the same range.
 *   6. A SERVICE IS A PORT, never an application, and the drill-down's
 *      figures say "at least".
 *
 * Bundles the real modules with esbuild and executes them (this repo has no
 * test runner -- see scripts/test-traffic-flow.mjs).
 *
 * Run: node scripts/test-traffic-flow-destinations.mjs
 */
process.env.TZ = "Asia/Kolkata";

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

const outdir = mkdtempSync(join(tmpdir(), "traffic-flow-destinations-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/traffic-flow-destinations.ts")}";
   export { flowRange, flowRangeMs, flowSummaryParams, FLOW_WINDOW_MS }
     from "${p("src/services/traffic-flow.service.ts")}";
   export { trafficFlowDestinationsService }
     from "${p("src/services/traffic-flow-destinations.service.ts")}";
   export { sameSearch } from "${p("src/hooks/useFlowDestinations.ts")}";
   export { lensRangeBounds, LENS_VIEWS } from "${p("src/lib/traffic-lens-customer.ts")}";
   export { trafficLensDestinationsService }
     from "${p("src/services/traffic-lens-destinations.service.ts")}";`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": p("src") },
  // The services import the axios client. It is replaced by a recorder so
  // the real service code runs against responses this file controls.
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^\.\/api$|^@\/services\/api$/ }, () => ({
          path: "api",
          namespace: "stub",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            "export const api = { get: (...a) => globalThis.__flowApiGet(...a) }; export default api;",
          loader: "js",
        }));
      },
    },
  ],
});
const m = await import(bundle);

// ---------------------------------------------------------------------------
// Fixtures (API.md's own examples, trimmed)
// ---------------------------------------------------------------------------
const NOW = Date.parse("2026-10-12T14:10:00Z");
const record = (over = {}) => ({
  window_start: "2026-10-12T14:05:00+00:00",
  window_end: "2026-10-12T14:10:00+00:00",
  address: "142.250.193.14",
  protocol: 6,
  protocol_name: "tcp",
  port: 443,
  service_name: "https",
  bytes_up: 2097152,
  bytes_down: 209715200,
  bytes: 211812352,
  flows: 640,
  ...over,
});
const range = (over = {}) => ({
  feature_enabled: true,
  measured: true,
  location_id: "l1",
  router_id: null,
  since: "2026-10-12T13:10:00+00:00",
  until: "2026-10-12T14:10:00+00:00",
  window_seconds: 300,
  windows: 12,
  windows_measured: 12,
  data_oldest: "2026-10-12T09:40:00+00:00",
  data_newest: "2026-10-12T14:05:00+00:00",
  per_window_top_n: 50,
  min_devices: null,
  windows_withheld: 0,
  ...over,
});
const search = (over = {}) => ({
  ...range(),
  retention_days: 7,
  filters: { address: null, protocol: null, port: null, direction: "any" },
  sort: "time",
  order: "desc",
  limit: 1000,
  total: 1834,
  returned: 1000,
  truncated: true,
  query_ms: 38,
  totals: { bytes_up: 31457280, bytes_down: 419430400, bytes: 450887680, flows: 9120 },
  unlisted: { bytes_up: 0, bytes_down: 62914560, bytes: 62914560, flows: 12 },
  rows: [record()],
  ...over,
});
const drill = (over = {}) => ({
  ...range(),
  service: {
    protocol: 6,
    protocol_name: "tcp",
    port: 443,
    service_name: "https",
    bytes_up: 31457280,
    bytes_down: 419430400,
    bytes: 450887680,
    flows: 9120,
    exact: true,
  },
  lower_bound: true,
  destinations_listed: 37,
  listed_bytes: 402653184,
  unlisted_bytes: 48234496,
  unlisted_share: 0.107,
  items: [
    {
      address: "142.250.193.14",
      bytes_up: 2097152,
      bytes_down: 209715200,
      bytes: 211812352,
      flows: 640,
      share: 0.4698,
    },
  ],
  ...over,
});
// The app formats counts, dates and clock times in the machine's locale.
// Expectations are built the same way, so this suite gives the same verdict
// on any machine ("1,000" or "1.000", "12 Oct" or "Oct 12", 24-hour or am/pm).
const N = (n) => Math.round(n).toLocaleString();
const DAY_LABEL = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
const CLOCK = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const SCOPE = { locationId: "l1", routerId: "" };
const RANGE = { since: "2026-10-12T13:10:00.000Z", until: "2026-10-12T14:10:00.000Z" };
const FORM = m.EMPTY_DESTINATION_FILTERS;
const SORT = m.DEFAULT_DESTINATION_SORT;

// ---------------------------------------------------------------------------
console.log("\ncustom range: minute precision, refused in words");
const DAY = 86400000;
const ok = m.customRangeFromInputs("2026-10-12T13:07", "2026-10-12T13:52", NOW);
check("a local, minute-precision range is accepted", ok.ok === true);
eq("local wall-clock time becomes the UTC instant (IST is +05:30)", ok.ok && ok.range, {
  since: "2026-10-12T07:37:00.000Z",
  until: "2026-10-12T08:22:00.000Z",
});
eq("an instant round-trips through the input value", m.toLocalInput(NOW), "2026-10-12T19:40");
eq("an unreadable instant is an empty input", m.toLocalInput(NaN), "");
const refuse = (a, b) => {
  const r = m.customRangeFromInputs(a, b, NOW);
  return r.ok ? "accepted" : r.message;
};
check("a missing end is refused", /Pick a start and an end/.test(refuse("2026-10-12T13:07", "")));
check("garbage is refused", /not a date and time/.test(refuse("yesterday", "2026-10-12T13:07")));
check(
  "start after end is refused",
  /start must be before the end/.test(refuse("2026-10-12T13:52", "2026-10-12T13:07")),
);
check(
  "an equal start and end is refused",
  /start must be before the end/.test(refuse("2026-10-12T13:07", "2026-10-12T13:07")),
);
check(
  "longer than 7 days is refused, not shortened",
  /may not be longer than 7 days/.test(
    refuse(m.toLocalInput(NOW - 7 * DAY - 60000), m.toLocalInput(NOW + 60000)),
  ),
);
const tooOld = refuse(m.toLocalInput(NOW - 9 * DAY), m.toLocalInput(NOW - 8 * DAY));
check(
  "a start before retention is refused, saying how long data is kept and from when",
  /kept for 7 days/.test(tooOld) &&
    tooOld.includes(`may not be earlier than ${DAY_LABEL("2026-10-05T14:10:00Z")} `),
  tooOld,
);
check(
  "exactly the last 7 days is one allowed range",
  m.customRangeFromInputs(m.toLocalInput(NOW - 7 * DAY), m.toLocalInput(NOW), NOW).ok === true,
);
check(
  "a clock a few minutes behind the server's is not refused",
  m.customRangeFromInputs(
    m.toLocalInput(NOW - 7 * DAY - 10 * 60000),
    m.toLocalInput(NOW - DAY),
    NOW,
  ).ok === true,
);
check(
  "the range label is local time, both ends",
  m.rangeLabel(RANGE) ===
    `${DAY_LABEL(RANGE.since)} ${CLOCK(RANGE.since)} to ${DAY_LABEL(RANGE.until)} ${CLOCK(RANGE.until)}` &&
    CLOCK(RANGE.since) !== CLOCK("2026-10-12T13:10:00+05:30"),
  m.rangeLabel(RANGE),
);
eq("an unreadable range has no label", m.rangeLabel({ since: "x", until: "y" }), "");

console.log("\none range for every request on the page");
const preset = { window: "24h", locationId: "l1", routerId: "" };
eq("a preset ends now", m.flowRange(preset, NOW), {
  since: "2026-10-11T14:10:00.000Z",
  until: "2026-10-12T14:10:00.000Z",
});
const custom = {
  ...preset,
  custom: { since: "2026-10-11T03:07:00.000Z", until: "2026-10-11T09:52:00.000Z" },
};
eq("a custom range is used exactly as given", m.flowRange(custom, NOW), custom.custom);
eq(
  "a cleared custom range falls back to the preset",
  m.flowRange({ ...custom, custom: null }, NOW),
  m.flowRange(preset, NOW),
);
const summaryParams = m.flowSummaryParams(custom, NOW);
check(
  "the venue summary reads the same custom range",
  summaryParams.since === custom.custom.since && summaryParams.until === custom.custom.until,
  JSON.stringify(summaryParams),
);
eq("range length of a preset", m.flowRangeMs(preset), 24 * 3600000);
eq("range length of a custom range", m.flowRangeMs(custom), (6 * 60 + 45) * 60000);
eq(
  "an unreadable custom range does not produce a negative length",
  m.flowRangeMs({ ...preset, custom: { since: "x", until: "y" } }),
  24 * 3600000,
);

// ---------------------------------------------------------------------------
console.log("\nsearch request");
const bare = m.destinationSearchParams(SCOPE, RANGE, FORM, SORT);
eq("an empty form sends the venue, the range and the sort, nothing else", bare, {
  ok: true,
  params: {
    location_id: "l1",
    since: RANGE.since,
    until: RANGE.until,
    sort: "time",
    order: "desc",
  },
});
const full = m.destinationSearchParams(
  { locationId: "l1", routerId: "r1" },
  RANGE,
  { address: " 142.250.0.0/16 ", protocol: "6", port: "443", direction: "down" },
  { key: "bytes", order: "asc" },
);
eq("every filter is sent, trimmed", full.ok && full.params, {
  location_id: "l1",
  since: RANGE.since,
  until: RANGE.until,
  sort: "bytes",
  order: "asc",
  router_id: "r1",
  address: "142.250.0.0/16",
  protocol: "6",
  port: "443",
  direction: "down",
});
check(
  "an empty port is no filter, not port 0",
  bare.ok && !("port" in bare.params) && !("protocol" in bare.params),
);
const zero = m.destinationSearchParams(SCOPE, RANGE, { ...FORM, port: "0", protocol: "1" }, SORT);
check("port 0 can still be asked for", zero.ok && zero.params.port === "0");
check("direction any is not sent", bare.ok && !("direction" in bare.params));
const refused = (form, scope = SCOPE) => {
  const r = m.destinationSearchParams(scope, RANGE, { ...FORM, ...form }, SORT);
  return r.ok ? "accepted" : r.field;
};
eq("no venue, no request", refused({}, { locationId: "", routerId: "r1" }), "venue");
eq("a host name is not an address", refused({ address: "example.com" }), "address");
eq("free text is not an address", refused({ address: "google" }), "address");
eq("a bare number is not an address", refused({ address: "443" }), "address");
eq("an IPv6 prefix is an address", refused({ address: "2404:6800::/32" }), "accepted");
eq("port above 65535 is refused", refused({ port: "70000" }), "port");
eq("a fractional port is refused", refused({ port: "44.3" }), "port");
eq("protocol above 255 is refused", refused({ protocol: "256" }), "protocol");
check(
  "no request parameter names a device",
  full.ok &&
    Object.keys(full.params).every(
      (k) => !/client|mac|device|guest|session|src|talker|user|host/i.test(k),
    ),
  full.ok ? Object.keys(full.params).join(",") : "",
);

console.log("\nsorting");
eq("same column flips", m.nextSort({ key: "bytes", order: "desc" }, "bytes"), {
  key: "bytes",
  order: "asc",
});
eq("a number column starts largest first", m.nextSort(SORT, "bytes_down"), {
  key: "bytes_down",
  order: "desc",
});
eq("time starts newest first", m.nextSort({ key: "bytes", order: "asc" }, "time"), {
  key: "time",
  order: "desc",
});
eq("an address column starts ascending", m.nextSort(SORT, "address"), {
  key: "address",
  order: "asc",
});
eq(
  "aria-sort on the sorted column",
  m.ariaSort({ key: "port", order: "asc" }, "port"),
  "ascending",
);
eq("aria-sort elsewhere", m.ariaSort({ key: "port", order: "asc" }, "bytes"), "none");

// ---------------------------------------------------------------------------
const A = { location_id: "l1", since: "s", until: "u", port: "443", sort: "time", order: "desc" };
check("a re-sort is the same search", m.sameSearch(A, { ...A, sort: "bytes", order: "asc" }));
check("another venue is not", !m.sameSearch(A, { ...A, location_id: "l2" }));
check("another range is not", !m.sameSearch(A, { ...A, since: "s2" }));
check("another filter is not", !m.sameSearch(A, { ...A, port: "80" }));
check(
  "a dropped filter is not",
  !m.sameSearch(A, { location_id: "l1", since: "s", until: "u", sort: "time", order: "desc" }),
);
check("nothing searched yet is not", !m.sameSearch(null, A) && !m.sameSearch(A, null));

console.log("\nresult line: count and timing");
eq(
  "a capped page states the total",
  m.resultLine(search()),
  `Showing ${N(1000)} of ${N(1834)} records · 38 ms`,
);
eq(
  "a whole result",
  m.resultLine(search({ total: 12, returned: 12, truncated: false })),
  "12 records · 38 ms",
);
eq(
  "one record is singular",
  m.resultLine(search({ total: 1, returned: 1, truncated: false, query_ms: 4 })),
  "1 record · 4 ms",
);
eq(
  "nothing matched",
  m.resultLine(search({ total: 0, returned: 0, truncated: false, rows: [] })),
  "No records · 38 ms",
);
check(
  "a missing timing is left out, not shown as 0 ms",
  m.resultLine(search({ query_ms: null })) === `Showing ${N(1000)} of ${N(1834)} records`,
);
check(
  "totals describe every matching record",
  /Download 419 MB · Upload 31\.5 MB across all matching records/.test(m.totalsLine(search())),
  m.totalsLine(search()),
);
eq("no totals line when nothing was measured", m.totalsLine(search({ totals: null })), null);

console.log("\nwhat a result leaves out is said");
const notes = m.searchNotes(search());
check(
  "a capped page says so and what to do",
  notes.some((n) => n.includes(`Only the first ${N(1000)} are shown`) && /download/.test(n)),
);
check(
  "unlisted traffic is stated with its size",
  notes.some((n) => /Plus 62\.9 MB to addresses outside each window's top 50/.test(n)),
  notes.join(" | "),
);
const unknown = m.searchNotes(search({ unlisted: null, truncated: false }));
check(
  "unlisted null reads 'not known', never nothing",
  unknown.length === 1 && /is not known/.test(unknown[0]) && /top 50/.test(unknown[0]),
  unknown.join(" | "),
);
eq(
  "a whole result with nothing unlisted has no note",
  m.searchNotes(
    search({ truncated: false, unlisted: { bytes_up: 0, bytes_down: 0, bytes: 0, flows: 0 } }),
  ),
  [],
);
check(
  "windows without protocol and port are counted out loud",
  m
    .coverageNotes(range({ windows_measured: 9 }))
    .some((n) => /cover 9 of 12 five-minute windows/.test(n) && /not measured here/.test(n)),
);
check(
  "withheld windows are said in plain words",
  m
    .coverageNotes(range({ min_devices: 5, windows_withheld: 2 }))
    .some((n) =>
      /2 of 12 five-minute windows are not shown, because fewer than 5 devices were connected/.test(
        n,
      ),
    ),
);
eq("no threshold in force, no withheld line", m.coverageNotes(range({ windows_withheld: 2 })), []);

console.log("\nmeasured versus zero");
const stateOf = (over) => m.rangeState(range(over), NOW).kind;
eq("data in range", stateOf({}), "measured");
eq(
  "no window in range",
  stateOf({ measured: false, windows: 0, windows_measured: 0 }),
  "not_measured",
);
eq("measured:true with no windows is still not measured", stateOf({ windows: 0 }), "not_measured");
eq("windows without protocol and port", stateOf({ windows_measured: 0 }), "no_detail");
eq("every window withheld", stateOf({ min_devices: 5, windows_withheld: 12 }), "withheld");
eq(
  "some windows withheld is still a result",
  stateOf({ min_devices: 5, windows_withheld: 2 }),
  "measured",
);
eq("the platform switch off", stateOf({ feature_enabled: false, measured: false }), "feature_off");
eq(
  "withheld outranks unmeasured detail",
  stateOf({ min_devices: 5, windows_withheld: 12, windows_measured: 0 }),
  "withheld",
);
const msg = (over) => m.rangeStateMessage(m.rangeState(range(over), NOW));
eq("a measured range has no empty-state message", msg({}), null);
check(
  "not measured says where data starts, never 'no traffic'",
  /Not measured for this period/.test(msg({ measured: false, windows: 0 }).title) &&
    msg({ measured: false, windows: 0 }).body.includes(
      `Data starts ${CLOCK("2026-10-12T09:40:00Z")}.`,
    ) &&
    !/no traffic/i.test(msg({ measured: false, windows: 0 }).body),
  JSON.stringify(msg({ measured: false, windows: 0 })),
);
check(
  "nothing held at all is said as such",
  /not the same as no traffic/.test(msg({ measured: false, windows: 0, data_oldest: null }).body),
);
check(
  "withheld is not 'no destinations'",
  /Not shown while fewer than 5 devices are connected/.test(
    msg({ min_devices: 5, windows_withheld: 12 }).title,
  ) && /Traffic was measured/.test(msg({ min_devices: 5, windows_withheld: 12 }).body),
);
check(
  "no protocol and port is not 'no destinations'",
  /not the same as no destinations/.test(msg({ windows_measured: 0 }).body),
);
check(
  "switched off is not an empty result",
  /not an empty result/.test(msg({ feature_enabled: false, measured: false }).body),
);

console.log("\na record row");
const view = m.recordView(record(), NOW);
check(
  "the window is local time, start to end",
  view.window === `${CLOCK("2026-10-12T14:05:00Z")} to ${CLOCK("2026-10-12T14:10:00Z")}` &&
    /35/.test(view.window) &&
    /40/.test(view.window),
  view.window,
);
eq("service is the port label with protocol and port", view.service, "https (TCP/443)");
eq(
  "an unnamed port is bare",
  m.recordView(record({ protocol: 17, protocol_name: "udp", port: 19305, service_name: null }), NOW)
    .service,
  "UDP/19305",
);
eq("download / upload / total", [view.down, view.up, view.total], ["210 MB", "2.1 MB", "212 MB"]);
eq("flows", view.flows, "640");
check(
  "a window on another day carries its date",
  new RegExp(`^${DAY_LABEL("2026-10-11T10:00:00Z")} `).test(
    m.recordView(
      record({
        window_start: "2026-10-11T10:00:00+00:00",
        window_end: "2026-10-11T10:05:00+00:00",
      }),
      NOW,
    ).window,
  ),
);
check(
  "the row key is the record's own identity, with no device in it",
  view.key === "2026-10-12T14:05:00+00:00|142.250.193.14|6|443",
  view.key,
);
check(
  "a row view has exactly the venue-level columns",
  Object.keys(view).sort().join(",") === "address,down,flows,key,service,total,up,window",
  Object.keys(view).join(","),
);

console.log("\ndownload");
eq(
  "a complete file says how many records",
  m.exportMessage({ total: 12, rows: 12, truncated: false }),
  {
    tone: "success",
    text: "Downloaded 12 records.",
  },
);
const cut = m.exportMessage({ total: 81234, rows: 50000, truncated: true });
check(
  "a cut file is a warning with both numbers",
  cut.tone === "warning" && cut.text.includes(`first ${N(50000)} of ${N(81234)} records`),
  cut.text,
);
const blind = m.exportMessage({ total: null, rows: null, truncated: null });
check(
  "unreadable headers are not called complete",
  blind.tone === "warning" &&
    /could not be read/.test(blind.text) &&
    blind.text.includes(`at most ${N(50000)}`),
  blind.text,
);
check(
  "a cut file without counts still says it was cut",
  m
    .exportMessage({ total: null, rows: null, truncated: true })
    .text.includes(`cut at ${N(50000)} records`),
);

const calls = [];
let nextResponse = null;
globalThis.__flowApiGet = async (url, config) => {
  calls.push({ url, config });
  return nextResponse;
};
nextResponse = { data: search() };
const got = await m.trafficFlowDestinationsService.search(bare.params);
check(
  "search calls the platform route with the params as given",
  calls[0].url === "/platform/traffic-flow/destinations" &&
    calls[0].config.params === bare.params &&
    got.total === 1834,
);
nextResponse = {
  data: "blob",
  headers: {
    "x-total-rows": "81234",
    "x-export-rows": "50000",
    "x-export-truncated": "true",
    "content-disposition":
      'attachment; filename="traffic-lens-destinations-20261012T1310Z-20261012T1410Z.csv"',
  },
};
const file = await m.trafficFlowDestinationsService.exportCsv(bare.params);
check(
  "the download asks for a blob from the export route with the SAME params",
  calls[1].url === "/platform/traffic-flow/destinations/export" &&
    calls[1].config.params === bare.params &&
    calls[1].config.responseType === "blob",
);
eq(
  "the cap and the counts are read from the headers",
  [file.total, file.rows, file.truncated, file.filename],
  [81234, 50000, true, "traffic-lens-destinations-20261012T1310Z-20261012T1410Z.csv"],
);
nextResponse = { data: "blob", headers: { "x-total-rows": "12", "x-export-rows": "12" } };
eq(
  "no truncated header and equal counts is a complete file",
  (await m.trafficFlowDestinationsService.exportCsv(bare.params)).truncated,
  false,
);
nextResponse = { data: "blob", headers: {} };
const noHeaders = await m.trafficFlowDestinationsService.exportCsv(bare.params);
eq(
  "headers the browser cannot read are unknown, not 'complete'",
  [noHeaders.total, noHeaders.rows, noHeaders.truncated, noHeaders.filename],
  [null, null, null, "traffic-lens-destinations.csv"],
);

// ---------------------------------------------------------------------------
console.log("\ndrill-down: a service's destinations");
eq("a service key is a protocol and a port", m.serviceFromKey("6/443"), { protocol: 6, port: 443 });
eq("port 0 is a service", m.serviceFromKey("1/0"), { protocol: 1, port: 0 });
eq("the all-other row is not a service", m.serviceFromKey("__other"), null);
eq("an unknown protocol is not a service", m.serviceFromKey("x/443"), null);
eq("an impossible port is not a service", m.serviceFromKey("6/70000"), null);
eq(
  "the request names the venue, the range and the service",
  m.serviceDestinationParams({ locationId: "l1", routerId: "r1" }, RANGE, {
    protocol: 6,
    port: 443,
  }),
  {
    location_id: "l1",
    since: RANGE.since,
    until: RANGE.until,
    protocol: "6",
    port: "443",
    limit: "10",
    router_id: "r1",
  },
);
eq(
  "no venue, no request",
  m.serviceDestinationParams({ locationId: "", routerId: "r1" }, RANGE, { protocol: 6, port: 443 }),
  null,
);
const dv = m.serviceDestinationsView(drill(), NOW);
check("rows", dv.kind === "rows" && dv.rows.length === 1);
eq("titled by the port label", dv.title, "https (TCP/443)");
eq("an exact service total is bare", dv.total, "451 MB in this period");
eq("every row figure says at least", dv.rows[0], {
  address: "142.250.193.14",
  down: "at least 210 MB",
  up: "at least 2.1 MB",
  share: "at least 47%",
  barWidth: 47,
});
check(
  "a row is an address and volumes, nothing else",
  Object.keys(dv.rows[0]).sort().join(",") === "address,barWidth,down,share,up",
);
check(
  "bytes to unlisted addresses are stated",
  dv.notes.some((n) =>
    /48\.2 MB \(11%\) of this service went to addresses outside a window's top 50/.test(n),
  ),
  dv.notes.join(" | "),
);
check(
  "addresses beyond the list are counted",
  dv.notes.some((n) => /36 more addresses of this service are not listed here/.test(n)),
);
check(
  "the lower bound is explained",
  dv.notes.some((n) => /"at least"/.test(n) && /top 50 destinations/.test(n)),
);
const inexact = m.serviceDestinationsView(
  drill({ service: { ...drill().service, exact: false } }),
  NOW,
);
check(
  "an inexact service total says at least, and the shares say of what",
  inexact.kind === "rows" &&
    inexact.total === "at least 451 MB in this period" &&
    inexact.notes.some((n) => /share of the measured part/.test(n)),
);
const none = m.serviceDestinationsView(
  drill({
    items: [],
    destinations_listed: 0,
    listed_bytes: 0,
    unlisted_bytes: 0,
    unlisted_share: 0,
    service: { ...drill().service, bytes: 0, bytes_up: 0, bytes_down: 0, flows: 0 },
  }),
  NOW,
);
check(
  "a service with no traffic is a measured zero",
  none.kind === "empty" && /No https \(TCP\/443\) traffic recorded in this period/.test(none.title),
  JSON.stringify(none),
);
const hidden = m.serviceDestinationsView(
  drill({ items: [], destinations_listed: 0, listed_bytes: 0 }),
  NOW,
);
check(
  "traffic with no listed destination is not 'no traffic'",
  hidden.kind === "empty" && /was among any window's top 50/.test(hidden.title),
  JSON.stringify(hidden),
);
const unmeasured = m.serviceDestinationsView(
  drill({ measured: false, windows: 0, service: null, items: [] }),
  NOW,
);
check(
  "an unmeasured range is said, not drawn as empty",
  unmeasured.kind === "state" && /Not measured for this period/.test(unmeasured.message.title),
);
const withheld = m.serviceDestinationsView(
  drill({ min_devices: 5, windows_withheld: 12, items: [] }),
  NOW,
);
check(
  "a withheld range is said in plain words",
  withheld.kind === "state" && /fewer than 5 devices/.test(withheld.message.title),
);
check(
  "a missing service figure is not a zero",
  m.serviceDestinationsView(drill({ service: null }), NOW).kind === "state",
);

// ---------------------------------------------------------------------------
console.log("\nno device anywhere, nothing fetched unasked, wiring");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(f);
  }
  return out;
}
const sources = walk(join(ROOT, "src")).map((f) => [relative(ROOT, f), readFileSync(f, "utf8")]);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const types = read("src/types/traffic-flow-destinations.ts");
const service = read("src/services/traffic-flow-destinations.service.ts");
const hook = read("src/hooks/useFlowDestinations.ts");
const lib = read("src/lib/traffic-flow-destinations.ts");
const tab = read("src/components/master/TrafficFlowDestinations.tsx");
const panel = read("src/components/master/TrafficFlowServiceDestinations.tsx");
const rangeControl = read("src/components/master/TrafficFlowRangeControl.tsx");
const page = read("src/routes/master.traffic-flow.tsx");
const venue = read("src/components/master/TrafficFlowVenueView.tsx");

// Field names in the wire types: every `name:` / `name?:` in the file.
const fieldNames = [...code(types).matchAll(/^\s*([a-z_][a-zA-Z0-9_]*)\??:/gm)].map((x) => x[1]);
const DEVICE_WORD =
  /(^|_)(client|clients|mac|device|devices|guest|guests|session|sessions|talker|talkers|user|src|host|hostname|nat)(_|$)/;
check(
  "the wire types were actually read",
  fieldNames.includes("address") && fieldNames.includes("window_start") && fieldNames.length > 40,
  String(fieldNames.length),
);
eq(
  "no wire field names a device (min_devices is a threshold, the one exception)",
  fieldNames.filter((n) => DEVICE_WORD.test(n) && n !== "min_devices"),
  [],
);
check(
  "the check itself catches a device field",
  ["client_ip", "src_addr", "mac_address", "guest_session_id", "device_id"].every((n) =>
    DEVICE_WORD.test(n),
  ),
);
check(
  "the Destinations files import nothing about devices, guests or sessions",
  [types, service, hook, lib, tab, panel, rangeControl].every(
    (src) => !/from "[^"]*(guest|session|device|connected|mac-)[^"]*"/i.test(src),
  ),
);
check(
  "the sort keys are the venue-level columns only",
  /"time"\s*\|\s*"address"\s*\|\s*"protocol"\s*\|\s*"port"\s*\|\s*"bytes"\s*\|\s*"bytes_up"\s*\|\s*"bytes_down"\s*\|\s*"flows";/.test(
    types
      .replace(/\n\s*/g, " ")
      .replace(/\|\s+"/g, '| "')
      .replace(/=\s+\|/, "="),
  ),
);
const tabCode = code(tab);
const panelCode = code(panel);
check(
  "the search form has four filters and none is a device",
  ["address", "protocol", "port", "direction"].every((f) =>
    new RegExp(`field\\(\\{ ${f}`).test(tabCode),
  ) && (tabCode.match(/field\(\{/g) ?? []).length === 4,
);
check(
  "the result table has the seven venue-level columns",
  (tabCode.match(/\{ key: "/g) ?? []).length === 7 &&
    !/Device|MAC|Guest|Source/.test(tabCode.match(/const COLUMNS[\s\S]*?\];/)[0]),
);
check(
  "both screens say in words that no device is shown",
  /no record says which device/.test(tab) && /does not say which device/.test(panel),
);
check(
  "both screens say requests are audited",
  /AUDIT_NOTE/.test(tabCode) && /AUDIT_NOTE/.test(panelCode) && /audit log/.test(m.AUDIT_NOTE),
);

for (const flag of [
  "retry: false",
  "staleTime: Infinity",
  "refetchOnWindowFocus: false",
  "refetchOnReconnect: false",
  "refetchOnMount: false",
])
  check(`hooks: ${flag}`, hook.includes(flag));
check(
  "both queries use those settings",
  (code(hook).match(/\.\.\.ASKED_FOR_ONLY/g) ?? []).length === 2,
);
check(
  "both queries are disabled until asked",
  (code(hook).match(/enabled: params !== null/g) ?? []).length === 2,
);
check("no polling", !/refetchInterval/.test(hook));
check(
  "rows are kept on screen only across a re-sort of the same search",
  /sameSearch\(previousQuery\?\.queryKey\[2\], params\) \? previous : undefined/.test(hook),
);
check(
  "a segmented control never submits the search form",
  /type="button"\s+onClick=\{\(\) => onChange\(o\.value\)\}/.test(
    read("src/components/master/MasterKit.tsx"),
  ),
);
check(
  "nothing is searched from an effect",
  !/useEffect/.test(tabCode) && !/useEffect/.test(panelCode),
);
check(
  "a search starts only from the form's submit or a sort click",
  (tabCode.match(/setParams\(/g) ?? []).length === 3 &&
    /onSubmit=\{submit\}/.test(tabCode) &&
    /setParams\(null\)/.test(tabCode),
  String((tabCode.match(/setParams\(/g) ?? []).length),
);
check(
  "a re-sort re-asks for the same search",
  /setParams\(\{ \.\.\.params, sort: next\.key, order: next\.order \}\)/.test(tabCode),
);
check(
  "the download uses the search on screen",
  /let request = params;/.test(tabCode) && /download\.mutate\(request/.test(tabCode),
);
check(
  "the download reports what the file holds",
  /exportMessage\(file\)/.test(tabCode) && /toast\.warning/.test(tabCode),
);
check("a failed search is not an empty result", /an error is not an empty result/.test(tab));
check("a failed drill-down is not an empty list", /an error is not an empty list/.test(panel));
check("not searched yet is its own state", /Not searched yet\./.test(tab));
check(
  "nothing matched is its own state",
  /No records match these filters\./.test(tab) && /r\.total === 0/.test(tabCode),
);
check(
  "empty states go through rangeState",
  /rangeStateMessage\(/.test(tabCode) && /serviceDestinationsView\(/.test(panelCode),
);
check(
  "the result line and the notes are rendered",
  /resultLine\(r\)/.test(tabCode) && /searchNotes\(r\)/.test(tabCode),
);

const importers = (re, self) =>
  sources
    .filter(([f, src]) => f !== self && re.test(src))
    .map(([f]) => f)
    .sort();
eq(
  "only the hook imports the Destinations service",
  importers(
    /traffic-flow-destinations\.service/,
    "src/services/traffic-flow-destinations.service.ts",
  ),
  ["src/hooks/useFlowDestinations.ts"],
);
eq(
  "only the two Master components use the hooks (the flow-records hook borrows `sameSearch`)",
  importers(/hooks\/useFlowDestinations/, "src/hooks/useFlowDestinations.ts"),
  [
    "src/components/master/TrafficFlowDestinations.tsx",
    "src/components/master/TrafficFlowServiceDestinations.tsx",
    // Imports the pure `sameSearch` only, and is itself Master-only:
    // scripts/test-traffic-flow-records.mjs pins who may import it.
    "src/hooks/useFlowRecords.ts",
  ],
);
eq(
  "the components are mounted on the Master page only",
  importers(/components\/master\/TrafficFlow(Destinations|ServiceDestinations)"/, ""),
  ["src/components/master/TrafficFlowVenueView.tsx", "src/routes/master.traffic-flow.tsx"],
);
check(
  "the service talks to the platform prefix only",
  /const BASE = "\/platform\/traffic-flow";/.test(service),
);
check(
  "the page has a Destinations tab",
  /\{ value: "destinations", label: "Destinations" \}/.test(page) &&
    /<TrafficFlowDestinations/.test(page),
);
check(
  "the tab reads the page's own range",
  /rangeAt=\{\(at\) => flowRange\(scope, at\)\}/.test(page),
);
check(
  "the venue view uses the shared range control",
  /<TrafficFlowRangeControl scope=\{scope\} onChange=\{set\} \/>/.test(venue) &&
    /<TrafficFlowRangeControl/.test(tab),
);
check(
  "the range control offers the presets and Custom",
  /\{ value: "custom", label: "Custom" \}/.test(rangeControl) &&
    /type="datetime-local"/.test(rangeControl),
);
check(
  "the range control refuses through customRangeFromInputs",
  /customRangeFromInputs\(since, until, Date\.now\(\)\)/.test(rangeControl) &&
    /role="alert"/.test(rangeControl),
);
check(
  "a service row opens its destinations, the all-other row does not",
  /serviceFromKey\(r\.key\) && \(/.test(venue) && /<TrafficFlowServiceDestinations/.test(venue),
);
check(
  "the drill-down reads the range the venue view shows",
  /range=\{flowRange\(scope, at\)\}/.test(venue),
);
check("changing the scope closes the drill-down", /setOpened\(null\);\s*onScope\(/.test(venue));
check(
  "the drill-down is opened from a service, never from a device or a destination row",
  (venue.match(/setOpened\(/g) ?? []).length === 4 && !/d\.ip[\s\S]{0,400}setOpened/.test(venue),
  String((venue.match(/setOpened\(/g) ?? []).length),
);
const uiCode = code(tab + panel + rangeControl);
check("no hard-coded module name in the screens", !/Traffic (Flow|Lens)/.test(uiCode));
check(
  "no screen says Application (except to say a service is not one)",
  !/application/i.test(uiCode.replace(/not an application/g, "")),
);
check("the records column is headed Service (port)", /label: "Service \(port\)"/.test(tab));
check("the search screen says nothing inspects contents", /inspects/.test(tab));
check(
  "no fixture data in the app",
  !/192\.168\.|10\.20\.0\.|142\.250\./.test(
    tab + panel + rangeControl + lib + service + hook + types,
  ),
);

// ---------------------------------------------------------------------------
console.log("\ncustomer dashboard: same rules, the venue's own routes");
const lensCustom = {
  kind: "custom",
  since: "2026-10-11T03:07:00.000Z",
  until: "2026-10-11T09:52:00.000Z",
};
eq("a custom period is used exactly as given", m.lensRangeBounds(lensCustom, NOW), {
  since: lensCustom.since,
  until: lensCustom.until,
  ms: (6 * 60 + 45) * 60000,
});
eq("a preset still ends now", m.lensRangeBounds({ kind: "preset", window: "6h" }, NOW), {
  since: "2026-10-12T08:10:00.000Z",
  until: "2026-10-12T14:10:00.000Z",
  ms: 6 * 3600000,
});
check(
  "an unreadable custom period has no negative length",
  m.lensRangeBounds({ kind: "custom", since: "x", until: "y" }, NOW).ms > 0,
);
eq(
  "the page has an Overview and a Destinations view (and Countries after them)",
  m.LENS_VIEWS.map((v) => v.id),
  ["overview", "destinations", "geo"],
);
calls.length = 0;
nextResponse = { data: search({ min_devices: 5, windows_withheld: 2 }) };
const lensGot = await m.trafficLensDestinationsService.search("l 1", bare.params);
check(
  "the customer search uses the venue path, and the venue is not also a parameter",
  calls[0].url === "/traffic-flow/locations/l%201/destinations" &&
    !("location_id" in calls[0].config.params) &&
    calls[0].config.params.since === RANGE.since &&
    lensGot.windows_withheld === 2,
  JSON.stringify(calls[0]),
);
nextResponse = { data: "blob", headers: { "x-total-rows": "9", "x-export-rows": "9" } };
const lensFile = await m.trafficLensDestinationsService.exportCsv("l1", full.params);
check(
  "the customer download keeps every filter and drops only the venue",
  calls[1].url === "/traffic-flow/locations/l1/destinations/export" &&
    calls[1].config.responseType === "blob" &&
    calls[1].config.params.address === "142.250.0.0/16" &&
    calls[1].config.params.port === "443" &&
    !("location_id" in calls[1].config.params) &&
    lensFile.truncated === false,
);
nextResponse = { data: drill() };
await m.trafficLensDestinationsService.serviceDestinations("l1", {
  location_id: "l1",
  protocol: "6",
  port: "443",
});
check(
  "the customer drill-down uses the venue path",
  calls[2].url === "/traffic-flow/locations/l1/services/destinations" &&
    calls[2].config.params.protocol === "6" &&
    !("location_id" in calls[2].config.params),
);

const CUSTOMER_DESTINATION_FILES = [
  "src/services/traffic-lens-destinations.service.ts",
  "src/hooks/useLensDestinations.ts",
  "src/components/traffic-lens/TrafficLensDestinations.tsx",
  // Shared with the Master console, so held to the customer rules too.
  "src/lib/traffic-flow-destinations.ts",
  "src/types/traffic-flow-destinations.ts",
];
for (const f of CUSTOMER_DESTINATION_FILES) {
  const src = code(read(f));
  const hit = src.match(
    /wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i,
  );
  check(`${f}: no word about how it is gathered`, !hit, hit ? hit[0] : "");
  check(
    `${f}: imports nothing operator-only`,
    !/lib\/traffic-flow"|traffic-flow\.service|traffic-flow-destinations\.service|hooks\/useTrafficFlow|hooks\/useFlowDestinations|components\/master\/|\/platform\//.test(
      src,
    ),
  );
  check(
    `${f}: imports nothing about devices, guests or sessions`,
    !/from "[^"]*(guest|session|device|connected|mac-)[^"]*"/i.test(src),
  );
}
const lensService = read("src/services/traffic-lens-destinations.service.ts");
const lensHook = read("src/hooks/useLensDestinations.ts");
const lensTab = read("src/components/traffic-lens/TrafficLensDestinations.tsx");
// The shell and the Overview (where a service row opens its destinations).
const lensPage =
  read("src/components/traffic-lens/TrafficLensView.tsx") +
  read("src/components/traffic-lens/TrafficLensOverview.tsx");
const lensColumns = read("src/lib/traffic-lens-insights.ts").match(
  /export const LENS_RECORD_COLUMNS[\s\S]*?\n\];/,
)[0];
const lensTabCode = code(lensTab);
check("the customer service only reads", !/api\.(post|put|patch|delete)/.test(lensService));
check(
  "the customer service never sends an organisation or a threshold",
  !/organization|min_devices/.test(code(lensService)),
);
for (const flag of [
  "retry: false",
  "staleTime: Infinity",
  "refetchOnWindowFocus: false",
  "refetchOnReconnect: false",
  "refetchOnMount: false",
])
  check(`customer hooks: ${flag}`, lensHook.includes(flag));
check(
  "both customer queries use those settings and wait to be asked",
  (code(lensHook).match(/\.\.\.ASKED_FOR_ONLY/g) ?? []).length === 2 &&
    (code(lensHook).match(/enabled: !!locationId && params !== null/g) ?? []).length === 2 &&
    !/refetchInterval/.test(lensHook),
);
check(
  "the organisation is in both customer query keys",
  (code(lensHook).match(/resolveActiveOrganizationId\(\), locationId, params\)/g) ?? []).length ===
    2,
);
eq(
  "only the customer hook imports the customer service",
  importers(
    /traffic-lens-destinations\.service/,
    "src/services/traffic-lens-destinations.service.ts",
  ),
  ["src/hooks/useLensDestinations.ts"],
);
eq(
  "only the customer component imports the customer hook",
  importers(/hooks\/useLensDestinations/, "src/hooks/useLensDestinations.ts"),
  ["src/components/traffic-lens/TrafficLensDestinations.tsx"],
);
check("nothing is searched from an effect on the customer screen", !/useEffect/.test(lensTabCode));
check(
  "a customer search starts only from the form's submit or a sort click",
  (lensTabCode.match(/setParams\(/g) ?? []).length === 2 && /onSubmit=\{submit\}/.test(lensTabCode),
  String((lensTabCode.match(/setParams\(/g) ?? []).length),
);
check(
  "the customer form has four filters and none is a device",
  (lensTabCode.match(/field\(\{/g) ?? []).length === 4 &&
    ["address", "protocol", "port", "direction"].every((f) =>
      new RegExp(`field\\(\\{ ${f}`).test(lensTabCode),
    ),
);
// Since the 2026-10-13 owner request the table has the SHAPE of a full
// connection log: Src addr, S.port, S.NAT, D.NAT and Packets keep their place
// as placeholders. What must stay true is that a placeholder has no data
// behind it: no field, no sort, no filter, and a dash in every cell.
const lensPlaceholders = lensColumns.match(/placeholder\(\s*"[^"]+",\s*"[^"]+"/g) ?? [];
check(
  "the customer table has eleven live columns and five placeholders",
  /const COLUMNS = LENS_RECORD_COLUMNS;/.test(lensTabCode) &&
    (lensColumns.match(/\blive\("/g) ?? []).length === 11 &&
    lensPlaceholders.length === 5,
  `${(lensColumns.match(/\blive\("/g) ?? []).length} live, ${lensPlaceholders.length} placeholders`,
);
check(
  "every device, translation and packet column is a placeholder, never a live one",
  !(lensColumns.match(/\blive\("[^"]+", "[^"]+"/g) ?? []).some((c) =>
    /src|source|device|mac|guest|nat|packet|client|session/i.test(c),
  ),
);
check(
  "a placeholder cell is a literal dash, whatever the row holds",
  ["src_addr", "src_port", "src_nat", "dst_nat", "packets"].every((id) =>
    new RegExp(`\\b${id}: DASH,`).test(read("src/lib/traffic-lens-insights.ts")),
  ),
);
check(
  "the customer screens say in words that no device or guest is shown",
  /no\s+record\s+says\s+which\s+device\s+or\s+guest/.test(lensTab) &&
    /does\s+not\s+say\s+which\s+device\s+or\s+guest/.test(lensTab),
);
check(
  "the customer screens say requests are audited",
  (lensTabCode.match(/AUDIT_NOTE/g) ?? []).length >= 3,
);
check(
  "customer empty states go through the shared rules",
  /rangeStateMessage\(rangeState\(r, now\)\)/.test(lensTabCode) &&
    /serviceDestinationsView\(/.test(lensTabCode) &&
    /searchNotes\(r\)/.test(lensTabCode) &&
    /retrievedLine\(r\)/.test(lensTabCode),
);
check(
  "customer failures are not empty results",
  /an\s+error\s+is\s+not\s+an\s+empty\s+result/.test(lensTab) &&
    /an\s+error\s+is\s+not\s+an\s+empty\s+list/.test(lensTab),
);
check(
  "the customer download reports what the file holds",
  /exportMessage\(file\)/.test(lensTabCode),
);
check("no customer screen says Application", !/application/i.test(lensTabCode));
check(
  "the customer records columns are headed Service, D.port and Protocol",
  ['"service", "Service"', '"port", "D.port"', '"protocol", "Protocol"'].every((l) =>
    lensColumns.includes(l),
  ),
);
check(
  "the quick filter box and a chip's removal never set request params themselves",
  /onChange=\{\(e\) => setQuick\(e\.target\.value\)\}/.test(lensTabCode) &&
    !/setQuick[\s\S]{0,80}setParams/.test(lensTabCode) &&
    /if \(e\.key === "Enter"\) e\.preventDefault\(\)/.test(lensTabCode),
);
check(
  "no request parameter is built from a placeholder column",
  !/src_addr|src_port|src_nat|dst_nat|packets/.test(
    code(read("src/lib/traffic-flow-destinations.ts")),
  ) && !/params\.(src|source|nat|packets)/.test(lensTabCode),
);
check(
  "the Destinations view reads the page's one range control",
  /view === "destinations" && recordsMode !== "connections" && \(\s*<TrafficLensDestinations\s+locationId=\{locationId\}\s+rangeAt=\{\(moment\) => lensRangeBounds\(range, moment\)\}/.test(
    lensPage,
  ) && (lensPage.match(/<LensRangeControl/g) ?? []).length === 1,
);
check(
  "the range control offers Custom and refuses through customRangeFromInputs",
  /<TabsTrigger value="custom">Custom<\/TabsTrigger>/.test(lensPage) &&
    /customRangeFromInputs\(since, until, Date\.now\(\)\)/.test(lensPage) &&
    /type="datetime-local"/.test(lensPage),
);
check(
  "a customer service row opens its destinations, the all-other row does not",
  /serviceFromKey\(r\.key\) && \(/.test(lensPage) &&
    /<TrafficLensServiceDestinations/.test(lensPage),
);
check(
  "the customer drill-down closes when the period changes",
  /opened && opened\.period === period \? opened : null/.test(lensPage),
);
check(
  "the customer drill-down is opened from a service row only",
  (lensPage.match(/setOpened\(/g) ?? []).length === 2,
  String((lensPage.match(/setOpened\(/g) ?? []).length),
);
check(
  "no fixture data in the customer files",
  !/192\.168\.|10\.20\.0\.|142\.250\./.test(lensService + lensHook + lensTab),
);

console.log(
  failures === 0
    ? `\nall traffic flow destination checks passed\n`
    : `\n${failures} traffic flow destination check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
