/**
 * The six defects a QA pass found on the customer dashboard at the Omada
 * venue on 2026-09-18, pinned so they cannot come back quietly.
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * Five of the six are SENTENCES. Nothing in tsc, eslint or the build can
 * see a sentence: a screen that claims a block cuts somebody off compiles
 * exactly as well as one that does not, and the only reader who finds out
 * is a venue owner walking across a lobby on the strength of it. So the
 * gate has to be a shape check over the real sources, the same design as
 * `scripts/test-block-device-outcome.mjs` and for the same reason.
 *
 * In the order a venue owner notices them:
 *
 *   1. BLOCKED GUESTS PROMISED WHAT THE BACKEND FORBIDS CLAIMING. The
 *      headline read "Cut off a guest's access to your network
 *      immediately." `providers/omada.py` (~L911) states the opposite:
 *      what a block does to a client that currently holds a portal
 *      authorization is UNMEASURED, and "Nothing in this platform may tell
 *      an operator that blocking cuts off a guest who is online right
 *      now." The sign-in half is ours and certain; the session half is
 *      attempted. The headline now says both, with the right certainty on
 *      each, and `blockOutcomeMessage` still says which actually happened.
 *
 *   2. "NOBODY IS BLOCKED" WAS TRUE OF OUR OWN RECORD ONLY. A device kept
 *      off from a guest's device panel is held by the venue's controller,
 *      and `list_blocked` is `supported: false` -- there is no readable
 *      list (CAPABILITY-MATRIX §10.8), so such a device can never appear
 *      in that table. The empty state now says so, and ONLY at a
 *      controller-managed venue, because only there does the device panel
 *      it names exist.
 *
 *   3. TWO CONTROLS THAT REACH NOTHING. "Allow device" and "Remove limit"
 *      are enabled for a device that was never blocked and never limited.
 *      They STAY enabled -- disabling them would require knowing the
 *      device is not blocked, which is exactly the unreadable fact in (2)
 *      -- and the panel now names the outcome instead.
 *
 *   4. "11 USERS" BESIDE "TOTAL GUESTS 4". The footer counts session rows,
 *      so one guest who reconnects seven times is seven of the eleven. It
 *      now says which it counts.
 *
 *   5. TWO RENDERED COPY BUGS: "2 duplicate removed", and a literal `--`
 *      where an em dash belongs.
 *
 *   6. THE VIEW BUTTON HAD NO ACCESSIBLE NAME. Icon-only, no text child,
 *      no label: a screen reader announces "button", once per row.
 *
 * And, because two of the fixes add copy, the last section checks EN/HI
 * parity across the venue-admin dictionaries. `t()` falls back to English
 * per key and does it silently, so a half-translated screen looks perfect
 * in review and shows itself only to the reader whose paragraph switches
 * language mid-sentence.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs`). Every check below reads the real
 * source file or the real dictionary off disk.
 *
 * Run: node scripts/test-customer-dashboard-qa-copy.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

/**
 * Comments have to come out before anything is matched. This file's whole
 * subject is what the screens SAY, and every source it reads carries long
 * comments quoting the very sentences that must not be rendered -- the
 * headline in defect 1 is quoted verbatim in the comment that explains why
 * it was replaced. Matching raw text would find the explanation and call it
 * the bug.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const blockUsers = stripComments(read("src/components/features/BlockUsers.tsx"));
const deviceControls = stripComments(read("src/components/customer/GuestDeviceControls.tsx"));
const users = stripComments(read("src/routes/users.tsx"));
const emptyState = stripComments(read("src/components/common/EmptyState.tsx"));
const en = JSON.parse(read("src/lib/i18n/locales/en/guests.json"));
const hi = JSON.parse(read("src/lib/i18n/locales/hi/guests.json"));

// ---------------------------------------------------------------------------
console.log("\n1. Blocked Guests claims only what a block actually does");
// ---------------------------------------------------------------------------

check(
  "the headline no longer says a block cuts a guest off",
  !/Cut off a guest/i.test(blockUsers),
  "providers/omada.py: what a block does to a live authorization is UNMEASURED",
);
check(
  "no rendered sentence on this screen claims a block cuts anyone off",
  !/cut(s|ting)? (them|him|her|the guest|anyone|a guest) off/i.test(blockUsers),
);
check(
  "the headline says the sign-in half, which is ours and certain",
  /Stop a guest signing in again/.test(blockUsers),
);
check(
  "the headline says the session half is ATTEMPTED, not done",
  /try to end any session they have now/.test(blockUsers),
  "'and ends their session' would be the same false promise in new words",
);
// The screen's other two session sentences must keep the same hedge, or the
// headline is honest and the two places an owner reads next are not.
check(
  "the confirm dialog still hedges the session half",
  /we will try to end any session they have\s+right now/.test(blockUsers),
);
check(
  "the card caption still hedges the session half",
  /we also try to end any session these guests have now/.test(blockUsers),
);
// The outcome ladder is the only thing allowed to say what happened, because
// it is the only thing that has been told.
check(
  "the outcome is still reported from what the server returned",
  /blockOutcomeMessage\(created, identifierNoun, clientControls\.controllerManaged\)/.test(
    blockUsers,
  ),
  "a headline can hedge and a toast can still assert; both have to be true",
);

// ---------------------------------------------------------------------------
console.log("\n2. The empty state says whose list it is");
// ---------------------------------------------------------------------------

check("the empty state still reads 'Nobody is blocked'", /Nobody is blocked/.test(blockUsers));
check(
  "it qualifies that with the devices it can never list",
  /Devices kept off from a guest.s device panel are not listed here/.test(blockUsers),
);
check(
  "and names the reason as the controller's, not a bug of ours",
  /this venue.s controller does not offer a list we can read/.test(blockUsers),
);
check(
  "the qualification is gated on the venue actually having that panel",
  /clientControls\.controllerManaged\s*\?\s*"Devices kept off/.test(blockUsers),
  "a MikroTik venue has no device panel, so the sentence would name a screen nobody has seen",
);
check(
  "a MikroTik venue gets no note at all",
  /:\s*undefined\s*\n?\s*\}/.test(blockUsers) || /:\s*undefined/.test(blockUsers),
);
check(
  "EmptyState renders the note above the call to action",
  /\{note &&[\s\S]{0,200}\{note\}[\s\S]{0,200}\{action &&/.test(emptyState),
  "a caveat under the button is a caveat nobody reads",
);
check(
  "the note prop is optional, so every other empty state is unchanged",
  /note\?: ReactNode/.test(emptyState),
);

// ---------------------------------------------------------------------------
console.log("\n3. The two undo controls stay live and say what they do");
// ---------------------------------------------------------------------------

// The decision, pinned as a decision: neither button may grow a disabled
// state derived from anything other than its own declared capability, the
// pending flag, and whether we have a usable MAC.
check(
  "Allow device is gated only on the capability, the MAC and the pending flag",
  /disabled=\{busy \|\| !macUsable \|\| unblockVerdict\.availability === "unavailable"\}/.test(
    deviceControls,
  ),
  "a disabled Allow device asserts the device is not blocked, which nothing here can know",
);
check(
  "Remove limit is gated the same way",
  /disabled=\{busy \|\| !macUsable \|\| clearVerdict\.availability === "unavailable"\}/.test(
    deviceControls,
  ),
);
check(
  "neither undo button infers a state from the guest being offline",
  !/(unblock|clearSpeed|clearVerdict)[\s\S]{0,160}status === "offline"/.test(deviceControls),
);
check(
  "the panel says what happens when there is nothing to undo",
  /deviceUndoAlwaysOffered/.test(deviceControls),
);
check(
  "it is said once, under both controls",
  (deviceControls.match(/deviceUndoAlwaysOffered/g) ?? []).length === 1,
);
check(
  "and only where at least one of them is offered",
  /unblockVerdict\.availability !== "unavailable" \|\|[\s\S]{0,80}clearVerdict\.availability !== "unavailable"/.test(
    deviceControls,
  ),
);
check(
  "the sentence does not promise the device is currently untouched",
  !/not (currently )?blocked/i.test(en.deviceUndoAlwaysOffered),
);
check(
  "the sentence says the controller does not tell us",
  /does not tell us which devices/.test(en.deviceUndoAlwaysOffered),
);
check(
  "and that a no-op is reported rather than swallowed",
  /nothing changes and we say so/.test(en.deviceUndoAlwaysOffered),
);
// The guarantee this panel must never lose.
check(
  "a MikroTik venue still never renders this panel",
  /if \(!controls\.controllerManaged\) return null;/.test(deviceControls),
);

// ---------------------------------------------------------------------------
console.log("\n4. The footer says what it counts");
// ---------------------------------------------------------------------------

check("the bare '{{count}} users' key is gone", en.usersCount === undefined);
check("and gone from Hindi too", hi.usersCount === undefined);
check("nothing still reads it", !/usersCount/.test(users));
check(
  "the footer counts sessions",
  /t\("sessionsCount", \{ count: data\.total \}\)/.test(users),
  "data.total is session rows; one guest reconnecting seven times is seven of them",
);
check(
  "and names the distinct guests beside them",
  /t\("guestsCount", \{ count: data\.uniqueGuests \}\)/.test(users),
);
check(
  "a missing guest count says only the part we can see",
  /data\?\.uniqueGuests === undefined[\s\S]{0,120}t\("sessionsCount"/.test(users),
  "quoting the session total twice under two names is the original defect again",
);
check(
  "the sessions phrase has both plural forms",
  !!en.sessionsCount_one && !!en.sessionsCount_other,
);
check("the guests phrase has both plural forms", !!en.guestsCount_one && !!en.guestsCount_other);
check(
  "the two are joined by a translatable template, not by concatenation",
  /\{\{sessions\}\}/.test(en.sessionsFromGuests) && /\{\{guests\}\}/.test(en.sessionsFromGuests),
  "word order differs between en and hi; a hardcoded ' from ' cannot be translated",
);
check(
  "the Total guests tile still shows distinct guests",
  /data\.uniqueGuests \?\? data\.total/.test(users),
);

// ---------------------------------------------------------------------------
console.log("\n5. The two rendered copy bugs");
// ---------------------------------------------------------------------------

check(
  "the duplicate counter is pluralised",
  /duplicate\s*\n?\s*\{parsed\.duplicates\.length === 1 \? "" : "s"\}\s*removed/.test(blockUsers),
  "'2 duplicate removed'",
);
check(
  "no literal double hyphen survives in this screen's rendered copy",
  !/"[^"\n]*[a-z] -- [a-z][^"\n]*"/.test(blockUsers),
);
check(
  "the empty state no longer promises a block takes effect 'immediately'",
  !/block one — it takes effect immediately/.test(blockUsers),
  "true of the sign-in rule, which is ours; untrue of the live session, which is not",
);
check(
  "the empty state uses a real em dash",
  /block one — from then on they cannot sign in/.test(blockUsers),
);
// The same typographic slip anywhere else in the two dictionaries.
for (const [lang, dict] of [
  ["en", en],
  ["hi", hi],
]) {
  const offenders = Object.entries(dict).filter(([, v]) => typeof v === "string" && / -- /.test(v));
  check(
    `no '--' stands in for an em dash in ${lang}/guests.json`,
    offenders.length === 0,
    offenders.map(([k]) => k).join(", "),
  );
}

// ---------------------------------------------------------------------------
console.log("\n6. The view button has a name");
// ---------------------------------------------------------------------------

check(
  "the view button carries an accessible name",
  /aria-label=\{t\("viewGuestDetails", \{ name: u\.name \}\)\}/.test(users),
  "icon-only, no text child: a screen reader announces 'button', once per row",
);
check(
  "the name identifies WHICH guest",
  /\{\{name\}\}/.test(en.viewGuestDetails),
  "'View details' eleven times identifies none of them",
);
check(
  "it also has a sighted tooltip, like its two neighbours",
  /title=\{t\("viewDetails"\)\}/.test(users),
);
check(
  "the icon itself is hidden from the accessibility tree",
  /<Eye className="h-3\.5 w-3\.5" aria-hidden="true" \/>/.test(users),
);
// The neighbours, so this row's three buttons cannot drift apart again.
check("the extend button still has its tooltip", /title=\{t\("extend"\)\}/.test(users));
check(
  "the disconnect button still has its tooltip",
  /title=\{u\.status === "offline" \? t\("alreadyOffline"\) : t\("disconnect"\)\}/.test(users),
);

// ---------------------------------------------------------------------------
console.log("\n7. EN/HI parity across the venue-admin dictionaries");
// ---------------------------------------------------------------------------
//
// The dashboard ships `en` and `hi` only -- the ten-language suite
// (`test:portal-i18n-parity`) is the GUEST PORTAL and does not read these
// files. Nothing ran over them until now.

const NAMESPACES = ["common", "nav", "guests", "account", "help"];
/**
 * `help` is deliberately partial: `hi/help.json` carries the page chrome and
 * the seven group lines, and the 25 per-screen sentences reach a Hindi reader
 * through `fallbackLng` until a native review pass. That is a decision
 * recorded in `src/lib/i18n/index.ts`, so it is exempted BY NAME rather than
 * by weakening the check for everything.
 */
