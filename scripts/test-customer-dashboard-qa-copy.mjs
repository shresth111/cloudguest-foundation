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
 * SECTIONS 8-14 ARE A SECOND PASS, same day, over seven more sentences on six
 * more screens. They live here rather than in a second suite because they are
 * the same defect class, and because a second suite would need its own copy of
 * the EN/HI parity block in section 7 -- which is precisely the duplication
 * this file was written to end. Their own header comment is above section 8.
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
 * the eight group lines, and the 26 per-screen sentences reach a Hindi reader
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

// ===========================================================================
// SECOND PASS (2026-09-18): seven more sentences that promised more than the
// system does. Same file rather than a second suite, because six of the seven
// are the SAME defect class as the six above -- a screen describing an outcome
// the backend never produces -- and because a second suite would need its own
// copy of the EN/HI parity block, which is the drift this file exists to stop.
//
// The through-line: every one of these is about the LIVE-SESSION half. This
// platform is genuinely good at the sign-in half (a rule, consulted before
// every login, on our own side of the wire) and has almost nothing on the
// other -- one vendor in `_GUEST_ACCESS_ADAPTERS`, a RADIUS CoA transport
// measured at zero successes in production, and no scheduled sweep at all.
// Copy kept quietly borrowing the certainty of the first half for the second.
// ===========================================================================

const whiteList = stripComments(read("src/components/features/WhiteList.tsx"));
const operations = stripComments(read("src/components/features/OperationsFeatures.tsx"));
const fixAProblem = stripComments(read("src/components/customer/FixAProblem.tsx"));
const qos = stripComments(read("src/components/network/QosManagement.tsx"));
const liveSessions = stripComments(read("src/components/guests/LiveSessionsTable.tsx"));
const assistant = stripComments(read("src/components/features/AssistantWidget.tsx"));
const howItWorks = stripComments(read("src/components/customer/HowItWorksPage.tsx"));
const guestSvc = stripComments(read("src/services/guest.service.ts"));
const helpEn = JSON.parse(read("src/lib/i18n/locales/en/help.json"));

// ---------------------------------------------------------------------------
console.log("\n8. Whitelist-only does not promise a sweep that does not exist");
// ---------------------------------------------------------------------------
//
// The worst of the seven: a TIME-BOUNDED promise ("within a few minutes")
// about the one half nothing measures. There is no sweep. `celery_app.py`'s
// beat schedule has three guest-domain tasks -- session timeout, FUP time
// accrual, quota reset -- and none reads `whitelist_only_enabled`. The only
// thing that ends a live session from a rule is `BlocklistEnforcer.enforce`,
// which returns early for anything that is not a BLOCKLIST.

check(
  "the screen no longer promises already-online guests are disconnected",
  !/disconnected within a few minutes/i.test(whiteList),
  "no sweep reads whitelist_only_enabled; BlocklistEnforcer returns early for whitelist rules",
);
check(
  "and makes no time-bounded claim about live sessions at all",
  !/within (a few|\d+) minutes?/i.test(whiteList),
  "a different number would be the same invented promise",
);
check("it says the list is consulted at sign-in", /checked when someone signs in/.test(whiteList));
check(
  "and says plainly that anyone already online stays online",
  /anyone already online stays online until their session ends/.test(whiteList),
);
// The two halves that ARE true keep their full strength. Hedging a true
// sentence is the same failure as asserting a false one, in the other
// direction, and this screen's refusal path is genuinely watertight.
check(
  "the refusal is still stated without hedging",
  /refused on that page, in your words/.test(whiteList),
  "WhitelistOnlyAccessDeniedError really carries the venue's own message",
);
check(
  "the pre-OTP guarantee is still stated without hedging",
  /never sent a verification code/.test(whiteList),
  "check_portal_admission refuses before the code is generated",
);

// ---------------------------------------------------------------------------
console.log("\n9. Open Hours says what it gates, in the words already settled on");
// ---------------------------------------------------------------------------

check(
  "Open Hours no longer says guests are disconnected outside the schedule",
  !/outside it they are disconnected/.test(operations),
  "_require_venue_open is called from login paths only; is_open_now is absent from guest/tasks.py",
);
check(
  "it says what guests actually see instead",
  /see your closed message instead of the sign-in page/.test(operations),
);
check(
  "and reuses LocationPolicies' settled phrasing for the live-session half",
  /Anyone already online stays online until their session ends/.test(operations),
);
// The sentence this one was matched to must still be there to match.
const locationPolicies = stripComments(read("src/components/features/LocationPolicies.tsx"));
check(
  "LocationPolicies still carries the phrasing this was aligned to",
  /anyone\s+online right now keeps those until then/.test(locationPolicies),
  "if that sentence moves, these two screens have silently become three phrasings",
);

