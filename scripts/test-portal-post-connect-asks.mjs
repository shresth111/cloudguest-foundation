/**
 * Regression test for the post-connect ask rules on `/portal/session`.
 *
 * WHAT THIS LOCKS DOWN, and why each one is worth a test rather than a code
 * comment:
 *
 * 1. **The Google review card and any rating prompt never share a screen,
 *    and never share a visit.** That is not a UX preference -- Google's
 *    Rating Manipulation policy bans selectively soliciting positive
 *    reviews, and the penalty lands on the VENUE's Business Profile
 *    (reviews unpublished, a public "fake reviews were removed" banner,
 *    account-level suspension across a chain). The design's whole claim is
 *    that the prohibited behaviour is *impossible* here rather than merely
 *    absent, because the Google ask is decided before the product holds any
 *    sentiment about the guest. A test is what keeps that true after the
 *    next person edits the resolver.
 * 2. **The star prompt does not fire on arrival.** It used to ask "how was
 *    your visit?" about a visit ninety seconds old, as a full-screen
 *    takeover in front of the screen that tells a guest their WiFi works.
 * 3. **Both profile fields default off.** The venue is the Data Fiduciary
 *    under DPDP; a build that quietly collected a name because a backend
 *    field was absent would make a decision that is not ours to make.
 * 4. **No `localStorage` on this path.** Inside Apple's Captive Network
 *    Assistant Web Storage *throws*; a storage read on this surface has
 *    already taken hydration down once (see
 *    `test-portal-cna-storage-safety.mjs`), and the don't-ask-twice flag
 *    that used to live here failed on every read on exactly the platform
 *    where the environment is worst.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (no vitest/jest, no
 * `test` script) -- see `scripts/ci-gated-test.sh`. `src/lib/portal-post-
 * connect.ts` has zero imports precisely so it can be bundled and exercised
 * for real here, rather than reimplemented in the test.
 *
 * Run: node scripts/test-portal-post-connect-asks.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "post-connect-test-"));

await build({
  entryPoints: [join(SRC, "lib/portal-post-connect.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const M = await import(join(work, "bundle.mjs"));

let failures = 0;
const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(["ok   ", name]);
  } catch (e) {
    failures++;
    results.push(["FAIL ", `${name}\n         ${e.message}`]);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg}: expected ${expected}, got ${actual}`);
}

const MINUTE = 60_000;
const NOW = Date.parse("2026-09-06T12:00:00Z");
const startedMinutesAgo = (m) => new Date(NOW - m * MINUTE).toISOString();

const OFF_CONFIG = {
  collectGuestName: false,
  collectGuestEmail: false,
  reviewUrl: null,
  reviewCardEnabled: false,
  guestFeedbackEnabled: false,
  feedbackDwellMinutes: 25,
};
const config = (over) => ({ ...OFF_CONFIG, ...over });

/** A venue that has BOTH switched the review card on and pasted a link --
 * the only state in which a guest ever sees it. Spelled out as a pair
 * everywhere below, because the pair is the rule: an earlier version of
 * this frontend inferred the switch from the URL, which made pausing the
 * ask and deleting the link the same gesture. */
const REVIEW_ON = { reviewCardEnabled: true, reviewUrl: "https://g.page/r/abc/review" };
const session = (over) => ({
  startedAt: startedMinutesAgo(1),
  hasProfile: false,
  hasOpenedReviewLink: false,
  ...over,
});
const ask = (over) =>
  M.resolvePostConnectAsk({
    config: OFF_CONFIG,
    session: session(),
    now: NOW,
    reviewCardShownThisSession: false,
    starCampaignAvailable: false,
    arrivalAskSettled: false,
    feedbackSettled: false,
    ...over,
  });

// ---------------------------------------------------------------- defaults
check("a venue that has configured nothing asks nothing", () => {
  eq(ask({}), null, "no settings must mean no card");
});

