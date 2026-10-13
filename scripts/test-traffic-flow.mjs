/**
 * Master "Traffic Lens" (NetFlow/IPFIX) page: honesty, privacy and scope
 * guards. Shapes are wyfy-specs/flow-visibility/API.md; the fixtures below
 * exist ONLY in this file -- the app ships no fixture data.
 *
 * What this pins, worst-first:
 *
 *   1. NO CUSTOMER SURFACE. Guest traffic metadata is operator-only
 *      (~/wyfy-ops/netflow/DESIGN.md §7). Only the Master hook may import
 *      the service, only Master files may import the hook, and the nav item
 *      is cap-gated on `traffic_flows.read`, the backend's GLOBAL-only key.
 *   2. UNMEASURED IS NEVER ZERO. `measured: false` renders "Not measured"
 *      whatever numbers are in the payload; a router never heard from shows
 *      a dash, not "0 of 12"; a timeline step the backend left out is a
 *      gap; a measured zero still reads "0 B".
 *   3. AN UNKNOWN STATE IS NEVER SHOWN AS HEALTHY, and "Receiving" is the
 *      only green state.
 *   4. NO APPLICATION CLAIM. A service is protocol + port + IANA label; an
 *      unnamed port is a bare "UDP/19305". No column or label says
 *      "Application".
 *   5. DEVICES, DESTINATIONS AND SERVICES STAY SEPARATE, and the lower-bound
 *      wording is driven by the API's own `list_accuracy` field.
 *   6. A WRITE IS REPORTED BY ITS READ-BACK, not by its 200, and is
 *      confirmed inline (never `window.confirm`).
 *
 * Bundles the real modules with esbuild and executes them (this repo has no
 * test runner -- see scripts/test-device-logs-presentation.mjs).
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
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/traffic-flow.ts")}";
   export { flowSummaryParams, FLOW_TIMELINE_SERIES, FLOW_WINDOW_MS }
     from "${p("src/services/traffic-flow.service.ts")}";
   export * as customer from "${p("src/lib/traffic-lens-customer.ts")}";
   export { lensSummaryParams, LENS_TIMELINE_SERIES }
     from "${p("src/services/traffic-lens.service.ts")}";
   export { TRAFFIC_LENS_FEATURE_KEY } from "${p("src/types/traffic-lens.ts")}";
   export { BACKEND_PERMISSION_KEYS } from "${p("src/lib/backendPermissionKeys.generated.ts")}";
   export { NAV_PERMISSION_KEYS } from "${p("src/lib/customerNavPermissions.ts")}";`,
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
  // The service imports the axios client; only the pure param builder is
  // exercised here, so the client is stubbed rather than loaded.
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
            "export const api = {}; export default api; export const requestErrorOf = () => null;",
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
const row = (over = {}) => ({
  router_id: "r1",
  router_name: "Hall Router",
  organization_id: "o1",
  organization_name: "Example Cafe",
  location_id: "l1",
  location_name: "Main Hall",
  vendor: "mikrotik",
  state: "receiving",
  configured: true,
  configured_at: "2026-10-12T09:40:00+00:00",
  last_verified_at: "2026-10-12T09:40:00+00:00",
  last_verdict_ok: true,
  last_verdict_detail: "verified",
  last_window_start: "2026-10-12T14:00:00+00:00",
  last_window_end: "2026-10-12T14:05:00+00:00",
  windows_last_hour: 12,
  bytes_last_hour: 734003200,
  ...over,
});
const step = (start, over = {}) => ({
  start,
  covered_seconds: 300,
  bytes_up: 4194304,
  bytes_down: 52428800,
  bps_up: 111848,
  bps_down: 1398101,
  services_measured: true,
  services: { "6/443": 36700160, "17/443": 15728640 },
  other_bytes: 4194304,
  protocols: { tcp: 38000000, udp: 18000000, icmp: 623104, other: 0 },
  ...over,
});
const summary = (over = {}) => ({
  feature_enabled: true,
  measured: true,
  since: "2026-10-12T13:10:00+00:00",
  until: "2026-10-12T14:10:00+00:00",
  window_seconds: 300,
  step_seconds: 300,
  windows: 12,
  data_oldest: "2026-10-12T09:40:00+00:00",
  data_newest: "2026-10-12T14:05:00+00:00",
  totals: {
    bytes_up: 52428800,
    bytes_down: 681574400,
    bytes_internal: 1048576,
    bytes_unclassified: 0,
    flows: 18422,
    covered_seconds: 3600,
    avg_bps_up: 116508,
    avg_bps_down: 1514609,
    devices_peak: 14,
    destinations_peak: 212,
  },
  services_measured: true,
  services: {
    exact: true,
    items: [
      {
        protocol: 6,
        protocol_name: "tcp",
        port: 443,
        service_name: "https",
        bytes_up: 31457280,
        bytes_down: 419430400,
        bytes: 450887680,
        flows: 9120,
        share: 0.6143,
        avg_bps: 1001973,
      },
      {
        protocol: 17,
        protocol_name: "udp",
        port: 19305,
        service_name: null,
        bytes_up: 10485760,
        bytes_down: 209715200,
        bytes: 220200960,
        flows: 3011,
        share: 0.3,
        avg_bps: 489335,
      },
    ],
    other_bytes: 62914560,
    other_share: 0.0857,
  },
  protocols: [
    { protocol: 6, protocol_name: "tcp", bytes: 480000000, share: 0.654 },
    { protocol: 17, protocol_name: "udp", bytes: 250000000, share: 0.3406 },
    { protocol: 1, protocol_name: "icmp", bytes: 4003200, share: 0.0054 },
    { protocol: null, protocol_name: "other", bytes: 0, share: 0.0 },
  ],
  timeline: {
    series: [
      { key: "6/443", protocol: 6, protocol_name: "tcp", port: 443, service_name: "https" },
      { key: "17/443", protocol: 17, protocol_name: "udp", port: 443, service_name: "https" },
    ],
    // 12 steps expected in the hour; three are sent, so nine are gaps.
    steps: [
      step("2026-10-12T13:10:00+00:00"),
      step("2026-10-12T13:15:00+00:00", { services_measured: false, services: {} }),
      step("2026-10-12T14:00:00+00:00", { covered_seconds: 150 }),
    ],
  },
  list_accuracy: {
    method: "sum_of_per_window_top_n",
    per_window_top_n: 10,
    lower_bound: true,
    applies_to: ["devices", "destinations"],
  },
  devices: { items: [], other_bytes_at_most: 411041792 },
  destinations: { items: [], other_bytes_at_most: 522190848 },
  ...over,
});
const NOT_MEASURED_SUMMARY = summary({
  measured: false,
  totals: null,
  services_measured: false,
  services: null,
  protocols: [],
  timeline: { series: [], steps: [] },
  devices: { items: [], other_bytes_at_most: null },
  destinations: { items: [], other_bytes_at_most: null },
});

// ---------------------------------------------------------------------------
console.log("\nthe visible name is one constant");
eq("module name", m.TRAFFIC_FLOW_MODULE_NAME, "Traffic Lens");

// ---------------------------------------------------------------------------
console.log("\nrouter states: unknown is never healthy");
const STATES = [
  "feature_off",
  "unsupported_vendor",
  "not_configured",
  "awaiting_first_data",
  "receiving",
  "silent",
];
const typesSrc = readFileSync(join(ROOT, "src/types/traffic-flow.ts"), "utf8");
const unionStates = [
  ...typesSrc.match(/export type FlowExportState =([^;]+);/)[1].matchAll(/"([a-z_]+)"/g),
].map((x) => x[1]);
eq("the test's state list matches the type union", unionStates.sort(), [...STATES].sort());
for (const s of STATES) {
  check(`${s} has a label`, typeof m.FLOW_STATE[s]?.label === "string");
  check(`${s} has an explanation`, (m.FLOW_STATE[s]?.detail ?? "").length > 20);
}
const labels = STATES.map((s) => m.FLOW_STATE[s].label);
check("six states, six distinct labels", new Set(labels).size === 6, labels.join(" | "));
eq(
  "receiving is the only green state",
  STATES.filter((s) => m.FLOW_STATE[s].tone === "online"),
  ["receiving"],
);
check(
  "an unknown state from the wire is not green and says unknown",
  m.flowState("weird").tone !== "online" && /unknown/i.test(m.flowState("weird").label),
);
check("a missing state is not green", m.flowState(undefined).tone !== "online");
check(
  "awaiting-first-data says unknown, not quiet",
  /unknown, not quiet/i.test(m.FLOW_STATE.awaiting_first_data.detail),
);
check(
  "feature-off names the flag",
  /CLOUDGUEST_TRAFFIC_FLOW_ENABLED/.test(m.FLOW_STATE.feature_off.detail),
);
check(
  "a silent router says since when",
  /^Silent since /.test(m.stateLabel(row({ state: "silent" }), NOW)),
  m.stateLabel(row({ state: "silent" }), NOW),
);
eq(
  "silent with no window end is just Silent",
  m.stateLabel(row({ state: "silent", last_window_end: null }), NOW),
  "Silent",
);
eq("the first state filter keeps everything", m.FLOW_STATE_FILTER_OPTIONS[0].value, "");

// ---------------------------------------------------------------------------
console.log("\nfleet row: a dash is not a zero");
eq("receiving shows windows of expected", m.windowsLastHourLabel(row(), 300), "12 of 12");
eq(
  "silent shows its real zero",
  m.windowsLastHourLabel(row({ state: "silent", windows_last_hour: 0 }), 300),
  "0 of 12",
);
for (const s of ["feature_off", "unsupported_vendor", "not_configured", "awaiting_first_data"]) {
  const r = row({ state: s, windows_last_hour: 0, bytes_last_hour: 0 });
  eq(`${s}: windows is a dash, not 0`, m.windowsLastHourLabel(r, 300), "—");
  eq(`${s}: bytes is a dash, not 0 B`, m.bytesLastHourLabel(r), "—");
}
eq("missing counter is a dash", m.windowsLastHourLabel(row({ windows_last_hour: null }), 300), "—");
eq("last data: 5 min ago", m.lastDataLabel(row(), NOW), "5 min ago");
eq("last data: none held", m.lastDataLabel(row({ last_window_end: null }), NOW), "none held");
const fleet = [
  row(),
  row({ router_id: "r2", router_name: "Lobby", location_id: "l2", state: "silent" }),
  row({
    router_id: "r3",
    router_name: "Omada",
    organization_id: "o2",
    state: "unsupported_vendor",
  }),
];
const F = { organizationId: "", locationId: "", state: "", q: "" };
eq("no filter keeps all", m.filterRouters(fleet, F).length, 3);
eq("customer filter", m.filterRouters(fleet, { ...F, organizationId: "o2" }).length, 1);
eq("venue filter", m.filterRouters(fleet, { ...F, locationId: "l2" })[0].router_id, "r2");
eq("state filter", m.filterRouters(fleet, { ...F, state: "silent" })[0].router_id, "r2");
eq("name search is case-insensitive", m.filterRouters(fleet, { ...F, q: " lob " }).length, 1);

// ---------------------------------------------------------------------------
console.log("\nplatform banners");
const status = (collector, on = true) => ({
  feature_enabled: on,
  generated_at: "",
  window_seconds: 300,
  silent_after_seconds: 3600,
  collector,
  routers: [],
});
const healthy = {
  agent_configured: true,
  last_pull_at: "2026-10-12T14:06:10+00:00",
  last_pull_ok: true,
  last_error: null,
  last_window_start: null,
  unknown_exporters: [],
};
eq("a healthy collector raises nothing", m.statusBanners(status(healthy), NOW), []);
const off = m.statusBanners(status(healthy, false), NOW);
check("flag off is one notice", off.length === 1 && /switched off/.test(off[0].title));
const failed = m.statusBanners(
  status({ ...healthy, last_pull_ok: false, last_error: "timeout" }),
  NOW,
);
check(
  "a failed pull is an error that carries the reason",
  failed.length === 1 && failed[0].tone === "error" && /timeout/.test(failed[0].body),
);
check("a failed pull is not 'quiet'", /not quiet/i.test(failed[0].body));
const never = m.statusBanners(status({ ...healthy, last_pull_ok: null }), NOW);
check("no pull yet is said, not hidden", never.length === 1 && /no pull/i.test(never[0].title));
const unknown = m.statusBanners(status({ ...healthy, unknown_exporters: ["10.20.0.77"] }), NOW);
check(
  "unknown exporters are named and not attributed",
  unknown.length === 1 &&
    /10\.20\.0\.77/.test(unknown[0].body) &&
    /not attributed/.test(unknown[0].body),
);

// ---------------------------------------------------------------------------
console.log("\nmeasured versus zero");
const tv = m.totalsView(summary());
eq("measured download", tv.download, "682 MB");
eq("measured upload", tv.upload, "52.4 MB");
eq("average rate", tv.downloadRate, "1.5 Mb/s");
eq("devices are a peak, not a distinct count", tv.devicesPeak, "Up to 14 at once");
eq("internal traffic is its own line", tv.internal, "1.0 MB");
eq("zero unclassified is not a line", tv.unclassified, null);
const nm = m.totalsView(NOT_MEASURED_SUMMARY);
check(
  "measured:false renders every tile Not measured",
  !nm.measured &&
    [
      nm.download,
      nm.upload,
      nm.downloadRate,
      nm.uploadRate,
      nm.devicesPeak,
      nm.destinationsPeak,
    ].every((v) => v === "Not measured"),
);
const lying = m.totalsView(summary({ measured: false }));
check(
  "measured:false wins over numbers left in the payload",
  !lying.measured && lying.download === "Not measured",
);
check("a missing summary is not measured", !m.totalsView(undefined).measured);
const zero = m.totalsView(
  summary({
    totals: { ...summary().totals, bytes_up: 0, bytes_down: 0, avg_bps_up: 0, avg_bps_down: 0 },
  }),
);
check(
  "a measured zero still reads as zero",
  zero.measured && zero.download === "0 B" && zero.downloadRate === "0 b/s",
);
eq("bytes: null is a dash", m.flowBytes(null), "—");
eq("bytes: negative is a dash", m.flowBytes(-5), "—");
eq("bytes: zero is zero", m.flowBytes(0), "0 B");
eq("rate: undefined is a dash", m.flowRate(undefined), "—");
eq("rate: kb/s", m.flowRate(116508), "117 kb/s");
eq("rate from bytes uses covered seconds", m.rateFromBytes(37500, 300), 1000);
eq("rate with nothing covered is null, not 0", m.rateFromBytes(0, 0), null);
eq("rate from a missing byte count is null", m.rateFromBytes(null, 300), null);

const msgRange = m.notMeasuredMessage(NOT_MEASURED_SUMMARY, ["receiving"], NOW);
check(
  "no data in range says where data starts",
  msgRange.title === "Not measured for this period." && /Data starts /.test(msgRange.body),
  msgRange.body,
);
check("...and that it is not zero traffic", /not zero traffic/.test(msgRange.body));
const noData = { ...NOT_MEASURED_SUMMARY, data_oldest: null, data_newest: null };
const msgSetup = m.notMeasuredMessage(noData, ["not_configured"], NOW);
check(
  "not set up is its own empty, with the setup offer",
  /not set up on this router/.test(msgSetup.title) && msgSetup.offerSetup === true,
);
check(
  "awaiting is unknown, not quiet",
  /unknown, not quiet/i.test(m.notMeasuredMessage(noData, ["awaiting_first_data"], NOW).body),
);
check(
  "unsupported vendor says so and offers no setup",
  /Not supported/.test(m.notMeasuredMessage(noData, ["unsupported_vendor"], NOW).title) &&
    m.notMeasuredMessage(noData, ["unsupported_vendor"], NOW).offerSetup === false,
);
check(
  "flag off on the summary says switched off",
  /switched off/.test(m.notMeasuredMessage({ ...noData, feature_enabled: false }, [], NOW).title),
);
const fresh = m.freshnessLine(summary(), NOW);
check(
  "freshness is the newest window's END (start + window)",
  /^Latest data: .+ \(0 min ago\)$|^Latest data: .+ \(just now\)$/.test(fresh),
  fresh,
);
check("freshness never says live", !/live/i.test(fresh));
check("no data held is said", /none held/.test(m.freshnessLine(noData, NOW)));

// ---------------------------------------------------------------------------
console.log("\nservices are ports, never applications");
const named = summary().services.items[0];
const bare = summary().services.items[1];
eq("named port", m.serviceLabel(named), "https (TCP/443)");
eq("unnamed port is bare protocol/port", m.serviceLabel(bare), "UDP/19305");
eq(
  "no port is just the protocol",
  m.serviceLabel({ protocol: 1, protocol_name: "icmp", port: null, service_name: null }),
  "ICMP",
);
eq("protocol by number when unnamed", m.protocolLabel(47, null), "Protocol 47");
eq("other protocol", m.protocolLabel(null, "other"), "Other");
eq("service key matches the timeline key", m.serviceKey(named), "6/443");
const sv = m.servicesView(summary());
check("services rows + an other row", sv.kind === "rows" && sv.rows.length === 2 && !!sv.other);
eq("share", sv.rows[0].share, "61%");
eq("rate from the API", sv.rows[0].rate, "1.0 Mb/s");
eq("other share", sv.other.share, "8.6%");
eq("other has no direction split to show", sv.other.down, "—");
eq(
  "services_measured:false is not measured, not empty",
  m.servicesView(
    summary({
      services_measured: false,
      services: { exact: true, items: [], other_bytes: 0, other_share: 0 },
    }),
  ).kind,
  "not_measured",
);
eq("measured:false is not measured", m.servicesView(NOT_MEASURED_SUMMARY).kind, "not_measured");
eq(
  "measured with no services is a real empty",
  m.servicesView(summary({ services: { exact: true, items: [], other_bytes: 0, other_share: 0 } }))
    .kind,
  "empty",
);
const pr = m.protocolRows(summary());
check(
  "four protocol rows, zero kept as zero",
  pr.length === 4 && pr[3].share === "0%" && pr[3].bytes === "0 B",
);
eq("protocols not measured is null, not zeros", m.protocolRows(NOT_MEASURED_SUMMARY), null);
eq("share: fraction", m.shareLabel(0.0054), "0.5%");
eq("share: tiny", m.shareLabel(0.0004), "<0.1%");
eq("share: zero is zero", m.shareLabel(0), "0%");
eq("share: null is a dash", m.shareLabel(null), "—");
eq("share: a percent sent by mistake is a dash, not rescaled", m.shareLabel(61.4), "—");
eq("bar width", m.shareBarWidth(0.6143), 61.4);
eq("bar width of an unreadable share is 0", m.shareBarWidth(NaN), 0);
eq("first band colour", m.seriesColor(summary(), "6/443"), "var(--chart-1)");
eq("a service with no band has no colour", m.seriesColor(summary(), "17/19305"), null);
check(
  "as many band colours as series requested",
  m.FLOW_SERIES_COLORS.length === m.FLOW_TIMELINE_SERIES,
);

// ---------------------------------------------------------------------------
console.log("\ntimeline: gaps stay gaps");
const slots = m.timelineSlots(summary());
eq("every step of the hour has a slot", slots.length, 12);
eq("only sent steps are measured", slots.filter((s) => s.measured).length, 3);
const gap = slots[2];
check(
  "a missing step is null everywhere, never 0",
  gap.measured === false && gap.up === null && gap.down === null && gap.services === null,
);
eq("slots are in time order from the range start", slots[0].t, Date.parse("2026-10-12T13:10:00Z"));
eq("rates come from the API", [slots[0].up, slots[0].down], [111848, 1398101]);
const bandSum = Object.values(slots[0].services).reduce((a, b) => a + b, 0);
check(
  "bands add up to up + down (within rounding)",
  Math.abs(bandSum - m.rateFromBytes(4194304 + 52428800, 300)) <= 3,
  String(bandSum),
);
eq("per-service rate uses the step's covered seconds", slots[0].services["6/443"], 978671);
check(
  "a step whose services were not measured has totals but no bands",
  slots[1].measured === true && slots[1].services === null && slots[1].down === 1398101,
);
eq(
  "a half-covered step is rated on what was covered",
  slots[10].services["6/443"],
  m.rateFromBytes(36700160, 150),
);
check(
  "the gap note counts the blanks",
  /^9 of 12 steps have no data/.test(m.timelineGapNote(slots)),
);
check("the gap note says not zero", /not zero/.test(m.timelineGapNote(slots)));
eq("no gaps, no note", m.timelineGapNote(slots.filter((s) => s.measured)), null);
eq("not measured draws nothing", m.timelineSlots(NOT_MEASURED_SUMMARY), []);
eq(
  "an unusable step size invents nothing",
  m.timelineSlots(summary({ step_seconds: 0 })).length,
  3,
);
eq("step label: minutes", m.stepLabel(300), "5-minute steps");
eq("step label: hour", m.stepLabel(3600), "1-hour steps");
eq("step label: missing", m.stepLabel(null), "Step not reported");

// ---------------------------------------------------------------------------
console.log("\ndevices and destinations: separate lists, lower bounds");
check("devices are lower bounds", m.isLowerBound(summary(), "devices"));
check("destinations are lower bounds", m.isLowerBound(summary(), "destinations"));
check("services are not", !m.isLowerBound(summary(), "services"));
check(
  "the wording follows the API field, not a constant",
  !m.isLowerBound(
    summary({ list_accuracy: { ...summary().list_accuracy, lower_bound: false } }),
    "devices",
  ) && m.lowerBoundNote(summary({ list_accuracy: null }), "devices") === null,
);
check(
  "the footnote says at least and names the top N",
  /at least/.test(m.lowerBoundNote(summary(), "devices")) &&
    /top 10 devices/.test(m.lowerBoundNote(summary(), "devices")),
);
eq("at least", m.atLeast("308 MB", true), "at least 308 MB");
eq("exact stays bare", m.atLeast("308 MB", false), "308 MB");
eq("a dash is not 'at least'", m.atLeast("—", true), "—");
eq("everything else is an upper bound", m.otherAtMostLabel(411041792, true), "at most 411 MB");
eq("missing everything-else is no line", m.otherAtMostLabel(null, true), null);
eq("session match", m.deviceMatchLabel("session"), "Guest login");
eq("no match", m.deviceMatchLabel("none"), "Not a guest login");
eq("unknown match is not a guest", m.deviceMatchLabel("bogus"), "Not known");
check(
  "the not-counted panel has four items, all not yet checked",
  m.NOT_COUNTED_ITEMS.length === 4 && /Not yet checked/.test(m.NOT_YET_CHECKED),
);

// ---------------------------------------------------------------------------
console.log("\nsetup drawer");
eq("script lines are joined", m.scriptText(["a", "b"]), "a\nb");
eq("no lines is no script", m.scriptText([]), null);
eq("null is no script", m.scriptText(null), null);
const cfg = (over = {}) => ({
  router_id: "r1",
  status: row(),
  eligible: true,
  blockers: [],
  blocker_codes: [],
  routeros_version: "7.18.2",
  desired: null,
  paste_script: [],
  removal_script: [],
  ...over,
});
eq("eligible and permitted: nothing blocks", m.applyBlockers(cfg(), true), []);
check("no permission blocks", /traffic_flows\.update/.test(m.applyBlockers(cfg(), false)[0]));
eq(
  "the backend's sentence is shown",
  m.applyBlockers(
    cfg({ eligible: false, blockers: ["No tunnel."], blocker_codes: ["NO_TUNNEL"] }),
    true,
  ),
  ["No tunnel."],
);
check(
  "a code without a sentence still gets one",
  /RouterOS/.test(
    m.applyBlockers(cfg({ eligible: false, blocker_codes: ["ROUTEROS_VERSION"] }), true)[0],
  ),
);
check(
  "ineligible with no reason still blocks",
  m.applyBlockers(cfg({ eligible: false }), true).length === 1,
);
const okMsg = m.writeVerdictMessage("apply", {
  ok: true,
  detail: "verified",
  state: "awaiting_first_data",
});
check(
  "verified apply is a success",
  okMsg.tone === "success" && /verified on the router/.test(okMsg.text),
);
const badMsg = m.writeVerdictMessage("apply", { ok: false, detail: "target: port differs" });
check(
  "a 200 with ok:false is a warning that names the fields",
  badMsg.tone === "warning" && /port differs/.test(badMsg.text),
);
check(
  "a missing verdict is a warning, never a success",
  m.writeVerdictMessage("remove", {}).tone === "warning",
);
check(
  "a dry run says nothing was written",
  /Nothing was written/.test(m.dryRunSummary({ planned_writes: ["add x"] })),
);
check(
  "a dry run with no writes says the router matches",
  /already matches/.test(m.dryRunSummary({ planned_writes: [] })),
);

// ---------------------------------------------------------------------------
console.log("\nrequest params");
const params = m.flowSummaryParams({ window: "24h", locationId: "l1", routerId: "" }, NOW);
check(
  "window sent as explicit since/until",
  params.since === "2026-10-11T14:10:00.000Z" && params.until === "2026-10-12T14:10:00.000Z",
  JSON.stringify(params),
);
check("venue sent, empty router not sent", params.location_id === "l1" && !("router_id" in params));
eq(
  "series asks for exactly the bands that have a colour",
  params.series,
  String(m.FLOW_SERIES_COLORS.length),
);
const both = m.flowSummaryParams({ window: "1h", locationId: "l1", routerId: "r1" }, NOW);
check("router and venue may be combined", both.router_id === "r1" && both.location_id === "l1");
eq(
  "the longest window is the backend's 7-day maximum",
  Math.max(...Object.values(m.FLOW_WINDOW_MS)),
  7 * 86400000,
);

// ---------------------------------------------------------------------------
console.log("\nno customer surface, no application claim, wiring");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(f);
  }
  return out;
}
const sources = walk(join(ROOT, "src")).map((f) => [relative(ROOT, f), readFileSync(f, "utf8")]);
const importersOf = (re, self) =>
  sources
    .filter(([f, src]) => f !== self && re.test(src))
    .map(([f]) => f)
    .sort();
const MASTER_FILES = [
  "src/components/master/TrafficFlowRouterDrawer.tsx",
  "src/components/master/TrafficFlowVenueView.tsx",
  "src/routes/master.traffic-flow.tsx",
];
const serviceUsers = importersOf(/traffic-flow\.service/, "src/services/traffic-flow.service.ts");
check(
  "only Master Traffic Lens files import the service",
  serviceUsers.every((f) => f === "src/hooks/useTrafficFlow.ts" || MASTER_FILES.includes(f)),
  serviceUsers.join(", "),
);
const hookUsers = importersOf(/hooks\/useTrafficFlow/, "src/hooks/useTrafficFlow.ts");
check(
  "only Master Traffic Lens files import the hook",
  hookUsers.length > 0 && hookUsers.every((f) => MASTER_FILES.includes(f)),
  hookUsers.join(", "),
);
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const shell = read("src/components/master/MasterShell.tsx");
const page = read("src/routes/master.traffic-flow.tsx");
const venue = read("src/components/master/TrafficFlowVenueView.tsx");
const drawer = read("src/components/master/TrafficFlowRouterDrawer.tsx");
const chart = read("src/components/traffic-lens/TrafficLensTimelineChart.tsx");
const service = read("src/services/traffic-flow.service.ts");
const ui = page + venue + drawer + chart;
check("nav item is cap-gated", /to: "\/master\/traffic-flow",[^}]*cap: "traffic-flow"/.test(shell));
check(
  "nav label reads the constant",
  /to: "\/master\/traffic-flow",\s*label: TRAFFIC_FLOW_MODULE_NAME,/.test(shell),
);
check(
  "nav sits directly after Device Logs",
  /"\/master\/device-logs",\s*"\/master\/traffic-flow",/.test(shell),
);
check(
  "cap maps to the backend's GLOBAL-only read key",
  /"traffic-flow": \["traffic_flows\.read"\]/.test(shell),
);
check(
  "apply cap maps to the update key",
  /"traffic-flow\.apply": \["traffic_flows\.update"\]/.test(shell),
);
const uiCode = ui.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
check("no hard-coded module name in the screens", !/Traffic (Flow|Lens)/.test(uiCode));
check(
  "no screen says Application (except to say a service is not one)",
  !/application/i.test(uiCode.replace(/not an application/g, "")),
);
check("the services column is headed Service (port)", /<MTh>Service \(port\)<\/MTh>/.test(venue));
check("the screen says nothing inspects contents", /inspects/.test(page) && /inspects/.test(venue));
check("writes are confirmed inline, never window.confirm", !/window\.confirm|\bconfirm\(/.test(ui));
check(
  "the drawer has an inline confirm step",
  /setConfirming\("apply"\)/.test(drawer) && /setConfirming\("remove"\)/.test(drawer),
);
check(
  "the drawer reports the read-back, not just the 200",
  /writeVerdictMessage\(op, result\)/.test(drawer) && /toast\.warning/.test(drawer),
);
check(
  "the drawer shows backend-rendered scripts",
  /scriptText\(d\?\.paste_script\)/.test(drawer) &&
    /scriptText\(d\?\.removal_script\)/.test(drawer),
);
check("a dry run is offered", /Dry run \(read only\)/.test(drawer));
check(
  "a real apply always states dry_run explicitly",
  /dry_run: opts\.dryRun/.test(service) &&
    /dryRun: false/.test(read("src/hooks/useTrafficFlow.ts")),
);
check(
  "service talks to the platform prefix only",
  /"\/platform\/traffic-flow"/.test(service) && !/\/overview/.test(service),
);
check(
  "fleet rows use the shared state and counters",
  /flowState\(r\.state\)/.test(page) && /windowsLastHourLabel\(r, windowSeconds\)/.test(page),
);
check(
  "venue totals go through totalsView",
  /totalsView\(s\)/.test(venue) && /!totals\.measured/.test(venue),
);
check("venue shows the freshness line", /freshnessLine\(s, now\)/.test(venue));
check(
  "venue shows the not-counted panel",
  /NOT_COUNTED_ITEMS\.map/.test(venue) && /NOT_YET_CHECKED/.test(venue),
);
check(
  "lower-bound wording is on both lists",
  /lowerBoundNote\(s, "devices"\)/.test(venue) && /lowerBoundNote\(s, "destinations"\)/.test(venue),
);
check(
  "a device row carries no destination or service field",
  !/d\.(dst|destination|remote|service|port)/.test(venue),
);
check(
  "the chart is lazy (recharts off the route's critical path)",
  /lazy\(\(\) =>\s*import\("@\/components\/traffic-lens\/TrafficLensTimelineChart"\)/.test(venue) &&
    !/from "recharts"/.test(venue + page),
);
check(
  "the timeline is bars, so a gap is never bridged",
  /<BarChart/.test(chart) && !/<Area|<Line/.test(chart),
);
check(
  "no fixture data in the app",
  !/192\.168\.|10\.20\.0\.|142\.250\./.test(ui + service + read("src/lib/traffic-flow.ts")),
);

// ===========================================================================
// CUSTOMER DASHBOARD PAGE (wyfy-specs/flow-visibility/API.md, "Customer API")
//
//   7. EVERY STATE IS ITS OWN SCREEN: add-on not enabled, not switched on
//      for the venue, equipment that cannot report, stopped, no data in the
//      period ("not measured", never zero), not this caller's, failed.
//   8. NOTHING ABOUT HOW IT IS GATHERED reaches a customer file, and the
//      customer page has no control and calls no Master route.
//   9. THE SMALL-VENUE RULE IS SAID OUT LOUD: destinations left out because
//      few devices were connected are announced, never silently dropped.
// ===========================================================================
const c = m.customer;

console.log("\ncustomer: which screen");
const base = {
  demo: false,
  entitled: true,
  statusLoading: false,
  statusRefusal: null,
  statusFailed: false,
  status: { collection: "collecting", latest_data: "2026-10-12T14:05:00+00:00" },
};
const kind = (over) => c.lensScreen({ ...base, ...over }).kind;
eq("collecting shows data", c.lensScreen(base), { kind: "data", stopped: false });
eq(
  "entitlements say off: locked without a request",
  kind({ entitled: false, status: null }),
  "locked",
);
eq(
  "a 402 is locked even if entitlements said on",
  kind({ statusRefusal: "locked", status: null }),
  "locked",
);
eq("entitlements unknown never locks by itself", kind({ entitled: null }), "data");
eq(
  "entitlements unknown + no answer yet is loading",
  kind({ entitled: null, status: null, statusLoading: true }),
  "loading",
);
eq(
  "a lapsed licence is its own screen",
  kind({ statusRefusal: "licence", status: null }),
  "licence",
);
eq(
  "403/404 is not-yours, not empty",
  kind({ statusRefusal: "forbidden", status: null }),
  "forbidden",
);
eq("a failed request is failed, not empty", kind({ statusFailed: true, status: null }), "failed");
eq(
  "equipment cannot report",
  kind({ status: { collection: "not_available", latest_data: null } }),
  "not_available",
);
eq(
  "can report, nothing ever arrived: not switched on",
  kind({ status: { collection: "not_collecting_yet", latest_data: null } }),
  "not_switched_on",
);
eq(
  "stopped still shows the earlier data, flagged",
  c.lensScreen({
    ...base,
    status: { collection: "not_collecting_yet", latest_data: "2026-10-12T13:02:00+00:00" },
  }),
  { kind: "data", stopped: true },
);
eq(
  "an unknown collection value is not dressed as working",
  kind({ status: { collection: "weird", latest_data: null } }),
  "failed",
);
eq("the demo account shows no data", kind({ demo: true }), "demo");
eq("402 feature_not_entitled", c.lensRefusalFrom(402, "feature_not_entitled"), "locked");
eq("402 with no code still reads as the lock", c.lensRefusalFrom(402, undefined), "locked");
eq("402 license_not_active", c.lensRefusalFrom(402, "license_not_active"), "licence");
eq("403", c.lensRefusalFrom(403, null), "forbidden");
eq("404 is the same not-yours", c.lensRefusalFrom(404, null), "forbidden");
eq("500 is a failure, not a refusal", c.lensRefusalFrom(500, null), null);
eq("a network error is a failure", c.lensRefusalFrom(null, null), null);

console.log("\ncustomer: words");
for (const k of ["demo", "licence", "forbidden", "failed", "not_available", "not_switched_on"]) {
  check(
    `${k} has a title and a body`,
    c.LENS_NOTICES[k].title.length > 10 && c.LENS_NOTICES[k].body.length > 20,
  );
}
check(
  "not switched on says Wyfy support does it, and offers the ask",
  /Wyfy support switches it on/.test(c.LENS_NOTICES.not_switched_on.body) &&
    c.LENS_NOTICES.not_switched_on.ask === true,
);
check(
  "not switched on is not 'no traffic'",
  /not the same as no traffic/.test(c.LENS_NOTICES.not_switched_on.body),
);
check(
  "not available names the equipment, offers nothing",
  /does not report traffic detail/.test(c.LENS_NOTICES.not_available.body) &&
    c.LENS_NOTICES.not_available.ask === false,
);
check("failed is not an empty venue", /not an empty venue/.test(c.LENS_NOTICES.failed.body));
check("the demo shows no sample figures", /No sample figures/.test(c.LENS_NOTICES.demo.body));
const cnm = c.lensNotMeasured("2026-10-12T09:40:00+00:00", NOW);
check(
  "no data in the period: Not measured, with where data starts",
  cnm.title === "Not measured for this period." &&
    /Data starts /.test(cnm.body) &&
    /not the same as no traffic/.test(cnm.body),
);
check(
  "...and without a start it invents none",
  !/Data starts/.test(c.lensNotMeasured(null, NOW).body),
);
eq(
  "collecting has no stopped notice",
  c.lensStoppedNotice(false, "2026-10-12T14:05:00+00:00", NOW),
  null,
);
const stopped = c.lensStoppedNotice(true, "2026-10-12T13:02:00+00:00", NOW);
check(
  "stopped says No data since, and that the gap is missing data",
  /^No data since /.test(stopped.title) &&
    /missing data, not an idle venue/.test(stopped.body) &&
    stopped.ask === true,
);
check(
  "freshness uses latest_data as sent (already the period's end)",
  /^Latest data: .+ \(5 min ago\)$/.test(c.lensFreshness("2026-10-12T14:05:00+00:00", NOW)),
  c.lensFreshness("2026-10-12T14:05:00+00:00", NOW),
);
eq("no data yet", c.lensFreshness(null, NOW), "Latest data: none yet.");
eq("guest login", c.lensDeviceLabel("session"), "Guest login");
eq("ambiguous", c.lensDeviceLabel("ambiguous"), "Could not tell which guest");
eq("not a guest", c.lensDeviceLabel("none"), "Not a guest login");
eq("unknown match is not called a guest", c.lensDeviceLabel("bogus"), "Not known");
check(
  "the tagline says what it does not show",
  /does not show which sites a particular guest visited/.test(c.LENS_TAGLINE),
);
check(
  "the lock screen is three lines, one of them what it does not do",
  c.LENS_LOCKED_POINTS.length === 3 &&
    c.LENS_LOCKED_POINTS.some((x) => /does not show which sites/.test(x)),
);
check(
  "minimums footnote",
  /at least/.test(c.lensLowerBoundNote(true, "devices")) &&
    /addresses/.test(c.lensLowerBoundNote(true, "destinations")),
);
eq("exact lists get no footnote", c.lensLowerBoundNote(false, "devices"), null);
eq("customer name is the one constant", c.TRAFFIC_LENS_NAME, m.TRAFFIC_FLOW_MODULE_NAME);

console.log("\ncustomer: the small-venue rule is said out loud");
const destItems = [
  { ip: "x", bytes_up: 1, bytes_down: 2, bytes: 3, flows: 1, share_at_least: 0.1 },
];
const all = c.lensDestinationsState(
  { min_devices: 5, windows_withheld: 12, items: [], other_bytes_at_most: null },
  12,
);
check(
  "every period withheld: says why, not 'no destinations'",
  all.kind === "all_withheld" &&
    /Not shown while fewer than 5 devices are connected/.test(all.message),
);
const some = c.lensDestinationsState(
  { min_devices: 5, windows_withheld: 2, items: destItems, other_bytes_at_most: 1 },
  12,
);
check(
  "some withheld: rows plus a plain note with the count",
  some.kind === "rows" &&
    /^2 of 12 five-minute periods/.test(some.note) &&
    /fewer than 5 devices/.test(some.note),
  some.note,
);
check("...and that the totals still include them", /still counted in the totals/.test(some.note));
const one = c.lensDestinationsState(
  { min_devices: 5, windows_withheld: 1, items: destItems, other_bytes_at_most: 1 },
  12,
);
check(
  "singular wording",
  /^1 of 12 five-minute period in this range is left out/.test(one.note),
  one.note,
);
const someEmpty = c.lensDestinationsState(
  { min_devices: 5, windows_withheld: 3, items: [], other_bytes_at_most: 0 },
  12,
);
check(
  "withheld + an empty list still carries the note",
  someEmpty.kind === "empty" && someEmpty.note !== null,
);
const none = c.lensDestinationsState(
  { min_devices: 5, windows_withheld: 0, items: destItems, other_bytes_at_most: 1 },
  12,
);
check("nothing withheld: no note", none.kind === "rows" && none.note === null);
eq(
  "measured and genuinely empty",
  c.lensDestinationsState(
    { min_devices: 5, windows_withheld: 0, items: [], other_bytes_at_most: 0 },
    12,
  ),
  { kind: "empty", note: null },
);
check(
  "a missing threshold is not invented",
  /only a few devices/.test(
    c.lensDestinationsState(
      { min_devices: null, windows_withheld: 12, items: [], other_bytes_at_most: null },
      12,
    ).message,
  ),
);
eq(
  "a missing destinations block is empty, not a crash",
  c.lensDestinationsState(null, 12).kind,
  "empty",
);

console.log("\ncustomer: range, colours, shared helpers on the customer shape");
const b = c.lensRangeBounds({ kind: "preset", window: "6h" }, NOW);
check(
  "bounds are explicit and end now",
  b.since === "2026-10-12T08:10:00.000Z" &&
    b.until === "2026-10-12T14:10:00.000Z" &&
    b.ms === 6 * 3600000,
);
eq(
  "four presets: 1 h, 6 h, 24 h, 7 d",
  c.LENS_PRESETS.map((x) => x.value),
  ["1h", "6h", "24h", "7d"],
);
eq(
  "the longest preset is the 7-day maximum",
  Math.max(...c.LENS_PRESETS.map((x) => x.ms)),
  7 * 86400000,
);
const cp = m.lensSummaryParams(c.LENS_DEFAULT_RANGE, NOW);
check(
  "default is the last hour, sent as since/until",
  cp.since === "2026-10-12T13:10:00.000Z" && cp.until === "2026-10-12T14:10:00.000Z",
);
eq(
  "series asks for exactly the bands that have a colour",
  cp.series,
  String(c.LENS_SERIES_COLORS.length),
);
check(
  "as many band colours as series requested",
  c.LENS_SERIES_COLORS.length === m.LENS_TIMELINE_SERIES,
);
check(
  "no customer band colour repeats",
  new Set(c.LENS_SERIES_COLORS).size === c.LENS_SERIES_COLORS.length,
);
eq(
  "customer band colour by series position",
  m.seriesColor(summary(), "17/443", c.LENS_SERIES_COLORS),
  "var(--chart-5)",
);
eq("overview is the first view", c.LENS_VIEWS[0].id, "overview");
// The customer summary is the Master one minus feature_enabled, plus three
// fields: the shared helpers must work on it unchanged.
const { feature_enabled: _drop, ...core } = summary();
const custSummary = {
  ...core,
  location_id: "l1",
  collection: "collecting",
  latest_data: "2026-10-12T14:10:00+00:00",
};
check(
  "totalsView on the customer shape",
  m.totalsView(custSummary).measured && m.totalsView(custSummary).download === "682 MB",
);
eq(
  "timeline gaps on the customer shape",
  m.timelineSlots(custSummary).filter((x) => !x.measured).length,
  9,
);
eq("services on the customer shape", m.servicesView(custSummary).kind, "rows");
check(
  "measured:false on the customer shape is Not measured",
  !m.totalsView({ ...custSummary, measured: false, totals: null }).measured,
);
check("lower bound read from the customer shape", m.isLowerBound(custSummary, "destinations"));

console.log("\ncustomer: surface rules and wiring");
const CUSTOMER_FILES = [
  "src/lib/traffic-lens-customer.ts",
  "src/lib/traffic-lens-shared.ts",
  "src/lib/traffic-lens-insights.ts",
  "src/components/traffic-lens/TrafficLensView.tsx",
  "src/components/traffic-lens/TrafficLensOverview.tsx",
  "src/components/traffic-lens/TrafficLensParts.tsx",
  "src/components/traffic-lens/TrafficLensLayout.tsx",
  "src/components/traffic-lens/TrafficLensTimelineChart.tsx",
  "src/services/traffic-lens.service.ts",
  "src/hooks/useTrafficLens.ts",
  "src/types/traffic-lens.ts",
  "src/routes/traffic-lens.tsx",
];
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const f of CUSTOMER_FILES) {
  const code = strip(read(f));
  const hit = code.match(
    /wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i,
  );
  check(`${f}: no word about how it is gathered`, !hit, hit ? hit[0] : "");
  check(
    `${f}: imports nothing operator-only`,
    !/lib\/traffic-flow"|traffic-flow\.service|hooks\/useTrafficFlow|components\/master\/|\/platform\//.test(
      code,
    ),
  );
}
// The page is three files since the 2026-10-13 redesign: the shell (screens,
// views, the one range control), the Overview and the small parts.
const lensShell = read("src/components/traffic-lens/TrafficLensView.tsx");
const lensView =
  lensShell +
  read("src/components/traffic-lens/TrafficLensOverview.tsx") +
  read("src/components/traffic-lens/TrafficLensParts.tsx") +
  read("src/components/traffic-lens/TrafficLensLayout.tsx");
const lensService = read("src/services/traffic-lens.service.ts");
const lensCode = strip(lensView);
check("the customer service only reads", !/api\.(post|put|patch|delete)/.test(lensService));
check(
  "the customer service uses the venue path",
  /`\/traffic-flow\/locations\/\$\{encodeURIComponent\(locationId\)\}`/.test(lensService),
);
check(
  "the page has no on/off control",
  !/<Switch|Apply|Remove|Turn (on|off)|window\.confirm/.test(lensCode),
);
check("no screen says Application", !/application/i.test(lensCode));
check(
  "a service with no plain name is captioned Service (port)",
  /"Service \(port\)"/.test(lensView) && /serviceDisplayNames\(/.test(lensView),
);
check(
  "no link to Guest Connection Records, and no sentence that leans on one",
  !/Guest Connection Records|network-activity/.test(lensCode),
);
check(
  "a device row carries only what the API sends",
  !/d\.(name|phone|mac|host|dst|destination|remote|service|port)\b/.test(lensCode),
);
check(
  "the device is labelled through lensDeviceLabel",
  /lensDeviceLabel\(d\.match\)/.test(lensView),
);
check(
  "destinations go through the small-venue rule",
  /lensDestinationsState\(s\.destinations, s\.windows\)/.test(lensView) &&
    /dest\.kind === "all_withheld"/.test(lensView) &&
    /dest\.note/.test(lensView),
);
check(
  "totals go through totalsView; unmeasured shows the notice",
  /totalsView\(s\)/.test(lensView) &&
    /if \(!totals\.measured\) return <NoticeCard notice=\{lensNotMeasured/.test(lensView),
);
check("the screen is decided by lensScreen", /lensScreen\(\{/.test(lensView));
check(
  "the lock comes from /me/entitlements by the add-on key",
  /useFeatureEntitled\(TRAFFIC_LENS_FEATURE_KEY\)/.test(lensView),
);
eq("the add-on key", m.TRAFFIC_LENS_FEATURE_KEY, "traffic_flow");
check(
  "the lock screen files a real ticket",
  /useSupportRequest\(subject\)/.test(lensView) && /LENS_ENABLE_SUBJECT/.test(lensView),
);
check(
  "the chart is lazy and gets the customer colours",
  /lazy\(\(\) =>\s*import\("@\/components\/traffic-lens\/TrafficLensTimelineChart"\)/.test(
    lensView,
  ) && /colors=\{LENS_SERIES_COLORS\}/.test(lensView),
);
check(
  "one range control",
  (lensView.match(/<LensRangeControl/g) ?? []).length === 1 &&
    /function LensRangeControl/.test(lensView),
);
check("views come from LENS_VIEWS", /LENS_VIEWS\.map/.test(lensView));
check(
  "no fixture data in the customer files",
  !CUSTOMER_FILES.some((f) => /192\.168\.|10\.20\.0\.|142\.250\./.test(read(f))),
);
const nav = read("src/lib/customerNav.ts");
const sidebar = read("src/components/customer/CustomerSidebar.tsx");
const featurePage = read("src/components/customer/CustomerFeaturePage.tsx");
check(
  "nav row: Network group, owner only",
  /id: "traffic-lens", label: "Traffic Lens", icon: Waypoints, roles: \["owner"\]/.test(nav) &&
    nav.indexOf('id: "traffic-lens"') > nav.indexOf('id: "network"') &&
    nav.indexOf('id: "traffic-lens"') < nav.indexOf('id: "security",\n    label'),
);
eq("nav row needs venue_traffic.read", m.NAV_PERMISSION_KEYS["traffic-lens"], [
  "venue_traffic.read",
]);
check(
  "that key is one the backend seeds",
  m.BACKEND_PERMISSION_KEYS.includes("venue_traffic.read"),
);
check(
  "sidebar lock badge reads the entitlement",
  /useFeatureEntitled\(TRAFFIC_LENS_FEATURE_KEY\)/.test(sidebar) &&
    /item\.id === "traffic-lens" && trafficLensEntitled === false/.test(sidebar),
);
check(
  "the shell renders the view for the selected venue",
  /feature === "traffic-lens" && <TrafficLensView locationId=\{locationId\} \/>/.test(featurePage),
);
check(
  "the route requires a customer session and a venue",
  /createFileRoute\("\/traffic-lens"\)/.test(read("src/routes/traffic-lens.tsx")) &&
    /requireCustomerSession/.test(read("src/routes/traffic-lens.tsx")) &&
    /requireActiveLocationId/.test(read("src/routes/traffic-lens.tsx")),
);
check(
  "staff are not offered it in the Staff Access catalog",
  !/traffic-lens/.test(read("src/config/customerFeatureCatalog.ts")),
);
for (const lang of ["en", "hi"]) {
  check(
    `${lang} nav label exists`,
    typeof JSON.parse(read(`src/lib/i18n/locales/${lang}/nav.json`)).customerItem[
      "traffic-lens"
    ] === "string",
  );
}

console.log(
  failures === 0
    ? `\nall traffic flow checks passed\n`
    : `\n${failures} traffic flow check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
