/**
 * Regression test for the customer dashboard's device health & interface
 * traffic derivation.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 * `interface_traffic_counters` stores IF-MIB octet *counters*, not rates.
 * Everything the venue owner sees is a difference between two of them, so
 * the arithmetic is the whole feature -- and it is the kind that is
 * silently wrong rather than loudly broken. In rough order of how badly a
 * regression would hurt:
 *
 *   1. A COUNTER RESET MUST RENDER AS A GAP, NEVER AS A SPIKE. A device
 *      reboot restarts the counter near zero, so the naive delta is
 *      negative. `Math.abs()` of that is an enormous fake burst placed at
 *      exactly the moment the device was least healthy -- which is
 *      precisely when someone is looking at this page. A negative value
 *      is nonsense too. Only a gap is honest.
 *   2. A MISSING READING MUST NEVER BECOME ZERO. An SNMP agent that does
 *      not answer an OID reported nothing; "0 Mbps" is a measurement
 *      nobody took, and on a traffic chart it reads as "the line was
 *      idle" -- the opposite of the truth when the truth is unknown.
 *   3. READINGS WITH NO INTERFACE DATA MUST BE SKIPPED, NOT ZEROED. Both
 *      metrics sweeps write into the same table on different cadences,
 *      and only the SNMP one carries per-interface counters. Treating the
 *      router-API rows as zeroes would punch a fake hole into every
 *      other slot of every chart.
 *   4. A GAP TOO LONG TO AVERAGE OVER MUST NOT BE AVERAGED. A saturation
 *      peak divided across six hours of downtime reads as calm.
 *
 * Also asserts the naming discipline (`docs/ipdr-logs-syslog-spec.md` §5)
 * and the two-render-path wiring, since a correct derivation rendered
 * nowhere -- or rendered on only one of the two paths -- is the same bug
 * wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure
 * derivation is bundled with esbuild and executed for real; the wiring is
 * checked against the real component and config sources.
 *
 * Run: node scripts/test-device-health.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

// ---------------------------------------------------------------------------
// Bundle the real derivation.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "device-health-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export {
     toInterfaceSeries,
     intervalMbps,
     formatOctets,
     formatMbps,
     metricsSourceLabel,
     readingSpanLabel,
     MAX_INTERVAL_MINUTES,
   } from "${join(ROOT, "src/lib/device-health.ts").replace(/\\/g, "/")}";`,
);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});

const {
  toInterfaceSeries,
  intervalMbps,
  formatOctets,
  formatMbps,
  metricsSourceLabel,
  readingSpanLabel,
  MAX_INTERVAL_MINUTES,
} = await import(outfile);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = "2026-09-01T10:00:00.000Z";
const T5 = "2026-09-01T10:05:00.000Z";
const T10 = "2026-09-01T10:10:00.000Z";
const T_FAR = "2026-09-01T14:00:00.000Z"; // 4 h after T10

/** An SNMP reading carrying one interface's counters. */
function snmpReading(id, at, inOctets, outOctets, extra = {}) {
  return {
    id,
    routerId: "r1",
    recordedAt: at,
    healthStatus: "healthy",
    cpuUsagePercent: 20,
    memoryUsagePercent: 40,
    uptimeSeconds: 1000,
    connectedClientsCount: null,
    metricsSource: "snmp",
    interfaceTrafficCounters: [{ ifIndex: 1, ifName: "ether1", up: true, inOctets, outOctets }],
    ...extra,
  };
}

/** A router-API reading: no per-interface breakdown at all. */
function routerApiReading(id, at) {
  return {
    id,
    routerId: "r1",
    recordedAt: at,
    healthStatus: "healthy",
    cpuUsagePercent: 25,
    memoryUsagePercent: 42,
    uptimeSeconds: 1000,
    connectedClientsCount: 12,
    metricsSource: "routerApi",
    interfaceTrafficCounters: null,
  };
}

// ---------------------------------------------------------------------------
// 1. The happy path: a real rate out of two real counters.
// ---------------------------------------------------------------------------

// 37.5 MB across 300 s = 37_500_000 * 8 / 300 / 1e6 = 1 Mbps.
check(
  "interval-mbps-computes-a-real-rate",
  Math.abs(intervalMbps(0, 37_500_000, T0, T5) - 1) < 1e-9,
  `got ${intervalMbps(0, 37_500_000, T0, T5)}`,
);