check("both profile fields default off, so absent backend flags collect nothing", () => {
  // This is the shape `toRuntimeConfig` produces from a response with no
  // `collect_guest_*` fields at all -- i.e. the backend before the migration.
  eq(M.profileCardEligible(config({}), session()), false, "absent flags must not collect");
});

// ------------------------------------------------------------ profile card
check("profile card shows when the venue collects a name and the guest has not answered", () => {
  eq(ask({ config: config({ collectGuestName: true }) }), "profile", "should ask");
});

check("hasProfile suppresses the profile card -- the localStorage flag it replaces", () => {
  eq(
    ask({ config: config({ collectGuestName: true }), session: session({ hasProfile: true }) }),
    null,
    "an answered guest must never be asked again",
  );
});

check("isNewGuest is NOT consulted -- a returning guest at a newly-enabled venue is asked", () => {
  // The old rule gated on `isNewGuest`, so a venue enabling collection in
  // October could never ask the thousands of guests it already had.
  const src = readFileSync(join(SRC, "lib/portal-post-connect.ts"), "utf8");
  assert(!/\bisNewGuest\b\s*[:.]/.test(src), "the resolver must not read isNewGuest");
});

// --------------------------------------------------------- the review card
check("review card needs a review URL -- no URL, no card, no placeholder", () => {
  eq(
    ask({ config: config({ reviewCardEnabled: true, reviewUrl: null }) }),
    null,
    "the switch alone must render nothing -- there is no link to send anyone to",
  );
});

check("review card needs the venue's switch, not just a stored link", () => {
  eq(
    ask({ config: config({ reviewCardEnabled: false, reviewUrl: REVIEW_ON.reviewUrl }) }),
    null,
    "a paused venue keeps its link and must NOT keep being asked about",
  );
});

check("review card shows for a guest with nothing left to be asked", () => {
  eq(ask({ config: config(REVIEW_ON) }), "review", "should offer the review");
});

check("a guest who has tapped the review link is never asked again", () => {
  eq(
    ask({
      config: config(REVIEW_ON),
      session: session({ hasOpenedReviewLink: true }),
    }),
    null,
    "a tap is final",
  );
});

check("profile wins the arrival slot over the review card", () => {
  eq(
    ask({ config: config({ collectGuestName: true, ...REVIEW_ON }) }),
    "profile",
    "profile is asked once ever, so it must not be crowded out",
  );
});

check("settling the arrival ask closes the slot -- it does not promote the runner-up", () => {
  eq(
    ask({
      config: config({ collectGuestName: true, ...REVIEW_ON }),
      arrivalAskSettled: true,
    }),
    null,
    'a guest who says "not now" must not immediately get a second ask',
  );
});

// ------------------------------------------------------------- URL safety
check("only https Google hosts reach an href", () => {
  const ok = [
    "https://g.page/r/CQ_abc/review",
    "https://search.google.com/local/writereview?placeid=x",
    "https://maps.app.goo.gl/abc",
    "https://www.google.co.in/maps/place/x",
  ];
  const bad = [
    "http://g.page/r/abc",
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "https://g.page.evil.com/r/abc",
    "https://example.com/review",
    "",
    null,
  ];
  for (const u of ok) assert(M.isSafeGoogleReviewUrl(u), `should accept ${u}`);
  for (const u of bad) assert(!M.isSafeGoogleReviewUrl(u), `should reject ${String(u)}`);
});

// ------------------------------------------------------------- dwell gate
const FEEDBACK = {
  config: config({ guestFeedbackEnabled: true }),
  starCampaignAvailable: true,
};

check("the star prompt does NOT fire on arrival", () => {
  eq(
    ask({ ...FEEDBACK, session: session({ startedAt: startedMinutesAgo(1.5) }) }),
    null,
    "asking about a visit ninety seconds old is the defect this gate removes",
  );
});

check("the star prompt does not fire at 24 minutes either", () => {
  eq(
    ask({ ...FEEDBACK, session: session({ startedAt: startedMinutesAgo(24) }) }),
    null,
    "too soon",
  );
});

