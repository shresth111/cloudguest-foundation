/**
 * Traffic Lens "Worth a look", fed by the server's findings.
 * Shapes: wyfy-specs/flow-visibility/API.md, "Findings API". The fixtures
 * below exist ONLY in this file; every address is from a documentation
 * range.
 *
 * What this pins, worst-first:
 *
 *   1. A CARD NAMES A DEVICE OR A DESTINATION, NEVER BOTH -- and a response
 *      that ever carried both would be shown without its detail.
 *   2. "COULD NOT BE CHECKED" IS NEVER SHOWN AS CLEAR: each reason has its
 *      own words, an unknown reason still reads "could not be checked", and
 *      none of them is folded into the "nothing flagged" line.
 *   3. A FLAG IS NOT AN ACCUSATION. A service is "unusual for this venue";
 *      no card says malicious, attack, hacked or infected-for-certain, and
 *      the clear line never says the venue is fine.
 *   4. ONLY `act` IS ALARMING: `look` and `info` never use the destructive
 *      colour, and an unknown severity is treated as `look`.
 *   5. FLAGGED FIRST (most serious first), clear checks in ONE line.
 *   6. LOWER BOUNDS STAY "AT LEAST", and the list's name, date and credit
 *      are shown whenever the list was used.
 *
 * Bundles the real module with esbuild and executes it (this repo has no
 * test runner -- see scripts/test-traffic-flow.mjs).
 *
 * Run: node scripts/test-traffic-lens-findings.mjs
 */
process.env.TZ = "UTC";

import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
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
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
const has = (name, text, part) =>
  check(name, String(text).includes(part), `"${part}" not in "${text}"`);

const outdir = mkdtempSync(join(tmpdir(), "traffic-lens-findings-"));
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/traffic-lens-findings.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src").replace(/\\/g, "/") },
});
const m = await import(bundle);

// ---------------------------------------------------------------------------
// Fixtures (API.md's own example)
// ---------------------------------------------------------------------------
const NOW = Date.parse("2026-10-12T04:05:00Z");
const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const PERIOD = { since: "2026-10-12T03:00:00+00:00", until: "2026-10-12T04:00:00+00:00" };
const HOUR = { start: PERIOD.since, end: PERIOD.until };
const DEVICE_IP = "192.168.88.24";
const BAD_ADDRESS = "203.0.113.9";

const base = (id, names, over = {}) => ({
  id,
  state: "clear",
  reason: null,
  severity: null,
  names,
  period: PERIOD,
  parts: null,
  evidence: {},
  thresholds: {},
  ...over,
});

const upload = (over = {}) =>
  base("upload_heavy", "nothing", {
    state: "flagged",
    severity: "look",
    parts: {
      ...HOUR,
      bytes_up: 3 * GIB,
      typical_bytes_up: 100 * MIB,
      times_typical: 30.7,
      hours: 1,
    },
    evidence: {
      period_bytes: 3 * GIB,
      baseline_days: 7,
      derived: true,
      typical_busiest_hour_bytes_up: 100 * MIB,
      items: [{ ...HOUR, bytes_up: 3 * GIB, bytes_down: 200 * MIB, bytes: 3 * GIB + 200 * MIB }],
    },
    ...over,
  });

const quiet = (over = {}) =>
  base("quiet_hours_traffic", "nothing", {
    state: "flagged",
    severity: "look",
    parts: { ...HOUR, bytes: 800 * MIB, usual_at_most_bytes: MIB, hours: 2, baseline_days: 7 },
    evidence: {
      baseline_days: 7,
      derived: true,
      quiet_hours_utc: [0, 1, 2, 3, 4, 5],
      items: [{ ...HOUR, bytes: 800 * MIB, usual_at_most_bytes: MIB }],
    },
    ...over,
  });

