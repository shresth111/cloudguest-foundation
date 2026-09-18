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
 *   6. THE BACKEND'S REFUSAL IS RENDERED VERBATIM. Its sentence names a
 *      specific credential and a specific place in the controller's settings
 *      tree; a paraphrase kept here would be a second copy, and the copy is
 *      what goes stale. Asserted as an exact string equality, not a match.
 *   7. `performed: false` IS A FAILURE, ON AN HTTP 200, and the number shown
 *      after a speed is `applied`, never `requested`. Both are the traps this
 *      product has already fallen into once.
 *
 * The wire contract those verdicts are computed from -- paths, bodies, and
 * the org-scoping -- is `scripts/test-omada-client-actions.mjs`. This file is
 * about the words; that one is about the request.
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
  deviceActionVerdict,
  clientActionMessage,
  rateLabel,
  disconnectOutcome,
  blockOutcomeMessage,
  CONTROLLER_SPEED_LIMIT_MAX_MBPS,
} = await import(bundle);

// --- the venue shapes ------------------------------------------------
// The backend's own reason strings, copied from
// `network_integration/providers/omada.py`. They are asserted to be RENDERED
// VERBATIM, so they are pinned here rather than matched loosely: a console
// that paraphrases a sentence naming a specific credential in a specific place
// in the controller's settings tree is a second copy that goes stale.
const LEGACY_REASON =
  "This venue's controller is connected with a hotspot operator login, which can let guests on " +
  "and disconnect them but cannot change a device's settings. Add Open API credentials to the " +
  "controller (Settings > Platform Integration > Open API) to turn this on.";
const BLOCKED_LIST_REASON =
  "The controller does not offer a list of blocked devices through the connection we hold. " +
  "Blocked guests are listed under Blocked Guests, which is this platform's own record and is " +
  "what actually refuses them when they try to sign in again.";

const yes = () => ({ supported: true, reason: null });
const no = (reason) => ({ supported: false, reason });