// ---------------------------------------------------------------------------
// 2. COUNTER RESET -> GAP. The headline invariant.
// ---------------------------------------------------------------------------

const reset = intervalMbps(9_000_000_000, 12_000_000, T0, T5);
check("counter-reset-is-a-gap", reset === null, `got ${reset}`);
check("counter-reset-is-never-negative", !(typeof reset === "number" && reset < 0));
check(
  "counter-reset-is-never-an-absolute-value-spike",
  !(typeof reset === "number" && reset > 1),
  "abs() of a reset would draw a huge fake burst at the worst possible moment",
);

// End to end, through the series builder: a reboot mid-history.
const rebooted = toInterfaceSeries([
  snmpReading("a", T0, 1_000_000_000, 500_000_000),
  snmpReading("b", T5, 1_037_500_000, 512_500_000),
  snmpReading("c", T10, 5_000_000, 2_000_000), // rebooted
]);
check("series-built-for-the-interface", rebooted.length === 1 && rebooted[0].ifName === "ether1");
check(
  "series-reboot-point-is-null-not-a-spike",
  rebooted[0].points.length === 2 && rebooted[0].points[1].downMbps === null,
  JSON.stringify(rebooted[0].points),
);
check(
  "series-peak-ignores-the-reset-interval",
  Math.abs(rebooted[0].peakDownMbps - 1) < 1e-9,
  `peak was ${rebooted[0].peakDownMbps}`,
);
check(
  "series-totals-exclude-the-reset-interval",
  rebooted[0].totalInOctets === 37_500_000,
  `total was ${rebooted[0].totalInOctets}`,
);

// ---------------------------------------------------------------------------
// 3. MISSING READING -> GAP, NEVER ZERO.
// ---------------------------------------------------------------------------

check("null-earlier-counter-is-a-gap", intervalMbps(null, 100, T0, T5) === null);
check("null-later-counter-is-a-gap", intervalMbps(100, null, T0, T5) === null);
check(
  "a-missing-counter-never-becomes-zero",
  intervalMbps(null, null, T0, T5) !== 0,
  "0 Mbps reads as 'the line was idle', which is not what an unanswered OID means",
);

const withNulls = toInterfaceSeries([
  snmpReading("a", T0, 1_000, 1_000),
  snmpReading("b", T5, null, null),
  snmpReading("c", T10, 37_501_000, 37_501_000),
]);
check(
  "series-null-counters-produce-nulls-not-zeroes",
  withNulls[0].points.every((p) => p.downMbps === null || typeof p.downMbps === "number") &&
    withNulls[0].points[0].downMbps === null,
  JSON.stringify(withNulls[0].points),
);

// ---------------------------------------------------------------------------
// 4. READINGS WITH NO INTERFACE DATA ARE SKIPPED, NOT ZEROED.
// ---------------------------------------------------------------------------

const interleaved = toInterfaceSeries([
  snmpReading("a", T0, 1_000_000_000, 500_000_000),
  routerApiReading("b", T5),
  snmpReading("c", T10, 1_075_000_000, 525_000_000),
]);
check(
  "router-api-readings-do-not-create-points",
  interleaved[0].points.length === 1,
  `got ${interleaved[0].points.length} points`,
);
check(
  "router-api-readings-do-not-zero-the-chart",
  interleaved[0].points[0].downMbps !== null && interleaved[0].points[0].downMbps > 0,
  "the SNMP pair either side of a router-API row must still yield a real rate",
);
// 75 MB over 600 s = 1 Mbps.
check(
  "rate-spans-the-skipped-reading-correctly",
  Math.abs(interleaved[0].points[0].downMbps - 1) < 1e-9,
  `got ${interleaved[0].points[0].downMbps}`,
);

// ---------------------------------------------------------------------------
// 5. TOO LONG A GAP IS NOT AVERAGED.
// ---------------------------------------------------------------------------

check(
  "an-over-long-interval-is-a-gap",
  intervalMbps(0, 99_999_999_999, T10, T_FAR) === null,
  "a peak averaged across four hours of downtime reads as calm",
);
check("max-interval-is-declared", MAX_INTERVAL_MINUTES === 30);
check("zero-length-interval-is-a-gap", intervalMbps(0, 100, T0, T0) === null);
check("backwards-interval-is-a-gap", intervalMbps(0, 100, T5, T0) === null);