const PARTIAL_BY_DESIGN = new Set(["help"]);

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );

for (const ns of NAMESPACES) {
  const e = JSON.parse(read(`src/lib/i18n/locales/en/${ns}.json`));
  const h = JSON.parse(read(`src/lib/i18n/locales/hi/${ns}.json`));
  const enKeys = flatten(e);
  const hiKeys = new Set(flatten(h));
  const extra = flatten(h).filter((k) => !enKeys.includes(k));

  if (!PARTIAL_BY_DESIGN.has(ns)) {
    const missing = enKeys.filter((k) => !hiKeys.has(k));
    check(`hi/${ns}.json translates every en key`, missing.length === 0, missing.join(", "));
  }
  // Both directions, for every namespace including the partial one: a key
  // that exists ONLY in Hindi is a key nothing renders, or a rename that
  // took the English side with it.
  check(`hi/${ns}.json has no key en/${ns}.json lacks`, extra.length === 0, extra.join(", "));
}

// The keys this change added, pinned by name in both languages, so a merge
// that keeps one side of the diff cannot pass the parity check above by
// deleting them from both.
for (const key of [
  "sessionsCount_one",
  "sessionsCount_other",
  "guestsCount_one",
  "guestsCount_other",
  "sessionsFromGuests",
  "viewDetails",
  "viewGuestDetails",
  "deviceUndoAlwaysOffered",
]) {
  check(`en and hi both carry ${key}`, !!en[key] && !!hi[key]);
}

console.log(
  failures === 0
    ? "\nall customer-dashboard QA copy checks passed"
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
