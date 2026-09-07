/**
 * Regression test for how a guest is named in operator-facing surfaces.
 *
 * WHAT WENT WRONG: `identityFromGuest` ended in `guest?.display_name ||
 * "Guest"`. `Guest.display_name` is NULL on virtually every real row --
 * the only backend write path is `POST /guest/profile`, reached only from
 * the post-connect profile card, which only renders when the venue turns
 * on `collect_guest_name`, and that flag defaults to false for every
 * venue. So every real guest rendered as the literal word "Guest": the
 * Users table, the dashboard's recent-guest list and every Guest Activity
 * report showed one repeated placeholder where the identifying fact --
 * the phone number or email in `Guest.identifier`, which is NOT NULL and
 * therefore always present -- was sitting unused one field away.
 *
 * This is a display defect on top of genuinely missing data, and the two
 * halves need different fixes. These assertions pin the display half.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. THE WORD "Guest" IS NEVER INVENTED. It reads like a real name, so
 *      it is indistinguishable from a guest actually called Guest, and it
 *      makes every row look identical. This is the assertion that fails
 *      against the old implementation.
 *   2. THE IDENTIFIER IS NOT THROWN AWAY. A surface with only one identity
 *      column must fall back to the phone/email, not to a placeholder.
 *   3. A REAL NAME ALWAYS WINS. The fallback must not shadow the guests
 *      who did fill the card in.
 *   4. THE BLANK IS EXPLAINED, NOT HIDDEN. When no row in a report has a
 *      name, the UI must say why -- otherwise a blank column reads as a
 *      broken join and someone "fixes" it by reintroducing a placeholder.
 *
 * Run: node scripts/test-guest-identity.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "guest-identity-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export {
     identityFromGuest,
     shouldExplainMissingGuestNames,
     GUEST_NAME_NOT_COLLECTED_NOTICE,
     UNIDENTIFIED_GUEST_LABEL,
   } from "${join(ROOT, "src/lib/guest-identity.ts").replace(/\\/g, "/")}";`,
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
  identityFromGuest,
  shouldExplainMissingGuestNames,
  GUEST_NAME_NOT_COLLECTED_NOTICE,
  UNIDENTIFIED_GUEST_LABEL,
} = await import(`file://${outfile}`);

// ---------------------------------------------------------------------------
// 1. The placeholder is gone.
// ---------------------------------------------------------------------------

console.log('\nthe word "Guest" is never invented');

// This is the shape of a real row today: a phone number, no name.
const phoneOnly = identityFromGuest({ identifier: "+919876598647", display_name: null });
eq("a nameless guest has a null name, not a placeholder", phoneOnly.name, null);
check(
  'no field on a nameless guest equals the literal "Guest"',
  ![phoneOnly.name, phoneOnly.label, phoneOnly.email, phoneOnly.phone].includes("Guest"),
  JSON.stringify(phoneOnly),
);

// The masked form the API actually returns when masking is on
// (`MaskedIdentifier` -> `mask_mobile`). Must behave identically: the
// display layer never re-derives identity from an unmasked value.
const masked = identityFromGuest({ identifier: "XXXXXXX98647", display_name: null });
eq("a masked identifier still yields no invented name", masked.name, null);
eq("a masked identifier is used verbatim as the label", masked.label, "XXXXXXX98647");

// Guests who submitted whitespace, or rows holding "", have no name on
// file -- rendering an invisible one is the same defect wearing a hat.
eq(
  "an empty display_name is no name",
  identityFromGuest({ identifier: "+91", display_name: "" }).name,
  null,
);
eq(
  "a whitespace display_name is no name",
  identityFromGuest({ identifier: "+91", display_name: "   " }).name,
  null,
);

// ---------------------------------------------------------------------------
// 2. The identifier survives.
// ---------------------------------------------------------------------------

console.log("\nthe identifying fact is not thrown away");

eq("a phone identifier becomes the label", phoneOnly.label, "+919876598647");
eq("a phone identifier lands in phone", phoneOnly.phone, "+919876598647");
eq("a phone identifier does not land in email", phoneOnly.email, "");

const emailOnly = identityFromGuest({ identifier: "akhil@example.com", display_name: null });
eq("an email identifier becomes the label", emailOnly.label, "akhil@example.com");
eq("an email identifier lands in email", emailOnly.email, "akhil@example.com");
eq("an email identifier does not land in phone", emailOnly.phone, "");

// The only case with genuinely nothing to show: a session whose guest_id
// matched no row at all. Must still not be name-shaped.
const nothing = identityFromGuest(undefined);
eq("an unmatched guest gets the explicit unknown marker", nothing.label, UNIDENTIFIED_GUEST_LABEL);
eq("an unmatched guest has no name", nothing.name, null);
check(
  "the unknown marker is not mistakable for a name",
  UNIDENTIFIED_GUEST_LABEL !== "Guest" && /unknown/i.test(UNIDENTIFIED_GUEST_LABEL),
  UNIDENTIFIED_GUEST_LABEL,
);

// ---------------------------------------------------------------------------
// 3. A real name always wins.
// ---------------------------------------------------------------------------

console.log("\na real name is never shadowed by the fallback");

const named = identityFromGuest({ identifier: "+919876598647", display_name: "Priya Kapoor" });
eq("a real name is returned as-is", named.name, "Priya Kapoor");
eq("a real name is preferred over the identifier for the label", named.label, "Priya Kapoor");
eq("the identifier is still available alongside the name", named.phone, "+919876598647");

// Already masked server-side by `MaskedName` -- passed through untouched,
// never re-masked and never treated as "no name".
const maskedName = identityFromGuest({ identifier: "+919876598647", display_name: "Priya K." });
eq("a server-masked name is passed through", maskedName.name, "Priya K.");

// ---------------------------------------------------------------------------
// 4. The blank column explains itself.
// ---------------------------------------------------------------------------

console.log("\na fully blank name column is explained, not left to guess");

check(
  "an all-blank name column triggers the notice",
  shouldExplainMissingGuestNames([
    { name: null, mobile: "+91" },
    { name: null, mobile: "+92" },
  ]),
);
check(
  "one real name is enough to suppress the notice",
  !shouldExplainMissingGuestNames([
    { name: null, mobile: "+91" },
    { name: "Priya Kapoor", mobile: "+92" },
  ]),
);
check("an empty result set explains nothing", !shouldExplainMissingGuestNames([]));
check("a null result set explains nothing", !shouldExplainMissingGuestNames(null));
check(
  "a report with no name column at all is not annotated",
  !shouldExplainMissingGuestNames([{ date: "2026-09-06", totalData: 12 }]),
);
check(
  "the notice names the setting an operator would have to turn on",
  /ask for guest name/i.test(GUEST_NAME_NOT_COLLECTED_NOTICE),
  GUEST_NAME_NOT_COLLECTED_NOTICE,
);
check(
  "the notice does not claim the data is merely loading or broken",
  !/error|failed|loading/i.test(GUEST_NAME_NOT_COLLECTED_NOTICE),
  GUEST_NAME_NOT_COLLECTED_NOTICE,
);

// ---------------------------------------------------------------------------
// 5. Call sites actually use it.
// ---------------------------------------------------------------------------
// A correct helper that nobody calls fixes nothing, and the old literal
// living on in a service file would resurrect the defect on that surface.

console.log("\nthe placeholder is gone from the surfaces that showed it");

const customerService = readFileSync(join(ROOT, "src/services/customer.service.ts"), "utf8");
check(
  'customer.service.ts no longer falls back to the string "Guest"',
  !/\|\|\s*"Guest"/.test(customerService),
);
check(
  "the dashboard and Users rows resolve identity through the shared helper",
  (customerService.match(/identity\.label/g) ?? []).length >= 2,
);

const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
check(
  "the Reports screen renders the missing-name notice",
  /GUEST_NAME_NOT_COLLECTED_NOTICE/.test(reports),
);

console.log(
  failures === 0
    ? `\nall guest identity checks passed\n`
    : `\n${failures} guest identity check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
