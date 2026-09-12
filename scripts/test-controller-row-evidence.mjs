/**
 * A vendor LABEL must never be able to silence a real outage.
 *
 * THE PRODUCTION DEFECT THIS LOCKS DOWN (observed 2026-09-12)
 * ----------------------------------------------------------
 * `/master/routers` read **ONLINE 0 / DEGRADED 0 / OFFLINE 0 / VIA CONTROLLER
 * 7** while a row in that very list was `status: "offline"`,
 * `health_status: "unhealthy"`, `last_seen_at 2026-09-10`. Seven live
 * MikroTiks had been relabelled `tplink_omada` through a bare `<select>` that
 * writes on change with no confirm and no undo, and because every liveness,
 * monitoring and alerting decision keyed off the LABEL alone, that single edit
 * switched monitoring off for all seven and put nothing in its place. Nobody
 * was paged, because the alert evaluator's roster is filtered by the same
 * label.
 *
 * The fix (FIX-PLAN D3a) is that eligibility is EVIDENCE-based: a row carrying
 * agent evidence -- it has checked in (`lastSeenAt`, written only by its
 * heartbeat) or reports a RouterOS version (written only by the agent's status
 * push) -- is treated as agent-managed whatever its vendor column says. A
 * device that checked in and then stopped is down, and that fact cannot depend
 * on what someone typed in a dropdown afterwards.
 *
 * Admin-entered fields are deliberately NOT evidence (FE-1.2) -- see the
 * boundary case in section 1.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. A MISLABELLED ROUTER THAT HAS GONE SILENT IS STILL REPORTED DOWN. This
 *      is the whole defect. If this test passes and nothing else does, the
 *      class of failure is gone.
 *   2. A GENUINE CONTROLLER IS STILL EXEMPT. The evidence rule must not undo
 *      §11.5 -- a legitimately onboarded controller has no agent columns, and
 *      must still never be told it "has never contacted us" or be sent to run
 *      a MikroTik setup script.
 *   3. A CONTROLLER SOMETHING RECORDED AS DOWN IS NOT ABSORBED EITHER. The
 *      vendor gate may suppress a claim this platform never measured; it may
 *      never suppress a negative one it was handed.
 *   4. THE MISLABEL IS VISIBLE, not merely survivable. `vendorLooksWrong` is
 *      what gets the DATA corrected instead of the platform compensating for
 *      it silently for ever.
 *   5. EVERY PRE-EXISTING ANSWER IS UNCHANGED. An agent-managed row with no
 *      vendor surprises must answer exactly as it did before this existed.
 *
 * Also asserts the source-level bindings, because a correct predicate wired to
 * nothing is the same bug wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure
 * predicates are bundled with esbuild and executed for real; the wiring is
 * checked against the real component and route sources.
 *
 * Run: node scripts/test-controller-row-evidence.mjs
 */
import { build } from "esbuild";
import { existsSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "controller-row-evidence-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export {
     isControllerManaged,
     isControllerManagedRow,
     hasAgentEvidence,
     vendorLooksWrong,
     partitionRoutersByDeviceWrite,
     excludedControllerRoutersNote,
     CONTROLLER_STATE_COPY,
     isControllerState,
     controllerStateSentence,
     controllerUnsupportedCopy,
     NOT_MEASURED_HERE,
   } from "${p("src/lib/router-vendors.ts")}";
   export {
     deriveRouterLiveness,
     deriveLocationLiveness,
     lastContactLabel,
     locationIsControllerManaged,
   } from "${p("src/lib/location-liveness.ts")}";
   export { isTunnelInterfaceName, toInterfaceSeries } from "${p("src/lib/device-health.ts")}";`,
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
  isControllerManaged,
  isControllerManagedRow,
  hasAgentEvidence,
  vendorLooksWrong,
  partitionRoutersByDeviceWrite,
  excludedControllerRoutersNote,
  CONTROLLER_STATE_COPY,
  isControllerState,
  controllerStateSentence,
  controllerUnsupportedCopy,
  NOT_MEASURED_HERE,
  deriveRouterLiveness,
  deriveLocationLiveness,
  lastContactLabel,
  locationIsControllerManaged,
  isTunnelInterfaceName,
  toInterfaceSeries,
} = await import(`file://${outfile}`);

const NOW = new Date("2026-09-12T12:00:00.000Z");
const TWO_DAYS_AGO = "2026-09-10T12:00:00.000Z";
const A_MINUTE_AGO = "2026-09-12T11:59:00.000Z";

