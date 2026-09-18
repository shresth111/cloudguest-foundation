/**
 * A venue admin must not have to know what hardware their venue runs -- and
 * where the hardware genuinely cannot do something, they must be TOLD, before
 * the click, in words that name the thing and do not blame them.
 *
 * WHAT THIS GUARDS
 * ----------------
 * Three of the customer dashboard's guest controls were written for a MikroTik
 * and shipped unchanged to venues whose access points are a TP-Link Omada
 * controller. Measured against origin/main of the backend, at such a venue:
 *
 *   * Guest WiFi Limits -> Bandwidth, and Access Tiers -> Bandwidth, become a
 *     BANDWIDTH policy, whose only consumer is `queue_management`: a RouterOS
 *     `/queue simple` write plus the MikroTik `Mikrotik-Rate-Limit` reply
 *     attribute. `_QUEUE_ADAPTERS` holds one vendor and a controller's
 *     synthetic `Router` row has NULL API credentials, so
 *     `_assign_guest_queue` raises and is swallowed. The number saved, read
 *     back, displayed as active, and reached nothing.
 *   * Guests -> Disconnect ends our own `GuestSession` row and then asks
 *     `get_guest_access_adapter(router.vendor)`, which raises
 *     `UnsupportedGuestAccessVendorError`. The backend records that honestly
 *     as `disconnect_enforced: false` -- and this dashboard discarded the
 *     whole response body and inferred a verdict from a different call.
 *   * Blocked Guests creates a real rule that really does bar future sign-ins,
 *     then `_enforce_block` raises down the same adapter path, so the rule
 *     persists with `enforcement_status: "failed"` every single time, and the
 *     toast told the owner to "Check the router and try again" -- at a venue
 *     with no router to check, about a retry that cannot succeed.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. A MIKROTIK VENUE IS UNCHANGED, asserted POSITIVELY. Every control is
 *      `available`, every reason is null, `blockOutcomeMessage` returns the
 *      exact sentence it always has, and the disconnect ladder lands on the
 *      same two outcomes it always did. This is the guarantee the whole change
 *      rests on and it is checked first.
 *   2. NO CONTROL IS SILENTLY LIVE. Every device-dependent control at a
 *      controller venue is `unavailable` or `qualified` -- never `available` --
 *      and every one of those carries a non-empty reason.
 *   3. THE COPY CLAIMS NOTHING WE HAVE NOT MEASURED. CAPABILITY-MATRIX §10 is
 *      executed as assertions: no sentence promises enforcement of a speed, no
 *      sentence calls a block a lock, and no sentence says what a block does to
 *      a live session.
 *   4. UNKNOWNS FAIL OPEN. A venue with no routers, an unreadable routers list,
 *      or a mixed MikroTik-and-controller venue keeps every control exactly as
 *      it is today -- the same `every`-not-`some` posture
 *      `locationIsControllerManaged` already takes.
 *   5. THE SCREENS ACTUALLY READ THE LADDER, and do not keep a second copy of
 *      it. Greps, in the same spirit as test-block-users-e164.mjs's.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-controller-venue-network-screens.mjs` for the same note). The
 * pure modules are bundled with esbuild and driven directly, so the assertions
 * are about the words a venue owner would actually read.
 *
 * Run: node scripts/test-omada-client-controls.mjs
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
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "omada-client-controls-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/omada-client-controls.ts"))};\n` +
    `export * from ${JSON.stringify(join(ROOT, "src/lib/block-outcome.ts"))};\n`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  // `@/...` is the app's own alias for src/ (vite-tsconfig-paths); esbuild
  // needs telling separately.
  alias: { "@": join(ROOT, "src") },
});
const {
  CLIENT_CONTROL_IDS,
  clientControlVerdict,
  clientControlVerdicts,
  controlIsUsable,
  disconnectOutcome,
  blockOutcomeMessage,
  CONTROLLER_SPEED_LIMIT_MAX_MBPS,
} = await import(bundle);

// --- the venue shapes ------------------------------------------------
const MIKROTIK = { controllerManaged: false, vendor: null, writes: null };
// What every Omada venue looks like today: the routes that would tell us what
// its controller can do do not exist yet, so `writes` is null.
const CONTROLLER_UNKNOWN = { controllerManaged: true, vendor: "tplink_omada", writes: null };
// What an Open API venue will look like once they do.
const CONTROLLER_OPENAPI = {
  controllerManaged: true,
  vendor: "tplink_omada",
  writes: { disconnect: true, block: true, rateLimit: true, authMode: "openapi" },
};
// And a hotspot-operator-only venue, which CAPABILITY-MATRIX §7 says can have
// the portal and nothing else.
const CONTROLLER_LEGACY = {
  controllerManaged: true,
  vendor: "tplink_omada",
  writes: { disconnect: true, block: false, rateLimit: false, authMode: "legacy" },
};
// A venue summary persisted by a build that predated `RouterLiveness.vendor`.
const CONTROLLER_NO_VENDOR = { controllerManaged: true, vendor: null, writes: null };

const noun = (n) => (n === 1 ? "number" : "numbers");
const rule = (over) => ({
  kind: "identifier",
  id: "r1",
  enforcementStatus: null,
  sessionsEnded: null,
  ...over,
});

// =====================================================================
console.log("\n1. a MikroTik venue is untouched -- asserted positively");
// =====================================================================
for (const control of CLIENT_CONTROL_IDS) {
  const v = clientControlVerdict(control, MIKROTIK);
  eq(`${control} is available at a MikroTik venue`, v.availability, "available");
  eq(`${control} carries no reason at a MikroTik venue`, v.reason, null);
  check(`${control} is usable at a MikroTik venue`, controlIsUsable(v));
}
// The two venue shapes that are NOT controller-managed and must behave as one.
for (const [label, venue] of [
  ["a venue with no routers at all", { controllerManaged: false, vendor: null, writes: null }],
  [
    "a MIXED venue -- a MikroTik beside a controller",
    // `locationIsControllerManaged` is `every`, not `some`, so this arrives
    // here as false and the MikroTik's screens keep working.
    { controllerManaged: false, vendor: "tplink_omada", writes: null },
  ],
]) {
  const all = clientControlVerdicts(venue);
  check(
    `${label} keeps every control`,
    all.every((v) => v.availability === "available" && v.reason === null),
    JSON.stringify(all.filter((v) => v.availability !== "available")),
  );
}
eq(
  "the block toast at a MikroTik venue is the sentence it always was",
  blockOutcomeMessage([rule({ enforcementStatus: "failed" })], noun),
  "1 number blocked, but we could not take them off the WiFi — they may still be online. Check the router and try again.",
);
eq(
  "a confirmed MikroTik disconnect still reads as cleared",
  disconnectOutcome({
    sessionEnforced: true,
    deviceDisconnected: false,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "device-cleared",
);
eq(
  "a failed MikroTik disconnect still reads as a fault",
  disconnectOutcome({
    sessionEnforced: false,
    deviceDisconnected: false,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "not-cleared",
);
eq(
  "a MikroTik disconnect nothing tried is not reported as a failure",
  disconnectOutcome({
    sessionEnforced: null,
    deviceDisconnected: false,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "session-only",
);

// =====================================================================
console.log("\n2. at a controller venue, nothing device-dependent is silently live");
// =====================================================================
for (const [label, venue] of [
  ["no capability reported", CONTROLLER_UNKNOWN],
  ["a hotspot-operator-only venue", CONTROLLER_LEGACY],
]) {
  for (const control of ["speed-limit", "speed-profile"]) {
    const v = clientControlVerdict(control, venue);
    eq(`${control} is refused outright (${label})`, v.availability, "unavailable");
    check(`${control} names a reason (${label})`, !!v.reason && v.reason.length > 30, v.reason);
    check(`${control} is not submittable (${label})`, !controlIsUsable(v));
  }
}
eq(
  "block-device is refused where the credentials cannot make the write",
  clientControlVerdict("block-device", CONTROLLER_LEGACY).availability,
  "unavailable",
);
check(
  "a hotspot-operator venue is told which credential is missing",
  /Open API/.test(clientControlVerdict("block-device", CONTROLLER_LEGACY).reason),
  clientControlVerdict("block-device", CONTROLLER_LEGACY).reason,
);
// Blocking a guest from signing in is a row in OUR database, read by OUR
// portal. It works at every venue on every vendor and gating it would remove
// the only half of blocking that is whole.
eq(
  "barring a sign-in is never gated -- it is ours, not the controller's",
  clientControlVerdict("block-signin", CONTROLLER_UNKNOWN).availability,
  "available",
);
// Disconnect and session timeout stay LIVE and carry a caveat; greying them
// would take away controls that do real work.
for (const control of ["disconnect", "session-timeout"]) {
  const v = clientControlVerdict(control, CONTROLLER_UNKNOWN);
  eq(`${control} stays usable with a caveat`, v.availability, "qualified");
  check(`${control} is still submittable`, controlIsUsable(v));
  check(`${control} says what it will not do`, !!v.reason, v.reason);
}
// And once the controller write lands, the caveat goes away entirely rather
// than lingering as a permanent apology.
for (const control of ["disconnect", "session-timeout"]) {
  const v = clientControlVerdict(control, CONTROLLER_OPENAPI);
  eq(`${control} is unqualified once the controller can be asked`, v.availability, "available");
  eq(`${control} drops its caveat with it`, v.reason, null);
}
eq(
  "an Open API venue gets per-guest speed, with a caveat rather than a refusal",
  clientControlVerdict("speed-limit", CONTROLLER_OPENAPI).availability,
  "qualified",
);

// =====================================================================
console.log("\n3. the copy claims nothing we have not measured -- CAPABILITY-MATRIX §10");
// =====================================================================
const everySentence = [
  CONTROLLER_UNKNOWN,
  CONTROLLER_OPENAPI,
  CONTROLLER_LEGACY,
  CONTROLLER_NO_VENDOR,
]
  .flatMap((venue) => clientControlVerdicts(venue))
  .map((v) => v.reason)
  .filter(Boolean);
check(
  "there are sentences to check at all",
  everySentence.length > 10,
  String(everySentence.length),
);
// §10.4 -- we measured the controller accept, store and return a limit.
// Nobody has measured a device's throughput before and after.
for (const word of [/\benforce[sd]?\b/i, /\bguarantee[sd]?\b/i, /\bat least\b/i]) {
  const offender = everySentence.find((s) => word.test(s));
  check(`no sentence promises a speed it cannot (${word})`, !offender, offender);
}
// §10.5 -- a block is per-site and per-MAC, and phones randomise their MAC.
const blockCopy = clientControlVerdict("block-device", CONTROLLER_OPENAPI).reason;
check(
  "a block that works is still described as a deterrent, not a lock",
  /deterrent/.test(blockCopy) && /random/.test(blockCopy),
  blockCopy,
);
// §10.6 -- what a block does to an already-authorised guest is UNMEASURED.
for (const s of everySentence) {
  check(
    "no sentence claims a block cuts a live guest off",
    !/(kick|cut).{0,24}(off|out)/i.test(s),
    s,
  );
}
// §10.9 -- the controller stores a larger number; nothing proves the AP
// honours it. The contract we enforce is the documented one.
eq("the speed ceiling is the documented contract", CONTROLLER_SPEED_LIMIT_MAX_MBPS, 1024);
// The gap is OURS while the routes do not exist. A sentence that blames the
// customer's hardware for a hole in our product gets the hardware replaced.
const unwired = clientControlVerdict("block-device", CONTROLLER_UNKNOWN).reason;
check(
  "an unwired control asks the customer to talk to us, not to their vendor",
  /Wyfy Guest contact/.test(unwired) && !/unsupported|cannot support/i.test(unwired),
  unwired,
);
// A venue summary persisted before `RouterLiveness.vendor` existed must still
// produce a true sentence -- just one that does not name a brand.
for (const v of clientControlVerdicts(CONTROLLER_NO_VENDOR)) {
  if (!v.reason) continue;
  check(
    `${v.control} stays vendor-neutral when we cannot name the brand`,
    !/TP-Link|Omada/.test(v.reason),
    v.reason,
  );
}
check(
  "and names the brand when we can",
  clientControlVerdicts(CONTROLLER_UNKNOWN).some((v) => v.reason && /TP-Link Omada/.test(v.reason)),
);

// =====================================================================
console.log("\n4. the block toast stops sending owners to a router that is not there");
// =====================================================================
const failedAtController = blockOutcomeMessage([rule({ enforcementStatus: "failed" })], noun, true);
check(
  "it does not tell a controller venue to check the router",
  !/router/i.test(failedAtController),
  failedAtController,
);
check(
  "it does not invite a retry that cannot succeed",
  !/try again/i.test(failedAtController),
  failedAtController,
);
check(
  "it still says the block itself worked",
  /cannot sign in again/.test(failedAtController),
  failedAtController,
);
// The other five branches are venue-independent and must not have moved.
for (const [label, rules] of [
  ["pending", [rule({ enforcementStatus: "pending" })]],
  ["sessions-ended", [rule({ enforcementStatus: "enforced", sessionsEnded: 2 })]],
  ["unenforced", [rule({ enforcementStatus: "unenforced" })]],
  ["nobody-online", [rule({ enforcementStatus: "enforced", sessionsEnded: 0 })]],
  ["unknown", [rule({})]],
]) {
  eq(
    `the ${label} branch is identical at either venue`,
    blockOutcomeMessage(rules, noun, true),
    blockOutcomeMessage(rules, noun, false),
  );
}

// =====================================================================
console.log("\n5. a controller venue's disconnect is not reported as a fault");
// =====================================================================
const controllerVerdict = clientControlVerdict("disconnect", CONTROLLER_UNKNOWN);
eq(
  "a controller venue gets its own outcome, above the failure branch",
  disconnectOutcome({
    // This is what the backend returns there on EVERY call, by construction.
    sessionEnforced: false,
    deviceDisconnected: false,
    verdict: controllerVerdict,
  }),
  "controller-venue",
);
eq(
  "a controller venue that DID clear the device still reads as success",
  disconnectOutcome({
    sessionEnforced: true,
    deviceDisconnected: false,
    verdict: controllerVerdict,
  }),
  "device-cleared",
);
eq(
  "the connected-devices loop alone is enough to claim success",
  disconnectOutcome({
    sessionEnforced: null,
    deviceDisconnected: true,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "device-cleared",
);

// =====================================================================
console.log("\n6. the screens read the ladder, and do not keep a second copy of it");
// =====================================================================
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
for (const [rel, needle, why] of [
  ["src/routes/users.tsx", /disconnectOutcome\(/, "the Disconnect toast picks its branch"],
  ["src/routes/users.tsx", /useClientControls\(\)/, "the confirm dialog knows the venue"],
  [
    "src/components/features/BlockUsers.tsx",
    /blockOutcomeMessage\(created, identifierNoun, clientControls\.controllerManaged\)/,
    "the block toast is told which venue it is on",
  ],
  [
    "src/components/features/BlockUsers.tsx",
    /<ControllerControlNotice verdict=\{blockDeviceVerdict\}/,
    "the device half of a block is named before the click",
  ],
  [
    "src/components/features/LocationPolicies.tsx",
    /disabled=\{!speedUsable\}/,
    "Guest WiFi Limits greys the speed it cannot apply",
  ],
  [
    "src/components/features/CreateGroup.tsx",
    /disabled=\{!tierSpeedUsable\}/,
    "Access Tiers greys the speed it cannot apply",
  ],
  [
    "src/components/features/LocationPolicies.tsx",
    /speedUsable \? \(\s*p\.bandwidth/,
    // The form can be greyed and the saved-policies table one screen down
    // would still print "20 Mbps" from a row written before this venue's
    // router became a controller. Same claim, second place.
    "the saved-policies table does not restate a speed nothing applies",
  ],
  [
    "src/services/customer.service.ts",
    /disconnect_enforced/,
    "the disconnect response is read rather than discarded",
  ],
]) {
  check(`${rel}: ${why}`, needle.test(read(rel)), "grep failed");
}
// The whole point of a pure module is that there is one ladder.
for (const rel of [
  "src/routes/users.tsx",
  "src/components/features/BlockUsers.tsx",
  "src/components/features/LocationPolicies.tsx",
  "src/components/features/CreateGroup.tsx",
]) {
  check(
    `${rel} does not define its own verdict ladder`,
    !/function\s+clientControlVerdict\b/.test(read(rel)),
    "a local copy would drift from the one this test executes",
  );
}
// Wiring a customer screen to a Master route ships a 403 to a paying
// customer: `network_integrations.*` is ScopeType.GLOBAL by seed data and a
// venue admin holds none of it.
for (const rel of [
  "src/routes/users.tsx",
  "src/components/features/BlockUsers.tsx",
  "src/components/features/LocationPolicies.tsx",
  "src/components/features/CreateGroup.tsx",
  "src/hooks/useClientControls.ts",
  "src/services/omada-client-controls.service.ts",
]) {
  check(
    `${rel} does not call a Master-scoped network-integrations route`,
    !/network-integrations\/\$\{|omadaDisconnectService|networkIntegrationService/.test(read(rel)),
    "GLOBAL-scoped routes 403 for a venue admin",
  );
}
// While the contract is unpublished this module must issue no request at all.
check(
  "the adapter stays off the network until the routes land",
  /CUSTOMER_CLIENT_ROUTES_LANDED = false/.test(
    read("src/services/omada-client-controls.service.ts"),
  ),
  "a speculative 404 on every page load reads as an outage to a venue owner",
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
