/**
 * Regression test for the identifier Blocked Guests actually stores
 * (`src/lib/phone-e164.ts`) and for the screen that stores it
 * (`src/components/features/BlockUsers.tsx`).
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * Blocking a guest by phone number did not block anybody, and the screen
 * reported success. The screen built its rule as `"+" + digits` with no
 * country-code input anywhere on it, so an Indian venue owner typing the
 * ten digits they know stored `+9876543210` while the guest signs in as
 * `+919876543210` (`useGuestSignIn.ts`). guest_access matches by exact
 * string equality (`guest_access/repository.py`), so the rule was inert:
 *
 *   1. FUTURE SIGN-INS WERE NOT BLOCKED. No row matched, so the gate
 *      returned its default allow.
 *   2. A GUEST WHO WAS ONLINE STAYED ONLINE, AND THE SCREEN SAID THEY DID
 *      NOT. Enforcement (`guest_access/enforcement.py`) looks the guest up
 *      by that same identifier first and returns "nothing to do" before
 *      contacting any router -- HTTP 200, `sessions_ended: 0` -- and the
 *      toast asserted "1 number blocked" regardless.
 *
 * So the assertions below are, in order of how much damage the failure
 * does:
 *
 *   1. THE TYPED INPUT -> STORED IDENTIFIER MAPPING. Every shape a real
 *      pasted list mixes must land on ONE canonical value, and nothing
 *      may be accepted in a shape that cannot match a sign-in. This is the
 *      defect itself.
 *   2. NOTHING IS SILENTLY ACCEPTED. Anything unresolvable is rejected
 *      with a message naming what to do -- never normalised by guesswork
 *      into a rule that will never fire.
 *   3. THE SCREEN USES THE SHARED NORMALISER. A correct helper nobody
 *      calls is the same bug wearing a disguise, so the component source
 *      is checked for the import and for the absence of the old
 *      `"+" + digits` construction.
 *   4. THE TOAST DOES NOT OVER-CLAIM. "Blocked" and "blocked and taken
 *      off the WiFi" are different outcomes; the message must come from
 *      the server's `enforcement_status`/`sessions_ended`, and a failure
 *      must not be summarised away by a sibling success.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs` for the same note). The pure
 * module is bundled with esbuild and executed for real; the wiring is
 * checked against the real component source.
 *
 * Run: node scripts/test-block-users-e164.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "block-users-e164-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/phone-e164.ts"))};\n` +
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
  normalizePhoneToE164,
  toE164,
  splitE164,
  PHONE_COUNTRIES,
  DEFAULT_DIAL_CODE,
  blockOutcome,
  blockOutcomeMessage,
} = await import(bundle);

const IN = "+91";

console.log("\nthe stored identifier, for every shape a pasted list mixes");
// The exact list from the defect report. All four are the same person and
// must produce the same rule; two of them used to produce rules that
// matched nobody.
const CANON = "+919876543210";
for (const [typed, why] of [
  ["9876543210", "bare national digits -- what an Indian owner types"],
  ["+919876543210", "already E.164"],
  ["919876543210", "country code typed without the +"],
  ["09876543210", "national with a trunk-prefix 0"],
  ["00919876543210", "00 international access prefix"],
  ["+91 98765-43210", "formatting punctuation is not data"],
  ["  9876543210  ", "surrounding whitespace"],
  ["(0) 98765 43210", "brackets and spaces around a trunk prefix"],
]) {
  const r = normalizePhoneToE164(typed, IN);
  eq(`${JSON.stringify(typed)} -> ${CANON} (${why})`, r.ok ? r.e164 : `INVALID:${r.reason}`, CANON);
}

console.log("\nthe old bug is impossible: nothing is stored as + plus bare national digits");
for (const typed of ["9876543210", "09876543210", "9876543210 "]) {
  const r = normalizePhoneToE164(typed, IN);
  check(
    `${JSON.stringify(typed)} does not become "+9876543210"`,
    r.ok && r.e164 !== "+9876543210",
    `got ${JSON.stringify(r.ok ? r.e164 : r.reason)}`,
  );
}

console.log("\nan explicit country code beats the picker");
// A pasted export of foreign guests must not be rewritten into the
// venue's own country just because the picker says India.
eq(
  "+441632960961 stays British under +91",
  normalizePhoneToE164("+441632960961", IN).e164,
  "+441632960961",
);
eq(
  "+919876543210 stays Indian under +44",
  normalizePhoneToE164("+919876543210", "+44").e164,
  "+919876543210",
);

console.log("\nthe picker is what resolves a bare local number");
eq("9876543210 under +1", normalizePhoneToE164("9876543210", "+1").e164, "+19876543210");
eq("9876543210 under +44", normalizePhoneToE164("9876543210", "+44").e164, "+449876543210");
eq("501234567 under +971", normalizePhoneToE164("501234567", "+971").e164, "+971501234567");
eq("default dial code is India", DEFAULT_DIAL_CODE, "+91");
eq("no picker argument means the default", normalizePhoneToE164("9876543210").e164, CANON);

console.log("\na number of national length is national, even when it starts with the code");
// Ten digits is what an owner types. Reading "9198765432" as "+91" plus an
// eight-digit stub would silently write a rule for somebody else.
eq("9198765432 under +91", normalizePhoneToE164("9198765432", IN).e164, "+919198765432");

console.log("\nnothing unresolvable is silently accepted");
for (const [typed, reason] of [
  ["", "empty"],
  ["   ", "empty"],
  ["98765abc10", "not-a-number"],
  ["98-76-5", "too-short"],
  ["12345", "too-short"],
  ["1234567890123456789", "too-long"],
  ["+1234567", "too-short"],
  ["+1234567890123456", "too-long"],
  // Long enough to carry some country code, but not one we can identify,
  // and not the one selected -- guessing here is how the original defect
  // wrote a rule that never fired.
  ["441632960961", "ambiguous"],
]) {
  const r = normalizePhoneToE164(typed, IN);
  eq(`${JSON.stringify(typed)} is rejected as ${reason}`, r.ok ? "ACCEPTED" : r.reason, reason);
  if (!r.ok) {
    check(
      `${JSON.stringify(typed)} rejection says what to do`,
      typeof r.message === "string" && r.message.length > 12 && !/^invalid$/i.test(r.message),
      JSON.stringify(r.message),
    );
  }
}

console.log("\nround-trip: what is stored can be shown back in a picker + field");
for (const country of PHONE_COUNTRIES) {
  const national = "9876543210".slice(0, 15 - country.code.length + 1);
  const stored = toE164(country.code, national);
  const split = splitE164(stored);
  eq(`${stored} splits back to ${country.code}`, split.cc, country.code);
  eq(`${stored} splits back to ${national}`, split.national, national);
}
// A row written by the old code carries bare national digits behind a
// stray "+". It must not be shown as though somebody chose that country.
eq("legacy +9876543210 falls back to the default code", splitE164("+9876543210").cc, "+91");

console.log("\nthe screen actually uses the shared normaliser");
const src = readFileSync(join(ROOT, "src/components/features/BlockUsers.tsx"), "utf8");
check(
  "BlockUsers imports normalizePhoneToE164 from @/lib/phone-e164",
  /normalizePhoneToE164/.test(src) && /@\/lib\/phone-e164/.test(src),
);
check(
  "BlockUsers renders a country-code picker",
  /PHONE_COUNTRIES/.test(src) && /block-cc/.test(src),
);
check(
  'BlockUsers no longer builds an identifier as "+" + digits',
  !/["'`]\+["'`]\s*\+\s*(c\b|cleaned)/.test(src),
  "found the old bare-plus construction",
);
check(
  "BlockUsers does not define a second normaliser",
  !/const\s+toE164\s*=/.test(src) && !/function\s+toE164\b/.test(src),
  "a local copy of the normaliser is how this bug class comes back",
);

console.log("\nthe toast reports what the server said, not what we hoped");
// The real ladder, executed -- not a copy of it. These are the outcomes
// the screen used to render identically as "N numbers blocked."
const noun = (n) => (n === 1 ? "number" : "numbers");
const rule = (over) => ({
  kind: "identifier",
  enforcementStatus: null,
  sessionsEnded: null,
  ...over,
});
const outcome = (rules) => blockOutcome(rules).outcome;

eq(
  "a router that could not be reached is reported, not swallowed by a sibling success",
  outcome([
    rule({ enforcementStatus: "enforced", sessionsEnded: 1 }),
    rule({ enforcementStatus: "failed" }),
  ]),
  "failed",
);
eq(
  "a real disconnection is reported as one",
  outcome([rule({ enforcementStatus: "enforced", sessionsEnded: 2 })]),
  "sessions-ended",
);
eq(
  "a blocked guest who was not online is not reported as disconnected",
  outcome([rule({ enforcementStatus: "enforced", sessionsEnded: 0 })]),
  "nobody-online",
);
eq(
  "a block nobody enforced does not claim nobody was online",
  outcome([rule({ enforcementStatus: "unenforced", sessionsEnded: 0 })]),
  "unenforced",
);
eq(
  "enforcement still running is said to be running",
  outcome([rule({ enforcementStatus: "pending" })]),
  "pending",
);
eq("an older API that omits the fields claims nothing", outcome([rule({})]), "unknown");

// The exact defect: enforcement found nobody, returned sessions_ended 0,
// and the screen said "1 number blocked" as though somebody had been cut
// off. The wording must not imply a disconnection that did not happen.
const nothingHappened = blockOutcomeMessage(
  [rule({ enforcementStatus: "enforced", sessionsEnded: 0 })],
  noun,
);
check(
  "a 0-session block does not claim a session ended",
  !/session[s]? ended/.test(nothingHappened),
  JSON.stringify(nothingHappened),
);
const stillOnline = blockOutcomeMessage([rule({ enforcementStatus: "failed" })], noun);
check(
  "a failed enforcement tells the owner the guest may still be online",
  /still be online/.test(stillOnline),
  JSON.stringify(stillOnline),
);
eq(
  "a confirmed disconnection counts the sessions",
  blockOutcomeMessage([rule({ enforcementStatus: "enforced", sessionsEnded: 1 })], noun),
  "1 number blocked. 1 active session ended.",
);

check(
  "BlockUsers derives its toast from the created rules",
  /blockOutcomeMessage\(created,/.test(src),
  "the toast is still asserted regardless of the response",
);
check(
  "BlockUsers does not define a second outcome ladder",
  !/function\s+blockOutcomeMessage\b/.test(src),
  "a local copy would drift from the one this test executes",
);
check(
  "the enforcement fields survive the service mapper",
  /sessions_ended/.test(readFileSync(join(ROOT, "src/services/guest.service.ts"), "utf8")),
  "guest.service.ts drops sessions_ended, so the toast can never know",
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