/* ── 1. The defect itself ──────────────────────────────────────────────── */

console.log("\n1. A mislabelled MikroTik that went silent is still down");

// The exact production row: relabelled, offline, unhealthy, last seen 2 days
// ago. Under the old label-only rule this answered `not-applicable` and was
// counted under "Via controller".
const MISLABELLED = {
  id: "r-office-guest",
  name: "Office Guest",
  status: "offline",
  last_seen_at: TWO_DAYS_AGO,
  vendor: "tplink_omada",
  health_status: "unhealthy",
};

const mislabelled = deriveRouterLiveness(MISLABELLED, NOW);
check(
  "is not exempted as a controller",
  mislabelled.state !== "not-applicable",
  `got state=${mislabelled.state}`,
);
check("reports a definite failure", mislabelled.status === "fail", `got ${mislabelled.status}`);
check(
  "does not claim we never measure it",
  !/no check-in to wait for here/.test(mislabelled.detail),
  mislabelled.detail,
);
check(
  "its last contact is reported as a real timestamp, not 'Not measured here'",
  lastContactLabel(mislabelled, NOW) !== NOT_MEASURED_HERE,
  lastContactLabel(mislabelled, NOW),
);

// And the venue it sits at is not-live, rather than quietly fine.
const venue = deriveLocationLiveness([MISLABELLED], NOW);
check("its venue reads not-live", venue.state === "not-live", `got ${venue.state}`);

// Each individual piece of evidence is enough on its own.
for (const [label, row] of [
  ["last_seen_at", { vendor: "tplink_omada", lastSeenAt: TWO_DAYS_AGO }],
  ["routerOsVersion", { vendor: "tplink_omada", routerOsVersion: "7.14.3" }],
]) {
  check(`${label} alone is agent evidence`, hasAgentEvidence(row));
  check(`${label} alone defeats the controller label`, !isControllerManagedRow(row));
}

// ...and the BOUNDARY, which matters as much as the rule. `routerOsVersion`
// comes from the agent's status push and `lastSeenAt` from its heartbeat --
// both are the DEVICE reporting in. `hasApiCredentials` is somebody typing a
// username and a password into a form, and proves nothing about what is at the
// other end of the row. Counting it would mean that filling in credentials
// silently reclassified a controller as agent-managed: the same "somebody
// typed something" failure this predicate exists to end, with an extra step
// (FIX-PLAN FE-1.2).
check(
  "an admin-entered credential is NOT agent evidence",
  !hasAgentEvidence({ vendor: "tplink_omada", hasApiCredentials: true }),
);
check(
  "and does not defeat the controller label on its own",
  isControllerManagedRow({ vendor: "tplink_omada", hasApiCredentials: true }),
);

/* ── 2. A genuine controller is still exempt ───────────────────────────── */

console.log("\n2. A genuinely onboarded controller keeps its §11.5 exemption");

const GENUINE = {
  id: "r-omada",
  name: "Lobby controller",
  status: "pending_provisioning",
  last_seen_at: null,
  vendor: "tplink_omada",
  health_status: null,
  routeros_version: null,
  has_api_credentials: false,
};

const genuine = deriveRouterLiveness(GENUINE, NOW);
check("is exempt", genuine.state === "not-applicable", `got ${genuine.state}`);
check("never claims to be live", genuine.status !== "pass");
check(
  "is not told to run a setup script",
  !/setup script/i.test(`${genuine.detail} ${genuine.nextStep ?? ""}`),
);
check(
  "its last contact reads 'Not measured here'",
  lastContactLabel(genuine, NOW) === NOT_MEASURED_HERE,
  lastContactLabel(genuine, NOW),
);
check(
  "a venue of only genuine controllers still gates the RouterOS screens",
  locationIsControllerManaged(deriveLocationLiveness([GENUINE], NOW)),
);

/* ── 3. A recorded fault is never absorbed ─────────────────────────────── */

console.log("\n3. A controller recorded as down is reported, not absorbed");