const device = (over = {}) =>
  base("dominant_device", "device", {
    state: "flagged",
    severity: "info",
    parts: {
      share_at_least: 0.71,
      bytes_at_least: 7 * GIB,
      device: { router_id: "r1", ip: DEVICE_IP, match: "none", guest_session_id: null },
    },
    evidence: { period_bytes: 10 * GIB, devices_at_once: 12, lower_bound: true },
    ...over,
  });

const service = (over = {}) =>
  base("unusual_service", "service", {
    state: "flagged",
    severity: "look",
    parts: {
      protocol: 6,
      protocol_name: "tcp",
      port: 6881,
      service_name: null,
      share: 0.3,
      bytes: 3 * GIB,
      why: "new",
      services: 1,
      baseline_days: 7,
    },
    evidence: {
      baseline_days: 7,
      items: [
        {
          protocol: 6,
          protocol_name: "tcp",
          port: 6881,
          service_name: null,
          bytes: 3 * GIB,
          share: 0.3,
          why: "new",
          days_seen: 1,
        },
      ],
    },
    ...over,
  });

const knownBad = (over = {}) =>
  base("known_bad_destinations", "destination", {
    state: "flagged",
    severity: "act",
    parts: {
      addresses: 1,
      bytes_at_least: 2 * GIB,
      address: BAD_ADDRESS,
      list_name: "Spamhaus DROP",
      list_date: "2026-10-12",
    },
    evidence: {
      list: { name: "Spamhaus DROP", date: "2026-10-12", entries: 1726 },
      lower_bound: true,
      addresses_checked: 212,
      addresses_matched: 1,
      items: [
        {
          address: BAD_ADDRESS,
          bytes: 2 * GIB,
          flows: 40,
          windows: 9,
          list_entry: "203.0.113.0/24",
          reference: "SBL1",
        },
      ],
    },
    ...over,
  });

const cannot = (id, names, reason, evidence = {}, thresholds = {}) =>
  base(id, names, { state: "could_not_check", reason, evidence, thresholds });

const THREAT = {
  name: "Spamhaus DROP",
  available: true,
  date: "2026-10-12",
  stale: false,
  max_age_days: 14,
  entries: 1726,
  credit: {
    text: "Known-bad address list: Spamhaus DROP, The Spamhaus Project",
    url: "https://www.spamhaus.org/blocklists/do-not-route-or-peer/",
  },
};

function response(findings, over = {}) {
  const counts = { flagged: 0, clear: 0, could_not_check: 0 };
  for (const f of findings) counts[f.state] += 1;
  return {
    location_id: "loc",
    measured: true,
    ...PERIOD,
    window_seconds: 300,
    windows: 12,
    data_oldest: null,
    data_newest: null,
    baseline: { since: "", until: PERIOD.until, days: 7, derived: true, timezone: "UTC" },
    counts,
    notifications: false,
    threat_list: THREAT,
    findings,
    ...over,
  };
}

const ALL_FLAGGED = [upload(), quiet(), device(), service(), knownBad()];
const ALL_CLEAR = [
  base("upload_heavy", "nothing"),
  base("quiet_hours_traffic", "nothing"),
  base("dominant_device", "device"),
  base("unusual_service", "service"),
  base("known_bad_destinations", "destination"),
];
/** A UTC hour as this machine prints a time (12- or 24-hour: the runner's
 * locale decides, the checks do not care which). */