// ---------------------------------------------------------------------------
console.log("\n10. Reset a session reports what happened, per venue");
// ---------------------------------------------------------------------------
//
// `terminate_session` -> `issue_live_disconnect` -> `get_guest_access_adapter`,
// whose registry is `{"mikrotik": ...}`. At a controller venue the device call
// cannot happen, and the old copy promised it on every 2xx.

check(
  "terminateSession no longer discards the backend's answer",
  /Promise<\{ sessionEnforced: boolean \| null \}>/.test(guestSvc),
  "disconnect_enforced has always been returned and was always thrown away",
);
check(
  "it reads both envelope shapes, like disconnectSession does",
  /disconnect_enforced \?\? body\?\.data\?\.disconnect_enforced/.test(guestSvc),
  "reading only data.disconnect_enforced pins sessionEnforced to null forever",
);
check(
  "Fix a Problem runs the result through the EXISTING ladder",
  /disconnectOutcome\(\{[\s\S]{0,200}sessionEnforced,/.test(fixAProblem),
  "a second ladder would be a third honesty pattern",
);
check(
  "it reuses the disconnect verdict rather than inventing a reset capability",
  /clientControls\.verdict\("disconnect"\)/.test(fixAProblem),
);
check(
  "the confirm dialog no longer promises the device goes, ungated",
  !/description="They'll be disconnected and sent back to the login page/.test(fixAProblem),
);
check(
  "the promise is gated on the venue actually reaching the device",
  /resetReachesDevice\s*\?/.test(fixAProblem),
);
check(
  "a MikroTik venue still gets the original sentence verbatim",
  /They'll be disconnected and sent back to the login page to sign in again\./.test(fixAProblem),
  "the claim is TRUE on RouterOS; gating must not cost those venues their copy",
);
check(
  "the controller branch does not send an owner to check a router",
  !/controller-venue[\s\S]{0,400}[Cc]heck the router/.test(fixAProblem),
  "there is no router at that venue to check, and the retry cannot succeed",
);
check(
  "the success toast no longer asserts the outcome on any 2xx",
  !/toast\.success\("Done — they'll be sent back to the login page to sign in again\."\)/.test(
    fixAProblem,
  ),
);

// ---------------------------------------------------------------------------
console.log("\n11. Call Priority claims a mechanism, not a measured outcome");
// ---------------------------------------------------------------------------

check(
  "the screen no longer promises calls stay clear",
  !/calls stay clear/.test(qos),
  "throughput was never measured; CAPABILITY-MATRIX §10.4",
);
check("it says what the rule does instead", /changes the order traffic is sent in/.test(qos));
check(
  "and names the limit the owner would otherwise discover the hard way",
  /cannot add capacity your internet line does not have/.test(qos),
);
// The gate question the brief asked, pinned as ANSWERED rather than re-solved:
// this screen is already not offered at a controller venue, so no second
// vendor check belongs inside it.
const routerVendors = stripComments(read("src/lib/router-vendors.ts"));
check(
  "Call Priority is still gated out of controller venues one layer up",
  /CONTROLLER_UNSUPPORTED_FEATURE_IDS[\s\S]{0,200}"voip"/.test(routerVendors),
  "if voip leaves that list, this screen starts rendering at venues with no RouterOS queue",
);
check(
  "so the screen itself grew no second vendor check",
  !/isControllerManaged|controllerManaged/.test(qos),
  "two gates on one fact drift; the outer one already refuses to mount this",
);
check(
  "the help page's voip line drops the same promise",
  !/calls stay clear/.test(helpEn.feature.voip),
);

// ---------------------------------------------------------------------------
console.log("\n12. The How-it-works page answers for THIS venue");
// ---------------------------------------------------------------------------
//
// This page renders the sidebar's own expression so the two cannot drift --
// but it had never picked up the sidebar's controller gate, so at an Omada
// venue the one screen whose job is "what can I do here" was the last one
// still answering for a MikroTik.

check(
  "the page applies the sidebar's controller gate",
  /featureAppliesToControllerVenue\(item\.id\)/.test(howItWorks),
);
check(
  "using the shared reason string, not a new sentence",
  /controllerVenueFeatureReason/.test(howItWorks),
  "a third phrasing of 'configured in Omada' is a third thing to keep true",
);
check(
  "the gated rows are muted rather than removed",
  /viaController && "opacity-60"/.test(howItWorks),
  "an absence cannot be asked why -- CustomerSidebar's own reasoning",
);
check(
  "and the group note is shown only where something in it is gated",
  /group\.items\.some\(\(item\) => !featureAppliesToControllerVenue\(item\.id\)\)/.test(howItWorks),
);
check(
  "a MikroTik venue reaches none of it",
  /controllerManaged\s*\n?\s*\?\s*!featureAppliesToControllerVenue/.test(howItWorks),
);
// The four rewritten sentences, by the fact each one was wrong about.
check("the DHCP line no longer assumes a router of ours", !/your router/.test(helpEn.feature.dhcp));
check(
  "the policies line calls the speed a cap",
  /speed cap/.test(helpEn.feature.policies),
  "a speed is a cap, not a promise -- throughput was never measured",
);
check(
  "and scopes it to the next session rather than every guest",
  /next session starts under/.test(helpEn.feature.policies) &&
    !/every guest connects under/.test(helpEn.feature.policies),
  "LocationPolicies' own footer says these apply the next time each guest connects",
);
check(
  "the users line does not promise the device goes",
  /end someone's session/.test(helpEn.feature.users) &&
    !/disconnect someone/.test(helpEn.feature.users),
);
// Website Blocking is a tab of Security -> Blocking now, so its line moved to
// "blocking". Asserted to EXIST first -- the old key going missing made the
// original check pass on `undefined` without anyone noticing.
check("the blocking line exists", typeof helpEn.feature.blocking === "string");
check(
  "the blocking line describes the rule, not a guaranteed outcome",
  !/guests can't reach/.test(helpEn.feature.blocking ?? "guests can't reach"),
);
check(
  "and does not promise category filtering, which does not exist",
  !/categor/i.test(helpEn.feature.blocking ?? "categor"),
  "web category filtering needs a provider this platform does not have",
);
check(
  "the retired website-blocking line is gone rather than orphaned",
  !("website-blocking" in helpEn.feature),
);
// Found in passing, and the same defect as section 9.
check(
  "the business-hours line says sign in, not stay online",
  /can sign in/.test(helpEn.feature["business-hours"]) &&
    !/can stay online/.test(helpEn.feature["business-hours"]),
  "Open Hours never ends a session that is already running",
);

// ---------------------------------------------------------------------------
console.log("\n13. Terminate and Block describe the lockout they actually impose");
// ---------------------------------------------------------------------------
//
// The cooldown is REAL -- `TERMINATION_RECONNECT_COOLDOWN_MINUTES = 60` -- and
// really enforced, but only inside `reconnect()`, the admin route behind
// `guest_sessions.execute`. No guest-facing login path consults it.

check(
  "Terminate no longer describes the cooldown as the guest's",
  !/imposes a 60-minute reconnect cooldown for this guest/.test(liveSessions),
  "the guest can sign in again on the portal immediately; only our Reconnect is held",
);
check(
  "it keeps the real number",
  /60 minutes/.test(liveSessions),
  "the constant is 60 and is genuinely enforced -- the scope was wrong, not the value",
);
check("it names what is actually held", /blocks the dashboard's Reconnect/.test(liveSessions));
check(
  "and says plainly what is NOT held",
  /does not stop them signing in again on the WiFi login page/.test(liveSessions),
);
check(
  "the assistant no longer says a block prevents reconnecting",
  !/prevents reconnecting/.test(assistant),
  "a blocked guest can rejoin the SSID and reach the portal; what they cannot do is get through it",
);
check(
  "it says the sign-in half, which is ours and certain",
  /stops them signing in again until you unblock them, on any device/.test(assistant),
);
check(
  "the session half is ATTEMPTED, in the same words BlockUsers uses",
  /tries to end the session they have right now/.test(assistant),
);
check(
  "and it points at the screen that reports what actually happened",
  /the screen tells you whether that worked/.test(assistant),
);
check(
  "Disconnect's description is unchanged, because it was true",
  /ends just their current session/.test(assistant),
  "one session versus a standing rule is exactly the two backend routes",
);

// ---------------------------------------------------------------------------
console.log("\n14. Nothing in this pass claims a block cuts off a live guest");
// ---------------------------------------------------------------------------
//
// The single rule the backend states in its own words, swept across every
// screen this change touched rather than asserted once where it was easy.

for (const [name, src] of [
  ["WhiteList.tsx", whiteList],
  ["OperationsFeatures.tsx", operations],
  ["FixAProblem.tsx", fixAProblem],
  ["LiveSessionsTable.tsx", liveSessions],
  ["AssistantWidget.tsx", assistant],
  ["QosManagement.tsx", qos],
]) {
  check(
    `${name} makes no immediate-cutoff claim`,
    !/(cut|kick)(s|ting)? (them|him|her|the guest|anyone|a guest) off|immediately disconnect|disconnected immediately/i.test(
      src,
    ),
  );
}

console.log(
  failures === 0
    ? "\nall customer-dashboard QA copy checks passed"
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