for (const [label, extra] of [
  ["status offline", { status: "offline" }],
  ["health unhealthy", { health_status: "unhealthy" }],
  ["both", { status: "offline", health_status: "unhealthy" }],
]) {
  const row = deriveRouterLiveness({ ...GENUINE, ...extra }, NOW);
  check(`${label}: state is controller-reported-down`, row.state === "controller-reported-down");
  check(`${label}: reports a failure`, row.status === "fail");
  check(
    `${label}: does not borrow agent vocabulary`,
    !/\b(Online|Gone quiet|Never checked in)\b/.test(row.shortLabel),
    row.shortLabel,
  );
}

// ...and it must still count as controller-managed for the SCREEN gate, or a
// venue whose controller is unhealthy would be handed back five RouterOS forms
// the backend still refuses by vendor.
check(
  "a down controller still gates the RouterOS screens",
  locationIsControllerManaged(
    deriveLocationLiveness([{ ...GENUINE, health_status: "unhealthy" }], NOW),
  ),
);

/* ── 4. The mislabel is visible ────────────────────────────────────────── */

console.log("\n4. The mislabel is surfaced, not merely survived");

check(
  "vendorLooksWrong flags the production row",
  vendorLooksWrong({ vendor: "tplink_omada", lastSeenAt: TWO_DAYS_AGO }),
);
check(
  "vendorLooksWrong does not flag a genuine controller",
  !vendorLooksWrong({ vendor: "tplink_omada", lastSeenAt: null }),
);
check(
  "vendorLooksWrong does not flag an ordinary MikroTik",
  !vendorLooksWrong({ vendor: "mikrotik", lastSeenAt: A_MINUTE_AGO }),
);

/* ── 5. Nothing pre-existing moved ─────────────────────────────────────── */

console.log("\n5. Agent-managed rows answer exactly as before");

const HEALTHY = {
  id: "r-1",
  name: "Lobby router",
  status: "online",
  last_seen_at: A_MINUTE_AGO,
  vendor: "mikrotik",
};
const healthy = deriveRouterLiveness(HEALTHY, NOW);
check("a checking-in MikroTik is online", healthy.state === "online" && healthy.status === "pass");
check(
  "a row with no vendor at all is unchanged",
  deriveRouterLiveness({ ...HEALTHY, vendor: undefined }, NOW).state === "online",
);
check(
  "an unrecognised vendor is treated as agent-managed",
  deriveRouterLiveness({ ...HEALTHY, vendor: "unifi" }, NOW).state === "online",
);
// The pure-vendor question is unchanged -- the adapter registries still ask it.
check("isControllerManaged still answers on the label alone", isControllerManaged("tplink_omada"));
check("isControllerManaged is case-insensitive", isControllerManaged("TPLink_Omada"));

/* ── 6. Router pickers ─────────────────────────────────────────────────── */

console.log("\n6. Router pickers offer only what can be written to");

const MIXED = [
  { id: "a", name: "Front desk", vendor: "mikrotik", lastSeenAt: A_MINUTE_AGO },
  { id: "b", name: "Office Guest", vendor: "tplink_omada", lastSeenAt: null },
];
const split = partitionRoutersByDeviceWrite(MIXED);
check(
  "the controller is not offered",
  split.writable.every((r) => r.id !== "b"),
);
check(
  "the MikroTik is offered",
  split.writable.some((r) => r.id === "a"),
);
check("the controller is accounted for", split.controllerManaged.length === 1);
check(
  "a mislabelled MikroTik is NOT removed from its own venue's picker",
  partitionRoutersByDeviceWrite([
    { id: "c", name: "Relabelled", vendor: "tplink_omada", lastSeenAt: TWO_DAYS_AGO },
  ]).writable.length === 1,
);

const note = excludedControllerRoutersNote(split.controllerManaged);
check("what was left out is named", typeof note === "string" && note.length > 0);
check("the note says where it IS configured", /Omada/.test(note ?? ""), note ?? "");
check("nothing excluded means no note at all", excludedControllerRoutersNote([]) === null);

/* ── 7. The hard constraint: no tunnel on a customer surface ───────────── */

console.log("\n7. WireGuard/tunnel interfaces never reach a customer chart");

// Observed live on the venue owner's own Devices screen: "Traffic by port"
// listed `wg-cloudguard` -- Up, 258 KB in / 631 KB out -- beside ether1..5.
check("wg-cloudguard is recognised as a tunnel", isTunnelInterfaceName("wg-cloudguard"));
for (const name of [
  "wg0",
  "wg_mgmt",
  "WG-CloudGuard",
  "gre-tunnel1",
  "l2tp-out1",
  "ovpn-client1",
]) {
  check(`${name} is recognised as a tunnel`, isTunnelInterfaceName(name));
}
for (const name of ["ether1", "ether5", "bridge", "sfp1", "wlan1", "wan"]) {
  check(`${name} is NOT treated as a tunnel`, !isTunnelInterfaceName(name));
}

