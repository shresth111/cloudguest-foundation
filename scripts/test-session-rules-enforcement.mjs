#!/usr/bin/env node
/**
 * The Guest WiFi Limits screen must not claim to enforce what it does not,
 * and must not disclaim what it does.
 *
 * Idle Timeout, Maximum Daily Session Limit and the data limit each spent a
 * release captured, stored, echoed back on reload -- and read by nothing. All
 * three were written into the BANDWIDTH policy's rules JSON, where the backend
 * happily accepts them (`BandwidthPolicyRules` declares every one of the
 * fields) and no code path anywhere reads them: the only consumer of a
 * BANDWIDTH resolve is queue_management, which reads the two rate fields. The
 * screen was honest about it, in the one way that mattered -- it disabled the
 * controls and said "Not enforced yet".
 *
 * They are now wired to the policy types that really do enforce them:
 *
 *   Idle Timeout      -> SESSION policy, `idle_timeout_minutes`, which the
 *                        guest login path resolves and the RADIUS
 *                        Access-Accept carries as `Idle-Timeout`.
 *   Max Daily Session -> FUP policy, `daily_time_limit_minutes`, which the
 *                        five-minutely accrual sweep and the login gate read.
 *   Data limit        -> FUP policy, `daily`/`weekly`/`monthly_data_limit_mb`,
 *                        which `_track_fup_data_usage` bumps on every RADIUS
 *                        Interim-Update and every Omada usage poll, and which
 *                        `record_usage` and `_enforce_fup_quota` enforce.
 *
 * This guard exists because the failure it catches is invisible. Writing to
 * the wrong policy type produces no error at any layer: the API returns 201,
 * the policy is listed, the value reads back on reload, and the setting does
 * nothing. That is precisely how the original bug shipped, three times, on two
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
  /export function fupPolicyRules\(/.test(policyEngine),
  "policy-engine.ts no longer exports fupPolicyRules -- the daily limit and " +
    "the data limit have no helper aiming them at the FUP policy.",
);
// One helper, one write, both settings. A policy version is a whole rules
// object: publishing the time limit alone would leave the three
// `*_data_limit_mb` keys absent from the version that is now current, which
// the backend reads as "no data cap". Splitting them back into two helpers is
// how a venue's data cap gets silently deleted by an unrelated save.
for (const key of ["daily_data_limit_mb", "weekly_data_limit_mb", "monthly_data_limit_mb"]) {
  check(
    new RegExp(`${key}:`).test(policyEngine),
    `policy-engine.ts never writes ${key} -- the data limit is not reaching ` +
      "the field the backend reads, or is being written by omission (which " +
      "the backend reads as no cap at all).",
  );
}
// `\n}\n`, not `\n}` -- the args object literal closes with `}) {` on its own
// line, so the shorter anchor stops at the signature and inspects nothing.
const fupBody = policyEngine.match(/export function fupPolicyRules\([\s\S]*?\n\}\n/);
check(fupBody !== null, "policy-engine.ts has no fupPolicyRules body to inspect.");
if (fupBody) {
  check(
    /daily_time_limit_minutes/.test(fupBody[0]),
    "fupPolicyRules no longer writes daily_time_limit_minutes -- the daily " +
      "time limit and the data cap must be published in ONE rules version, " +
      "or whichever is written last erases the other.",
  );
  for (const key of ["daily_data_limit_mb", "weekly_data_limit_mb", "monthly_data_limit_mb"]) {
    check(
      new RegExp(`${key}:`).test(fupBody[0]),
      `fupPolicyRules does not write ${key}. Every period must be written ` +
        "explicitly, including as null: a venue clearing a cap needs the new " +
        "version to say there is no cap.",
    );
  }
}
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
// 2. Nothing on this form disclaims itself any more, because nothing needs to.
//
// The inverse of what this section used to assert. While the data limit was
// stored-and-never-read, the note had to stay on it and only on it; now that
// all three controls reach the policy type that enforces them, a lingering
// "Not enforced yet" would be the opposite lie -- an operator declining to use
// a setting that works.
//
// Asserted on the constant's absence rather than only on render count, because
// a disclaimer left in the file with no renderer is a disclaimer waiting to be
// re-attached to the wrong control by someone who finds it and assumes it was
// dropped by mistake.
// ---------------------------------------------------------------------------

check(
  !/NOT_ENFORCED_NOTE/.test(locationPolicies),
  "NOT_ENFORCED_NOTE is back in LocationPolicies.tsx. Every control on this " +
    "form now reaches a policy the backend reads; if one has stopped doing " +
    "so, fix the write rather than re-adding the disclaimer.",
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
// 2b. The data limit is a live control aimed at a period the platform meters.
//
// Two ways this can regress, and they fail in opposite directions:
//
//   * the control goes back to being a dead `<div aria-disabled>`, which is
//     the state it shipped in for a release;
//   * "Per session" comes back to the reset list. There is no venue-level
//     per-session data allowance anywhere on this platform -- GuestQuotaUsage
//     exists per QuotaPeriodType, which has exactly DAILY/WEEKLY/MONTHLY --
//     so that option writes a cap with nowhere to go. It reads as a PROMISE
//     OF LESS, which is the direction an operator never checks.
// ---------------------------------------------------------------------------

check(
  /aria-controls="data-limit-panel"/.test(locationPolicies),
  "The data-limit disclosure in LocationPolicies.tsx is no longer a real " +
    "control (it lost aria-controls) -- it was a dead div for a release and " +
    "must not become one again.",
);
check(
  /setDataLimitOpen\(\(prev\) => !prev\)/.test(locationPolicies),
  "The 'Add a data limit' toggle no longer opens the panel, so the fields " +
    "underneath are unreachable and the cap can never be set.",
);
check(
  !/aria-disabled="true"/.test(locationPolicies),
  "Something on LocationPolicies.tsx is rendered aria-disabled again. That " +
    "was the data limit's dead-div state; if a control genuinely cannot work " +
    "here it belongs behind ControllerControlNotice with a real reason.",
);

const resets = locationPolicies.match(/const RESETS[^=]*=\s*([^;]*);/);
check(resets !== null, "LocationPolicies.tsx has no RESETS option list.");
if (resets) {
  check(
    !/Per session/.test(resets[1]),
    'The data limit offers "Per session" again. GuestQuotaUsage is metered ' +
      "per QuotaPeriodType (DAILY/WEEKLY/MONTHLY only), so that option has no " +
      "field to be written to -- the one per-session cap on this platform is " +
      "a voucher batch's own data_limit_mb, set on the Vouchers screen.",
  );
  check(
    /FUP_DATA_RESET_PERIODS/.test(resets[1]),
    "RESETS no longer comes from FUP_DATA_RESET_PERIODS. The list on screen " +
      "and the fields the save path writes must be one source, or a label can " +
      "be offered that nothing writes.",
  );
}

// The saved cap has to come back off the FUP policy on reload, not off the
// bandwidth copy. Reading the stale copy is how a venue sees a cap they have
// just cleared -- the same class of bug as writing to a field nothing reads.
check(
  /fupDataLimitFromRules/.test(locationPolicies),
  "LocationPolicies.tsx no longer reads the data limit back off the FUP " +
    "policy, so the form can show a cap that is not the one in force.",
);

// ---------------------------------------------------------------------------
// 2c. A guest cut off by a data cap is told why, and is not offered a login
//     that the backend will refuse.
//
// `_enforce_fup_quota` refuses the next login on a data cap exactly as it does
// on a time cap. Before the dashboard could set a data cap this ending was
// unreachable from any screen and the portal said nothing, which was the right
// answer for an unreachable state. It is the wrong answer now.
// ---------------------------------------------------------------------------

check(
  runtimeTypes.includes('"data_limit_reached"'),
  'RuntimeEndedSessionReason is missing "data_limit_reached" -- the backend ' +
    "can send it and the portal would fall through to generic copy.",
);
check(
  expired.includes('case "data_limit_reached"'),
  'portal.expired.tsx has no branch for "data_limit_reached", so a guest cut ' +
    "off by the venue's data cap is shown the generic pair instead.",
);
for (const key of ["expiredDataLimitTitle", "expiredDataLimitBody"]) {
  check(i18n.includes(`${key}:`), `portal-i18n.ts is missing the ${key} string.`);
}
// The two endings must not share copy. They share a consequence, not a
// sentence: "you've used today's WiFi time" is false of a guest who spent two
// gigabytes in ten minutes, and it is the wrong guess they would otherwise
// reach on their own.
const dataBranch = expired.match(/case "data_limit_reached":[\s\S]*?\n      case /);
check(
  dataBranch !== null && !/expiredDailyLimit/.test(dataBranch[0]),
  "The data-limit ending renders the daily-TIME copy. A guest who spent the " +
    "data allowance did not run out of time, and telling them they did is a " +
    "checkable lie about their own afternoon.",
);
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
// Keyed on the two spent-allowance endings by name. Was a single `!==
// "time_limit_reached"`; it became a set when the data cap joined it, because
// `_enforce_fup_quota` refuses the next login on either metric and one of them
// silently losing the gate is the regression worth catching.
const gate = expired.match(/REFUSED_NEXT_LOGIN[^=]*=\s*\[([^\]]*)\]/);
check(
  gate !== null,
  "portal.expired.tsx no longer names the endings whose next login the backend " +
    "refuses, so the sign-in gate cannot be checked.",
);
if (gate) {
  for (const reason of ["time_limit_reached", "data_limit_reached"]) {
    check(
      gate[1].includes(`"${reason}"`),
      `The sign-in gate in portal.expired.tsx no longer covers ${reason}. ` +
        "_enforce_fup_quota refuses that login, so the button walks the guest " +
        "into a bare refusal.",
    );
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} problem(s) with session-rules enforcement:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  "PASS: Idle Timeout reaches the SESSION policy, Maximum Daily Session Limit " +
    "and the data limit reach the FUP policy in one rules version, no control " +
    "on the form disclaims itself any more, and every ending -- including a " +
    "spent data allowance -- has its own honest copy and its own CTA.",
);
