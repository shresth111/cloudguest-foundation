/**
 * Master "Traffic Lens" -> Flows: the flow table (API.md F-1, F-2), and the
 * one table component both consoles draw. The fixtures below exist ONLY in
 * this file -- the app ships no fixture data.
 *
 * What this pins, worst-first:
 *
 *   1. MASTER ONLY. A flow record places a device's address beside the
 *      address it reached. Only the Master hook may import the service,
 *      only the Master component the hook, only the Master page the
 *      component; no customer file imports any of it, and the customer
 *      table's device columns are still placeholders.
 *   2. NULL IS "NOT RECORDED": never zero, never blank, never a dash. A
 *      field null in every returned row greys its whole column.
 *   3. AN INCOMPLETE RANGE IS SAID whenever the API sets `incomplete`, and
 *      never when it does not.
 *   4. NOTHING IS FETCHED UNASKED: every search and download is audited.
 *   5. ONE TABLE COMPONENT, two column sets. The shared component and its
 *      helper module say nothing about how records are gathered, because
 *      the customer dashboard imports them.
 *
 * Bundles the real modules with esbuild and executes them.
 *
 * Run: node scripts/test-traffic-flow-records.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "traffic-flow-records-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/traffic-flow-records.ts")}";
   export { recordTime, retrievedLine, filterLoadedRecords } from "${p("src/lib/records-table.ts")}";
   export { trafficFlowRecordsService } from "${p("src/services/traffic-flow-records.service.ts")}";
   export { apiCalls, setNext } from "@/services/api";
   export { LENS_RECORD_COLUMNS } from "${p("src/lib/traffic-lens-insights.ts")}";`,
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

// ---------------------------------------------------------------------------
// Fixtures (API.md's own example)
// ---------------------------------------------------------------------------
const flow = (over = {}) => ({
  start: "2026-10-13T09:25:45+00:00",
  end: "2026-10-13T09:26:10+00:00",
  arrived_at: "2026-10-13T09:26:11+00:00",
  window_start: "2026-10-13T09:25:00+00:00",
  window_end: "2026-10-13T09:30:00+00:00",
  src_address: "192.168.88.24",
  src_port: 51544,
  dst_address: "142.250.193.14",
  dst_port: 443,
  protocol: 6,
  protocol_name: "tcp",
  nat_src_address: "203.0.114.9",
  nat_src_port: 40001,
  nat_dst_address: "142.250.193.14",
  nat_dst_port: 443,
  bytes: 33440,
  packets: 546,
  application: "https (TCP/443)",
  direction: "upload",
  exporter: "10.20.0.31",
  router_id: "r1",
  records_merged: 1,
  ports_merged: false,
  ...over,
});
const result = (over = {}) => ({
  feature_enabled: true,
  records_enabled: true,
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
  fields_not_recorded: ["exporter_port"],
  row_meaning: "One row is one flow record as the router exported it, in one direction.",
  filters: {},
  sort: "start",
  order: "desc",
  limit: 1000,
  total: 1834,
  returned: 1000,
  truncated: true,
  query_ms: 38,
  totals: { bytes: 61323264, packets: 51200 },
  rows: [flow()],
  ...over,
});
const SCOPE = { locationId: "l1", routerId: "" };
const RANGE = { since: "2026-10-13T08:40:00.000Z", until: "2026-10-13T09:40:00.000Z" };
const SORT = m.DEFAULT_FLOW_RECORD_SORT;
const FORM = m.EMPTY_FLOW_RECORD_FILTERS;

// ---------------------------------------------------------------------------
console.log("\n1. the columns are the reference table's, in its order");
eq(
  "the reference thirteen, then Records (on for this console)",
  m.FLOW_RECORD_DEFAULT_COLUMNS.map((id) => m.FLOW_RECORD_COLUMNS.find((c) => c.id === id).label),
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
    "Export",
    "Records",
  ],
);
eq(
  "four more columns the API returns start hidden",
  m.FLOW_RECORD_COLUMNS.filter((c) => !c.initial).map((c) => c.label),
  ["Direction", "Arrived", "Window", "Router"],
);
eq(
  "every sortable heading asks for a sort the API accepts, and all nine are offered",
  m.FLOW_RECORD_COLUMNS.filter((c) => c.sort).map((c) => c.sort),
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
check(
  "no heading says Application: the value is a port label",
  !m.FLOW_RECORD_COLUMNS.some((c) => /application|app\b/i.test(c.label)),
);
check(
  "every column is drawn from a field the API returns",
  m.FLOW_RECORD_COLUMNS.every((c) =>
    m.FLOW_COLUMN_FIELDS[c.id].every((f) => Object.prototype.hasOwnProperty.call(flow(), f)),
  ),
);
check(
  "with every field recorded, no column is greyed",
  m.flowRecordColumns(result()).every((c) => c.notRecorded === null),
);
{
  const cols = m.flowRecordColumns(
    result({ fields_not_recorded: ["start", "end", "nat_src_address", "nat_dst_address"] }),
  );
  eq(
    "a field null in every row greys its column, in place",
    cols.filter((c) => c.notRecorded !== null).map((c) => c.label),
    ["Start", "End", "S.NAT", "D.NAT"],
  );
  eq(
    "the order does not change",
    cols.map((c) => c.id),
    m.FLOW_RECORD_COLUMNS.map((c) => c.id),
  );
  check(
    "the reason says it is not the same as none",
    cols.find((c) => c.id === "nat_src").notRecorded === m.FLOW_COLUMN_NOT_RECORDED &&
      /not the same as none/.test(m.FLOW_COLUMN_NOT_RECORDED),
  );
}
check(
  "a field name the screen does not know changes nothing",
  m
    .flowRecordColumns(result({ fields_not_recorded: ["exporter_port", "something_new"] }))
    .every((c) => c.notRecorded === null),
);
check("no result yet: the plain columns", m.flowRecordColumns(null).length === 18);
{
  const D = m.FLOW_RECORD_DEFAULT_COLUMNS;
  eq(
    "a column can be switched on, in the table's order",
    m.toggleFlowRecordColumn(D, "direction"),
    [...D, "direction"],
  );
  eq(
    "and off",
    m.toggleFlowRecordColumn(D, "packets"),
    D.filter((x) => x !== "packets"),
  );
  eq("Start cannot be hidden", m.toggleFlowRecordColumn(D, "start"), D);
  eq(
    "neither address can be hidden",
    m.toggleFlowRecordColumn(m.toggleFlowRecordColumn(D, "src_address"), "dst_address"),
    D,
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. a row: values as sent, null as 'not recorded'");
{
  const row = m.flowRecordRow(flow(), 0, new Map([["r1", "Hall Router"]]));
  eq("a full row has nothing missing", row.missing, []);
  check(
    "Start and End are to the second",
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.cells.start) &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.cells.end) &&
      row.cells.start.endsWith(":45") &&
      row.cells.end.endsWith(":10"),
    `${row.cells.start} / ${row.cells.end}`,
  );
  eq(
    "addresses and ports as sent",
    [row.cells.src_address, row.cells.src_port, row.cells.dst_address, row.cells.dst_port],
    ["192.168.88.24", "51544", "142.250.193.14", "443"],
  );
  eq(
    "a translation that differs is shown; one that only repeats the address is 'same'",
    [row.cells.nat_src, row.cells.nat_dst, row.muted],
    ["203.0.114.9:40001", "same", ["nat_dst"]],
  );
  check("and says what it is the same as", /same as Dst addr/.test(row.reasons.nat_dst));
  eq("Records is how many records the row sums", row.cells.records, "1");
  eq(
    "protocol, bytes with a unit, packets",
    [row.cells.protocol, row.cells.bytes, row.cells.packets],
    ["TCP", "33.4 KB", (546).toLocaleString()],
  );
  eq("Service is the API's port label, untouched", row.cells.service, "https (TCP/443)");
  eq("Export is the exporter as sent", row.cells.exporter, "10.20.0.31");
  eq("the router is named when known", row.cells.router, "Hall Router");
  eq("direction is capitalised, not reinterpreted", row.cells.direction, "Upload");
}
{
  // The interim shape API.md describes: 5-minute totals, no times, no NAT.
  const row = m.flowRecordRow(
    flow({
      start: null,
      end: null,
      nat_src_address: null,
      nat_src_port: null,
      nat_dst_address: null,
      nat_dst_port: null,
      packets: null,
      application: null,
    }),
    3,
  );
  eq("nulls are listed as missing", row.missing, [
    "start",
    "end",
    "nat_src",
    "nat_dst",
    "packets",
    "service",
  ]);
  check(
    "each reads 'not recorded': not a dash, not zero, not blank",
    row.missing.every((id) => row.cells[id] === "not recorded") &&
      m.NOT_RECORDED_CELL === "not recorded",
  );
  check(
    "no cell of any row is empty or a bare dash",
    Object.values(row.cells).every((v) => v !== "" && v !== "—" && v !== "0"),
  );
  eq("an unnamed router shows its id", row.cells.router, "r1");
}
{
  const zero = m.flowRecordRow(flow({ bytes: 0, packets: 0, src_port: 0 }), 0);
  eq(
    "a real zero is a value, not 'not recorded'",
    [zero.cells.bytes, zero.cells.packets, zero.cells.src_port],
    ["0 B", "0", "0"],
  );
  check("and is not listed as missing", zero.missing.length === 0);
}
{
  const up = m.flowRecordRow(
    flow({
      src_port: null,
      nat_src_port: null,
      ports_merged: true,
      records_merged: 40,
      direction: "upload",
    }),
    0,
  );
  eq(
    "merged ports on an upload: the venue side is the source, and reads 'several'",
    [up.cells.src_port, up.cells.dst_port, up.missing.includes("src_port")],
    ["several", "443", false],
  );
  check(
    "the reason says how many records the row sums",
    up.reasons.src_port.includes(`${(40).toLocaleString()} records`) &&
      /different ports on the venue side/.test(up.reasons.src_port),
    up.reasons.src_port,
  );
  eq("and Records shows it", up.cells.records, "40");
  const down = m.flowRecordRow(
    flow({
      src_address: "142.250.193.14",
      src_port: 443,
      dst_address: "192.168.88.24",
      dst_port: null,
      ports_merged: true,
      records_merged: 7,
      direction: "download",
    }),
    0,
  );
  eq(
    "on a download the venue side is the destination",
    [down.cells.dst_port, down.cells.src_port],
    ["several", "443"],
  );
  const outside = m.flowRecordRow(
    flow({ dst_port: null, ports_merged: true, records_merged: 3, direction: "upload" }),
    0,
  );
  eq(
    "the outside port is never merged: a null there is still 'not recorded'",
    outside.cells.dst_port,
    "not recorded",
  );
  eq(
    "a null port without ports_merged is 'not recorded', not 'several'",
    m.flowRecordRow(flow({ src_port: null, ports_merged: false }), 0).cells.src_port,
    "not recorded",
  );
  const instant = m.flowRecordRow(flow({ end: flow().start }), 0);
  check(
    "an end in the same second as the start is shown once",
    instant.cells.end === "same" &&
      instant.muted.includes("end") &&
      /same second/.test(instant.reasons.end) &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:45$/.test(instant.cells.start),
  );
  check("a different end is shown in full", m.flowRecordRow(flow(), 0).cells.end.endsWith(":10"));
  const untranslated = m.flowRecordRow(
    flow({ nat_src_address: "192.168.88.24", nat_src_port: 51544 }),
    0,
  );
  eq("S.NAT equal to Src addr is 'same'", untranslated.cells.nat_src, "same");
  eq(
    "the same address on another port is a translation, and is shown",
    m.flowRecordRow(flow({ nat_src_address: "192.168.88.24", nat_src_port: 40001 }), 0).cells
      .nat_src,
    "192.168.88.24:40001",
  );
  eq(
    "Records with no count is 'not recorded'",
    m.flowRecordRow(flow({ records_merged: null }), 0).cells.records,
    "not recorded",
  );
}
eq("NAT with no port is the address alone", m.endpointLabel("203.0.114.9", null), "203.0.114.9");
eq("an IPv6 endpoint is bracketed", m.endpointLabel("2001:db8::1", 443), "[2001:db8::1]:443");
eq("no address, no endpoint (a port alone is not shown)", m.endpointLabel(null, 443), null);
eq(
  "a protocol with no name is its number",
  m.flowRecordRow(flow({ protocol: 47, protocol_name: "other" }), 0).cells.protocol,
  "Protocol 47",
);
eq(
  "a protocol that was not recorded says so",
  m.flowRecordRow(flow({ protocol: null, protocol_name: null }), 0).cells.protocol,
  "not recorded",
);
check(
  "two identical records on one page still get different keys",
  m.flowRecordRow(flow(), 0).key !== m.flowRecordRow(flow(), 1).key,
);

// ---------------------------------------------------------------------------
console.log("\n3. the request");
{
  const built = m.flowRecordParams(SCOPE, RANGE, FORM, SORT);
  eq("no filter: scope, range and sort only", built.ok && Object.keys(built.params).sort(), [
    "location_id",
    "order",
    "since",
    "sort",
    "until",
  ]);
  eq(
    "a router alone is a scope",
    m.flowRecordParams({ locationId: "", routerId: "r1" }, RANGE, FORM, SORT).params.router_id,
    "r1",
  );
  const none = m.flowRecordParams({ locationId: "", routerId: "" }, RANGE, FORM, SORT);
  check("no venue and no router is refused before any request", !none.ok && none.field === "scope");
  const all = m.flowRecordParams(
    SCOPE,
    RANGE,
    {
      address: " 10.0.0.0/8 ",
      src_address: "192.168.88.24",
      dst_address: "2001:db8::1",
      port: "53",
      src_port: "0",
      dst_port: "443",
      protocol: "17",
    },
    { key: "bytes", order: "asc" },
  );
  const byKey = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  eq(
    "every filter is sent under the API's own name, trimmed",
    byKey(all.params),
    byKey({
      since: RANGE.since,
      until: RANGE.until,
      sort: "bytes",
      order: "asc",
      location_id: "l1",
      address: "10.0.0.0/8",
      src_address: "192.168.88.24",
      dst_address: "2001:db8::1",
      port: "53",
      src_port: "0",
      dst_port: "443",
      protocol: "17",
    }),
  );
  check(
    "an empty port is no filter, never port 0",
    !("port" in built.params) && !("src_port" in built.params),
  );
  for (const [name, patch, bad] of [
    ["a word as an address", { address: "example" }, "address"],
    ["a port above 65535", { dst_port: "70000" }, "dst_port"],
    ["a protocol above 255", { protocol: "300" }, "protocol"],
    ["a bare number as an address", { src_address: "12345" }, "src_address"],
  ]) {
    const r = m.flowRecordParams(SCOPE, RANGE, { ...FORM, ...patch }, SORT);
    check(`refused: ${name}`, !r.ok && r.field === bad, JSON.stringify(r));
  }
  check(
    "no request parameter names a guest, a MAC or a session",
    !Object.keys(all.params).some((k) => /guest|mac|session|phone|name/i.test(k)),
  );
}
eq("the same column flips", m.nextFlowRecordSort(SORT, "start"), { key: "start", order: "asc" });
eq("bytes starts largest first", m.nextFlowRecordSort(SORT, "bytes"), {
  key: "bytes",
  order: "desc",
});
eq("an address starts ascending", m.nextFlowRecordSort(SORT, "src_address"), {
  key: "src_address",
  order: "asc",
});
eq("chips: none before a search", m.flowRecordChips(null), []);
eq(
  "chips: one per filter in force, never for scope, range or sort",
  m.flowRecordChips({
    location_id: "l1",
    since: "a",
    until: "b",
    sort: "start",
    order: "desc",
    src_address: "192.168.88.24",
    dst_port: "443",
    protocol: "6",
  }),
  [
    { field: "src_address", label: "Src addr 192.168.88.24" },
    { field: "dst_port", label: "D.port 443" },
    { field: "protocol", label: "Protocol TCP" },
  ],
);
eq(
  "seven filters, every one the API lists",
  m.FLOW_RECORD_FILTERS.map((f) => f.field),
  ["address", "src_address", "dst_address", "port", "src_port", "dst_port", "protocol"],
);

// ---------------------------------------------------------------------------
console.log("\n4. what the result is");
eq("rows", m.flowRecordsState(result()).kind, "rows");
{
  const off = m.flowRecordsState(result({ feature_enabled: false, total: 0, rows: [] }));
  check(
    "platform off: nothing was read",
    off.kind === "feature_off" && /Nothing was read/.test(off.body),
  );
  const recordsOff = m.flowRecordsState(
    result({ records_enabled: false, total: 0, rows: [], data_oldest: null }),
  );
  check(
    "flow records off and nothing held: says so, and that the venue view does not depend on it",
    recordsOff.kind === "records_off" && /venue view/.test(recordsOff.body),
  );
  const none = m.flowRecordsState(result({ total: 0, rows: [], data_oldest: null }));
  check(
    "nothing held is not 'no traffic'",
    none.kind === "nothing_held" && /not the same as no traffic/.test(none.body),
  );
  const noMatch = m.flowRecordsState(result({ total: 0, rows: [] }));
  check(
    "held but nothing matched says from when records are held",
    noMatch.kind === "no_match" && /held from \d{4}-\d{2}-\d{2}/.test(noMatch.body),
    noMatch.body,
  );
  eq(
    "the four empty answers are four different titles",
    new Set([off.title, recordsOff.title, none.title, noMatch.title]).size,
    4,
  );
}
check(
  "switched off with rows held: rows show, with a note that nothing new is stored",
  m.flowRecordsState(result({ records_enabled: false })).kind === "rows" &&
    /nothing new is being stored/.test(
      m.recordsSwitchedOffNote(result({ records_enabled: false })),
    ) &&
    /7 days/.test(m.recordsSwitchedOffNote(result({ records_enabled: false }))),
);
eq("switched on: no such note", m.recordsSwitchedOffNote(result()), null);
eq(
  "result line from the API's count and timing",
  m.retrievedLine(result()),
  `Retrieved ${(1000).toLocaleString()} of ${(1834).toLocaleString()} records in 0.04 second`,
);
eq(
  "totals carry units",
  m.flowTotalsLine(result()),
  `61.3 MB · ${(51200).toLocaleString()} packets across all matching records`,
);
eq("no totals, no line", m.flowTotalsLine(result({ totals: null })), null);
{
  const notes = m.flowRecordNotes(result());
  check(
    "a capped page says so, and the API's own sentence about what a row is is printed",
    /Only the first/.test(notes[0]) && notes[1] === result().row_meaning,
  );
  eq(
    "an uncapped page has only the row meaning",
    m.flowRecordNotes(result({ truncated: false })).length,
    1,
  );
}

// ---------------------------------------------------------------------------
console.log("\n4b. the storage line");
{
  const storage = (over = {}) => ({
    from_day: "2026-10-12",
    to_day: "2026-10-13",
    records_received: 6500,
    rows_stored: 180,
    records_merged: 3900,
    not_stored: { internal: 2400, daily_cap: 20 },
    internal_records_stored: false,
    ports_merged: true,
    ...over,
  });
  eq("no storage block: nothing is said", m.storageLine(result()), null);
  eq(
    "everything received stored one-to-one: nothing is said",
    m.storageLine(
      result({
        storage: storage({
          records_received: 180,
          records_merged: 0,
          not_stored: { internal: 0, daily_cap: 0 },
        }),
      }),
    ),
    null,
  );
  const line = m.storageLine(
    result({
      storage: storage(),
      rows: [flow({ records_merged: 40 }), flow({ records_merged: 2 }), flow()],
    }),
  );
  check(
    "it says how many records the rows on screen sum",
    line.startsWith(`Showing 3 rows that sum ${(43).toLocaleString()} records. `),
    line,
  );
  check(
    "it names the UTC days, not 'this range', and all four figures",
    /On 12 Oct to 13 Oct \(UTC\)/.test(line) &&
      line.includes(`${(6500).toLocaleString()} records were received`) &&
      line.includes(`${(180).toLocaleString()} kept as rows`) &&
      line.includes(`${(3900).toLocaleString()} merged into those rows (nothing lost)`) &&
      line.includes(`${(2400).toLocaleString()} inside the venue's own network are not kept`) &&
      line.includes(`${(20).toLocaleString()} not stored after the daily limit`),
    line,
  );
  check(
    "one day reads as one day; a zero part is left out",
    /On 13 Oct \(UTC\)/.test(
      m.storageLine(result({ storage: storage({ from_day: "2026-10-13" }) })),
    ) &&
      !/daily limit/.test(
        m.storageLine(
          result({
            storage: storage({
              records_received: 6480,
              not_stored: { internal: 2400, daily_cap: 0 },
            }),
          }),
        ),
      ),
  );
  check(
    "rows that each stand for one record do not claim to sum more",
    !/that sum/.test(m.storageLine(result({ storage: storage() }))),
  );
}

console.log("\n5. records incomplete since ...");
eq("not incomplete: no notice", m.incompleteNotice(result()), null);
eq(
  "stretches without the flag: still no notice (the flag is the authority)",
  m.incompleteNotice(
    result({
      incomplete: false,
      incomplete_stretches: [
        { router_id: "r1", since: "2026-10-13T09:30:00+00:00", until: "x", records_not_stored: 9 },
      ],
    }),
  ),
  null,
);
{
  const n = m.incompleteNotice(
    result({
      incomplete: true,
      incomplete_stretches: [
        {
          router_id: "r2",
          since: "2026-10-13T09:35:00+00:00",
          until: "2026-10-14T00:00:00+00:00",
          records_not_stored: 800,
        },
        {
          router_id: "r1",
          since: "2026-10-13T09:30:00+00:00",
          until: "2026-10-14T00:00:00+00:00",
          records_not_stored: 4200,
        },
      ],
    }),
  );
  check(
    "the title names the EARLIEST moment, to the second",
    n.title === `Records incomplete since ${m.recordTime("2026-10-13T09:30:00+00:00")}.` &&
      /:\d{2}:00\.$/.test(n.title),
    n.title,
  );
  check(
    "the body gives the cap, how many were not stored across the stretches, and where totals still are",
    n.body.includes((100000).toLocaleString()) &&
      n.body.includes(`${(5000).toLocaleString()} records`) &&
      /venue view, which is not affected/.test(n.body),
    n.body,
  );
}
{
  const n = m.incompleteNotice(
    result({
      incomplete: true,
      incomplete_stretches: [],
      incomplete_message: "Records incomplete since X.",
    }),
  );
  check(
    "the flag without stretches still shows a notice, with the API's own message",
    n !== null && n.body === "Records incomplete since X.",
  );
  check(
    "and with neither, a notice all the same",
    m.incompleteNotice(result({ incomplete: true })) !== null,
  );
}
{
  const ok = m.flowExportMessage({ total: 10, rows: 10, truncated: false, incompleteSince: null });
  eq("a whole download", [ok.tone, /Downloaded 10 records/.test(ok.text)], ["success", true]);
  const cut = m.flowExportMessage({
    total: 10,
    rows: 10,
    truncated: false,
    incompleteSince: "2026-10-13T09:30+00:00",
  });
  check(
    "a download from an incomplete range is a warning that says since when",
    cut.tone === "warning" &&
      cut.text.includes(`incomplete since ${m.recordTime("2026-10-13T09:30:00+00:00")}`),
    cut.text,
  );
}

// ---------------------------------------------------------------------------
console.log("\n6. the service");
{
  m.apiCalls.length = 0;
  m.setNext({ data: result(), headers: {} });
  await m.trafficFlowRecordsService.search({ location_id: "l1" });
  m.setNext({
    data: "blob",
    headers: {
      "content-disposition": 'attachment; filename="traffic-lens-flows-a-b.csv"',
      "x-total-rows": "60000",
      "x-export-rows": "50000",
      "x-export-truncated": "true",
      "x-records-incomplete-since": "2026-10-13T09:30:00+00:00",
    },
  });
  const file = await m.trafficFlowRecordsService.exportCsv({ location_id: "l1" });
  eq(
    "the two Master routes, and only GETs",
    m.apiCalls.map((c) => c.url),
    ["/platform/traffic-flow/flows", "/platform/traffic-flow/flows/export"],
  );
  eq(
    "the download reads the file name and all four headers",
    [file.filename, file.total, file.rows, file.truncated, file.incompleteSince],
    ["traffic-lens-flows-a-b.csv", 60000, 50000, true, "2026-10-13T09:30:00+00:00"],
  );
  m.setNext({ data: "blob", headers: {} });
  const bare = await m.trafficFlowRecordsService.exportCsv({ location_id: "l1" });
  eq(
    "unreadable headers are unknown, not 'complete'",
    [bare.truncated, bare.incompleteSince],
    [null, null],
  );
}

// ---------------------------------------------------------------------------
console.log("\n7. Master only, nothing unasked, one table");
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
const service = read("src/services/traffic-flow-records.service.ts");
const hook = read("src/hooks/useFlowRecords.ts");
const tab = read("src/components/master/TrafficFlowRecords.tsx");
const tabCode = code(tab);
const page = read("src/routes/master.traffic-flow.tsx");
const table = read("src/components/traffic-lens/RecordsTable.tsx");
const helper = read("src/lib/records-table.ts");

eq(
  "only the Master hook imports the service",
  importers(/traffic-flow-records\.service/, "src/services/traffic-flow-records.service.ts"),
  ["src/hooks/useFlowRecords.ts"],
);
eq(
  "only the Master component imports the hook",
  importers(/hooks\/useFlowRecords/, "src/hooks/useFlowRecords.ts"),
  ["src/components/master/TrafficFlowRecords.tsx"],
);
eq(
  "only the Master page mounts the component",
  importers(/components\/master\/TrafficFlowRecords"/, ""),
  ["src/routes/master.traffic-flow.tsx"],
);
eq(
  "only Master files read the Master flow-record rules and types",
  importers(/lib\/traffic-flow-records"|types\/traffic-flow-records"/, ""),
  [
    "src/components/master/TrafficFlowRecords.tsx",
    "src/lib/traffic-flow-records.ts",
    "src/services/traffic-flow-records.service.ts",
  ],
);
// The customer dashboard has its own flow-records route behind a second
// add-on (scripts/test-traffic-lens-flow-records.mjs). It shares the neutral
// rules in src/lib/flow-records.ts and never the Master files.
check(
  "no customer Traffic Lens file imports a Master flow-record file",
  !sources.some(
    ([f, src]) =>
      /components\/traffic-lens\/|lib\/traffic-lens-|lib\/flow-records|lib\/records-table|hooks\/useTrafficLens|hooks\/useLens|services\/traffic-lens|types\/flow-records|types\/traffic-lens/.test(
        f,
      ) &&
      /lib\/traffic-flow-records|types\/traffic-flow-records|traffic-flow-records\.service|useFlowRecords"|TrafficFlowRecords|platform\/traffic-flow/.test(
        code(src),
      ),
  ),
);
check(
  "the address a record was exported from exists in Master files only",
  sources
    .filter(([, src]) => /\bexporter\b/.test(code(src)) && /flow-records|FlowRecords/.test(src))
    .every(([f]) =>
      /^src\/(lib\/traffic-flow-records\.ts|types\/traffic-flow-records\.ts|components\/master\/TrafficFlowRecords\.tsx)$/.test(
        f,
      ),
    ),
);
check(
  "the customer venue-level table still has its four placeholders",
  m.LENS_RECORD_COLUMNS.filter((c) => c.notRecorded !== null)
    .map((c) => c.id)
    .join() === "src_addr,src_port,src_nat,dst_nat",
);
check("the service only reads", !/api\.(post|put|patch|delete)/.test(service));
for (const flag of [
  "retry: false",
  "staleTime: Infinity",
  "refetchOnWindowFocus: false",
  "refetchOnReconnect: false",
  "refetchOnMount: false",
])
  check(`hook: ${flag}`, hook.includes(flag));
check(
  "the search waits to be asked and never polls",
  /enabled: params !== null/.test(code(hook)) && !/refetchInterval/.test(hook),
);
check("nothing is searched from an effect", !/useEffect/.test(tabCode));
check(
  "the records load by themselves: the request is derived, never kept in state",
  /const params = built\.ok \? built\.params : null;/.test(tabCode) &&
    /flowRecordParams\(scope, bounds, applied, sort\)/.test(tabCode) &&
    !/setParams|useState<Record<string, string> \| null>/.test(tabCode) &&
    /useFlowRecordSearch\(params\)/.test(tabCode),
);
check(
  "one load per open, period, applied filter or sort: no effect, timer, interval or focus refetch",
  !/useEffect|setInterval|setTimeout|refetchInterval|refetch\(|visibilitychange|addEventListener/.test(
    tabCode,
  ),
);
check(
  "typing in a filter field asks for nothing until Search or Enter applies it",
  /const \[applied, setApplied\]/.test(tabCode) &&
    /onSubmit=\{submit\}/.test(tabCode) &&
    (tabCode.match(/setApplied\(/g) ?? []).length === 2 &&
    /setApplied\(form\)/.test(tabCode),
  String((tabCode.match(/setApplied\(/g) ?? []).length),
);
check(
  "the per-field filters are behind Filters, closed by default; the Filter box is always there",
  /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/.test(tabCode) &&
    /\{filtersOpen && \(/.test(tabCode) &&
    /<FiltersButton/.test(tabCode) &&
    /active=\{chips\.length\}/.test(tabCode) &&
    /<FilterChips chips=\{chips\} onRemove=\{dropFilter\}/.test(tabCode) &&
    tabCode.indexOf('placeholder="Filter…"') < tabCode.indexOf("{filtersOpen && ("),
);
check(
  "the long explanation is behind About these records, and 'Not searched yet' is gone",
  /<AboutRecords>/.test(tabCode) && !/Not searched yet/.test(tabCode),
);
check(
  "no venue and no router: no request, and the screen says to pick one",
  /\{!scoped \? \(\s*<Notice title="Pick a venue\."/.test(tab) &&
    !m.flowRecordParams({ locationId: "", routerId: "" }, RANGE, FORM, SORT).ok,
);
check(
  "the page pins the moment the range ends at: it moves on Refresh and on a new venue or range only",
  /bounds=\{flowRange\(scope, flowsAt\)\}/.test(page) &&
    (page.match(/setFlowsAt\(/g) ?? []).length === 2 &&
    !/useEffect|setInterval|refetchInterval/.test(code(page)),
  String((page.match(/setFlowsAt\(/g) ?? []).length),
);
check(
  "the filter box only narrows what is loaded, and Enter in it asks for nothing",
  /onChange=\{\(e\) => setQuick\(e\.target\.value\)\}/.test(tabCode) &&
    /if \(e\.key === "Enter"\) e\.preventDefault\(\)/.test(tabCode) &&
    /filterLoadedRecords\(/.test(tabCode),
);
check(
  "the incomplete notice is outside every result branch, so it shows whenever it is set",
  /\{incomplete && \(\s*<div role="alert"/.test(tab) &&
    tab.indexOf("{incomplete && (") < tab.indexOf("{!scoped ? ("),
);
check(
  "states and rows go through the tested rules",
  [
    "flowRecordsState(r)",
    "flowRecordColumns(r)",
    "flowRecordRow(row, i, routerNames)",
    "incompleteNotice(r)",
    "recordsSwitchedOffNote(r)",
    "retrievedLine(r)",
    "flowExportMessage(file)",
    "flowRecordNotes(r)",
  ].every((call) => tabCode.includes(call)),
);
check(
  "a failed search is not an empty result",
  /an\s+error\s+is\s+not\s+an\s+empty\s+result/.test(tab),
);
check("the screen says searches are audited", /FLOW_RECORDS_AUDIT_NOTE\}/.test(tab));
check(
  "the range is the page's own control, minute precision included",
  /<TrafficFlowRangeControl/.test(tab) && /bounds=\{flowRange\(scope, flowsAt\)\}/.test(page),
);
check(
  "the page has the Flows tab, after Destinations",
  /\{ value: "flows", label: "Flows" \}/.test(page) &&
    page.indexOf('value: "flows"') > page.indexOf('value: "destinations"') &&
    /<TrafficFlowRecords/.test(page),
);
check("no screen says Application", !/application/i.test(tabCode.replace(/row\.application/g, "")));
eq(
  "every records table in the app is the one component",
  importers(/components\/traffic-lens\/RecordsTable"/, ""),
  [
    "src/components/master/TrafficFlowRecords.tsx",
    "src/components/traffic-lens/TrafficLensDestinations.tsx",
    "src/components/traffic-lens/TrafficLensFlowRecords.tsx",
  ],
);
for (const [name, src] of [
  ["RecordsTable.tsx", table],
  ["records-table.ts", helper],
  ["flow-records.ts (shared rules)", read("src/lib/flow-records.ts")],
  ["types/flow-records.ts", read("src/types/flow-records.ts")],
]) {
  const hit = code(src).match(
    /wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i,
  );
  check(`${name}: no word about how records are gathered`, !hit, hit ? hit[0] : "");
  check(
    `${name}: imports nothing operator-only`,
    !/components\/master\/|traffic-flow-records|lib\/traffic-flow"|\/platform\//.test(code(src)),
  );
}
check(
  "the shared table never reorders or fetches: it reports clicks",
  !/\.sort\(|useQuery|useEffect|api\./.test(code(table)) && /onSort\(c\.sort as Sort\)/.test(table),
);
check(
  "an unavailable heading is never a sort button",
  /c\.notRecorded !== null \? \(\s*<button/.test(table) &&
    /aria-sort=\{c\.sort && c\.notRecorded === null \? sortState\(c\.sort\) : undefined\}/.test(
      table,
    ),
);
check(
  "no fixture data in the app's flow-record files",
  !/192\.168\.|10\.20\.0\.|142\.250\.|203\.0\.114\./.test(
    service +
      hook +
      tab +
      read("src/lib/traffic-flow-records.ts").replace(
        /203\.0\.113\.7 or 203\.0\.113\.0\/24|203\.0\.114\.9:40001/g,
        "",
      ),
  ),
);

console.log(
  failures === 0
    ? `\nall traffic flow record checks passed\n`
    : `\n${failures} traffic flow record check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