// End to end, through the real series builder.
const counters = (at, octets) => ({
  id: at,
  routerId: "r-1",
  recordedAt: at,
  healthStatus: "healthy",
  cpuUsagePercent: 5,
  memoryUsagePercent: 30,
  uptimeSeconds: 1000,
  connectedClientsCount: 3,
  metricsSource: "snmp",
  interfaceTrafficCounters: [
    { ifIndex: 1, ifName: "ether1", up: true, inOctets: octets, outOctets: octets },
    { ifIndex: 9, ifName: "wg-cloudguard", up: true, inOctets: octets, outOctets: octets },
  ],
});
const series = toInterfaceSeries([
  counters("2026-09-12T11:00:00.000Z", 1_000_000),
  counters("2026-09-12T11:05:00.000Z", 9_000_000),
]);
check(
  "toInterfaceSeries drops the tunnel entirely",
  series.every((s) => s.ifName !== "wg-cloudguard"),
  series.map((s) => s.ifName).join(", "),
);
check(
  "and keeps the venue's real ports",
  series.some((s) => s.ifName === "ether1"),
);

/* ── 8. The D2 vocabulary ──────────────────────────────────────────────── */

console.log("\n8. The controller status vocabulary");

const STATES = [
  "not_registered",
  "disabled",
  "credentials_rejected",
  "certificate_unverified",
  "unreachable",
  "not_mapped",
  "reachable",
];
for (const s of STATES) {
  check(`${s} has copy`, isControllerState(s) && !!CONTROLLER_STATE_COPY[s]?.label);
}
check("an unknown state is not accepted", !isControllerState("totally_fine"));
check(
  "agent vocabulary is never borrowed for a controller badge",
  STATES.every(
    (s) =>
      !/^(Online|Offline|Live|Gone quiet|Never checked in)$/.test(CONTROLLER_STATE_COPY[s].label),
  ),
);
check(
  "the healthy state is 'Controller reachable', not 'Online'",
  CONTROLLER_STATE_COPY.reachable.label === "Controller reachable",
);
check(
  "{ago} is substituted when a timestamp is known",
  controllerStateSentence("unreachable", "2 days ago").includes("2 days ago"),
);
check(
  "{ago} never leaks as a literal when there is no timestamp",
  !controllerStateSentence("unreachable", null).includes("{ago}") &&
    !controllerStateSentence("reachable", null).includes("{ago}"),
);

/* ── 8b. ...and it is now WIRED, not just defined ──────────────────────── */

console.log("\n8b. The backend's controller_state reaches the three surfaces");

// Until now `CONTROLLER_STATE_COPY`, `isControllerState` and
// `controllerStateSentence` had ZERO consumers in src/ -- this file was the
// only thing that imported them. The vocabulary shipped with #271 and the
// value with backend #239; this is the join.
//
// THE BUCKET STAYS COARSE AND THE WORDS GET FINER. `RouterLivenessState` is
// what a badge, a counter and a filter chip can hold, so the six fault
// states share one member; `CONTROLLER_STATE_COPY` has all seven, so the
// sentence still tells a `not_mapped` venue something different from an
// `unreachable` one. Adding five union members instead would have meant five
// new badge entries, five new fleet buckets and five new chips for a
// distinction only the sentence needs.

const DECLARED = (state, extra = {}) =>
  deriveRouterLiveness({ ...GENUINE, controller_state: state, ...extra }, NOW);