check("the star prompt fires past the dwell threshold", () => {
  eq(
    ask({ ...FEEDBACK, session: session({ startedAt: startedMinutesAgo(26) }) }),
    "feedback",
    "25 minutes is a coffee",
  );
});

check("a venue with the feedback toggle off never gets the star card", () => {
  eq(
    ask({
      config: config({ guestFeedbackEnabled: false }),
      starCampaignAvailable: true,
      session: session({ startedAt: startedMinutesAgo(40) }),
    }),
    null,
    "the venue must have opted in",
  );
});

check("a clock skew can only delay the card, never bring it forward", () => {
  eq(M.dwellMinutes(new Date(NOW + 10 * MINUTE).toISOString(), NOW), 0, "future start reads as 0");
  eq(M.dwellMinutes("not a date", NOW), 0, "unparseable start reads as 0");
  eq(M.dwellMinutes(null, NOW), 0, "absent start reads as 0");
});

check("the dwell threshold has a floor -- a venue cannot set it back to arrival", () => {
  eq(M.clampFeedbackDwellMinutes(0), M.MIN_FEEDBACK_DWELL_MINUTES, "0 must clamp up");
  eq(M.clampFeedbackDwellMinutes(-99), M.MIN_FEEDBACK_DWELL_MINUTES, "negative must clamp up");
  eq(M.clampFeedbackDwellMinutes(null), M.DEFAULT_FEEDBACK_DWELL_MINUTES, "absent means default");
  eq(M.clampFeedbackDwellMinutes(90), 90, "a hotel may ask for longer");
});

// ================= THE INVARIANT THIS FILE MOSTLY EXISTS FOR ==============

check("the Google card and the star card never appear in the same visit", () => {
  const both = config({
    ...REVIEW_ON,
    guestFeedbackEnabled: true,
  });
  // Arrival: the Google card shows, and the page records that it did.
  eq(
    ask({ config: both, starCampaignAvailable: true }),
    "review",
    "the Google ask comes first, before any sentiment exists",
  );
  // Later in the SAME visit, past the dwell gate: still no star prompt.
  eq(
    ask({
      config: both,
      starCampaignAvailable: true,
      reviewCardShownThisSession: true,
      session: session({ startedAt: startedMinutesAgo(45) }),
    }),
    null,
    "a guest shown the review link must not then be asked for a rating",
  );
  // A different visit, where the Google card did not show: the star card is
  // free to appear.
  eq(
    ask({
      config: both,
      starCampaignAvailable: true,
      reviewCardShownThisSession: false,
      session: session({ startedAt: startedMinutesAgo(45), hasOpenedReviewLink: true }),
    }),
    "feedback",
    "the two are separated by visit, not banned outright",
  );
});

check("the review card is reachable only on an arrival view", () => {
  // The asymmetry that makes the exclusion true by construction rather than
  // by a second rule that could be edited away.
  eq(
    ask({
      config: config(REVIEW_ON),
      session: session({ startedAt: startedMinutesAgo(45) }),
    }),
    null,
    "a guest 45 minutes in must never be shown the review card",
  );
});

check("the profile ask is not swapped out from under a guest at the dwell mark", () => {
  eq(
    ask({
      config: config({ collectGuestName: true, guestFeedbackEnabled: true }),
      starCampaignAvailable: true,
      session: session({ startedAt: startedMinutesAgo(30) }),
    }),
    "profile",
    "asked once ever, so it outranks the star card too",
  );
  eq(
    ask({
      config: config({ collectGuestName: true, guestFeedbackEnabled: true }),
      starCampaignAvailable: true,
      arrivalAskSettled: true,
      session: session({ startedAt: startedMinutesAgo(30) }),
    }),
    "feedback",
    "once the profile ask is settled the star card takes the later slot",
  );
});

