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
 * agent evidence -- it has checked in, or reports a RouterOS version, or has
 * an API credential on file -- is treated as agent-managed whatever its vendor
 * column says. A device that checked in and then stopped is down, and that
 * fact cannot depend on what someone typed in a dropdown afterwards.
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
  ["hasApiCredentials", { vendor: "tplink_omada", hasApiCredentials: true }],
]) {
  check(`${label} alone is agent evidence`, hasAgentEvidence(row));
  check(`${label} alone defeats the controller label`, !isControllerManagedRow(row));
}

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
check("the controller is not offered", split.writable.every((r) => r.id !== "b"));
check("the MikroTik is offered", split.writable.some((r) => r.id === "a"));
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
for (const name of ["wg0", "wg_mgmt", "WG-CloudGuard", "gre-tunnel1", "l2tp-out1", "ovpn-client1"]) {
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
  STATES.every((s) => !/^(Online|Offline|Live|Gone quiet|Never checked in)$/.test(CONTROLLER_STATE_COPY[s].label)),
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
  /isControllerManagedRow\(/.test(liveness) && !/\bisControllerManaged\(raw\.vendor\)/.test(liveness),
);

const fleet = read("src/routes/master.routers.tsx");
check("the fleet renders the mismatch tag", /VENDOR_MISMATCH_LABEL/.test(fleet));
check("the fleet buckets a down controller as offline", /controller-reported-down/.test(fleet));
check(
  "the fleet passes agent evidence into the derivation",
  /routeros_version: r\.routerOsVersion/.test(fleet) &&
    /has_api_credentials: r\.hasApiCredentials/.test(fleet),
);
check(
  "the vendor <select> offers only implemented vendors",
  // Lookbehind, because "SELECTABLE_DEVICE_VENDORS.map" contains
  // "DEVICE_VENDORS.map" -- a bare substring check passes for the wrong reason
  // and then fails for the right one.
  /SELECTABLE_DEVICE_VENDORS\.map/.test(fleet) && !/(?<!SELECTABLE_)DEVICE_VENDORS\.map/.test(fleet),
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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