check(
  "reachable is not a fault, and does not borrow agent vocabulary",
  DECLARED("reachable").state === "not-applicable" &&
    DECLARED("reachable").status !== "fail" &&
    DECLARED("reachable").shortLabel === "Controller reachable",
  DECLARED("reachable").shortLabel,
);
for (const state of STATES.filter((s) => s !== "reachable")) {
  const row = DECLARED(state);
  check(
    `${state} is a fault the venue owner is told about`,
    row.state === "controller-reported-down" && row.status === "fail",
    `${row.state}/${row.status}`,
  );
  check(
    `${state} keeps its OWN words, not one shared "Controller down"`,
    row.shortLabel === CONTROLLER_STATE_COPY[state].label,
    row.shortLabel,
  );
  check(`${state} says what to do next`, !!row.nextStep && row.nextStep.length > 10);
}
// The two with opposite next steps, which the old `status === "offline"`
// heuristic could not tell apart at all -- it had one answer for both.
check(
  "unreachable and not_mapped no longer read identically",
  DECLARED("unreachable").shortLabel !== DECLARED("not_mapped").shortLabel &&
    DECLARED("unreachable").nextStep !== DECLARED("not_mapped").nextStep,
);
check(
  "a controller's sync time never becomes a check-in",
  lastContactLabel(
    DECLARED("reachable", {
      controller_last_contacted_at: new Date(NOW.getTime() - 6e4).toISOString(),
    }),
    NOW,
  ) === NOT_MEASURED_HERE,
  "agent vocabulary must not touch a controller, whatever timestamp it has",
);
check(
  "but the sync time does reach the sentence",
  /minute|second|just now/i.test(
    DECLARED("unreachable", {
      controller_last_contacted_at: new Date(NOW.getTime() - 4 * 6e4).toISOString(),
    }).detail,
  ),
);
check(
  "a state this build has no words for falls back rather than rendering blank",
  DECLARED("teleported").state === "not-applicable",
  "isControllerState refuses it and the pre-D2 heuristic answers instead",
);
check(
  "and the fallback still reports a recorded fault",
  DECLARED("teleported", { status: "offline" }).state === "controller-reported-down",
);
check(
  "an agent-managed row is never given a controller state, whatever it carries",
  deriveRouterLiveness({ ...MISLABELLED, controller_state: "unreachable" }, NOW).state !==
    "controller-reported-down",
  "evidence beats the label here too -- this row heartbeats",
);

/* ── 9. The D4 refusal copy ────────────────────────────────────────────── */

console.log("\n9. Device-domain screens explain rather than vanish");

for (const id of ["vlans", "dhcp", "port-forwarding", "voip", "website-blocking"]) {
  const copy = controllerUnsupportedCopy(id, "Sector 12");
  check(`${id} has a reason`, typeof copy === "string" && copy.length > 0);
  check(`${id} names the venue`, (copy ?? "").includes("Sector 12"));
  check(
    `${id} says what we DO do, not only what we don't`,
    /sign guests in/.test(copy ?? ""),
    copy ?? "",
  );
}
check(
  "a feature with no entry gets null rather than a guess",
  controllerUnsupportedCopy("reports", "Sector 12") === null,
);
check(
  "a missing venue name degrades cleanly",
  (controllerUnsupportedCopy("vlans", null) ?? "").startsWith("This venue"),
);

/* ── 10. Wiring ────────────────────────────────────────────────────────── */

