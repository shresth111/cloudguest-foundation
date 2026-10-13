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
 *   5. THE RECORDS TABLE HAS NO DEVICE DATA. It has the shape of a full
 *      connection log, so source address and port, NAT and packets keep
 *      their place, but as placeholders: a dash in every cell whatever the
 *      row holds, no sort, no filter, and the reason in words.
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
// A period the rule can judge: at least 1 GiB, at least 5 devices at once.
const BIG = { ...summary().totals, bytes_down: 2 * 1024 ** 3, bytes_up: 0, devices_peak: 14 };
const hogDevices = (share, match = "none") => ({
  items: [device("d-a", Math.round(2 * 1024 ** 3 * share), share, match)],
  other_bytes_at_most: 0,
});
const hog = m.lensHeaviestDevice(summary({ totals: BIG, devices: hogDevices(0.62) }));
check(
  "60% or more is flagged and said in words",
  hog.flagged === true &&
    /most of everything/.test(hog.detail) &&
    /Not a guest login/.test(hog.detail),
);
check(
  "exactly 60% is flagged",
  m.lensHeaviestDevice(summary({ totals: BIG, devices: hogDevices(0.6) })).flagged,
);
check(
  "55% is not: the old 50% line is gone",
  m.lensHeaviestDevice(summary({ totals: BIG, devices: hogDevices(0.55) })).flagged === false,
);
eq(
  "the three numbers are the server's",
  [m.LENS_HEAVY_DEVICE_SHARE, m.LENS_HEAVY_MIN_PERIOD_BYTES, m.LENS_HEAVY_MIN_DEVICES],
  [0.6, 1073741824, 5],
);
check(
  "under 1 GiB in the period: 62% is not flagged",
  m.lensHeaviestDevice(
    summary({ totals: { ...BIG, bytes_down: 1024 ** 3 - 1 }, devices: hogDevices(0.62) }),
  ).flagged === false,
);
check(
  "fewer than 5 devices online: 62% is not flagged",
  m.lensHeaviestDevice(summary({ totals: { ...BIG, devices_peak: 4 }, devices: hogDevices(0.62) }))
    .flagged === false,
);
check(
  "the server's finding decides when it is to hand: flagged at 44%",
  m.lensHeaviestDevice(summary(), "flagged").flagged === true,
);
check(
  "and clear at 62%",
  m.lensHeaviestDevice(summary({ totals: BIG, devices: hogDevices(0.62) }), "clear").flagged ===
    false,
);
check(
  "a server 'could not check' is not a flag",
  m.lensHeaviestDevice(summary({ totals: BIG, devices: hogDevices(0.62) }), "could_not_check")
    .flagged === false,
);

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
const checks = m.lensChecks(summary({ totals: BIG }));
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
    /60% or more/.test(line) &&
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
    totals: { ...BIG, bytes_up: 1_400_000_000, bytes_down: 600_000_000 },
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
  /Upload \(1\.4 GB\) was higher than download \(600 MB\)/.test(flagged[1].text) &&
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
const partialChecks = m.lensChecks(summary({ services_measured: false, totals: BIG }));
{
  const small = m.lensChecks(summary())[0];
  check(
    "a period too small to judge is 'could not be checked', never clear",
    small.state === "unchecked" && /at least 1 GB and at least 5 devices/.test(small.text),
    small.text,
  );
  eq(
    "the server's finding is passed through to the check",
    [
      m.lensChecks(summary(), "flagged")[0].state,
      m.lensChecks(summary({ totals: BIG }), "could_not_check")[0].state,
    ],
    ["flagged", "unchecked"],
  );
}
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
const PLACEHOLDERS = ["src_addr", "src_port", "src_nat", "dst_nat", "packets"];
eq(
  "the asked-for shape, in the asked-for order",
  m.LENS_RECORD_DEFAULT_COLUMNS.map((id) => m.LENS_RECORD_COLUMNS.find((c) => c.id === id).label),
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
eq(
  "exactly five columns are placeholders",
  m.LENS_RECORD_COLUMNS.filter((c) => c.notRecorded !== null).map((c) => c.id),
  PLACEHOLDERS,
);
check(
  "a placeholder says 'Not recorded' and why, is never sortable and cannot be hidden",
  m.LENS_RECORD_COLUMNS.filter((c) => c.notRecorded !== null).every(
    (c) => /^Not recorded: .{15,}/.test(c.notRecorded) && c.sort === null && c.fixed === true,
  ),
);
check(
  "no LIVE column is a device, a guest, a translation or a packet count",
  !m.LENS_RECORD_COLUMNS.filter((c) => c.notRecorded === null).some((c) =>
    /device|mac|guest|source|src|nat|session|client|packet/i.test(`${c.id} ${c.label}`),
  ),
);
check(
  "no column is headed with the A-word",
  !m.LENS_RECORD_COLUMNS.some((c) => /application|app\b/i.test(`${c.id} ${c.label}`)),
);
eq(
  "every sort a header asks for is one the API accepts",
  m.LENS_RECORD_COLUMNS.filter((c) => c.sort).map((c) => c.sort),
  ["time", "address", "port", "protocol", "bytes", "bytes_down", "bytes_up", "flows"],
);
eq(
  "the Columns menu lists the placeholders by their headings",
  m.LENS_RECORD_NOT_RECORDED.map((c) => c.label),
  ["Src addr", "S.port", "S.NAT", "D.NAT", "Packets"],
);
eq(
  "the extra real columns start hidden",
  ids.filter((id) => !m.LENS_RECORD_DEFAULT_COLUMNS.includes(id)),
  ["down", "up", "direction", "flows"],
);
const DEFAULTS = m.LENS_RECORD_DEFAULT_COLUMNS;
eq("switching one on puts it in the table's order", m.toggleRecordColumn(DEFAULTS, "flows"), [
  ...DEFAULTS,
  "flows",
]);
eq(
  "hiding a live column keeps the order",
  m.toggleRecordColumn(DEFAULTS, "port"),
  DEFAULTS.filter((x) => x !== "port"),
);
eq("the start cannot be hidden", m.toggleRecordColumn(DEFAULTS, "start"), DEFAULTS);
eq("the address cannot be hidden", m.toggleRecordColumn(DEFAULTS, "address"), DEFAULTS);
eq("a placeholder cannot be hidden", m.toggleRecordColumn(DEFAULTS, "src_addr"), DEFAULTS);
eq("an unknown column changes nothing", m.toggleRecordColumn(DEFAULTS, "source"), DEFAULTS);

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
const cells = m.recordCells(record(), "Asia/Kolkata");
eq("a record fills exactly the table's columns", Object.keys(cells).sort(), [...ids, "key"].sort());
eq(
  "Start and End are to the second, in the venue's time",
  [cells.start, cells.end],
  ["2026-10-12 19:35:00", "2026-10-12 19:40:00"],
);
eq(
  "cells: address, port, protocol",
  [cells.address, cells.port, cells.protocol],
  ["203.0.113.14", "443", "TCP"],
);
eq("Service is the name with protocol and port", cells.service, "https (TCP/443)");
eq("cells: bytes carry units", [cells.total, cells.down, cells.up], ["202 MB", "200 MB", "2.0 MB"]);
eq("cells: flows", cells.flows, "640");
eq(
  "every placeholder cell is a dash",
  PLACEHOLDERS.map((id) => cells[id]),
  ["—", "—", "—", "—", "—"],
);
const smuggled = m.recordCells(
  record({
    src_addr: "x-device",
    src_port: 51544,
    client_ip: "x-device",
    src_nat: "x-nat",
    dst_nat: "x-nat",
    packets: 61,
  }),
  "Asia/Kolkata",
);
check(
  "a row that somehow carried a device, a NAT or a packet count still shows dashes",
  PLACEHOLDERS.every((id) => smuggled[id] === "—") &&
    !Object.values(smuggled).some((v) => /x-device|x-nat|51544|^61$/.test(v)),
  JSON.stringify(smuggled),
);
eq(
  "a time zone that is not one falls back, it does not throw",
  typeof m.recordTime(record().window_start, "Not/AZone"),
  "string",
);
check(
  "without a venue time zone the time is still to the second",
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(m.recordTime(record().window_start)),
);
eq("an unreadable instant is a dash", m.recordTime("nope", "Asia/Kolkata"), "—");
eq(
  "the line under the table names the venue's zone",
  m.recordTimeBasis("Asia/Kolkata"),
  "the venue's time (Asia/Kolkata)",
);
eq("and says so when it is the browser's", m.recordTimeBasis(null), "your browser's local time");
eq(
  "a bad zone name is not claimed as the venue's",
  m.recordTimeBasis("Not/AZone"),
  "your browser's local time",
);
eq("direction: both ways", cells.direction, "Both ways");
eq("direction: download only", m.recordDirection({ bytes_up: 0, bytes_down: 5 }), "Download");
eq("direction: upload only", m.recordDirection({ bytes_up: 5, bytes_down: 0 }), "Upload");
eq("direction: nothing", m.recordDirection({ bytes_up: 0, bytes_down: 0 }), "No bytes");
eq("direction: unreadable is a dash", m.recordDirection({ bytes_up: null, bytes_down: 5 }), "—");
const odd = m.recordCells(
  record({ protocol: 47, protocol_name: "other", port: 0, service_name: null }),
  "Asia/Kolkata",
);
eq(
  "no ports: the service is the protocol, the port a dash",
  [odd.service, odd.port, odd.protocol],
  ["Protocol 47", "—", "Protocol 47"],
);
eq(
  "an unnamed port is its bare label",
  m.recordCells(record({ protocol: 17, protocol_name: "udp", port: 19305, service_name: null }))
    .service,
  "UDP/19305",
);

const res = (over = {}) => ({ total: 72, returned: 72, query_ms: 38, rows: [], ...over });
eq(
  "result line: count and the API's own timing",
  m.retrievedLine(res()),
  "Retrieved 72 records in 0.04 second",
);
eq(
  "result line: a capped page says of how many",
  m.retrievedLine(res({ total: 1834, returned: 1000, query_ms: 380 })),
  `Retrieved ${(1000).toLocaleString()} of ${(1834).toLocaleString()} records in 0.38 second`,
);
eq(
  "result line: one record",
  m.retrievedLine(res({ total: 1, returned: 1 })),
  "Retrieved 1 record in 0.04 second",
);
eq(
  "result line: none",
  m.retrievedLine(res({ total: 0, returned: 0 })),
  "Retrieved no records in 0.04 second",
);
eq(
  "result line: no timing sent, none invented",
  m.retrievedLine(res({ query_ms: undefined })),
  "Retrieved 72 records",
);

const loaded = [
  m.recordCells(record(), "Asia/Kolkata"),
  m.recordCells(
    record({
      address: "198.51.100.8",
      protocol: 17,
      protocol_name: "udp",
      port: 53,
      service_name: "domain",
    }),
    "Asia/Kolkata",
  ),
];
eq(
  "filter box: empty keeps every loaded row",
  m.filterLoadedRecords(loaded, DEFAULTS, "  ").length,
  2,
);
eq(
  "filter box: matches on what is shown",
  m.filterLoadedRecords(loaded, DEFAULTS, "domain").map((r) => r.address),
  ["198.51.100.8"],
);
eq(
  "filter box: every word must match, any case",
  m.filterLoadedRecords(loaded, DEFAULTS, "TCP 203.0").map((r) => r.address),
  ["203.0.113.14"],
);
eq("filter box: no match is no rows", m.filterLoadedRecords(loaded, DEFAULTS, "zzz"), []);
eq(
  "filter box: a hidden column is not searched",
  m.filterLoadedRecords(loaded, DEFAULTS, "640").length,
  0,
);
eq("chips: none before a search", m.recordFilterChips(null), []);
eq(
  "chips: none without filters",
  m.recordFilterChips({ since: "a", until: "b", sort: "time" }),
  [],
);
eq(
  "chips: one per filter in force, in plain words",
  m.recordFilterChips({ address: "203.0.113.0/24", protocol: "6", port: "443", direction: "down" }),
  [
    { field: "address", label: "Dst addr 203.0.113.0/24" },
    { field: "protocol", label: "Protocol TCP" },
    { field: "port", label: "D.port 443" },
    { field: "direction", label: "Download only" },
  ],
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
const pageCode = strip2(
  shell +
    overview +
    parts +
    records +
    read("src/components/traffic-lens/TrafficLensLayout.tsx") +
    read("src/components/traffic-lens/TrafficLensGeo.tsx"),
);

check(
  "'Open Guest Connection Records' is gone, with its footnote and its route",
  !/Guest Connection Records|network-activity/.test(pageCode),
);
check(
  "the answers come from the tested functions, not from the component",
  [
    "lensTopService(s, phrase)",
    "lensPeak(s, now)",
    "lensHeaviestDevice(s, serverDevice)",
    "lensVolume(s, phrase)",
    "lensChecks(s, serverDevice)",
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
  "views are one array of three (Overview, Records, Countries), and the shell maps over it",
  (customer.match(/\{ id: "(overview|destinations|geo)", label: "/g) ?? []).length === 3 &&
    /\{ id: "overview", label: "Overview" \}/.test(customer) &&
    /\{ id: "destinations", label: "Records" \}/.test(customer) &&
    /\{ id: "geo", label: "Countries" \}/.test(customer) &&
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
eq(
  "country and network are listed as not on a record, with where to find them",
  m.LENS_RECORD_ELSEWHERE.map((c) => `${c.label}: ${c.why}`),
  [
    "Country: Not on a record. See the Countries view",
    "Network: Not on a record. See the Countries view",
  ],
);
check(
  "no country or network column exists, and none is joined on in the browser",
  !m.LENS_RECORD_COLUMNS.some((c) => /country|network|asn/i.test(`${c.id} ${c.label}`)) &&
    /LENS_RECORD_ELSEWHERE\.map/.test(records) &&
    !/traffic-flow-geo|useTrafficLensGeo|country_code|network_name/.test(records),
);
check(
  "the Overview's answers use no country data and ask for none",
  !/traffic-flow-geo|useTrafficLensGeo|country/i.test(strip2(overview)) ||
    (!/traffic-flow-geo|useTrafficLensGeo|country_code/.test(strip2(overview)) &&
      /onOpenCountries/.test(overview)),
);
check(
  "the Overview reaches Countries only through the shell's view state",
  /onOpenCountries=\{\(\) => setView\("geo"\)\}/.test(shell),
);
const geoView = read("src/components/traffic-lens/TrafficLensGeo.tsx");
check(
  "Countries opens on the tested sentence and says 'estimate' beside it",
  /geoLead\(geo\)/.test(geoView) &&
    /Read this as an estimate/.test(geoView) &&
    /\{GEO_ESTIMATE_NOTE\}/.test(geoView),
);
check(
  "Countries is built from the page's own layout parts",
  /from "@\/components\/traffic-lens\/TrafficLensLayout"/.test(geoView) &&
    /<Panel title=\{GEO_BLOCK_TITLE\}/.test(geoView) &&
    !/<Table\b|components\/ui\/card/.test(geoView),
);
check(
  "the attribution link is outside every state branch, so it shows for every answer",
  /\{!loading && error === null && \(\s*<p[^>]*data-testid="lens-geo-attribution"/.test(
    geoView.replace(/\n\s*/g, " "),
  ) && /href=\{attribution\.url\}/.test(geoView),
);
check(
  "the withheld-networks notice gives the count and the reason",
  /\{withheld\}/.test(geoView) && /\{GEO_WITHHELD_WHY\}/.test(geoView),
);
check(
  "the table says a download holds every recorded column",
  /A download always holds every recorded column/.test(records),
);
check(
  "placeholders are drawn greyed with their reason on hover and on tap",
  /title=\{c\.notRecorded\}/.test(records) &&
    /onClick=\{\(\) => setExplained\(explained === c\.id \? null : c\.id\)\}/.test(records) &&
    /\{why\.notRecorded\}/.test(records),
);
check(
  "the last column is the row's own download, not an address",
  /saveRecord\(row\)/.test(records) &&
    /since: row\.window_start, until: row\.window_end/.test(records) &&
    !/exporter/i.test(records),
);
check(
  "the result line, Search, chips, Download, Columns and the filter box are one form",
  (() => {
    const form = records.slice(records.indexOf("<form"), records.indexOf("</form>"));
    return (
      /retrievedLine\(r\)/.test(form) &&
      /chips\.map/.test(form) &&
      /dropFilter\(chip\.field\)/.test(form) &&
      /placeholder="Filter…"/.test(form)
    );
  })(),
);
check(
  "rows are filled by recordCells, one cell per shown column",
  /recordCells\(row, timeZone\)/.test(records) && /\{cells\[c\.id\]\}/.test(records),
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