// ---------------------------------------------------------------------------
// 6. Interfaces stay separate, and the peak names the right one.
// ---------------------------------------------------------------------------

function twoIface(id, at, wanIn, lanIn) {
  return {
    id,
    routerId: "r1",
    recordedAt: at,
    healthStatus: "healthy",
    cpuUsagePercent: null,
    memoryUsagePercent: null,
    uptimeSeconds: null,
    connectedClientsCount: null,
    metricsSource: "snmp",
    interfaceTrafficCounters: [
      { ifIndex: 1, ifName: "ether1", up: true, inOctets: wanIn, outOctets: 0 },
      { ifIndex: 2, ifName: "ether2", up: false, inOctets: lanIn, outOctets: 0 },
    ],
  };
}
const multi = toInterfaceSeries([
  twoIface("a", T0, 0, 0),
  twoIface("b", T5, 75_000_000, 3_750_000),
]);
check("two-interfaces-give-two-series", multi.length === 2);
check("series-sorted-by-if-index", multi[0].ifIndex === 1 && multi[1].ifIndex === 2);
check(
  "each-interface-keeps-its-own-rate",
  Math.abs(multi[0].peakDownMbps - 2) < 1e-9 && Math.abs(multi[1].peakDownMbps - 0.1) < 1e-9,
  `${multi[0].peakDownMbps} / ${multi[1].peakDownMbps}`,
);
check("peak-records-when-it-happened", multi[0].peakDownAt === T5);
check("interface-up-state-is-carried", multi[0].up === true && multi[1].up === false);

// One physical port polled by both sweeps is ONE series.
//
// The two transports disagree about `ifIndex` by construction: SNMP
// reports a real IF-MIB ifIndex, the RouterOS-API sweep parses the
// device's own internal row id. Keying the series on the index would
// split `ether1` into two half-length series -- each of which renders as
// a perfectly ordinary complete one, with no error anywhere to say the
// operator is looking at half the history.
const mixedTransport = toInterfaceSeries([
  {
    ...snmpReading("a", T0, 0, 0),
    metricsSource: "snmp",
    interfaceTrafficCounters: [
      { ifIndex: 1, ifName: "ether1", up: true, inOctets: 0, outOctets: 0 },
    ],
  },
  {
    ...snmpReading("b", T5, 0, 0),
    metricsSource: "routerApi",
    // Same physical port, different numbering scheme.
    interfaceTrafficCounters: [
      { ifIndex: 7, ifName: "ether1", up: true, inOctets: 75_000_000, outOctets: 0 },
    ],
  },
]);
check(
  "one-port-across-both-transports-is-one-series",
  mixedTransport.length === 1,
  `got ${mixedTransport.length} series: ${mixedTransport.map((s) => `${s.ifName}#${s.ifIndex}`).join(",")}`,
);
check(
  "and-the-rate-across-that-pair-is-measured",
  mixedTransport[0] && Math.abs(mixedTransport[0].peakDownMbps - 2) < 1e-9,
  `${mixedTransport[0] && mixedTransport[0].peakDownMbps}`,
);
// Two genuinely different ports must still stay apart -- the fix above
// must not have collapsed the series onto something too coarse.
check(
  "different-ports-are-still-different-series",
  multi.length === 2 && multi[0].ifName === "ether1" && multi[1].ifName === "ether2",
);

// ---------------------------------------------------------------------------
// 7. Formatting never dresses an unknown as a number.
// ---------------------------------------------------------------------------

check("format-mbps-null-is-not-zero", formatMbps(null) === "No reading", formatMbps(null));
check("format-octets-null-is-a-dash", formatOctets(null) === "—", formatOctets(null));
check("format-octets-real-value", formatOctets(1024) === "1.0 KB", formatOctets(1024));
check("metrics-source-null-is-not-recorded", metricsSourceLabel(null) === "Not recorded");
check("metrics-source-snmp", metricsSourceLabel("snmp") === "SNMP");
check("metrics-source-router-api", metricsSourceLabel("routerApi") === "Router API");
check("span-needs-two-readings", readingSpanLabel([snmpReading("a", T0, 1, 1)]) === null);