console.log("\n10. The predicates are actually wired in");

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const liveness = read("src/lib/location-liveness.ts");
check(
  "location-liveness judges the ROW, not the label",
  /isControllerManagedRow\(/.test(liveness) &&
    !/\bisControllerManaged\(raw\.vendor\)/.test(liveness),
);

const fleet = read("src/routes/master.routers.tsx");

// The wiring itself, at source level: three surfaces, one value.
const svc = read("src/services/router.service.ts");
check(
  "the mapper narrows the wire value instead of trusting it",
  /isControllerState\(r\.controller_state\)/.test(svc),
);
check(
  "and carries the contradiction flag the backend computes",
  /vendorClaimIsContradicted: r\.vendor_claim_is_contradicted === true/.test(svc),
);
check(
  "the Master fleet passes it into every liveness projection it builds",
  (fleet.match(/controller_state: r\.controllerState,/g) ?? []).length === 3,
  "displayStatus, contactLabel and statusBadge each build their own literal",
);
const fixProblemSrc = read("src/components/customer/FixAProblem.tsx");
check(
  "Fix a Problem passes it too",
  /controller_state: router\.controllerState/.test(fixProblemSrc),
);
// Comments stripped first. The fix is explained in a comment that quotes the
// call it replaced, and a negative regex over raw source would match its own
// explanation -- the same reason `test-location-liveness.mjs` checks its
// forbidden patterns "outside comments".
const fixProblemCode = fixProblemSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check(
  "and no longer decides 'do we measure this' from the bare vendor string",
  !/isControllerManaged\(router\.vendor\)/.test(fixProblemCode) &&
    /stateIsControllerManaged\(live\.state\)/.test(fixProblemCode),
  "the label and the row predicate disagreed about the same row",
);
check(
  "and now feeds the D3a evidence gate the evidence",
  /routeros_version: router\.routerOsVersion/.test(fixProblemSrc) &&
    /has_api_credentials: router\.hasApiCredentials/.test(fixProblemSrc),
);

check("the fleet renders the mismatch tag", /VENDOR_MISMATCH_LABEL/.test(fleet));
check("the fleet buckets a down controller as offline", /controller-reported-down/.test(fleet));
check(
  "the fleet passes agent evidence into the derivation",
  /routeros_version: r\.routerOsVersion/.test(fleet),
);
// BOTH vendor <select>s, not one. This assertion used to name only the fleet
// drawer's, and the Advanced drilldown's copy -- same `handleVendorChange`,
// same write -- kept offering Ruckus, UniFi, Aruba and Cisco Meraki for
// another day. `vendorOptionsFor` is the shared answer, so asserting the
// call is asserting both.
const advanced = read("src/components/routers/RouterSetupScriptAdvanced.tsx");
for (const [where, source] of [
  ["the fleet drawer", fleet],
  ["the Advanced drilldown", advanced],
]) {
  check(
    `${where}'s vendor <select> offers only implemented vendors`,
    // Lookbehind, because "SELECTABLE_DEVICE_VENDORS.map" contains
    // "DEVICE_VENDORS.map" -- a bare substring check passes for the wrong
    // reason and then fails for the right one.
    /vendorOptionsFor\([^)]*\)\.map/.test(source) &&
      !/(?<!SELECTABLE_)DEVICE_VENDORS\.map/.test(source),
  );
}
check(
  "a vendor outside the vocabulary stays visible rather than rendering as MikroTik",
  /not supported/.test(read("src/lib/router-vendors.ts")),
);
check(
  "the vendor write goes to the GLOBAL-scoped route, not PUT /routers/{id}",
  /platform\/routers\/\$\{routerId\}\/vendor/.test(read("src/services/router.service.ts")) &&
    !/api\.put\(`\/routers\/\$\{id\}`, \{ vendor \}\)/.test(read("src/hooks/useRouters.ts")),
);
check(
  "and carries a written reason the audit entry can store",
  /reason: input\.reason/.test(read("src/services/router.service.ts")),
);
check(
  "the change is confirmed, not fired from onChange",
  /VendorChangeDialog/.test(fleet) && /setVendorChange\(\{ router, vendor \}\)/.test(fleet),
);
check(
  "the override is offered only after the device has objected",
  /offerOverride = !!error/.test(fleet),
);

const consoleScreen = read("src/routes/master.console.tsx");
check(
  "Device Console refuses a controller as a RouterOS target",
  /isControllerManagedRow\(r\)/.test(consoleScreen) && /no RouterOS/.test(consoleScreen),
);

const deviceHealth = read("src/lib/device-health.ts");
check(
  "the tunnel filter is applied inside toInterfaceSeries",
  /if \(isTunnelInterfaceName\(counter\.ifName\)\) continue;/.test(deviceHealth),
);

