/**
 * Customer "Traffic Lens": the answers at the top of the page, the traffic
 * strip, and the columns of the Records table.
 * Design: wyfy-specs/flow-visibility/UX-REDESIGN.md. Shapes: API.md (C-2,
 * D-1). The fixtures below exist ONLY in this file -- the app ships no
 * fixture data, and section 6 fails the build if it ever does.
 *
 * What this pins, worst-first:
 *
 *   1. A STATEMENT IS NEVER MADE FROM NOTHING. No data, one reading only, a
 *      tie and a measured zero are different answers with different words.
 *      One five-minute reading never names a "busiest time".
 *   2. LOWER BOUNDS STAY "AT LEAST", and a check that did not trigger on
 *      minimums does not say the venue is fine.
 *   3. A CHECK WITHOUT DATA IS "COULD NOT BE CHECKED", never passed.
 *   4. A SERVICE IS A PORT LABEL: plain names are keyed on the port's
 *      standard name, an unnamed port gets none, and no product is named.
 *   5. THE RECORDS TABLE HAS NO DEVICE COLUMN, and what is not recorded
 *      (source address and port, NAT, packets) is listed as not recorded.
 *   6. NO FIXTURE DATA UNDER src/, and the "Open Guest Connection Records"
 *      link is gone.
 *
 * Bundles the real module with esbuild and executes it (this repo has no
 * test runner -- see scripts/test-traffic-flow.mjs).
 *
 * Run: node scripts/test-traffic-lens-insights.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "traffic-lens-insights-"));
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/traffic-lens-insights.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src").replace(/\\/g, "/") },
});
const m = await import(bundle);

// ---------------------------------------------------------------------------
// Fixtures (API.md's own example, trimmed)
// ---------------------------------------------------------------------------
const NOW = Date.parse("2026-10-12T14:10:00Z");
const PERIOD = "in the last hour";
const svc = (protocol, port, name, bytes, over = {}) => ({
  protocol,
  protocol_name: protocol === 6 ? "tcp" : "udp",
  port,
  service_name: name,
  bytes_up: Math.round(bytes * 0.1),
  bytes_down: Math.round(bytes * 0.9),
  bytes,
  flows: 100,
  share: 0,
  avg_bps: 1000,
  ...over,
});
const step = (start, down, up) => ({
  start,
  covered_seconds: 300,
  bytes_up: (up * 300) / 8,
  bytes_down: (down * 300) / 8,
  bps_up: up,
  bps_down: down,
  services_measured: true,
  services: {},
  other_bytes: 0,
  protocols: { tcp: 0, udp: 0, icmp: 0, other: 0 },
});
const device = (ip, bytes, share, match = "session") => ({
  router_id: "r1",
  ip,
  bytes_up: Math.round(bytes * 0.1),
  bytes_down: Math.round(bytes * 0.9),
  bytes,
  flows: 10,
  share_at_least: share,
  match,
  guest_session_id: null,
});
function summary(over = {}) {
  const items = [
    svc(6, 443, "https", 600_000_000),
    svc(17, 443, "https", 200_000_000),
    svc(17, 19305, null, 100_000_000),
    svc(17, 53, "domain", 50_000_000),
  ];
  const total = 1_000_000_000;
  for (const it of items) it.share = it.bytes / total;
  return {
    measured: true,
    since: "2026-10-12T13:10:00+00:00",
    until: "2026-10-12T14:10:00+00:00",
    window_seconds: 300,
    step_seconds: 300,
    windows: 12,
    data_oldest: "2026-10-12T09:40:00+00:00",
    data_newest: "2026-10-12T14:05:00+00:00",
    totals: {
      bytes_up: 100_000_000,
      bytes_down: 900_000_000,
      bytes_internal: 0,
      bytes_unclassified: 0,
      flows: 1000,
      covered_seconds: 3600,
      avg_bps_up: 222_222,
      avg_bps_down: 2_000_000,
      devices_peak: 14,
      destinations_peak: 212,
    },
    services_measured: true,
    services: {
      exact: true,
      windows_measured: 12,
      items,
      other_bytes: 50_000_000,
      other_share: 0.05,
    },
    protocols: [],
    timeline: {
      series: items.slice(0, 4).map((it) => ({
        key: `${it.protocol}/${it.port}`,
        protocol: it.protocol,
        protocol_name: it.protocol_name,
        port: it.port,
        service_name: it.service_name,
      })),
      steps: [
        step("2026-10-12T13:10:00+00:00", 1_000_000, 100_000),
        step("2026-10-12T13:15:00+00:00", 4_000_000, 200_000),
        step("2026-10-12T13:20:00+00:00", 2_000_000, 100_000),
      ],
    },
    list_accuracy: {
      method: "sum_of_per_window_top_n",
      per_window_top_n: 10,
      lower_bound: true,
      applies_to: ["devices", "destinations"],
    },
    devices: {
      items: [device("d-a", 440_000_000, 0.44), device("d-b", 100_000_000, 0.1, "none")],
      other_bytes_at_most: 460_000_000,
    },
    destinations: { items: [], other_bytes_at_most: null },
    ...over,
  };
}
const unmeasured = () =>
  summary({
    measured: false,
    totals: null,
    services_measured: false,
    services: null,
    timeline: { series: [], steps: [] },
    devices: { items: [], other_bytes_at_most: null },
  });
const withServices = (items, other = 0) => {
  const total = items.reduce((t, it) => t + it.bytes, 0) + other;
  for (const it of items) it.share = total > 0 ? it.bytes / total : 0;
  return summary({
    services: { exact: true, windows_measured: 12, items, other_bytes: other, other_share: 0 },
  });
};

// ---------------------------------------------------------------------------
console.log("\n1. what the traffic was (the headline)");
const top = m.lensTopService(summary(), PERIOD);
eq("kind: top", top.kind, "top");
eq(
  "https over TCP and UDP are one answer in plain words",
  top.headline,
  "Secure web browsing was 80% of your traffic in the last hour.",
);
eq("the figure is that share", top.figure, "80%");
check(
  "the detail names both port labels and the amount with its unit",
  /https \(TCP\/443\) \+ https \(UDP\/443\)/.test(top.detail) && /800 MB/.test(top.detail),
  top.detail,
);
check("the period is in the sentence", top.headline.includes(PERIOD));

for (const [name, s] of [
  ["null", null],
  ["undefined", undefined],
  ["measured: false", unmeasured()],
]) {
  const a = m.lensTopService(s, PERIOD);
  check(
    `no data (${name}): not measured, no figure, no zero`,
    a.kind === "not_measured" && a.figure === null && !/\b0\b|0%|0 B/.test(a.headline),
    JSON.stringify(a),
  );
}
const noDetail = m.lensTopService(summary({ services_measured: false, services: null }), PERIOD);
check(
  "traffic without service detail is 'not measured', not 'no services'",
  noDetail.kind === "not_measured" && /not the same as no services/.test(noDetail.detail),
);
const quiet = m.lensTopService(withServices([]), PERIOD);
check(
  "a measured period with no service traffic is 'none', worded as measured",
  quiet.kind === "none" && /was measured/.test(quiet.detail),
);

const tie = m.lensTopService(
  withServices([svc(6, 22, "ssh", 300), svc(17, 53, "domain", 300), svc(17, 123, "ntp", 100)]),
  PERIOD,
);
eq("kind: tie", tie.kind, "tie");
check(
  "a tie names both and gives neither the top",
  /Remote login and Name lookups \(DNS\) shared the top, 43% of your traffic each\./.test(
    tie.headline,
  ),
  tie.headline,
);
const tie3 = m.lensTopService(
  withServices([svc(6, 22, "ssh", 100), svc(17, 53, "domain", 100), svc(17, 123, "ntp", 100)]),
  PERIOD,
);
check("a three-way tie lists all three", /, .* and /.test(tie3.headline), tie3.headline);

const unnamedTop = m.lensTopService(
  withServices([svc(17, 19305, null, 900), svc(6, 443, "https", 100)]),
  PERIOD,
);
check(
  "an unnamed port leads with its bare label and gets no plain name",
  unnamedTop.headline.startsWith("UDP/19305 was 90%"),
  unnamedTop.headline,
);
const partial = m.lensTopService(
  summary({
    services_measured: false,
    services: { ...summary().services, exact: false, windows_measured: 9 },
  }),
  PERIOD,
);
check(
  "partial service detail says how many periods, and 'of the measured part'",
  partial.kind === "top" &&
    /9 of 12 five-minute periods/.test(partial.detail) &&
    /measured part/.test(partial.detail),
  partial.detail,
);

// ---------------------------------------------------------------------------
console.log("\n2. when it was busiest");
const peak = m.lensPeak(summary(), NOW);
eq("kind: peak", peak.kind, "peak");
check(
  "names the time and the speed with its unit",
  /^Busiest at .+: 4\.2 Mb\/s\.$/.test(peak.headline),
  peak.headline,
);
check(
  "the detail splits download and upload and says over how long",
  /Download 4\.0 Mb\/s, upload 200 kb\/s over 5 minutes\./.test(peak.detail),
  peak.detail,
);
eq("the peak's instant", peak.at, Date.parse("2026-10-12T13:15:00+00:00"));

eq("no data: not measured", m.lensPeak(unmeasured(), NOW).kind, "not_measured");
eq("null: not measured", m.lensPeak(null, NOW).kind, "not_measured");
eq(
  "measured but no step: not measured",
  m.lensPeak(summary({ timeline: { series: [], steps: [] } }), NOW).kind,
  "not_measured",
);

const one = m.lensPeak(
  summary({ timeline: { series: [], steps: [step("2026-10-12T13:10:00+00:00", 3_000_000, 0)] } }),
  NOW,
);
eq("one window only: kind single", one.kind, "single");
check(
  "one reading never names a busiest time",
  !/Busiest at/.test(one.headline) && one.at === null && /more than one reading/.test(one.detail),
  JSON.stringify(one),
);
check("one reading still reports its speed with a unit", /3\.0 Mb\/s/.test(one.detail));

const peakTie = m.lensPeak(
  summary({
    timeline: {
      series: [],
      steps: [
        step("2026-10-12T13:20:00+00:00", 2_000_000, 0),
        step("2026-10-12T13:10:00+00:00", 2_000_000, 0),
        step("2026-10-12T13:15:00+00:00", 1_000_000, 0),
      ],
    },
  }),
  NOW,
);
eq("tie: kind", peakTie.kind, "tie");
eq("tie: the FIRST time is named", peakTie.at, Date.parse("2026-10-12T13:10:00+00:00"));
check("tie: says it was reached again", /one more time/.test(peakTie.detail), peakTie.detail);

const idle = m.lensPeak(
  summary({
    timeline: {
      series: [],
      steps: [step("2026-10-12T13:10:00+00:00", 0, 0), step("2026-10-12T13:15:00+00:00", 0, 0)],
    },
  }),
  NOW,
);
check(
  "all-zero readings are a measured zero, not a peak and not 'not measured'",
  idle.kind === "idle" && /each was zero/.test(idle.detail),
);
eq("hourly steps say 'over 1 hour'", m.stepSpan(3600), "1 hour");
eq("15-minute steps", m.stepSpan(900), "15 minutes");
eq("no step size, no span", m.stepSpan(null), null);

// ---------------------------------------------------------------------------
console.log("\n3. the heaviest device");
const dev = m.lensHeaviestDevice(summary());
eq("kind: top", dev.kind, "top");
eq(
  "lower-bound input reads 'at least'",
  dev.headline,
  "One device used at least 44% of all traffic.",
);
check(
  "its bytes are 'at least' too, with the kind of device",
  /^Guest login · at least 440 MB\./.test(dev.detail),
  dev.detail,
);
check("under half is not flagged", dev.flagged === false);
check(
  "the answer names no address, destination or service",
  !/d-a|\d+\.\d+\.\d+\.\d+|https|TCP|UDP/.test(dev.headline + dev.detail),
);

const exact = m.lensHeaviestDevice(summary({ list_accuracy: null }));
eq("an exact list drops 'at least'", exact.headline, "One device used 44% of all traffic.");
const hog = m.lensHeaviestDevice(
  summary({ devices: { items: [device("d-a", 620, 0.62, "none")], other_bytes_at_most: 0 } }),
);
check(
  "half or more is flagged and said in words",
  hog.flagged === true && /half or more/.test(hog.detail) && /Not a guest login/.test(hog.detail),
);
check(
  "exactly half is flagged",
  m.lensHeaviestDevice(
    summary({ devices: { items: [device("d-a", 500, 0.5)], other_bytes_at_most: 0 } }),
  ).flagged,
);
eq("the threshold is one constant", m.LENS_HEAVY_DEVICE_SHARE, 0.5);

const devTie = m.lensHeaviestDevice(
  summary({
    devices: {
      items: [device("d-a", 300, 0.3), device("d-b", 300, 0.3), device("d-c", 100, 0.1)],
      other_bytes_at_most: 0,
    },
  }),
);
check(
  "a tie names no single device and is not flagged",
  devTie.kind === "tie" &&
    /^2 devices are level at the top, at least 30% of all traffic each\./.test(devTie.headline) &&
    devTie.flagged === false &&
    devTie.share === null,
  devTie.headline,
);
eq(
  "no device rows: none",
  m.lensHeaviestDevice(summary({ devices: { items: [], other_bytes_at_most: null } })).kind,
  "none",
);
eq("no data: not measured", m.lensHeaviestDevice(unmeasured()).kind, "not_measured");
eq("null: not measured", m.lensHeaviestDevice(null).kind, "not_measured");
check(
  "a share the API sent outside 0..1 is never flagged",
  m.lensHeaviestDevice(
    summary({ devices: { items: [device("d-a", 500, 62)], other_bytes_at_most: 0 } }),
  ).flagged === false,
);

// ---------------------------------------------------------------------------
console.log("\n4. how much in all");
const vol = m.lensVolume(summary(), PERIOD);
eq("total with unit and period", vol.headline, "1.0 GB used in the last hour.");
check(
  "download, upload and their average speeds, each with a unit",
  /Download 900 MB \(average 2\.0 Mb\/s\), upload 100 MB \(average 222 kb\/s\)\./.test(vol.detail),
  vol.detail,
);
eq("peaks are worded 'at once', never as totals", vol.facts, [
  "Up to 14 devices at once",
  "Up to 212 outside addresses at once",
]);
const volNone = m.lensVolume(unmeasured(), PERIOD);
check(
  "no data: not measured, no zero, no facts",
  volNone.kind === "not_measured" && volNone.facts.length === 0 && !/0 B/.test(volNone.headline),
);
const zero = m.lensVolume(
  summary({ totals: { ...summary().totals, bytes_up: 0, bytes_down: 0 } }),
  PERIOD,
);
check("a measured zero reads 0 B", zero.kind === "measured" && /^0 B used/.test(zero.headline));
eq(
  "period: 24 hours",
  m.lensPeriodPhrase({ kind: "preset", window: "24h" }),
  "in the last 24 hours",
);
eq("period: 7 days", m.lensPeriodPhrase({ kind: "preset", window: "7d" }), "in the last 7 days");
check(
  "period: custom says from ... to ...",
  /^from .+ to .+$/.test(
    m.lensPeriodPhrase({
      kind: "custom",
      since: "2026-10-12T13:00:00Z",
      until: "2026-10-12T14:00:00Z",
    }),
  ),
);

// ---------------------------------------------------------------------------
console.log("\n5. worth a look: three checks");
const checks = m.lensChecks(summary());
eq(
  "always the same three, in order",
  checks.map((c) => c.id),
  ["heavy_device", "upload_heavy", "unnamed_ports"],
);
eq(
  "the ordinary venue flags nothing",
  checks.map((c) => c.state),
  ["clear", "clear", "clear"],
);
check(
  "clear on lower-bound devices says 'minimums', not 'fine'",
  /minimums/.test(checks[0].text) && /not a guarantee/.test(checks[0].text),
  checks[0].text,
);
const line = m.lensChecksSummary(checks);
check(
  "nothing flagged lists what was looked for and never says all is well",
  /^Nothing flagged\. Looked for: /.test(line) &&
    /half or more/.test(line) &&
    !/all good|fine|healthy|normal|safe/i.test(line),
  line,
);

const none = m.lensChecks(unmeasured());
eq(
  "no data: every check is unchecked, none is clear",
  none.map((c) => c.state),
  ["unchecked", "unchecked", "unchecked"],
);
check(
  "each unchecked check says it could not be checked",
  none.every((c) => /^Could not be checked/.test(c.text)),
);
eq("and the line says so", m.lensChecksSummary(none), "Nothing could be checked for this period.");
eq(
  "null summary: unchecked",
  m.lensChecks(null).map((c) => c.state),
  ["unchecked", "unchecked", "unchecked"],
);

const flagged = m.lensChecks(
  summary({
    totals: { ...summary().totals, bytes_up: 700_000_000, bytes_down: 300_000_000 },
    devices: { items: [device("d-a", 620, 0.62)], other_bytes_at_most: 0 },
  }),
);
eq(
  "a heavy device and upload above download are both flagged",
  flagged.map((c) => c.state),
  ["flagged", "flagged", "clear"],
);
check(
  "the upload flag gives both figures with units and a neutral next step",
  /Upload \(700 MB\) was higher than download \(300 MB\)/.test(flagged[1].text) &&
    /may be/.test(flagged[1].text),
  flagged[1].text,
);
eq("a flag suppresses the 'nothing flagged' line", m.lensChecksSummary(flagged), null);
check(
  "equal upload and download is not flagged",
  m.lensChecks(summary({ totals: { ...summary().totals, bytes_up: 5, bytes_down: 5 } }))[1]
    .state === "clear",
);

const unnamed = m.lensChecks(
  withServices([svc(17, 19305, null, 300), svc(6, 443, "https", 700)]),
)[2];
check(
  "a quarter or more on unnamed ports is flagged as 'at least', without calling it wrong",
  unnamed.state === "flagged" &&
    /At least 30%/.test(unnamed.text) &&
    /not wrong in itself/.test(unnamed.text),
  unnamed.text,
);
eq("that threshold is one constant", m.LENS_UNNAMED_PORT_SHARE, 0.25);
const partialChecks = m.lensChecks(summary({ services_measured: false }));
eq(
  "no service detail: that check alone is unchecked",
  partialChecks.map((c) => c.state),
  ["clear", "clear", "unchecked"],
);
check(
  "the line then says what could not be checked",
  /Could not check: a quarter or more/.test(m.lensChecksSummary(partialChecks)),
);
check(
  "no check text names an app, a site or a guest",
  [...checks, ...flagged, unnamed].every(
    (c) => !/youtube|instagram|whatsapp|netflix|google|guest \w+ visited/i.test(c.text),
  ),
);

// ---------------------------------------------------------------------------
console.log("\n6. the traffic strip");
const COLORS = ["c1", "c2", "c3", "c4"];
const strip = m.lensComposition(summary(), COLORS);
eq(
  "four coloured services and one rest",
  strip.map((g) => g.color),
  ["c1", "c2", "c3", "c4", null],
);
check(
  "widths add up to 100",
  Math.abs(strip.reduce((t, g) => t + g.width, 0) - 100) < 0.11,
  String(strip.reduce((t, g) => t + g.width, 0)),
);
eq(
  "two services with the same plain name are told apart by protocol",
  [strip[0].name, strip[1].name],
  ["Secure web browsing (TCP)", "Secure web browsing (UDP)"],
);
eq("an unnamed port keeps its bare label", strip[2].name, "UDP/19305");
eq(
  "the rest is 'Everything else'",
  [strip[4].key, strip[4].name],
  [m.LENS_STRIP_REST_KEY, "Everything else"],
);
eq("a segment keeps its timeline colour by series position", strip[3].label, "domain (UDP/53)");
eq(
  "fewer colours: the others fold into the rest",
  m.lensComposition(summary(), ["c1", "c2"]).map((g) => g.color),
  ["c1", "c2", null],
);
eq("not measured: no strip", m.lensComposition(unmeasured(), COLORS), []);
eq(
  "services not measured: no strip",
  m.lensComposition(summary({ services_measured: false }), COLORS),
  [],
);
eq("no traffic: no strip", m.lensComposition(withServices([]), COLORS), []);
eq("plain name: https", m.serviceKind({ service_name: "https" }), "Secure web browsing");
eq("plain name: unnamed port has none", m.serviceKind({ service_name: null }), null);
eq("plain name: an unknown label has none", m.serviceKind({ service_name: "openvpn" }), null);

// ---------------------------------------------------------------------------
console.log("\n7. the Records table");
const ids = m.LENS_RECORD_COLUMNS.map((c) => c.id);
eq("the columns, in order", ids, [
  "from",
  "to",
  "address",
  "port",
  "protocol",
  "service",
  "direction",
  "down",
  "up",
  "total",
  "flows",
]);
check(
  "no column is a device, a guest or a translation",
  !m.LENS_RECORD_COLUMNS.some((c) =>
    /device|mac|guest|source|src|nat|session|client/i.test(`${c.id} ${c.label}`),
  ),
);
check(
  "no column is headed with the A-word",
  !ids.concat(m.LENS_RECORD_COLUMNS.map((c) => c.label)).some((x) => /application|app\b/i.test(x)),
);
eq(
  "every sort a header asks for is one the API accepts",
  m.LENS_RECORD_COLUMNS.filter((c) => c.sort).map((c) => c.sort),
  ["time", "address", "port", "protocol", "bytes_down", "bytes_up", "bytes", "flows"],
);
eq(
  "what is not recorded is listed, by name",
  m.LENS_RECORD_NOT_RECORDED.map((c) => c.label),
  ["Source address", "Source port", "Source NAT", "Destination NAT", "Packets"],
);
check(
  "each has a reason",
  m.LENS_RECORD_NOT_RECORDED.every((c) => c.why.length > 10),
);
eq("all columns show by default", m.LENS_RECORD_DEFAULT_COLUMNS, ids);
eq(
  "hiding a column keeps the table's order",
  m.toggleRecordColumn(ids, "port"),
  ids.filter((x) => x !== "port"),
);
eq(
  "showing it again puts it back in place",
  m.toggleRecordColumn(m.toggleRecordColumn(ids, "port"), "port"),
  ids,
);
eq("the time cannot be hidden", m.toggleRecordColumn(ids, "from"), ids);
eq("the address cannot be hidden", m.toggleRecordColumn(ids, "address"), ids);
eq("an unknown column changes nothing", m.toggleRecordColumn(ids, "source"), ids);

const record = (over = {}) => ({
  window_start: "2026-10-12T14:05:00+00:00",
  window_end: "2026-10-12T14:10:00+00:00",
  address: "203.0.113.14",
  protocol: 6,
  protocol_name: "tcp",
  port: 443,
  service_name: "https",
  bytes_up: 2_000_000,
  bytes_down: 200_000_000,
  bytes: 202_000_000,
  flows: 640,
  ...over,
});
const cells = m.recordCells(record(), NOW);
eq("a record fills exactly the table's columns", Object.keys(cells).sort(), [...ids, "key"].sort());
eq(
  "cells: address, port, protocol, service",
  [cells.address, cells.port, cells.protocol, cells.service],
  ["203.0.113.14", "443", "TCP", "https"],
);
eq("cells: bytes carry units", [cells.down, cells.up, cells.total], ["200 MB", "2.0 MB", "202 MB"]);
eq("cells: flows", cells.flows, "640");
eq("direction: both ways", cells.direction, "Both ways");
eq("direction: download only", m.recordDirection({ bytes_up: 0, bytes_down: 5 }), "Download");
eq("direction: upload only", m.recordDirection({ bytes_up: 5, bytes_down: 0 }), "Upload");
eq("direction: nothing", m.recordDirection({ bytes_up: 0, bytes_down: 0 }), "No bytes");
eq("direction: unreadable is a dash", m.recordDirection({ bytes_up: null, bytes_down: 5 }), "—");
const odd = m.recordCells(
  record({ protocol: 47, protocol_name: "other", port: 0, service_name: null }),
  NOW,
);
eq(
  "an unnamed port says so; port 0 is a dash; protocol by number",
  [odd.service, odd.port, odd.protocol],
  ["No standard name", "—", "Protocol 47"],
);

// ---------------------------------------------------------------------------
console.log("\n8. the page: wiring and what is gone");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const strip2 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const shell = read("src/components/traffic-lens/TrafficLensView.tsx");
const overview = read("src/components/traffic-lens/TrafficLensOverview.tsx");
const parts = read("src/components/traffic-lens/TrafficLensParts.tsx");
const records = read("src/components/traffic-lens/TrafficLensDestinations.tsx");
const insights = read("src/lib/traffic-lens-insights.ts");
const customer = read("src/lib/traffic-lens-customer.ts");
const pageCode = strip2(shell + overview + parts + records);

check(
  "'Open Guest Connection Records' is gone, with its footnote and its route",
  !/Guest Connection Records|network-activity/.test(pageCode),
);
check(
  "the answers come from the tested functions, not from the component",
  [
    "lensTopService(s, phrase)",
    "lensPeak(s, now)",
    "lensHeaviestDevice(s)",
    "lensVolume(s, phrase)",
    "lensChecks(s)",
    "lensComposition(s, LENS_SERIES_COLORS)",
  ].every((call) => overview.includes(call)),
);
check(
  "the component does no arithmetic of its own on the summary",
  !/Math\.|reduce\(|\.sort\(/.test(strip2(overview)),
);
check(
  "an unmeasured period shows the notice before any answer is computed",
  overview.indexOf("if (!totals.measured) return <NoticeCard") > 0 &&
    overview.indexOf("if (!totals.measured) return <NoticeCard") <
      overview.indexOf("lensTopService(s, phrase)"),
);
check(
  "views are one array of two, Overview first, and the shell maps over it",
  (customer.match(/\{ id: "(overview|destinations)", label: "/g) ?? []).length === 2 &&
    /\{ id: "overview", label: "Overview" \}/.test(customer) &&
    /\{ id: "destinations", label: "Records" \}/.test(customer) &&
    /LENS_VIEWS\.map/.test(shell),
);
check(
  "the Overview can only switch to Records through the shell's view state",
  /onOpenRecords=\{\(\) => setView\("destinations"\)\}/.test(shell),
);
check(
  "search, columns and the download are in the one form above the table",
  (() => {
    const form = records.slice(records.indexOf("<form"), records.indexOf("</form>"));
    return (
      /type="submit"/.test(form) &&
      /<DropdownMenuCheckboxItem/.test(form) &&
      /Download CSV/.test(form) &&
      /LENS_RECORD_NOT_RECORDED\.map/.test(form)
    );
  })(),
);
check(
  "the column chooser never fetches: it only changes what is shown",
  /onCheckedChange=\{\(\) => setVisible\(\(v\) => toggleRecordColumn\(v, c\.id\)\)\}/.test(
    records,
  ) && (strip2(records).match(/setParams\(/g) ?? []).length === 2,
);
check(
  "the table says the download holds every column",
  /The download holds all of them/.test(records),
);
check(
  "rows are filled by recordCells, one cell per shown column",
  /recordCells\(row, now\)/.test(records) && /\{v\[c\.id\]\}/.test(records),
);
check(
  "the lock screen shows no chart and no figure",
  (() => {
    const lock = shell.slice(shell.indexOf("function LockedScreen"));
    return !/Chart|recharts|\d+%|\d+ (MB|GB|Mb\/s)/.test(strip2(lock));
  })(),
);
check(
  "nothing in the insights module says how the data is gathered",
  !/wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i.test(
    strip2(insights),
  ),
);
check(
  "the insights module names no product",
  !/youtube|instagram|whatsapp|netflix|facebook|zoom|google|quic\b/i.test(insights),
);
check(
  "plain names are keyed on the port's standard name, never on an address or a number",
  /SERVICE_KINDS\[name\]/.test(insights) &&
    !/SERVICE_KINDS\[[^\]]*(port|ip|address)/.test(insights),
);

// No fixture data under src/: a past incident replaced a real dashboard with
// fixture arrays. The preview's sample data lives outside the repo.
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const lensFiles = walk(join(ROOT, "src")).filter((f) => /traffic-lens/i.test(relative(ROOT, f)));
check("found the Traffic Lens files", lensFiles.length >= 10, String(lensFiles.length));
const fixture = lensFiles.filter((f) =>
  /192\.168\.|10\.20\.0\.|142\.250\.|203\.0\.113\.|198\.51\.100\.|sample-data|SAMPLE DATA|sampleSummary/.test(
    readFileSync(f, "utf8").replace(/203\.0\.113\.7 or 203\.0\.113\.0\/24/g, ""),
  ),
);
eq(
  "no fixture data in any Traffic Lens file under src/",
  fixture.map((f) => relative(ROOT, f)),
  [],
);
check(
  "nothing under src/ imports the preview",
  !walk(join(ROOT, "src")).some(
    (f) =>
      /\.(ts|tsx)$/.test(f) &&
      /(from|import\()\s*["'][^"']*(wyfy-specs|flow-visibility\/preview|sample-data)/.test(
        readFileSync(f, "utf8"),
      ),
  ),
);

console.log(
  failures === 0
    ? `\nall traffic lens insight checks passed\n`
    : `\n${failures} traffic lens insight check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