check("the review decision reads no rating, sentiment or response value", () => {
  // The code-review test, mechanised. A regulator or a customer's lawyer
  // reading `resolvePostConnectAsk` must find no variable to select on --
  // that is what makes selective solicitation impossible rather than merely
  // absent. If someone later threads a rating into this module, this fails.
  const src = readFileSync(join(SRC, "lib/portal-post-connect.ts"), "utf8");
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/isStarFeedbackCampaign[\s\S]*?\n}/, ""); // shape check, not a value
  for (const forbidden of ["rating", "sentiment", "stars", "score", "averageRating"]) {
    assert(
      !new RegExp(`\\b${forbidden}`, "i").test(code.replace(/rating_5/g, "")),
      `\`${forbidden}\` must not appear in the ask-resolution code`,
    );
  }
});

check("exactly one ask can ever be returned", () => {
  const everythingOn = config({
    collectGuestName: true,
    collectGuestEmail: true,
    ...REVIEW_ON,
    guestFeedbackEnabled: true,
  });
  for (const minutes of [0, 1, 10, 24.9, 25, 60]) {
    const out = ask({
      config: everythingOn,
      starCampaignAvailable: true,
      session: session({ startedAt: startedMinutesAgo(minutes) }),
    });
    assert(
      out === null || typeof out === "string",
      "the resolver returns one ask or none, never a list",
    );
  }
});

// ------------------------------------------------- campaign shape routing
check("only the one-question star-prompt shape leaves the takeover", () => {
  const q = (answerType) => ({ answerType });
  assert(
    M.isStarFeedbackCampaign({ campaignType: "survey", questions: [q("rating_5")] }),
    "a single rating question is the star prompt",
  );
  assert(
    M.isStarFeedbackCampaign({
      campaignType: "survey",
      questions: [q("rating_5"), q("free_text")],
    }),
    "a rating plus an optional comment is still the star prompt",
  );
  assert(
    !M.isStarFeedbackCampaign({
      campaignType: "survey",
      questions: [q("rating_5"), q("single_choice")],
    }),
    "a real multi-question survey keeps the takeover",
  );
  assert(
    !M.isStarFeedbackCampaign({ campaignType: "banner", questions: [] }),
    "a banner is arrival content and keeps the takeover",
  );
  assert(
    !M.isStarFeedbackCampaign({
      campaignType: "survey",
      questions: [q("rating_5"), q("rating_5")],
    }),
    "two ratings do not fit one star row",
  );
});

// ------------------------------------------------------ email validation
check("email validation is permissive but catches the real typo", () => {
  for (const good of ["priya@gmail.com", "a.b+c@sub.domain.co.in", "  x@y.z  "]) {
    assert(M.isValidGuestEmail(good), `should accept ${good}`);
  }
  for (const bad of ["priya@gmail", "priya.gmail.com", "", "   ", "a b@c.com", "@c.com"]) {
    assert(!M.isValidGuestEmail(bad), `should reject "${bad}"`);
  }
});

// ------------------------------------------------------------- ask budget
check("name and email count as one ask -- they share a card", () => {
  const n = (over) =>
    M.countPostConnectAsks({
      collectGuestName: false,
      collectGuestEmail: false,
      reviewCardEnabled: false,
      guestFeedbackEnabled: false,
      dishRatingsEnabled: false,
      ...over,
    });
  eq(n({}), 0, "nothing on");
  eq(n({ collectGuestName: true }), 1, "name alone");
  eq(n({ collectGuestName: true, collectGuestEmail: true }), 1, "name + email share one card");
  eq(
    n({ collectGuestName: true, collectGuestEmail: true, reviewCardEnabled: true }),
    2,
    "plus the review ask",
  );
  eq(
    n({
      collectGuestName: true,
      collectGuestEmail: true,
      reviewCardEnabled: true,
      guestFeedbackEnabled: true,
      dishRatingsEnabled: true,
    }),
    M.MAX_POST_CONNECT_ASKS,
    "the meter's full scale",
  );
});

