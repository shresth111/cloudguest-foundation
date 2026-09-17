/**
 * Regression test for the Campaigns page's simplification pass.
 *
 * Every assertion here pins a REMOVAL, which is the shape most likely to be
 * undone by a well-meaning tidy-up: a screen looks bare, so a hero band comes
 * back; a card looks empty, so it is filled with a plausible-looking sample;
 * a row gets a second control "for convenience". None of that is visible to
 * tsc, eslint or the build, and none of it is a bug in the ordinary sense --
 * which is exactly why it needs a test rather than a comment.
 *
 * The founder's report, verbatim, and where each line is asserted below:
 *
 *   "We already have location selected and showing at top, no need to repeat
 *    same information 2 more time"           -> §1
 *   "This Extra fancy banner is not required" -> §1
 *   "for creating campaigns it should be simple enough" -> §4
 *   "Need to have customizable survey and feedback section" -> §3
 *   "No Need for unnecessary descriptions like 'Feedback Made Easy Collect
 *    real-time feedback from your users to improve your business & user
 *    satisfaction.'"                          -> §2
 *   "Discount coupons are interesting part of our product, so it should be
 *    more clearly designed"                  -> §3
 *   "No need for post login redirect url from here it is already present in
 *    the portal"                             -> §5
 *   "List of created campaign/survey forms"  -> §3
 *   "After login there should be option to choose from saved campaign which we
 *    want to be active"                      -> §3 (status control)
 *
 * Source-level, like scripts/test-open-hours-draft.mjs's own wiring section --
 * the page is a 1,700-line component whose behaviour is mostly fetch-and-paint
 * around a real API, and what regresses here is copy, layout and control
 * count, none of which a runtime assertion would catch better.
 *
 * Run: node scripts/test-campaigns-simplified.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const page = readFileSync(join(ROOT, "src/components/features/CampaignsPage.tsx"), "utf8");
/** Comments stripped, so a comment that MENTIONS a removed string (there are
 * several, explaining what was removed and why) cannot satisfy or fail an
 * assertion about what the page renders. */
const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("\n1. no hero band, and no third copy of the page's own title");
check(
  "the gradient hero band is gone",
  !/from-\[#1e1b4b\] via-\[#312e81\]/.test(code),
  "the dark indigo/violet band is back",
);
check(
  "its illustration is gone too",
  !/CampaignReachIllustration/.test(code),
  "the phone-and-badges SVG is back",
);
check("no framer-motion import for a decorative band", !/from "framer-motion"/.test(code));
check(
  "the page renders no <h2> title of its own",
  !/<h2/.test(code),
  "the shell already prints the feature name above this page",
);
// The venue itself comes from CustomerPageScope; this page must not name it.
check(
  "the page never prints a location name of its own",
  !/locationName|activeLocation/.test(code),
);

console.log("\n2. no marketing copy");
for (const line of [
  "Feedback Made Easy",
  "More Business With Discounts",
  "Leverage WiFi as a communication platform",
  "This lists out all the recent communication campaigns",
  "This helps you to create different types of campaigns",
  "Reach, survey, and re-engage guests over your WiFi",
  "Reach every guest who connects",
]) {
  check(`"${line.slice(0, 38)}..." is gone`, !code.includes(line));
}

console.log("\n3. real data, one control per row");
check(
  "the survey card lists this venue's own surveys",
  /const surveys = items\.filter\(\(c\) => c\.type === "SURVEY"\)/.test(code),
);
check(
  "...and offers the question editor from the card",
  /surveys\.map[\s\S]{0,600}openManage\(c\)/.test(code),
);
check(
  "the coupon card reads the campaigns' real assets",
  /campaignService\.listAssets\(c\.id\)/.test(code),
);
check("...and renders the real coupon code, not a literal", /\{asset\?\.couponCode \?/.test(code));
// `SURVEY_QUESTIONS` still exists, and should: it seeds the QUESTIONS EDITOR in
// demo mode, where there is no backend to ask. What must never come back is the
// card rendering it as content -- a real venue's "Survey & Feedback" card used
// to show three questions the venue had not written. Scoped by slicing the
// component itself, so the demo seed may stay and the card may not use it.
const componentBody = page.slice(page.indexOf("export function CampaignsPage"));
check(
  "the invented sample questions are not rendered",
  !/SURVEY_QUESTIONS/.test(componentBody),
  "the hard-coded 'Rate our food quality?' panel is back in the card",
);
check(
  "the saved-campaigns list exists and is named",
  /Saved campaigns/.test(code) && /filtered\.map/.test(code),
);
check(
  "a row carries exactly ONE status control",
  !/nextPlayAction/.test(code),
  "the redundant Play/Pause icon is back beside the status select",
);
check(
  "...and that control offers only the legal transitions",
  /selectableStatuses\(c\.status\)/.test(code),
);
check(
  "the results wiring this page already had is untouched",
  /campaignService\.listResults\(/.test(code) && /campaignService\.getResults\(/.test(code),
);

console.log("\n4. creating a campaign is name-and-type only");
check(
  "the name is the only required field",
  /if \(!form\.name\) e\.name = "Campaign name is required\.";/.test(code) &&
    !/e\.startDate = "Required\."/.test(code) &&
    !/e\.endDate = "Required\."/.test(code),
);
check(
  "an empty start date means now, not null",
  /form\.startDate \? new Date\(form\.startDate\) : new Date\(\)/.test(code),
);
check("the date fields are labelled as optional", /Leave empty to start now\./.test(code));

console.log("\n5. the Post-Login Redirect URL is not on this page");
check(
  "the card is gone",
  !/Post-Login Redirect URL/.test(code),
  "portal.service's redirect_url is edited in the Portal Builder",
);
check("...with its state", !/redirectUrl|portalConfigId|savingRedirect/.test(code));
check(
  "...and its service import",
  !/portal\.service/.test(code),
  "the Campaigns page must not write captive-portal config",
);

console.log(`\n${checks} checks, ${failures} failed`);
if (failures > 0) process.exit(1);
console.log("all campaigns simplification checks passed");
