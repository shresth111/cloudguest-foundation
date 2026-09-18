#!/usr/bin/env node
/**
 * The Guest WiFi Limits screen must not claim to enforce what it does not,
 * and must not disclaim what it does.
 *
 * Idle Timeout and Maximum Daily Session Limit each spent a release captured,
 * stored, echoed back on reload -- and read by nothing. Both were written into
 * the BANDWIDTH policy's rules JSON, where the backend happily accepts them
 * (`BandwidthPolicyRules` declares both fields) and no code path anywhere
 * reads them: the only consumer of a BANDWIDTH resolve is queue_management,
 * which reads the two rate fields. The screen was honest about it, in the one
 * way that mattered -- it disabled both controls and said "Not enforced yet".
 *
 * They are now wired to the policy types that really do enforce them:
 *
 *   Idle Timeout      -> SESSION policy, `idle_timeout_minutes`, which the
 *                        guest login path resolves and the RADIUS
 *                        Access-Accept carries as `Idle-Timeout`.
 *   Max Daily Session -> FUP policy, `daily_time_limit_minutes`, which the
 *                        five-minutely accrual sweep and the login gate read.
 *
 * This guard exists because the failure it catches is invisible. Writing to
 * the wrong policy type produces no error at any layer: the API returns 201,
 * the policy is listed, the value reads back on reload, and the setting does
 * nothing. That is precisely how the original bug shipped, twice, on two
 * different screens. A test that only checked "the form saves" would have
 * passed throughout.
 *
 * Deliberately source-structural rather than behavioural -- same approach as
 * every other scripts/*.mjs guard here, and for the same reason: it needs no
 * TypeScript toolchain, no API, and no browser. It cannot prove the router
 * honours the attribute (nothing in this repository can); it proves the value
 * leaves this screen aimed at the field that is read.
 *
 * Run: node scripts/test-session-rules-enforcement.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(join(root, rel), "utf8");

const locationPolicies = read("src/components/features/LocationPolicies.tsx");
const createGroup = read("src/components/features/CreateGroup.tsx");
const policyEngine = read("src/services/policy-engine.ts");
const expired = read("src/routes/portal.expired.tsx");
const runtimeTypes = read("src/types/portal-runtime.ts");
const i18n = read("src/lib/portal-i18n.ts");

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

// ---------------------------------------------------------------------------
// 1. The two settings reach the policy types that enforce them.
// ---------------------------------------------------------------------------

check(
  /export function fupTimeLimitRules\(/.test(policyEngine),
  "policy-engine.ts no longer exports fupTimeLimitRules -- the daily limit has " +
    "no helper aiming it at the FUP policy.",
);
check(
  /daily_time_limit_minutes/.test(policyEngine),
  "policy-engine.ts never mentions daily_time_limit_minutes -- the FUP field " +
    "the backend actually reads.",
);
check(
  /idle_timeout_minutes/.test(policyEngine),
  "policy-engine.ts never mentions idle_timeout_minutes -- sessionPolicyRules " +
    "is not carrying the idle timeout.",
);
check(
  /policyType:\s*"fup"/.test(locationPolicies),
  'LocationPolicies.tsx never creates a policy with policyType "fup" -- the ' +
    "daily limit is not being written where it is read.",
);
check(
  /listPolicyDetails\("fup"/.test(locationPolicies),
  "LocationPolicies.tsx never reads FUP policies back, so a saved daily limit " +
    "cannot round-trip onto the form.",
);

// `sessionPolicyRules` must be called with two arguments everywhere. A caller
// left at one argument still compiles if the parameter is ever made optional,
// and silently writes a SESSION policy with no opinion about idleness.
for (const [name, source] of [
  ["LocationPolicies.tsx", locationPolicies],
  ["CreateGroup.tsx", createGroup],
]) {
  const call = source.match(/sessionPolicyRules\(([\s\S]{0,200}?)\)\s*;/);
  check(
    call !== null && call[1].includes(","),
    `${name} calls sessionPolicyRules with a single argument -- the idle ` +
      "timeout is not being sent, so the SESSION policy expresses no opinion " +
      "about it and the backend falls back to its default.",
  );
}

// ---------------------------------------------------------------------------
// 2. The disclaimer stays exactly where it is still true.
//
// This is the half most likely to be lost to a tidy-up. Removing the note
// wholesale because "two of its three controls got fixed" would restore the
// original lie on the one control that still cannot keep the promise.
// ---------------------------------------------------------------------------

check(
  /const NOT_ENFORCED_NOTE = /.test(locationPolicies),
  "NOT_ENFORCED_NOTE is gone from LocationPolicies.tsx. The data-limit control " +
    "is still stored-and-never-read, so it still needs to say so.",
);

const noteUses = locationPolicies.match(/\{NOT_ENFORCED_NOTE\}/g) ?? [];
check(
  noteUses.length === 1,
  `NOT_ENFORCED_NOTE is rendered ${noteUses.length} time(s); expected exactly ` +
    "1 (the data limit). More than one means a control that IS enforced is " +
    "disclaiming itself; zero means the data limit has stopped disclaiming.",
);

// ONE FORM, TWO TIMINGS, AND THE FOOTER SPEAKS FOR ONLY ONE OF THEM.
//
// The footer read "Applies the next time each guest connects" over all five
// settings. That was true of all five until a bandwidth publish started
// dispatching `reapply_policy_assignments` -> `reapply_active_sessions_for_
// location`, whose stated purpose is to reach guests who are already
// connected "without waiting for their session to die or for a reconnect".
//
// So the speed now lands immediately and the other four still wait. A
// blanket sentence is wrong whichever way it is written, and the danger is
// a tidy-up that restores one -- most likely by shortening the enumeration
// back to something that reads more smoothly and silently re-absorbs
// Bandwidth into a promise it does not keep.
//
// Vendor-neutral on purpose: the reapply feeds back through the same
// `resolve_and_assign_queue` pipeline a login uses, which routes RouterOS to
// its queue and a controller to its controller. Both venues changed.
check(
  !/Applies the next time each guest connects/.test(locationPolicies),
  "The footer is back to one blanket timing sentence over all five settings. " +
    "A bandwidth publish reaches already-connected guests now; the other four " +
    "still wait for a reconnect.",
);
check(
  /const BANDWIDTH_APPLIES_NOW_NOTE\s*=/.test(locationPolicies),
  "BANDWIDTH_APPLIES_NOW_NOTE is gone -- the one setting that does NOT wait " +
    "for a reconnect has stopped saying so beside its own control.",
);
for (const field of ["Session timeout", "idle timeout", "devices per user", "daily limit"]) {
  check(
    new RegExp(field).test(locationPolicies),
    `The footer no longer names "${field}" among the settings that wait for ` +
      "the next connection. An unnamed field is one an owner must guess about.",
  );
}

// DISABLING THE DOOR IS NOT DISABLING THE ROOM.
//
// The dashed "Add a data limit" row is disabled and says so, and that was
// taken as the whole fix. It was not: `handleEdit` also sets `dataLimitOpen`
// for any row carrying a data limit saved before the row was greyed, so
// editing such a location reopened three live, editable, un-noted inputs
// that wrote straight into `BandwidthPolicyRules.data_limit` -- the field
// this whole guard exists because nothing reads.
//
// So the affordance carried the disclaimer and the form an owner actually
// typed into carried none. These pin that the form stays gone: no input and
// no option lists for one, and a stored figure disclosed rather than
// presented for editing.
check(
  !/id="dl-quota"/.test(locationPolicies),
  "The data-limit quota input is back. It is reachable by editing any row " +
    "saved with a data limit, and it writes into a field with no reader.",
);
check(
  !/const (DATA_UNITS|RESETS) =/.test(locationPolicies),
  "The data-limit option lists are back in LocationPolicies.tsx -- they " +
    "populate nothing now, and their presence is how the form gets rebuilt.",
);
check(
  /DATA_LIMIT_STORED_NOTE/.test(locationPolicies),
  "A location's stored data limit is shown with no word about it enforcing " +
    "nothing. It is still in the policy; an owner reading the figure must be " +
    "told no guest is cut off at it.",
);

// The note must not be attached to either control that now works.
const idleSelect = locationPolicies.match(/<Select\s+id="it"[\s\S]*?\/>/);
check(idleSelect !== null, 'LocationPolicies.tsx has no Select with id="it" (Idle Timeout).');
if (idleSelect) {
  check(
    !/NOT_ENFORCED_NOTE/.test(idleSelect[0]),
    "Idle Timeout still carries the 'not enforced' note, but it is enforced now.",
  );
  check(
    !/\bdisabled\b/.test(idleSelect[0]),
    "Idle Timeout is still disabled -- an enforced setting an operator cannot " +
      "change is no better than an unenforced one.",
  );
}

const dailySelect = locationPolicies.match(/<Select\s+id="dl"[\s\S]*?\/>/);
check(dailySelect !== null, 'LocationPolicies.tsx has no Select with id="dl" (daily limit).');
if (dailySelect) {
  check(
    !/NOT_ENFORCED_NOTE/.test(dailySelect[0]),
    "Maximum Daily Session Limit still carries the 'not enforced' note, but it " +
      "is enforced now.",
  );
  check(!/\bdisabled\b/.test(dailySelect[0]), "Maximum Daily Session Limit is still disabled.");
}

// ---------------------------------------------------------------------------
// 3. Idle Timeout offers no "No Limit", on either screen.
//
// It cannot be honoured: the idle timeout is the only prompt reaper of an
// abandoned session on this fleet (keepalive is deliberately off, after a real
// false-logout incident), so "no idle timeout" means sessions that never
// close. Offering the option while applying 30 minutes anyway is exactly the
// lie this change set out to remove -- and it is a lie that reads as a
// *promise of more*, which is the dangerous direction.
// ---------------------------------------------------------------------------

for (const [name, source] of [
  ["LocationPolicies.tsx", locationPolicies],
  ["CreateGroup.tsx", createGroup],
]) {
  const list = source.match(/const IDLE_TIMEOUT = \[([^\]]*)\]/);
  check(list !== null, `${name} has no IDLE_TIMEOUT option list.`);
  if (list) {
    check(
      !list[1].includes("No Limit"),
      `${name}'s Idle Timeout offers "No Limit", which this platform cannot ` +
        "honour -- the router applies its 30-minute default regardless, so the " +
        "option promises something the guest never gets.",
    );
  }
  const table = source.match(/const IDLE_TIMEOUT_MINUTES[^=]*=\s*\{([\s\S]*?)\};/);
  check(table !== null, `${name} has no IDLE_TIMEOUT_MINUTES table.`);
  if (table) {
    check(
      !/:\s*null/.test(table[1]),
      `${name}'s IDLE_TIMEOUT_MINUTES maps a label to null -- a null idle ` +
        "timeout writes a SESSION policy with no idle opinion, which is " +
        '"No Limit" reintroduced under another name.',
    );
  }
}

// ---------------------------------------------------------------------------
// 4. The guest is told the truth about each ending.
// ---------------------------------------------------------------------------

for (const reason of ["idle_timed_out", "time_limit_reached"]) {
  check(
    runtimeTypes.includes(`"${reason}"`),
    `RuntimeEndedSessionReason is missing "${reason}" -- the backend can send ` +
      "it and the portal would fall through to generic copy.",
  );
  check(
    expired.includes(`case "${reason}"`),
    `portal.expired.tsx has no branch for "${reason}", so that guest is shown ` +
      "the generic 'something went wrong' pair instead of what happened.",
  );
}

for (const key of [
  "expiredIdleTitle",
  "expiredIdleBody",
  "expiredIdleBodyNoDuration",
  "expiredDailyLimitTitle",
  "expiredDailyLimitBody",
]) {
  check(i18n.includes(`${key}:`), `portal-i18n.ts is missing the ${key} string.`);
}

// A guest who has spent the day's allowance must not be offered a sign-in that
// the backend will refuse. This is the one ending where the screen's usual
// call to action is wrong, and the failure mode of getting it wrong is a guest
// bounced between a button and a refusal with no explanation of either.
check(
  /canSignInAgain/.test(expired),
  "portal.expired.tsx no longer gates its sign-in buttons -- a guest whose " +
    "daily time limit is spent will be offered a login the backend refuses.",
);
check(
  /const canSignInAgain\s*=\s*endedSession\?\.reason !== "time_limit_reached"/.test(expired),
  "The sign-in gate in portal.expired.tsx is no longer keyed on " +
    "time_limit_reached specifically.",
);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem(s) with session-rules enforcement:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "PASS: Idle Timeout reaches the SESSION policy, Maximum Daily Session Limit " +
    "reaches the FUP policy, the 'not enforced' note remains on the one control " +
    "that still needs it, and every ending has its own honest copy.",
);