for (const f of [
  "src/components/network/VlanManagement.tsx",
  "src/components/network/DhcpManagement.tsx",
  "src/components/network/PortForwardingManagement.tsx",
  "src/components/network/QosManagement.tsx",
  "src/components/network/ContentFilterManagement.tsx",
  "src/components/network/HotspotManagement.tsx",
]) {
  const src = read(f);
  const name = f.split("/").pop();
  check(`${name} builds its pickers through RouterPickerItems`, /<RouterPickerItems /.test(src));
  check(`${name} names what it left out`, /<ControllerRoutersNote /.test(src));
  check(
    `${name} no longer maps routers into SelectItems itself`,
    !/routers(\.rows)?\.map\(\(r\) => \(\s*<SelectItem/.test(src),
  );
}

const verdicts = read("src/lib/connection-verdicts.ts");
check(
  "connection-verdicts gates the unreachable rungs on liveness being measured",
  /measured && signals\.routerReachable === false/.test(verdicts),
);
check(
  "its docstring no longer asserts the fleet is all MikroTik",
  !/^ \* 4\. NEVER CLAIM WIRELESS\. The fleet is MikroTik/m.test(verdicts),
);

const fixAProblem = read("src/components/customer/FixAProblem.tsx");
check(
  "Fix a Problem prefers an agent-managed router as its subject",
  /routers\.find\(\(r\) => isAgentManaged\(r\.vendor\)\)/.test(fixAProblem),
);
check(
  "Fix a Problem tells the verdict engine whether liveness is measured",
  /routerLivenessMeasured: controllerSignals\.measured/.test(fixAProblem),
);

const devices = read("src/components/customer/DeviceHealthTrafficView.tsx");
check(
  "the Devices screen does not fetch history for a controller",
  /useDeviceHealthHistory\(activeIsController \? undefined : activeId\)/.test(devices),
);
check(
  "the Devices screen never renders a model string for a controller",
  /activeIsController\s*\?\s*`\$\{routerVendorLabel/.test(devices),
);

/* ── 11. A refusal must never be painted as an emptiness ───────────────── */

console.log("\n11. Network Integrations distinguishes 'failed' from 'empty'");

// WHY THIS IS ASSERTED HERE. It was reported on 2026-09-12 that the customer
// `/network-integrations` page swallows a 403 into a calm "No controller
// connected", and that the notice panel this branch adds therefore ends in a
// call to action that denies. Checked against the code and against the
// backend: NEITHER half held.
//
//   * `app/domains/network_integration/router.py` does NOT gate every route
//     at GLOBAL. Only the eight `/platform/*` routes carry
//     `scope=ScopeType.GLOBAL`; the sixteen tenant routes ("",
//     "/{integration_id}", "/test-connection", ...) pass no `scope=` at all,
//     and `RequirePermission` then resolves it via `_infer_scope_type`, which
//     yields ORGANIZATION from the `X-Organization-Id` header the customer
//     shell already sends. An Organization Owner holding the key at org scope
//     passes. (That the reporter's own `GET /me/permissions` showed the key is
//     evidence FOR this, not against it.)
//   * This page does not swallow: `isError` renders an `ErrorState` with the
//     real message and a retry, and the empty state is explicitly guarded on
//     `!list.isError`, so a denial cannot reach it. The observed
//     "No controller connected" means the call SUCCEEDED and returned zero
//     rows -- which is what a venue with no integration should see.
//
// Nothing was changed on that surface, because changing it would have broken a
// working one. What is added is this guard: the property that makes the
// reported defect impossible is now asserted, so a future edit that collapses
// the two branches fails here instead of being discovered in production.
// FIX-PLAN FE-0: the customer surface is retired, so the panel must not offer
// a way back to it. Backend `074d719` made every `network_integrations.*`
// route GLOBAL and `rbac.seed`'s RETIRED_NON_GLOBAL_MODULES dropped the
// org-scoped grants, so for a venue owner every call 403s. (That change is
// merged and not yet deployed, which is why the page still answered when it
// was loaded live -- a distinction worth recording, because it is exactly what
// made this look like a false alarm.)
const notice = read("src/components/customer/ControllerManagedFeatureNotice.tsx");
check(
  "the D4 notice offers no link to the retired page",
  !/customerFeatureHref\("network-integrations"\)/.test(notice) && !/<Link/.test(notice),
);
check(
  "it names a person instead of a destination",
  /Your Wyfy Guest contact manages this venue/.test(notice),
);
check(
  "the customer route file is gone",
  !existsSync(join(ROOT, "src/routes/network-integrations.tsx")),
);
for (const [label, rel] of [
  ["the customer nav", "src/lib/customerNav.ts"],
  ["the feature catalog", "src/config/customerFeatureCatalog.ts"],
  ["the customer shell", "src/components/customer/CustomerFeaturePage.tsx"],
  ["the agent shell", "src/config/customerFeatures.tsx"],
]) {
  check(
    `${label} no longer mounts or lists it`,
    !/id: "network-integrations"|case "network-integrations"|feature === "network-integrations"/.test(
      read(rel),
    ),
  );
}

const integrations = read("src/components/features/NetworkIntegrationsPage.tsx");
check(
  "a failed load renders an error, not an empty state",
  /\{list\.isError && \(\s*<ErrorState/.test(integrations),
);
check(
  "the empty state is unreachable while the load is failing",
  /!list\.isLoading && !list\.isError && rows\.length === 0/.test(integrations),
);
check(
  "the error carries the real message rather than a generic one",
  /description=\{errorText\(\s*list\.error/.test(integrations),
);
check("and offers a retry", /onRetry=\{\(\) => list\.refetch\(\)\}/.test(integrations));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
