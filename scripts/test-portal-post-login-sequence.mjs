#!/usr/bin/env node
/**
 * Regression suite for the portal QA fixes of 2026-10-06.
 *
 * Run: `npm run test:post-login-sequence`
 *
 *  1. The ordered post-login SEQUENCE (owner: "after survey get
 *     discount/image, after that redirect"): which steps run, in what
 *     order, where the guest ends up -- and that a venue that never saved a
 *     sequence gets exactly its old single choice.
 *  2. The gate handoff: a redirect finish is the NAS/controller direct
 *     target only when no step must run first.
 *  3. The queue expansion: survey and offer campaigns both run (the staging
 *     bug: `/next` returned only one, so the survey never showed), the
 *     one-question star prompt is left for the dwell-gated card.
 *  4. Required details at sign-in (name AND email) and the post-connect card
 *     never re-asking a detail the backend already holds.
 *  5. Source wiring the behaviour depends on (session page runs the
 *     runner; success page uses the sequence-aware gate destination; one
 *     Save button in the editor).
 *
 * Bundles the REAL modules with esbuild, same approach as
 * test-portal-post-login.mjs.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-post-login-sequence-"));

async function load(entry, name) {
  await build({
    entryPoints: [join(SRC, entry)],
    bundle: true,
    format: "esm",
    platform: "neutral",
    outfile: join(work, `${name}.mjs`),
    logLevel: "silent",
    alias: { "@": SRC },
    jsx: "automatic",
    mainFields: ["module", "main"],
  });
  return import(join(work, `${name}.mjs`));
}

const seq = await load("lib/portal-post-login-sequence.ts", "seq");
const items = await load("lib/portal-post-login-sequence-items.ts", "items");
const pc = await load("lib/portal-post-connect.ts", "pc");
const gn = await load("lib/portal-guest-name.ts", "gn");

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) console.log(`  ok    ${name}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("1. sequence resolution");
{
  const r = seq.resolvePostLoginSequence({ postLoginHtml: null, redirectUrl: null });
  check(
    "never-configured, nothing set -> survey, offer, then the connected page",
    same(r.steps, ["survey", "offer"]) && r.finish === "connected" && !r.configured,
  );
  const page = seq.resolvePostLoginSequence({ postLoginHtml: "<p>Hi</p>", redirectUrl: null });
  check(
    "never-configured page venue -> the page is the resting page (old html mode)",
    same(page.steps, ["page"]) && page.pageIsResting && page.finish === "connected",
  );
  const redir = seq.resolvePostLoginSequence({
    postLoginHtml: null,
    redirectUrl: "https://venue.example/welcome",
  });
  check(
    "never-configured redirect venue -> no steps, straight to the URL",
    redir.steps.length === 0 &&
      redir.finish === "redirect" &&
      redir.url === "https://venue.example/welcome",
  );
  const legacyGuestUrl = seq.resolvePostLoginSequence(
    { postLoginHtml: null, redirectUrl: null },
    "https://guest-was-going.example",
  );
  check(
    "never-configured: a real pre-hotspot URL still wins (old behaviour kept)",
    legacyGuestUrl.finish === "redirect" && legacyGuestUrl.steps.length === 0,
  );
  const owner = seq.resolvePostLoginSequence({
    postLoginHtml: "<p>Deal</p>",
    redirectUrl: "https://venue.example",
    postLoginSequence: { steps: ["survey", "offer", "page"], finish: "redirect" },
  });
  check(
    "owner's example: survey -> offer -> page -> website, in that order",
    same(owner.steps, ["survey", "offer", "page"]) &&
      owner.finish === "redirect" &&
      owner.url === "https://venue.example" &&
      !owner.pageIsResting &&
      owner.configured,
  );
  const configuredConnected = seq.resolvePostLoginSequence(
    {
      postLoginHtml: null,
      redirectUrl: null,
      postLoginSequence: { steps: ["offer"], finish: "connected" },
    },
    "https://guest-was-going.example",
  );
  check(
    "configured 'connected' finish is honoured even with a pre-hotspot URL",
    configuredConnected.finish === "connected" && same(configuredConnected.steps, ["offer"]),
  );
  const noUrl = seq.resolvePostLoginSequence({
    postLoginHtml: null,
    redirectUrl: "javascript:alert(1)",
    postLoginSequence: { steps: [], finish: "redirect" },
  });
  check("an unsafe redirect URL falls back to the connected page", noUrl.finish === "connected");
  const pageNoHtml = seq.resolvePostLoginSequence({
    postLoginHtml: "   ",
    redirectUrl: null,
    postLoginSequence: { steps: ["page", "offer"], finish: "connected" },
  });
  check("a page step with no page is dropped", same(pageNoHtml.steps, ["offer"]));
  check(
    "toPostLoginSequence drops unknown and duplicate steps",
    same(seq.toPostLoginSequence({ steps: ["offer", "x", "offer", "survey"], finish: "nope" }), {
      steps: ["offer", "survey"],
      finish: "connected",
    }),
  );
  check("toPostLoginSequence(null) -> null (derive)", seq.toPostLoginSequence(null) === null);
}

console.log("2. gate handoff");
{
  const straight = seq.gateDestinationForSequence({
    postLoginHtml: null,
    redirectUrl: "https://venue.example",
    postLoginSequence: { steps: [], finish: "redirect" },
  });
  check(
    "redirect with no steps -> the gate goes straight to the URL",
    straight.mode === "redirect" && straight.url === "https://venue.example",
  );
  const withSteps = seq.gateDestinationForSequence({
    postLoginHtml: null,
    redirectUrl: "https://venue.example",
    postLoginSequence: { steps: ["survey"], finish: "redirect" },
  });
  check(
    "redirect AFTER steps -> the gate lands on the session page first",
    withSteps.mode === "default" && withSteps.url === undefined,
  );
  const resting = seq.gateDestinationForSequence({ postLoginHtml: "<p>x</p>", redirectUrl: null });
  check("a resting page reads as html mode", resting.mode === "html");
}

console.log("3. queue expansion (the survey that never showed)");
{
  const survey = {
    campaignId: "s1",
    campaignType: "survey",
    isSkippable: true,
    questions: [{ answerType: "single_choice" }],
    asset: null,
  };
  const star = {
    campaignId: "s2",
    campaignType: "survey",
    isSkippable: true,
    questions: [{ answerType: "rating_5" }],
    asset: null,
  };
  const empty = { ...survey, campaignId: "s3", questions: [] };
  const offer = {
    campaignId: "o1",
    campaignType: "banner",
    isSkippable: true,
    questions: [],
    asset: { imageUrl: "https://x/y.png", clickUrl: null, headline: null, couponCode: null },
  };
  // Backend order puts the offer first (it won the old tie-break).
  const queue = [offer, star, survey, empty];
  const out = items.expandSequenceItems(["survey", "offer"], queue, null);
  check(
    "survey step then offer step -- BOTH show, in the venue's order",
    same(
      out.map((i) => i.campaign?.campaignId),
      ["s1", "o1"],
    ),
  );
  check(
    "the one-question star prompt is left for the dwell-gated card",
    !out.some((i) => i.campaign?.campaignId === "s2"),
  );
  check("a survey with no questions is skipped", !out.some((i) => i.campaign?.campaignId === "s3"));
  const reversed = items.expandSequenceItems(["offer", "page", "survey"], queue, "<p>p</p>");
  check(
    "reordering the steps reorders the screens; the page sits where it was put",
    same(
      reversed.map((i) => i.kind + ":" + (i.campaign?.campaignId ?? "")),
      ["campaign:o1", "page:", "campaign:s1"],
    ),
  );
  check(
    "a step with nothing eligible yields nothing",
    items.expandSequenceItems(["survey"], [offer], null).length === 0,
  );
}

console.log("4. required details + never asking twice");
{
  check(
    "details step shows for a missing email alone",
    gn.needsDetailsStep({ emailRequired: true }) && !gn.needsDetailsStep({}),
  );
  check(
    "email shape check is permissive but catches 'priya@gmail'",
    gn.isPlausibleGuestEmail("a@b.co") && !gn.isPlausibleGuestEmail("priya@gmail"),
  );
  check(
    "email error codes map to the email message",
    gn.guestDetailsErrorKey({ data: { code: "guest_email_invalid" } }) === "errEmailRequired" &&
      gn.isGuestEmailRequiredError({ data: { code: "guest_email_required" } }),
  );
  const config = {
    collectGuestName: true,
    collectGuestEmail: true,
    requireGuestName: false,
    requireGuestEmail: false,
    reviewUrl: null,
    reviewCardEnabled: false,
    guestFeedbackEnabled: false,
    feedbackDwellMinutes: 25,
  };
  const base = { startedAt: new Date().toISOString(), hasOpenedReviewLink: false };
  check(
    "email-OTP guest: the email is never asked after connecting",
    !pc.postConnectAsksEmail(config, {
      ...base,
      hasProfile: true,
      authMethod: "otp_email",
      hasEmail: true,
      hasName: false,
    }),
  );
  check(
    "...but their NAME still is (per-field, not all-or-nothing)",
    pc.profileFieldsEligible(config, {
      ...base,
      hasProfile: true,
      authMethod: "otp_email",
      hasEmail: true,
      hasName: false,
    }),
  );
  check(
    "a name on file is never asked again",
    !pc.postConnectAsksName(config, { ...base, hasProfile: true, hasName: true }),
  );
  check(
    "a guest who declined is not asked again",
    !pc.profileFieldsEligible(config, {
      ...base,
      hasProfile: true,
      hasName: false,
      hasEmail: false,
      profileDeclined: true,
    }),
  );
  check(
    "email required at sign-in is not re-asked on the card for an OTP guest",
    !pc.postConnectAsksEmail(
      { ...config, requireGuestEmail: true },
      { ...base, hasProfile: false, authMethod: "otp_sms" },
    ),
  );
  check(
    "older backend (no per-field bits): falls back to hasProfile",
    !pc.profileFieldsEligible(config, { ...base, hasProfile: true }) &&
      pc.profileFieldsEligible(config, { ...base, hasProfile: false }),
  );
}

console.log("5. wiring");
{
  const session = readFileSync(join(SRC, "routes/portal.session.tsx"), "utf8");
  const success = readFileSync(join(SRC, "routes/portal.success.tsx"), "utf8");
  const editor = readFileSync(join(SRC, "components/features/PortalPage.tsx"), "utf8");
  const runner = readFileSync(
    join(SRC, "components/portal-runtime/PostLoginSequenceRunner.tsx"),
    "utf8",
  );
  check(
    "session page runs the sequence runner before the finish",
    /<PostLoginSequenceRunner/.test(session) && /preFinishSteps/.test(session),
  );
  check(
    "session page waits for the steps before redirecting",
    /preFinishSteps\.length > 0 && !sequenceDone/.test(session),
  );
  check(
    "session page loads the whole campaign queue, not just /next",
    /getCampaignQueue/.test(session) && !/getNextCampaign\(/.test(session),
  );
  check("success page aims the gate with the sequence", /gateDestinationForSequence/.test(success));
  check(
    "success page shows the details step for a missing email too",
    /needsDetailsStep\(session\)/.test(success) && /askEmail=/.test(success),
  );
  check(
    "the runner is route-agnostic (props only, no router hooks)",
    !/useNavigate|useSearch|createFileRoute/.test(runner),
  );
  const saveButtons = editor.match(/onClick=\{saveConfig\}/g) ?? [];
  check(
    "the editor has exactly ONE save button",
    saveButtons.length === 1,
    `found ${saveButtons.length}`,
  );
  check(
    "per-field Required switches for name and email",
    /id="require-guest-name"/.test(editor) && /id="require-guest-email"/.test(editor),
  );
  check(
    "the editor says the star survey waits for the dwell",
    /will not appear right after sign-in/.test(editor),
  );
  check(
    "the editor states the iOS pop-up caveat next to the steps",
    /iOS closes the pop-up on its own/.test(editor),
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