// ------------------------------------------------------ the storage rules
check("no Web Storage anywhere on the post-connect path", () => {
  const files = [
    "lib/portal-post-connect.ts",
    "components/portal-runtime/GuestProfileNudge.tsx",
    "components/portal-runtime/GoogleReviewNudge.tsx",
    "components/portal-runtime/GuestFeedbackNudge.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(join(SRC, f), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert(!/localStorage|sessionStorage|indexedDB/.test(code), `${f} must not touch Web Storage`);
  }
});

check("no hardcoded English placeholders in a ten-language card", () => {
  const src = readFileSync(join(SRC, "components/portal-runtime/GuestProfileNudge.tsx"), "utf8");
  // Comments stripped first -- the component's own docstring names the two
  // deleted placeholders, and it should keep being allowed to.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert(!/Jane Doe|you@example\.com/.test(code), "placeholders must not be hardcoded");
  assert(!/placeholder="[A-Za-z]/.test(code), "no untranslated placeholder may ship on this card");
});

check("the profile card surfaces a failed save instead of swallowing it", () => {
  const src = readFileSync(join(SRC, "components/portal-runtime/GuestProfileNudge.tsx"), "utf8");
  assert(/AlertBanner/.test(src), "a failed save must be visible to the guest");
  assert(
    /friendlyGuestAuthError\(/.test(src),
    "errors must route through the shared guest-error mapper, not a hand-rolled string",
  );
});

check("the review CTA carries no adjective and no incentive", () => {
  // "Attempting to influence the rating or the contents of the review" is a
  // live clause; free WiFi is itself a "free good and/or service" under the
  // incentive clause.
  const i18n = readFileSync(join(SRC, "lib/portal-i18n.ts"), "utf8");
  const cta = i18n.match(/reviewCardCta: "([^"]*)"/)?.[1] ?? "";
  assert(cta.length > 0, "the review CTA must exist");
  for (const banned of ["great", "honest", "kind", "5-star", "five star", "positive", "best"]) {
    assert(!cta.toLowerCase().includes(banned), `the CTA must not say "${banned}"`);
  }
  const subtitle = i18n.match(/reviewCardSubtitle: "([^"]*)"/)?.[1] ?? "";
  for (const banned of ["free", "discount", "offer", "coffee", "faster", "wifi"]) {
    assert(!subtitle.toLowerCase().includes(banned), `the subtitle must not offer "${banned}"`);
  }
});

check("every new guest-facing key exists in all ten dictionaries", () => {
  const src = readFileSync(join(SRC, "lib/portal-i18n.ts"), "utf8");
  const keys = [
    "profileNudgeTitle",
    "profileNudgeTitleEmail",
    "profileNudgeSubtitle",
    "profileEmailPurpose",
    "profileSaveCta",
    "profileSaveEmailCta",
    "profileSkipCta",
    "profileRetryCta",
    "profileSlowSaving",
    "profileSaveFailed",
    "profileEmailInvalid",
    "profileSavedTemplate",
    "profileSaved",
    "dismissCardLabel",
    "reviewCardTitle",
    "reviewCardSubtitle",
    "reviewCardCta",
    "feedbackCardTitle",
    "feedbackCardSubtitle",
    "feedbackThanksTemplate",
    "feedbackFreeTextLabel",
    "feedbackSendCta",
    "feedbackStarLabelTemplate",
  ];
  for (const k of keys) {
    // Prettier wraps a long entry onto the next line, so the value may not
    // sit on the same line as its key.
    const n = (src.match(new RegExp(`\\b${k}:\\s+"`, "g")) || []).length;
    eq(n, 10, `${k} must be translated in all ten dictionaries`);
  }
});

// -------------------------------------------------------------------------
console.log("portal post-connect asks");
for (const [status, name] of results) console.log(`  ${status} ${name}`);
console.log("");
if (failures) {
  console.log(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("all checks passed");