const T = (h) =>
  new Date(Date.UTC(2026, 9, 12, h)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const textOf = (card) =>
  [card.name, card.text, card.next ?? "", ...card.rows.flatMap((r) => [r.label, r.value])].join(
    " | ",
  );
const allText = (view) =>
  [
    view.heading,
    view.clearLine ?? "",
    view.basis,
    view.withheldNote ?? "",
    ...view.flagged.map(textOf),
    ...view.unchecked.map(textOf),
  ].join(" | ");

// ---------------------------------------------------------------------------
console.log("\n1. A card names a device or a destination, never both");
// ---------------------------------------------------------------------------
{
  const view = m.findingsView(response(ALL_FLAGGED), NOW);
  eq("all five are flagged", view.flagged.length, 5);
  for (const card of view.flagged) {
    const text = textOf(card);
    check(
      `${card.id}: not both the device and the address`,
      !(text.includes(DEVICE_IP) && text.includes(BAD_ADDRESS)),
      text,
    );
  }
  const byId = Object.fromEntries(view.flagged.map((c) => [c.id, textOf(c)]));
  has("the device card names the device", byId.dominant_device, DEVICE_IP);
  check("the device card names no outside address", !byId.dominant_device.includes(BAD_ADDRESS));
  has("the address card names the address", byId.known_bad_destinations, BAD_ADDRESS);
  check(
    "the address card names no device",
    !byId.known_bad_destinations.includes(DEVICE_IP) &&
      !/192\.168\./.test(byId.known_bad_destinations),
  );
  for (const id of ["upload_heavy", "quiet_hours_traffic", "unusual_service"])
    check(`${id}: names neither`, !byId[id].includes(DEVICE_IP) && !byId[id].includes(BAD_ADDRESS));
  has(
    "the address card says it cannot say which device",
    byId.known_bad_destinations,
    "does not say which device",
  );
  has(
    "the upload card says it cannot say which device",
    byId.upload_heavy,
    "does not say which device",
  );

  // A response that carried both (the server never sends one).
  const paired = knownBad();
  paired.parts = { ...paired.parts, device: { ip: DEVICE_IP } };
  check("a paired finding is detected", m.findingPairsDeviceWithDestination(paired) === true);
  const card = m.findingCard(paired, NOW);
  eq("a paired finding shows no rows", card.rows, []);
  check(
    "a paired finding shows neither value",
    !textOf(card).includes(DEVICE_IP) && !textOf(card).includes(BAD_ADDRESS),
  );
  eq("a paired finding is still flagged", card.state, "flagged");
  for (const f of ALL_FLAGGED)
    check(
      `${f.id}: the fixture is not a pairing`,
      m.findingPairsDeviceWithDestination(f) === false,
    );
  const pairedEvidence = device();
  pairedEvidence.evidence = {
    ...pairedEvidence.evidence,
    items: [{ remote_address: BAD_ADDRESS }],
  };
  check(
    "a pairing hidden in evidence is detected too",
    m.findingPairsDeviceWithDestination(pairedEvidence) === true,
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. Could not be checked is never clear");
// ---------------------------------------------------------------------------
{
  const REASONS = {
    not_measured: "No data for this period.",
    no_quiet_hours: "no regularly quiet hour",
    no_device_list: "No device figures",
    services_not_measured: "Protocol and port were not recorded",
    destinations_not_measured: "Outside addresses were not recorded",
    list_unavailable: "not available right now",
    list_stale: "too old to rely on",
    feature_off: "switched off",
  };
  for (const [reason, part] of Object.entries(REASONS)) {
    const card = m.findingCard(cannot("upload_heavy", "nothing", reason), NOW);
    eq(`${reason}: state`, card.state, "could_not_check");
    has(`${reason}: its own words`, card.text, part);
    eq(`${reason}: no tone`, card.tone, null);
  }
  const floor = m.findingCard(
    cannot(
      "dominant_device",
      "device",
      "not_enough_traffic",
      { period_bytes: 30 * MIB },
      { min_period_bytes: GIB },
    ),
    NOW,
  );
  has("not enough traffic: says so", floor.text, "Not enough traffic to judge");
  check(
    "not enough traffic: what there was, with its unit",
    /: [\d.]+ MB in this period/.test(floor.text),
    floor.text,
  );
  check(
    "not enough traffic: what it needs, with its unit",
    /needs [\d.]+ GB\./.test(floor.text),
    floor.text,
  );
  const short = m.findingCard(
    cannot(
      "upload_heavy",
      "nothing",
      "baseline_too_short",
      { baseline_days: 2 },
      { baseline_min_days: 4 },
    ),
    NOW,
  );
  has("short baseline: needs", short.text, "Needs 4 days");
  has("short baseline: has", short.text, "there are 2 so far");
  const one = m.findingCard(
    cannot(
      "upload_heavy",
      "nothing",
      "baseline_too_short",
      { baseline_days: 1 },
      { baseline_min_days: 4 },
    ),
    NOW,
  );
  has("short baseline: singular", one.text, "there is 1 so far");
  const few = m.findingCard(
    cannot("dominant_device", "device", "too_few_devices", {}, { min_devices: 5 }),
    NOW,
  );
  has("too few devices: the number", few.text, "Fewer than 5 devices");
  has("too few devices: why it is not a flag", few.text, "ordinary");
  const withheld = m.findingCard(
    cannot("known_bad_destinations", "destination", "withheld_small_venue", { min_devices: 5 }),
    NOW,
  );
  eq(
    "withheld: the small-venue sentence",
    withheld.text,
    "Not checked while fewer than 5 devices are connected.",
  );
  const unknown = m.findingCard(cannot("upload_heavy", "nothing", "something_new"), NOW);
  eq("an unknown reason still reads could not be checked", unknown.text, "Could not be checked.");
  eq("an unknown reason is not clear", unknown.state, "could_not_check");
  const noReason = m.findingCard(cannot("upload_heavy", "nothing", null), NOW);
  eq("no reason at all still reads could not be checked", noReason.text, "Could not be checked.");

  const mixed = m.findingsView(
    response([
      base("upload_heavy", "nothing"),
      cannot("quiet_hours_traffic", "nothing", "no_quiet_hours"),
      base("dominant_device", "device"),
      cannot("unusual_service", "service", "baseline_too_short"),
      cannot("known_bad_destinations", "destination", "list_unavailable"),
    ]),
    NOW,
  );
  eq(
    "unchecked are listed one by one",
    mixed.unchecked.map((c) => c.id),
    ["quiet_hours_traffic", "unusual_service", "known_bad_destinations"],
  );
  check(
    "the clear line names only what was checked",
    mixed.clearLine.includes("an unusually heavy upload") &&
      mixed.clearLine.includes("one device using most of the traffic") &&
      !mixed.clearLine.includes("quiet") &&
      !mixed.clearLine.includes("unusual for this venue") &&
      !mixed.clearLine.includes("known-bad"),
    mixed.clearLine,
  );

  const none = m.findingsView(
    response(ALL_CLEAR.map((f) => cannot(f.id, f.names, "not_measured"))),
    NOW,
  );
  eq("nothing checked: no clear line at all", none.clearLine, null);
  has("nothing checked: the heading says so", none.heading, "none of which could be run");
  eq("nothing checked: five listed", none.unchecked.length, 5);
}

// ---------------------------------------------------------------------------
console.log("\n3. A flag is not an accusation");
// ---------------------------------------------------------------------------
{
  const flagged = m.findingsView(response(ALL_FLAGGED), NOW);
  const clear = m.findingsView(response(ALL_CLEAR), NOW);
  const text = `${allText(flagged)} | ${allText(clear)}`.toLowerCase();
  for (const word of ["malicious", "malware", "attack", "hacked", "hacker", "criminal", "botnet"])
    check(`never says "${word}"`, !text.includes(word));
  for (const phrase of [
    "all good",
    "all clear",
    "is safe",
    "is fine",
    "no problems",
    "secure network",
  ])
    check(`never says "${phrase}"`, !text.includes(phrase));
  const svc = flagged.flagged.find((c) => c.id === "unusual_service");
  has("a service is unusual for this venue", svc.text, "unusual for this venue");
  has("a port is a label, not an app", svc.next, "A port is a label, not an app");
  has("unusual is not wrong", svc.next, "unusual is not the same as wrong");
  has("the service is its port label", svc.text, "TCP/6881");
  has("new is said plainly", svc.text, "new at this venue");
  const seen = m.findingCard(
    service({ parts: { ...service().parts, why: "large_share", days_seen: 2 } }),
    NOW,
  );
  has("a large share says how often it was seen", seen.text, "seen here on 2 days only");
  const bad = flagged.flagged.find((c) => c.id === "known_bad_destinations");
  has("an address match says may, not is", bad.next, "may be infected or misused");
  const up = flagged.flagged.find((c) => c.id === "upload_heavy");
  has("an upload lists ordinary causes first", up.next, "a backup");
  const q = flagged.flagged.find((c) => c.id === "quiet_hours_traffic");
  has("quiet hours are said to be worked out", q.next, "not from your opening hours");
  eq(
    "nothing flagged: the line",
    clear.clearLine.startsWith("Nothing flagged. Looked for: "),
    true,
  );
  eq("nothing flagged: no cards", clear.flagged.length + clear.unchecked.length, 0);
  has("nothing is sent: said", clear.basis, "no alert is sent");
  has("the baseline is this venue's own", clear.basis, "this venue's last 7 days");
}

// ---------------------------------------------------------------------------
console.log("\n4. Only act is alarming");
// ---------------------------------------------------------------------------
{
  const view = m.findingsView(response(ALL_FLAGGED), NOW);
  eq("tones are the server's", Object.fromEntries(view.flagged.map((c) => [c.id, c.tone])), {
    known_bad_destinations: "act",
    upload_heavy: "look",
    quiet_hours_traffic: "look",
    unusual_service: "look",
    dominant_device: "info",
  });
  eq(
    "an unknown severity is look, not act",
    m.findingCard(upload({ severity: "critical" }), NOW).tone,
    "look",
  );
  eq("a missing severity is look", m.findingCard(upload({ severity: null }), NOW).tone, "look");
  eq(
    "a low address match stays look",
    m.findingCard(knownBad({ severity: "look" }), NOW).tone,
    "look",
  );
  eq("clear has no tone", m.findingCard(base("upload_heavy", "nothing"), NOW).tone, null);

  const component = readFileSync(
    join(ROOT, "src/components/traffic-lens/TrafficLensFindings.tsx"),
    "utf8",
  );
  const tones = component.slice(
    component.indexOf("const TONE"),
    component.indexOf("} as const;", component.indexOf("const TONE")),
  );
  const block = (name) => {
    const start = tones.indexOf(`${name}: {`);
    const next = ["act: {", "look: {", "info: {"]
      .map((k) => tones.indexOf(k, start + 1))
      .filter((i) => i > start);
    return tones.slice(start, next.length ? Math.min(...next) : undefined);
  };
  check("act uses the destructive colour", block("act").includes("destructive"));
  check("look does not", !block("look").includes("destructive") && !/red-\d/.test(block("look")));
  check("info does not", !block("info").includes("destructive") && !/red-\d/.test(block("info")));
  check("look is amber", block("look").includes("amber"));
  eq(
    "the destructive colour appears in the act tone only",
    component.split("destructive").length - 1,
    block("act").split("destructive").length - 1,
  );
  check("no raw red anywhere in the block", !/\b(bg|text|border)-red-\d/.test(component));
  check(
    "colour is never the only signal: a label for screen readers",
    component.includes("sr-only"),
  );
}

// ---------------------------------------------------------------------------
console.log("\n5. Flagged first, clear in one line");
// ---------------------------------------------------------------------------
{
  const view = m.findingsView(response(ALL_FLAGGED), NOW);
  eq(
    "most serious first, then the server's order",
    view.flagged.map((c) => c.id),
    [
      "known_bad_destinations",
      "upload_heavy",
      "quiet_hours_traffic",
      "unusual_service",
      "dominant_device",
    ],
  );
  eq("heading counts", view.heading, "5 of 5 checks flagged for this period");
  eq("nothing clear: no line", view.clearLine, null);
  for (const card of view.flagged)
    check(`${card.id}: opens to its evidence`, card.rows.length > 0 && !!card.next);

  const some = m.findingsView(
    response([
      upload(),
      ...ALL_CLEAR.slice(1, 4),
      cannot("known_bad_destinations", "destination", "list_stale"),
    ]),
    NOW,
  );
  eq("one flagged", some.heading, "1 of 5 checks flagged for this period");
  check("clear ones are one string", typeof some.clearLine === "string");
  has("the line says they were looked for", some.clearLine, "Also looked for, and not flagged:");
  eq("three names in the one line", some.clearLine.split(";").length, 3);
  eq("clear cards carry no rows", m.findingCard(ALL_CLEAR[0], NOW).rows, []);
  const clear = m.findingsView(response(ALL_CLEAR), NOW);
  eq("all clear: heading", clear.heading, "5 checks, run on this period's figures");
  eq(
    "an unknown rule id still renders",
    m.findingCard(base("something_else", "nothing"), NOW).name,
    "A check",
  );
  eq("names follow the server's five rules", Object.keys(m.FINDING_NAMES), [
    "upload_heavy",
    "quiet_hours_traffic",
    "dominant_device",
    "unusual_service",
    "known_bad_destinations",
  ]);
}

// ---------------------------------------------------------------------------
console.log("\n6. Lower bounds, units, the list's name and date");
// ---------------------------------------------------------------------------
{
  const view = m.findingsView(response(ALL_FLAGGED), NOW);
  const byId = Object.fromEntries(view.flagged.map((c) => [c.id, c]));
  has("device share is at least", byId.dominant_device.text, "at least 71%");
  has("device bytes are at least", byId.dominant_device.text, "(at least ");
  has("device kind is in plain words", textOf(byId.dominant_device), "Not a guest login");
  has("devices at once is an upper figure", textOf(byId.dominant_device), "up to 12");
  has("address bytes are at least", byId.known_bad_destinations.text, "at least ");
  has("the list is named", byId.known_bad_destinations.text, "Spamhaus DROP");
  has("the list's date is given", byId.known_bad_destinations.text, "(2026-10-12)");
  has("the listed block is evidence", textOf(byId.known_bad_destinations), "203.0.113.0/24");
  has("how many were compared", textOf(byId.known_bad_destinations), "212 recorded");
  has("upload: the hour", byId.upload_heavy.text, `${T(3)} to ${T(4)}`);
  has(
    "upload: against the venue's own usual",
    byId.upload_heavy.text,
    "about 30.7 times this venue's usual busiest upload hour",
  );
  has("upload: what it is compared with", textOf(byId.upload_heavy), "this venue's last 7 days");
  has("quiet: what is normal there", byId.quiet_hours_traffic.text, "normally uses at most");
  has(
    "quiet: more hours are counted",
    byId.quiet_hours_traffic.text,
    "1 more quiet hour was like it",
  );
  has(
    "quiet: the worked-out hours, local time",
    textOf(byId.quiet_hours_traffic),
    `${T(0)} to ${T(6)}`,
  );
  for (const card of view.flagged)
    check(
      `${card.id}: every figure has a unit`,
      /\d\s?(B|kB|KB|MB|GB|TB|KiB|MiB|GiB|%)/.test(card.text),
      card.text,
    );

  const zero = m.findingCard(
    upload({ parts: { ...upload().parts, typical_bytes_up: 0, times_typical: null } }),
    NOW,
  );
  has("no usual upload: no invented multiple", zero.text, "usually uploads almost nothing");
  check("no usual upload: no 'times'", !zero.text.includes("times this venue"));

  eq("credit: shown with its link and the list's date", view.credit, {
    text: THREAT.credit.text,
    url: THREAT.credit.url,
    date: "2026-10-12",
  });
  const absent = m.findingsView(
    response(ALL_CLEAR, { threat_list: { ...THREAT, available: false, date: null } }),
    NOW,
  );
  eq("list not on the server: no credit for a list that was not used", absent.credit, null);
  const stale = m.findingsView(
    response(
      [...ALL_CLEAR.slice(0, 4), cannot("known_bad_destinations", "destination", "list_stale")],
      {
        threat_list: { ...THREAT, stale: true },
      },
    ),
    NOW,
  );
  eq("stale list: not used, so no credit", stale.credit, null);

  const customer = m.findingsView(
    response(ALL_CLEAR, { min_devices: 5, windows_withheld: 3 }),
    NOW,
  );
  eq(
    "customer: periods left out are counted",
    customer.withheldNote,
    "The address check left out 3 five-minute periods with fewer than 5 devices connected.",
  );
  eq(
    "nothing left out: no note",
    m.findingsView(response(ALL_CLEAR, { min_devices: 5, windows_withheld: 0 }), NOW).withheldNote,
    null,
  );
  eq("master: no note", view.withheldNote, null);
  const left = m.findingCard(
    knownBad({ evidence: { ...knownBad().evidence, min_devices: 5, windows_withheld: 4 } }),
    NOW,
  );
  has(
    "a flagged address card says what was left out",
    textOf(left),
    "4 five-minute periods with fewer than 5 devices",
  );

  eq("quiet hours: one run", m.quietHoursLabel([0, 1, 2], NOW), `${T(0)} to ${T(3)}`);
  eq(
    "quiet hours: two runs",
    m.quietHoursLabel([1, 2, 13], NOW),
    `${T(1)} to ${T(3)}, ${T(13)} to ${T(14)}`,
  );
  eq(
    "quiet hours: across midnight is one run",
    m.quietHoursLabel([22, 23, 0, 1], NOW),
    `${T(22)} to ${T(2)}`,
  );
  eq("quiet hours: none", m.quietHoursLabel([], NOW), null);
  eq("quiet hours: junk is ignored", m.quietHoursLabel([24, -1, "3", 2.5], NOW), null);
  eq("hour label: today", m.findingHourLabel(HOUR.start, HOUR.end, NOW), `${T(3)} to ${T(4)}`);
  eq("hour label: nothing given", m.findingHourLabel(null, null, NOW), "An hour in this period");
}

// ---------------------------------------------------------------------------
console.log("\n7. Wiring");
// ---------------------------------------------------------------------------
{
  const read = (p) => readFileSync(join(ROOT, p), "utf8");
  const lib = read("src/lib/traffic-lens-findings.ts");
  const types = read("src/types/traffic-lens-findings.ts");
  const component = read("src/components/traffic-lens/TrafficLensFindings.tsx");
  const customerService = read("src/services/traffic-lens.service.ts");
  const masterService = read("src/services/traffic-flow.service.ts");
  const overview = read("src/components/traffic-lens/TrafficLensOverview.tsx");
  const master = read("src/components/master/TrafficFlowVenueView.tsx");
  const hook = read("src/hooks/useTrafficLens.ts");

  check("the view module fetches nothing", !/\bfetch\(|axios|@\/services\//.test(lib));
  check("the block fetches nothing", !/\bfetch\(|axios|@\/services\/|useQuery/.test(component));
  check(
    "the customer call is the venue path",
    customerService.includes("`${base(locationId)}/findings`"),
  );
  check(
    "the customer service still calls no Master route",
    !/\/platform\//.test(customerService.replace(/\/\*[\s\S]*?\*\//g, "")),
  );
  check("the Master call is the platform path", masterService.includes("`${BASE}/findings`"));
  check(
    "the Master call always names the venue",
    masterService.includes("location_id: locationId"),
  );
  check("the customer page shows the block", overview.includes("<TrafficLensFindings"));
  check(
    "a failed load falls back to the page's own checks, through the same block",
    overview.includes("fallbackChecks={checks}") && !overview.includes("function WorthALook"),
  );
  check(
    "the server's verdict on the heavy device decides the answer tile too",
    overview.includes('serverFindingState(findings.data, "dominant_device")') &&
      overview.includes("lensHeaviestDevice(s, serverDevice)") &&
      overview.includes("lensChecks(s, serverDevice)"),
  );
  check("one renderer for both sources", component.includes("browserChecksView(fallbackChecks)"));
  check("the Master venue view shows the block", master.includes("<TrafficLensFindings"));
  check(
    "Master asks only once a venue is known",
    read("src/hooks/useTrafficFlow.ts").includes("enabled: !!scope.locationId"),
  );
  check(
    "the organisation is in the customer cache key",
    /findings: \(org: string \| null/.test(hook),
  );
  check("the checks use the summary's own period", hook.includes("lensRangeBounds(range, at)"));
  check(
    "a failed request is said, not shown as clear",
    component.includes("a request that failed is not a clear result"),
  );
  check("the credit is a link", component.includes("href={view.credit.url}"));
  check("flagged cards can be opened", component.includes("aria-expanded={open}"));
  check(
    "no type field holds a device beside a destination",
    !/device[^\n]*address|address[^\n]*device/i.test(types.replace(/\/\*[\s\S]*?\*\//g, "")),
  );
  check(
    "no fixture data ships with the block",
    ![lib, component].some((s) => /203\.0\.113|192\.168\.|SBL\d/.test(s)),
  );
  for (const word of ["tunnel", "wireguard", "exporter", "collector", "netflow", "ipfix"])
    check(
      `"${word}" is in no customer-facing word`,
      !lib.toLowerCase().includes(word) && !component.toLowerCase().includes(word),
    );
}

// ---------------------------------------------------------------------------
console.log("\n8. The page's own checks go through the same block");
// ---------------------------------------------------------------------------
{
  const chk = (id, state, name) => ({ id, state, name, text: `${name}: the measurement.` });
  const three = [
    chk("heavy_device", "flagged", "One device using most of the traffic"),
    chk("upload_heavy", "clear", "More upload than download"),
    chk("unnamed_ports", "unchecked", "A quarter or more on ports with no standard name"),
  ];
  const view = m.browserChecksView(three);
  eq("fallback: heading", view.heading, "1 of 3 checks flagged for this period");
  eq(
    "fallback: a flag is look, never act",
    view.flagged.map((c) => c.tone),
    ["look"],
  );
  eq(
    "fallback: unchecked is could not be checked",
    view.unchecked.map((c) => c.state),
    ["could_not_check"],
  );
  has("fallback: clear ones are one line", view.clearLine, "more upload than download");
  check(
    "fallback: the unchecked one is not in the clear line",
    !view.clearLine.includes("quarter"),
  );
  has("fallback: says it is the shorter set", view.basis, "could not be loaded");
  eq("fallback: no list was used, so no credit", view.credit, null);
  const quietView = m.browserChecksView(
    three.map((c) => ({ ...c, state: c.state === "flagged" ? "clear" : c.state })),
  );
  check(
    "fallback, nothing flagged: the line names what could not be checked",
    /Could not check: a quarter or more/.test(quietView.clearLine),
    quietView.clearLine,
  );
  eq("fallback, nothing flagged: not listed twice", quietView.unchecked, []);
  const noneRun = m.browserChecksView(three.map((c) => ({ ...c, state: "unchecked" })));
  eq(
    "fallback, nothing run: says so",
    noneRun.clearLine,
    "Nothing could be checked for this period.",
  );

  const data = response([device(), cannot("upload_heavy", "nothing", "not_measured")]);
  eq("server verdict: flagged", m.serverFindingState(data, "dominant_device"), "flagged");
  eq(
    "server verdict: could not check",
    m.serverFindingState(data, "upload_heavy"),
    "could_not_check",
  );
  eq(
    "server verdict: a rule that is not there",
    m.serverFindingState(data, "unusual_service"),
    null,
  );
  eq("server verdict: not loaded yet", m.serverFindingState(undefined, "dominant_device"), null);
  eq(
    "server verdict: a state it does not know",
    m.serverFindingState(
      response([base("dominant_device", "device", { state: "odd" })]),
      "dominant_device",
    ),
    null,
  );
}

console.log(
  failures === 0
    ? `\nall traffic lens findings checks passed\n`
    : `\n${failures} traffic lens findings check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