// ---------------------------------------------------------------------------
// 8. Wiring: BOTH render paths, and the naming discipline.
// ---------------------------------------------------------------------------

const view = readFileSync(
  join(ROOT, "src/components/customer/DeviceHealthTrafficView.tsx"),
  "utf8",
);
const featurePage = readFileSync(
  join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"),
  "utf8",
);
const featureRegistry = readFileSync(join(ROOT, "src/config/customerFeatures.tsx"), "utf8");

// There are two render paths for a customer feature, and wiring only one
// leaves the other silently rendering something else.
check(
  "wired-into-the-customer-feature-page",
  /DeviceHealthTrafficView locationId=\{locationId\}/.test(featurePage) &&
    /import \{ DeviceHealthTrafficView \}/.test(featurePage),
  "path B: the real /devices route",
);
check(
  "wired-into-the-render-registry",
  // The guarantee is that the registry *renders* this view, not how the
  // module reaches it. The registry loads its feature pages lazily now (one
  // static import there put the whole feature set, OperationsFeatures
  // included, into the graph the browser fetches before first paint), so
  // accept either form: a static `import { DeviceHealthTrafficView }` or a
  // deferred `lazyView(..., "DeviceHealthTrafficView")`. Asserting the
  // import *syntax* rather than the wiring would fail on a change that
  // keeps the guarantee perfectly intact -- as it just did.
  /DeviceHealthTrafficView locationId=\{ctx\.locationId\}/.test(featureRegistry) &&
    (/import \{ DeviceHealthTrafficView \}/.test(featureRegistry) ||
      /lazyView\(\s*\(\) => import\("@\/components\/customer\/DeviceHealthTrafficView"\),\s*"DeviceHealthTrafficView",?\s*\)/.test(
        featureRegistry,
      )),
  "path A: the /agent staff dashboard",
);

// NAMING (docs/ipdr-logs-syslog-spec.md §5): the customer request said
// "SNMP logs". It is not a log, and the transport is not the product.
const customerCopy = view.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
// "No rate yet" and "not measured at all" are different facts, and the
// view must not tell the operator the second when the first is true.
// The window is small (one sweep interval after a device's very first
// counter reading) but it is a plain false statement while it lasts --
// and it lasts forever for a device that has been read exactly once.
check(
  "measured-once-is-not-reported-as-unmeasured",
  /hasCounters/.test(view) && /hasRateData/.test(view),
  "the view still collapses 'no rate yet' and 'no counters at all' into one condition",
);
check(
  "the-not-measured-message-is-guarded-by-having-no-counters",
  /hasCounters \? \(/.test(view),
  "the two empty states are not branched on hasCounters",
);
check(
  "the-waiting-message-explains-why-two-readings-are-needed",
  /throughput needs two readings/i.test(view),
  "the waiting state does not say why it is waiting",
);

check(
  "customer-copy-never-says-snmp-logs",
  !/snmp\s*logs?/i.test(customerCopy),
  "these are periodic measurements, not an event stream",
);
check(
  "customer-copy-does-not-call-it-logs",
  !/\blogs\b/i.test(customerCopy),
  "naming it 'logs' promises an event stream this data is not",
);
check(
  "customer-facing-title-names-the-real-thing",
  /Device health &amp; interface traffic/.test(view),
);

// SCOPE: SNMP configuration is Master-console only. No credential or
// config field may be read or rendered by any customer-facing surface.
for (const [label, source] of [
  ["view", view],
  ["service", readFileSync(join(ROOT, "src/services/deviceHealth.service.ts"), "utf8")],
  ["hook", readFileSync(join(ROOT, "src/hooks/useDeviceHealth.ts"), "utf8")],
]) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  check(
    `no-snmp-config-fields-in-the-${label}`,
    !/snmp_community|hasSnmpCommunity|has_snmp_community|snmp_enabled|snmpEnabled|snmp_version|snmpVersion|snmp_port|snmpPort/.test(
      code,
    ),
    "the community string is a shared secret; version/port/enabled are infrastructure settings",
  );
}

// The chart must break its line at a gap rather than interpolate over it,
// or invariants 1-4 above are computed correctly and then drawn away.
check(
  "charts-do-not-connect-across-gaps",
  (view.match(/connectNulls=\{false\}/g) || []).length >= 4,
  "every series must break at a null, not bridge it",
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
