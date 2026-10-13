/**
 * Customer "Traffic Lens" -> Records, for a customer who holds the SECOND
 * add-on (`traffic_flow_records`; API.md F-1c, F-2c): the connection-record
 * table, and how the page chooses between it and the venue-level table.
 * The fixtures below exist ONLY in this file -- the app ships none.
 *
 * This is the one place on the customer dashboard where a device's address
 * sits beside the address it reached. What this pins, worst-first:
 *
 *   1. THE BROWSER NEVER DECIDES THE ENTITLEMENT. The table is chosen from
 *      `/me/entitlements` for the second key, a 402 from the route itself
 *      always wins, "unknown" is never treated as "held", and the first
 *      add-on never implies the second.
 *   2. WITHOUT THE ADD-ON NOTHING CHANGES: the venue-level table, its five
 *      placeholder columns, and one line saying what the add-on is. The
 *      records route is not called.
 *   3. HONEST CELLS: null is "not recorded" with its reason, "not
 *      applicable" only where the value cannot exist, never a blank, a dash
 *      or a guess.
 *   4. THE INCOMPLETE NOTICE AND THE RETENTION come from the API.
 *   5. NOTHING IS FETCHED UNASKED: every search and download is audited.
 *   6. NO PLATFORM EQUIPMENT: the customer table has no thirteenth column,
 *      and no customer file imports a Master flow-record file.
 *
 * Run: node scripts/test-traffic-lens-flow-records.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "traffic-lens-flow-records-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/traffic-lens-flow-records.ts")}";
   export * as shared from "${p("src/lib/flow-records.ts")}";
   export { recordTime } from "${p("src/lib/records-table.ts")}";
   export { trafficLensFlowRecordsService } from "${p("src/services/traffic-lens-flow-records.service.ts")}";
   export { TRAFFIC_LENS_FEATURE_KEY, TRAFFIC_LENS_RECORDS_FEATURE_KEY } from "${p("src/types/traffic-lens.ts")}";
   export { LENS_RECORD_COLUMNS } from "${p("src/lib/traffic-lens-insights.ts")}";
   export { apiCalls, setNext } from "@/services/api";`,
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
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^\.\/api$|^@\/services\/api$/ }, () => ({
          path: "api",
          namespace: "stub",
        }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: `
            export const apiCalls = [];
            let next = { data: {}, headers: {} };
            export const setNext = (r) => { next = r; };
            export const api = {
              get: async (url, config) => { apiCalls.push({ url, config }); return next; },
            };
            export default api;
            export const requestErrorOf = () => null;`,
          loader: "js",
        }));
      },
    },
  ],
});
const m = await import(bundle);
const TZ = "Asia/Kolkata";

const flow = (over = {}) => ({
  start: "2026-10-13T09:25:45+00:00",
  end: "2026-10-13T09:26:10+00:00",
  arrived_at: "2026-10-13T09:26:11+00:00",
  window_start: "2026-10-13T09:25:00+00:00",
  window_end: "2026-10-13T09:30:00+00:00",
  src_address: "192.168.88.24",
  src_port: 51544,
  dst_address: "203.0.113.14",
  dst_port: 443,
  protocol: 6,
  protocol_name: "tcp",
  nat_src_address: "198.51.100.9",
  nat_src_port: 40001,
  nat_dst_address: "203.0.113.14",
  nat_dst_port: 443,
  bytes: 33440,
  packets: 546,
  application: "https (TCP/443)",
  direction: "upload",
  router_id: "r1",
  ...over,
});
const page = (over = {}) => ({
  location_id: "l1",
  router_id: null,
  since: "2026-10-13T08:40:00+00:00",
  until: "2026-10-13T09:40:00+00:00",
  window_seconds: 300,
  retention_days: 7,
  daily_cap: 100000,
  data_oldest: "2026-10-12T09:40:00+00:00",
  data_newest: "2026-10-13T09:35:00+00:00",
  incomplete: false,
  incomplete_message: null,
  incomplete_stretches: [],
  fields_not_recorded: [],
  row_meaning: "One row is one flow record as the router exported it, in one direction.",
  filters: {},
  sort: "start",
  order: "desc",
  limit: 1000,
  total: 1,
  returned: 1,
  truncated: false,
  query_ms: 38,
  totals: { bytes: 33440, packets: 546 },
  rows: [flow()],
  ...over,
});

// ---------------------------------------------------------------------------
console.log("\n1. which table: decided by what the backend reports");
eq("the second add-on has its own key", m.TRAFFIC_LENS_RECORDS_FEATURE_KEY, "traffic_flow_records");
check(
  "it is not the first add-on's key",
  m.TRAFFIC_LENS_RECORDS_FEATURE_KEY !== m.TRAFFIC_LENS_FEATURE_KEY,
);
eq("entitlements say held: the connection table", m.lensRecordsMode(true), "connections");
eq("entitlements say not held: venue-level, locked line", m.lensRecordsMode(false), "venue_locked");
eq("not known yet: venue-level, and no claim", m.lensRecordsMode(null), "venue");
eq(
  "the route's own refusal wins over an entitlement list that said held",
  m.lensRecordsMode(true, true),
  "venue_locked",
);
eq("a refusal while unknown is locked too", m.lensRecordsMode(null, true), "venue_locked");
check(
  "nothing but true ever opens the connection table",
  [undefined, null, false, 0, "", "true", 1].every(
    (v) => v === true || m.lensRecordsMode(v) !== "connections",
  ),
);
check(
  "the locked line names the add-on, says it is separate and not enabled, in one sentence pair",
  /separate add-on/.test(m.LENS_RECORDS_LOCKED_LINE) &&
    m.LENS_RECORDS_LOCKED_LINE.includes(m.LENS_RECORDS_ADDON_NAME) &&
    /not enabled for your organisation/.test(m.LENS_RECORDS_LOCKED_LINE) &&
    /venue as a whole/.test(m.LENS_RECORDS_LOCKED_LINE),
);

// ---------------------------------------------------------------------------
console.log("\n2. the entitled table: twelve real columns, reference order");
eq(
  "the default columns",
  m.LENS_FLOW_DEFAULT_COLUMNS.map((id) => m.LENS_FLOW_COLUMNS.find((c) => c.id === id).label),
  [
    "Start",
    "End",
    "Src addr",
    "S.port",
    "Dst addr",
    "D.port",
    "Protocol",
    "S.NAT",
    "D.NAT",
    "Bytes",
    "Packets",
    "Service",
  ],
);
check(
  "none of them is a placeholder",
  m.LENS_FLOW_COLUMNS.every((c) => c.notRecorded === null),
);
check(
  "there is no thirteenth column: nothing of the platform's equipment",
  !m.LENS_FLOW_COLUMNS.some((c) => /export|router|equipment/i.test(`${c.id} ${c.label}`)),
);
eq(
  "three more start hidden",
  m.LENS_FLOW_COLUMNS.filter((c) => !c.initial).map((c) => c.label),
  ["Direction", "Arrived", "Window"],
);
check(
  "no heading says Application",
  !m.LENS_FLOW_COLUMNS.some((c) => /application|app\b/i.test(c.label)),
);
eq(
  "every sortable heading asks for a sort the API accepts",
  m.LENS_FLOW_COLUMNS.filter((c) => c.sort).map((c) => c.sort),
  [
    "start",
    "end",
    "src_address",
    "src_port",
    "dst_address",
    "dst_port",
    "protocol",
    "bytes",
    "packets",
  ],
);
{
  const D = m.LENS_FLOW_DEFAULT_COLUMNS;
  eq("a column can be switched on", m.toggleLensFlowColumn(D, "direction"), [...D, "direction"]);
  eq(
    "Start and both addresses cannot be hidden",
    [
      m.toggleLensFlowColumn(D, "start").length,
      m.toggleLensFlowColumn(D, "src_address").length,
      m.toggleLensFlowColumn(D, "dst_address").length,
    ],
    [12, 12, 12],
  );
}

// ---------------------------------------------------------------------------
console.log("\n3. honest cells");
{
  const row = m.lensFlowRow(flow(), 0, TZ);
  eq("a full record has nothing missing", row.missing, []);
  eq(
    "Start and End to the second, in the venue's time",
    [row.cells.start, row.cells.end],
    ["2026-10-13 14:55:45", "2026-10-13 14:56:10"],
  );
  eq(
    "source and destination as sent",
    [row.cells.src_address, row.cells.src_port, row.cells.dst_address, row.cells.dst_port],
    ["192.168.88.24", "51544", "203.0.113.14", "443"],
  );
  eq(
    "translations as address:port",
    [row.cells.nat_src, row.cells.nat_dst],
    ["198.51.100.9:40001", "203.0.113.14:443"],
  );
  eq(
    "bytes with a unit, packets, service",
    [row.cells.bytes, row.cells.packets, row.cells.service],
    ["33.4 KB", (546).toLocaleString(), "https (TCP/443)"],
  );
  check(
    "no cell is keyed for a column the customer does not have",
    !("router" in row.cells) && !("exporter" in row.cells),
  );
}
{
  const row = m.lensFlowRow(
    flow({
      start: null,
      end: null,
      nat_src_address: null,
      nat_src_port: null,
      nat_dst_address: null,
      nat_dst_port: null,
    }),
    0,
    TZ,
  );
  eq("a record without times or translations lists them as missing", row.missing, [
    "start",
    "end",
    "nat_src",
    "nat_dst",
  ]);
  check(
    "each reads 'not recorded' with the reason, never blank, never a dash",
    row.missing.every(
      (id) => row.cells[id] === "not recorded" && row.reasons[id] === m.shared.NOT_RECORDED_REASON,
    ) && /not zero and not none/.test(m.shared.NOT_RECORDED_REASON),
  );
  check(
    "no cell is empty, a dash or a zero",
    Object.values(row.cells).every((v) => v !== "" && v !== "—" && v !== "0"),
  );
}
{
  const v6 = m.lensFlowRow(
    flow({
      src_address: "2001:db8::24",
      dst_address: "2001:db8:1::e",
      nat_src_address: null,
      nat_src_port: null,
      nat_dst_address: null,
      nat_dst_port: null,
    }),
    0,
    TZ,
  );
  check(
    "NAT on an IPv6 record: 'not recorded', with what is known about why, and not asserted absent",
    v6.cells.nat_src === "not recorded" &&
      v6.reasons.nat_src === m.shared.NAT_V6_REASON &&
      /normally not translated/.test(m.shared.NAT_V6_REASON) &&
      /may be nothing to record/.test(m.shared.NAT_V6_REASON),
  );
  const icmp = m.lensFlowRow(
    flow({ protocol: 1, protocol_name: "icmp", src_port: null, dst_port: null, application: null }),
    0,
    TZ,
  );
  eq(
    "a protocol without ports: its ports are 'not applicable'",
    [icmp.cells.src_port, icmp.cells.dst_port, icmp.reasons.src_port],
    ["not applicable", "not applicable", m.shared.NO_PORTS_REASON],
  );
  eq(
    "and its missing service is 'not recorded', not 'not applicable'",
    icmp.cells.service,
    "not recorded",
  );
  const tcp = m.lensFlowRow(flow({ src_port: null }), 0, TZ);
  eq(
    "a missing port on TCP is 'not recorded': nothing is assumed",
    tcp.cells.src_port,
    "not recorded",
  );
  const zero = m.lensFlowRow(flow({ bytes: 0, packets: 0 }), 0, TZ);
  check(
    "a real zero is a value",
    zero.cells.bytes === "0 B" && zero.cells.packets === "0" && zero.missing.length === 0,
  );
}
{
  const cols = m.lensFlowColumns(
    page({ fields_not_recorded: ["start", "end", "nat_src_address", "nat_dst_address"] }),
  );
  eq(
    "a field null in every row greys its column, in place",
    cols.filter((c) => c.notRecorded !== null).map((c) => c.label),
    ["Start", "End", "S.NAT", "D.NAT"],
  );
  eq(
    "order unchanged",
    cols.map((c) => c.id),
    m.LENS_FLOW_COLUMNS.map((c) => c.id),
  );
}

// ---------------------------------------------------------------------------
console.log("\n4. states, the incomplete notice, retention");
eq("rows", m.lensFlowState(page()).kind, "rows");
{
  const none = m.lensFlowState(page({ total: 0, rows: [], data_oldest: null }), TZ);
  check(
    "add-on held but nothing stored: says storing is switched on separately, and not 'no traffic'",
    none.kind === "nothing_held" &&
      /switched on separately by Wyfy support/.test(none.body) &&
      /not the same as no traffic/.test(none.body),
  );
  const noMatch = m.lensFlowState(page({ total: 0, rows: [] }), TZ);
  check(
    "held but nothing matched says from when",
    noMatch.kind === "no_match" && noMatch.body.includes("2026-10-12 15:10:00"),
    noMatch.body,
  );
  check("the two are different titles", none.title !== noMatch.title);
}
eq("no flag, no notice", m.shared.incompleteNotice(page(), "the Overview", TZ), null);
{
  const n = m.shared.incompleteNotice(
    page({
      incomplete: true,
      incomplete_stretches: [
        {
          router_id: "r1",
          since: "2026-10-13T09:30:00+00:00",
          until: "2026-10-14T00:00:00+00:00",
          records_not_stored: 4200,
        },
      ],
    }),
    "the Overview",
    TZ,
  );
  eq(
    "records incomplete since, in the venue's time",
    n.title,
    "Records incomplete since 2026-10-13 15:00:00.",
  );
  check(
    "how many were not stored, and that the Overview's totals are not affected",
    n.body.includes(`${(4200).toLocaleString()} records`) &&
      /Totals for the period are in the Overview, which is not affected/.test(n.body),
    n.body,
  );
}
eq("retention from the API", m.shared.retentionNote(7), "Kept for 7 days");
eq("one day", m.shared.retentionNote(1), "Kept for 1 day");
eq(
  "not reported: nothing is claimed",
  [m.shared.retentionNote(null), m.shared.retentionNote(undefined), m.shared.retentionNote(0)],
  [null, null, null],
);
{
  const notes = m.lensFlowNotes(
    page({ truncated: true, returned: 1000 }),
    "the venue's time (Asia/Kolkata)",
  );
  check(
    "a capped page says so; the note explains greyed cells and names the clock",
    /Only the first/.test(notes[0]) &&
      /not zero and not none/.test(notes[1]) &&
      /Asia\/Kolkata/.test(notes[1]),
  );
  check(
    "the server's operator sentence about a row is never printed to a customer",
    !notes.join(" ").includes("as the router exported it"),
  );
}

// ---------------------------------------------------------------------------
console.log("\n5. the request and the service");
{
  const built = m.shared.flowFilterParams(
    { since: "a", until: "b" },
    { ...m.shared.EMPTY_FLOW_RECORD_FILTERS, src_address: "192.168.88.24", dst_port: "443" },
    m.shared.DEFAULT_FLOW_RECORD_SORT,
  );
  eq("range, sort and filters only: the venue is the path's", built.params, {
    since: "a",
    until: "b",
    sort: "start",
    order: "desc",
    src_address: "192.168.88.24",
    dst_port: "443",
  });
  check(
    "no organisation, venue, guest or threshold is ever a parameter",
    !Object.keys(built.params).some((k) =>
      /organi[sz]ation|location|guest|mac|session|min_devices/i.test(k),
    ),
  );
  m.apiCalls.length = 0;
  m.setNext({ data: page(), headers: {} });
  await m.trafficLensFlowRecordsService.search("l 1", built.params);
  m.setNext({
    data: "blob",
    headers: {
      "x-total-rows": "5",
      "x-export-rows": "5",
      "x-records-incomplete-since": "2026-10-13T09:30:00+00:00",
    },
  });
  const file = await m.trafficLensFlowRecordsService.exportCsv("l 1", built.params);
  eq(
    "the two customer routes, venue in the path, encoded",
    m.apiCalls.map((c) => c.url),
    ["/traffic-flow/locations/l%201/flows", "/traffic-flow/locations/l%201/flows/export"],
  );
  eq(
    "the download reads the incomplete header",
    [file.truncated, file.incompleteSince],
    [false, "2026-10-13T09:30:00+00:00"],
  );
  check(
    "a download from an incomplete period is a warning",
    m.shared.flowExportMessage(file).tone === "warning",
  );
}

// ---------------------------------------------------------------------------
console.log("\n6. wiring: the backend decides, nothing unasked, no platform equipment");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(f);
  }
  return out;
}
const sources = walk(join(ROOT, "src")).map((f) => [relative(ROOT, f), readFileSync(f, "utf8")]);
const importers = (re, self) =>
  sources
    .filter(([f, src]) => f !== self && re.test(src))
    .map(([f]) => f)
    .sort();
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const service = read("src/services/traffic-lens-flow-records.service.ts");
const hook = read("src/hooks/useLensFlowRecords.ts");
const view = read("src/components/traffic-lens/TrafficLensFlowRecords.tsx");
const viewCode = code(view);
const shell = read("src/components/traffic-lens/TrafficLensView.tsx");
const venueTable = read("src/components/traffic-lens/TrafficLensDestinations.tsx");
const rules = read("src/lib/traffic-lens-flow-records.ts");
const CUSTOMER_FLOW_FILES = [
  "src/services/traffic-lens-flow-records.service.ts",
  "src/hooks/useLensFlowRecords.ts",
  "src/components/traffic-lens/TrafficLensFlowRecords.tsx",
  "src/lib/traffic-lens-flow-records.ts",
  "src/lib/flow-records.ts",
  "src/types/flow-records.ts",
];
for (const f of CUSTOMER_FLOW_FILES) {
  const src = code(read(f));
  const hit = src.match(
    /wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i,
  );
  check(`${f}: no word about how it is gathered`, !hit, hit ? hit[0] : "");
  check(
    `${f}: imports nothing operator-only`,
    !/lib\/traffic-flow"|lib\/traffic-flow-records|types\/traffic-flow-records|traffic-flow-records\.service|hooks\/useFlowRecords|components\/master\/|\/platform\//.test(
      src,
    ),
  );
}
check(
  "the shell reads the second key from /me/entitlements and passes it through the tested rule",
  /lensRecordsMode\(useFeatureEntitled\(TRAFFIC_LENS_RECORDS_FEATURE_KEY\)\)/.test(shell),
);
check(
  "the connection table mounts only in 'connections' mode; otherwise the venue-level table",
  /view === "destinations" && recordsMode === "connections" && \(\s*<TrafficLensFlowRecords/.test(
    shell,
  ) &&
    /view === "destinations" && recordsMode !== "connections" && \(\s*<TrafficLensDestinations/.test(
      shell,
    ) &&
    /locked=\{recordsMode === "venue_locked"\}/.test(shell),
);
check(
  "the first add-on's entitlement is never used to pick the table",
  !/recordsMode[^\n]*TRAFFIC_LENS_FEATURE_KEY\b/.test(shell) &&
    (shell.match(/lensRecordsMode\(/g) ?? []).length === 1,
);
check(
  "a 402 from the route itself swaps in the venue-level table, locked",
  /lensRecordsMode\(true, refusal === "locked"\) === "venue_locked"/.test(viewCode) &&
    /<TrafficLensDestinations[^>]*\blocked\b/.test(viewCode.replace(/\n\s*/g, " ")),
);
check(
  "the locked line is one line, shown only when the backend said not held",
  /\{locked && \(/.test(venueTable) &&
    (venueTable.match(/LENS_RECORDS_LOCKED_LINE\}/g) ?? []).length === 1,
);
check(
  "the venue-level table still has its five placeholders, and never calls the records route",
  m.LENS_RECORD_COLUMNS.filter((c) => c.notRecorded !== null)
    .map((c) => c.id)
    .join() === "src_addr,src_port,src_nat,dst_nat,packets" &&
    !/useLensFlowRecord|\/flows/.test(code(venueTable)),
);
eq(
  "only the customer hook imports the customer service",
  importers(
    /traffic-lens-flow-records\.service/,
    "src/services/traffic-lens-flow-records.service.ts",
  ),
  ["src/hooks/useLensFlowRecords.ts"],
);
eq(
  "only the connection table imports the hook",
  importers(/hooks\/useLensFlowRecords/, "src/hooks/useLensFlowRecords.ts"),
  ["src/components/traffic-lens/TrafficLensFlowRecords.tsx"],
);
eq(
  "only the page shell mounts the connection table",
  importers(/components\/traffic-lens\/TrafficLensFlowRecords"/, ""),
  ["src/components/traffic-lens/TrafficLensView.tsx"],
);
check("the service only reads", !/api\.(post|put|patch|delete)/.test(service));
check(
  "the service sends no organisation and takes the venue in the path",
  !/organization|location_id/.test(code(service)) &&
    /`\/traffic-flow\/locations\/\$\{encodeURIComponent\(locationId\)\}\/flows`/.test(service),
);
for (const flag of [
  "retry: false",
  "staleTime: Infinity",
  "refetchOnWindowFocus: false",
  "refetchOnReconnect: false",
  "refetchOnMount: false",
])
  check(`hook: ${flag}`, hook.includes(flag));
check(
  "the search waits to be asked, never polls, and is keyed by organisation and venue",
  /enabled: !!locationId && params !== null/.test(code(hook)) &&
    !/refetchInterval/.test(hook) &&
    /resolveActiveOrganizationId\(\), locationId, params\)/.test(code(hook)),
);
check("nothing is searched from an effect", !/useEffect/.test(viewCode));
check(
  "a search starts only from Search, a chip's removal or a sort click",
  (viewCode.match(/setParams\(/g) ?? []).length === 2 && /onSubmit=\{submit\}/.test(viewCode),
  String((viewCode.match(/setParams\(/g) ?? []).length),
);
check(
  "the filter box only narrows what is loaded",
  /onChange=\{\(e\) => setQuick\(e\.target\.value\)\}/.test(viewCode) &&
    /if \(e\.key === "Enter"\) e\.preventDefault\(\)/.test(viewCode),
);
check(
  "the incomplete notice sits above every result branch",
  /\{incomplete && \(/.test(view) &&
    view.indexOf("{incomplete && (") < view.indexOf("{params === null ? ("),
);
check(
  "retention is shown by the period control, from the API",
  /retentionNote\(status\.data\?\.retention_days\)/.test(shell) &&
    /retentionNote\(r\?\.retention_days\)/.test(viewCode),
);
check(
  "rows, columns and states go through the tested rules; the table is the shared one",
  [
    "lensFlowColumns(r)",
    "lensFlowRow(row, i, timeZone)",
    "lensFlowState(r, timeZone)",
    'incompleteNotice(r, "the Overview", timeZone)',
    "retrievedLine(r)",
    "flowExportMessage(file)",
  ].every((call) => viewCode.includes(call)) && /<RecordsTable/.test(viewCode),
);
check(
  "the customer table has no per-row action and no thirteenth column",
  !/rowAction/.test(viewCode) && !/exporter/i.test(view + rules),
);
check("the screen says searches are audited", /\{AUDIT_NOTE\}/.test(view));
check("no screen says Application", !/application/i.test(viewCode));
check(
  "a failed search is not an empty result",
  /an\s+error\s+is\s+not\s+an\s+empty\s+result/.test(view),
);
check(
  "no fixture data in the customer flow-record files",
  !/192\.168\.|10\.20\.0\.|142\.250\.|198\.51\.100\./.test(
    service +
      hook +
      view +
      rules +
      read("src/lib/flow-records.ts").replace(
        /203\.0\.113\.7 or 203\.0\.113\.0\/24|203\.0\.114\.9:40001/g,
        "",
      ),
  ),
);

console.log(
  failures === 0
    ? `\nall traffic lens flow record checks passed\n`
    : `\n${failures} traffic lens flow record check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