const MIKROTIK = { controllerManaged: false, vendor: null, capabilities: null };
// A controller venue we could not ask: the capabilities read 404'd (no
// controller connection is linked to this location) or did not come back.
const CONTROLLER_UNKNOWN = { controllerManaged: true, vendor: "tplink_omada", capabilities: null };
// An Open API venue -- everything declared supported bar the blocked list,
// which is false on every auth mode by design.
const CONTROLLER_OPENAPI = {
  controllerManaged: true,
  vendor: "tplink_omada",
  capabilities: {
    setRateLimit: yes(),
    clearRateLimit: yes(),
    block: yes(),
    unblock: yes(),
    listBlocked: no(BLOCKED_LIST_REASON),
    disconnect: yes(),
    clientStats: yes(),
  },
};
// And a hotspot-operator-only venue, which CAPABILITY-MATRIX §7 says can have
// the portal and a disconnect and nothing else.
const CONTROLLER_LEGACY = {
  controllerManaged: true,
  vendor: "tplink_omada",
  capabilities: {
    setRateLimit: no(LEGACY_REASON),
    clearRateLimit: no(LEGACY_REASON),
    block: no(LEGACY_REASON),
    unblock: no(LEGACY_REASON),
    listBlocked: no(BLOCKED_LIST_REASON),
    disconnect: yes(),
    clientStats: no(LEGACY_REASON),
  },
};
// A venue summary persisted by a build that predated `RouterLiveness.vendor`.
const CONTROLLER_NO_VENDOR = { controllerManaged: true, vendor: null, capabilities: null };

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
    controllerDisconnected: null,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "device-cleared",
);
eq(
  "a failed MikroTik disconnect still reads as a fault",
  disconnectOutcome({
    sessionEnforced: false,
    deviceDisconnected: false,
    controllerDisconnected: null,
    verdict: clientControlVerdict("disconnect", MIKROTIK),
  }),
  "not-cleared",
);
eq(
  "a MikroTik disconnect nothing tried is not reported as a failure",
  disconnectOutcome({
    sessionEnforced: null,
    deviceDisconnected: false,
    controllerDisconnected: null,
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
// A REFUSAL WE COULD NOT EARN IS NOT A REFUSAL WE MAY STATE.
//
// Both speed controls used to answer a null capabilities read by asserting
// that "a speed set here would never reach anybody's device". That was a
// claim about the venue's hardware made from the absence of an answer of
// ours -- and cloud-guest #270 plus CAPABILITY-MATRIX §3.1 (per-client rate
// limiting measured on real hardware: accepted, stored, changed at runtime,
// cleared) have since made it false as well as unearned.
//
// `CONTROLLER_UNKNOWN` is the 404/no-answer venue. It must get the same
// "we couldn't reach its connection to check" sentence every per-device
// action already gets, and must not describe an impossibility. Where the
// controller genuinely cannot do it -- CONTROLLER_LEGACY, which
// CAPABILITY-MATRIX §10.1 puts beyond per-client throttling entirely -- the
// backend's own sentence is rendered instead, and that is asserted below.
for (const control of ["speed-limit", "speed-profile"]) {
  const reason = clientControlVerdict(control, CONTROLLER_UNKNOWN).reason ?? "";
  check(`${control} says we could not ask, not that it cannot work`, /couldn/.test(reason), reason);
  check(
    `${control} claims no impossibility from a read that did not come back`,
    !/never reach/.test(reason),
    reason,
  );
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
    controllerDisconnected: null,
    verdict: controllerVerdict,
  }),
  "controller-venue",
);
eq(
  "a controller venue that DID clear the device still reads as success",
  disconnectOutcome({
    sessionEnforced: true,
    deviceDisconnected: false,
    controllerDisconnected: null,
    verdict: controllerVerdict,
  }),
  "device-cleared",
);
eq(
  "the connected-devices loop alone is enough to claim success",
  disconnectOutcome({
    sessionEnforced: null,
    deviceDisconnected: true,
    controllerDisconnected: null,
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
    "src/components/features/LocationPolicies.tsx",
    /const rates = speedUsable\s*\n?\s*\?/,
    // GREYING A CONTROL IS NOT THE SAME AS STOPPING IT WRITING, and this
    // screen shipped proof of the difference. With the speed greyed,
    // `f.bandwidth` is "" and `validate()` skips its required check by
    // design -- so `BANDWIDTH_KBPS[f.bandwidth] ?? 0` was 0, and every save
    // of the four settings that DO work at a controller venue overwrote the
    // venue's stored rate with "no limit" on the way past.
    //
    // Invisible from the screen, which is what makes it worth a guard: the
    // field is greyed and the table cell reads "Not applied here", so the
    // damage only surfaces if the gate ever lifts and every guest comes back
    // uncapped. A greyed control must preserve, never zero.
    "a greyed Bandwidth control preserves the stored rate instead of writing 0",
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
// The contract landed (cloud-guest #270) and the switch says so.
check(
  "the adapter is turned on",
  /CUSTOMER_CLIENT_ROUTES_LANDED = true/.test(
    read("src/services/omada-client-controls.service.ts"),
  ),
  "the org-scoped routes exist; leaving this false ships the screens greyed",
);
for (const [rel, needle, why] of [
  [
    "src/routes/users.tsx",
    /<GuestDeviceControls mac=\{detailUser\.mac\}/,
    "the per-device panel is on the one screen that has a MAC",
  ],
  [
    "src/components/customer/GuestDeviceControls.tsx",
    /if \(!controls\.controllerManaged\) return null;/,
    "a MikroTik venue never renders the panel at all",
  ],
  [
    "src/components/customer/GuestDeviceControls.tsx",
    /queueProfileId: selectedProfile\.id/,
    "a speed profile goes as an id, not as numbers re-derived in the browser",
  ],
]) {
  check(`${rel}: ${why}`, needle.test(read(rel)), "grep failed");
}
// `list_blocked` is false on every auth mode and an empty list would be this
// product asserting the venue has blocked nobody. Nothing may render one.
for (const rel of [
  "src/components/customer/GuestDeviceControls.tsx",
  "src/components/features/BlockUsers.tsx",
  "src/hooks/useClientControls.ts",
]) {
  check(
    `${rel} does not list the controller's blocked devices`,
    !/listBlocked\s*[.[]|clients\/blocked/.test(read(rel)),
    "the block flag is not readable through the connection we hold",
  );
}

// =====================================================================
console.log("\n7. one capability per button, and the backend's own sentence beside it");
// =====================================================================
for (const action of ["block", "unblock", "speed", "speed-clear"]) {
  eq(
    `${action} is offered at an Open API venue`,
    deviceActionVerdict(action, CONTROLLER_OPENAPI).availability !== "unavailable",
    true,
  );
  const legacy = deviceActionVerdict(action, CONTROLLER_LEGACY);
  if (action === "block" || action === "unblock" || action.startsWith("speed")) {
    eq(`${action} is refused at a hotspot-operator venue`, legacy.availability, "unavailable");
    // VERBATIM. Not "contains", not "starts with" -- the exact string the
    // backend wrote for the person looking at the disabled control.
    eq(`${action} renders the backend's reason unedited`, legacy.reason, LEGACY_REASON);
  }
  eq(
    `${action} is never refused at a MikroTik venue`,
    deviceActionVerdict(action, MIKROTIK).availability,
    "available",
  );
  check(
    `${action} says we could not ask when nothing told us`,
    /Wyfy Guest contact/.test(deviceActionVerdict(action, CONTROLLER_UNKNOWN).reason ?? ""),
    deviceActionVerdict(action, CONTROLLER_UNKNOWN).reason,
  );
}
// Block and set-speed stay LIVE with a caveat; removing something promises
// nothing extra and carries none.
eq(
  "blocking a device is qualified, not silently absolute",
  deviceActionVerdict("block", CONTROLLER_OPENAPI).availability,
  "qualified",
);
eq(
  "setting a speed is qualified, not a promise of throughput",
  deviceActionVerdict("speed", CONTROLLER_OPENAPI).availability,
  "qualified",
);
eq(
  "clearing a limit carries no caveat",
  deviceActionVerdict("speed-clear", CONTROLLER_OPENAPI).reason,
  null,
);
// A capability the backend declared false WITHOUT a reason still refuses --
// and still says something, rather than rendering a greyed control with no
// explanation next to it.
const SILENT_REFUSAL = {
  controllerManaged: true,
  vendor: "tplink_omada",
  capabilities: { ...CONTROLLER_OPENAPI.capabilities, block: { supported: false, reason: null } },
};
const silent = deviceActionVerdict("block", SILENT_REFUSAL);
eq("a reasonless refusal is still a refusal", silent.availability, "unavailable");
check("a reasonless refusal still says something", !!silent.reason, silent.reason);
// A field nobody sent is "we cannot", never "we can".
const MISSING_FIELD = {
  controllerManaged: true,
  vendor: "tplink_omada",
  capabilities: { ...CONTROLLER_OPENAPI.capabilities, unblock: undefined },
};
eq(
  "a missing capability field defaults to refused",
  deviceActionVerdict("unblock", MISSING_FIELD).availability,
  "unavailable",
);

// =====================================================================
console.log("\n8. after the click: performed:false is a failure, and applied wins over requested");
// =====================================================================
const rateFacts = (over) => ({
  action: "set_rate_limit",
  performed: true,
  clientMac: "AA:BB:CC:**:**:01",
  rateLimit: {
    enabled: true,
    appliedDownKbps: 2000,
    appliedUpKbps: 1000,
    requestedDownKbps: 1500,
    requestedUpKbps: 800,
    clamped: true,
    ...over,
  },
});
// THE TRAP PR #279 FELL INTO: a 200 with `performed: false` is the controller
// saying no, and a resolved promise is not success.
const refused = clientActionMessage({ ...rateFacts(), performed: false });
eq("performed:false is reported as a failure", refused.tone, "warning");
check(
  "performed:false does not claim anything was done",
  !/now holding|no speed limit/i.test(refused.text),
  refused.text,
);
const clamped = clientActionMessage(rateFacts());
check("the applied figure is shown", /2 Mbps/.test(clamped.text), clamped.text);
check(
  "the requested figure is NOT shown -- it is not the limit in force",
  !/1500|1\.5 Mbps|800 Kbps/.test(clamped.text),
  clamped.text,
);
check("clamping is said out loud", /rounded/.test(clamped.text), clamped.text);
const exact = clientActionMessage(rateFacts({ clamped: false, requestedDownKbps: 2000 }));
check(
  "an unclamped limit does not invent a rounding note",
  !/rounded/.test(exact.text),
  exact.text,
);
const cleared = clientActionMessage({
  action: "clear_rate_limit",
  performed: true,
  clientMac: "AA:BB:CC:**:**:01",
  rateLimit: {
    enabled: false,
    appliedDownKbps: null,
    appliedUpKbps: null,
    requestedDownKbps: null,
    requestedUpKbps: null,
    clamped: false,
  },
});
check("a cleared limit says there is no limit", /no speed limit/i.test(cleared.text), cleared.text);
// `null` on a direction is UNLIMITED, not zero and not unknown.
eq("null reads as no limit", rateLabel(null), "no limit");
eq("zero reads as no limit too -- it is what the backend means by it", rateLabel(0), "no limit");
eq("a whole-Mbps rate reads in Mbps", rateLabel(2000), "2 Mbps");
eq("a sub-Mbps rate keeps its kbps", rateLabel(1500), "1500 Kbps");
const oneWay = clientActionMessage(rateFacts({ appliedUpKbps: null, clamped: false }));
check(
  "an unlimited direction is words, not a zero",
  /no limit/.test(oneWay.text) && !/0 Mbps/.test(oneWay.text),
  oneWay.text,
);
// No message from any of these may promise throughput.
for (const message of [refused, clamped, exact, cleared, oneWay]) {
  check(
    "no outcome sentence promises an enforced speed",
    !/\benforce[sd]?\b|\bguarantee[sd]?\b/i.test(message.text),
    message.text,
  );
}

// =====================================================================
console.log("\n9. the controller leg of a disconnect, and the MikroTik null that skips it");
// =====================================================================
const openApiVerdict = clientControlVerdict("disconnect", CONTROLLER_OPENAPI);
eq(
  "a controller that confirms the drop reads as cleared",
  disconnectOutcome({
    sessionEnforced: false,
    deviceDisconnected: false,
    controllerDisconnected: true,
    verdict: openApiVerdict,
  }),
  "device-cleared",
);
eq(
  "a controller that refuses gets its own outcome, not 'check the router'",
  disconnectOutcome({
    sessionEnforced: false,
    deviceDisconnected: false,
    controllerDisconnected: false,
    verdict: openApiVerdict,
  }),
  "controller-refused",
);
// The whole MikroTik guarantee, said as an exhaustive equality: for every
// combination of the two legs a RouterOS venue can produce, the outcome with
// `controllerDisconnected: null` is the outcome the old three-branch ladder
// gave. Nothing about a MikroTik venue can reach either new line.
for (const sessionEnforced of [true, false, null]) {
  for (const deviceDisconnected of [true, false]) {
    const withNull = disconnectOutcome({
      sessionEnforced,
      deviceDisconnected,
      controllerDisconnected: null,
      verdict: clientControlVerdict("disconnect", MIKROTIK),
    });
    const legacyLadder =
      sessionEnforced === true || deviceDisconnected
        ? "device-cleared"
        : sessionEnforced === false
          ? "not-cleared"
          : "session-only";
    eq(
      `MikroTik ladder unchanged (enforced=${sessionEnforced}, device=${deviceDisconnected})`,
      withNull,
      legacyLadder,
    );
  }
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
