/**
 * Regression test for the UserReports report types that were previously
 * marked unavailable. Honesty-over-coverage is the whole point here, so the
 * test pins BOTH directions:
 *
 *   BUILT (data genuinely exists, surfaced additively):
 *     - campaign-performance / top-campaigns — real engagement counters from
 *       GET /campaigns/{id}/results (impressions/responses/skipped/clicked).
 *       The old fabricated Sent/Delivered/Opened funnel columns (campaigns
 *       have no delivery channel) and the fabricated "Reach" must be GONE.
 *     - otp-delivery — real per-request rows from GET /otp/requests. The old
 *       "Delivered/Failed" status and "Latency (ms)" columns (this platform
 *       persists no gateway delivery status and no latency) must be GONE.
 *     - sms-daywise — actual SMS OTP request volume by location/day from
 *       GET /otp/requests/sms-daily-consumption. It must not claim carrier
 *       delivery stages.
 *
 *   DELIBERATELY LEFT UNAVAILABLE (would need fabricated fields):
 *     - team-report      — guest teams carry only a live snapshot, no
 *                          per-period aggregate; no session links to a member.
 *     - campaign-daywise — results are lifetime totals, no daily buckets.
 *
 * Source-level assertions (UserReports.tsx is a 2.5k-line component, not
 * bundle-friendly), same wiring-check style as test-campaign-results.mjs.
 *
 * Run: node scripts/test-user-reports-real-types.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const src = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

/** Slice a labelled block out of the source so an assertion is scoped to it
 * rather than matching an unrelated mention of the same word elsewhere. */
function block(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) return "";
  const end = src.indexOf(endMarker, start + startMarker.length);
  return src.slice(start, end === -1 ? undefined : end);
}

const realSet = block("const REAL_REPORT_TYPES = new Set([", "]);");
const unavailable = block("const UNAVAILABLE_REASON: Record<string, string> = {", "\n};");
const campaignPerfCols = block('"campaign-performance": [', "],");
const topCampaignCols = block('"top-campaigns": [', "],");
const otpCols = block('"otp-delivery": [', "],");
const needsRange = block("const NEEDS_RANGE = new Set([", "]);");

console.log("\nthe four buildable types are wired as REAL, not unavailable");
for (const t of ["campaign-performance", "top-campaigns", "otp-delivery", "sms-daywise"]) {
  check(`${t} is in REAL_REPORT_TYPES`, realSet.includes(`"${t}"`));
  check(`${t} is NOT in UNAVAILABLE_REASON`, !unavailable.includes(`"${t}"`));
}

console.log("\ndispatch runs a real helper for each");
check("realCampaignPerformance is defined", /async function realCampaignPerformance\(/.test(src));
check("realTopCampaigns is defined", /async function realTopCampaigns\(/.test(src));
check("realOtpRequests is defined", /async function realOtpRequests\(/.test(src));
check(
  "realDailySmsOtpConsumption is defined",
  /async function realDailySmsOtpConsumption\(/.test(src),
);
check(
  "campaign-performance dispatches to realCampaignPerformance",
  /realCampaignPerformance\(/.test(src),
);
check("top-campaigns dispatches to realTopCampaigns", /realTopCampaigns\(/.test(src));
check("otp-delivery dispatches to realOtpRequests", /realOtpRequests\(/.test(src));
check(
  "sms-daywise dispatches to realDailySmsOtpConsumption",
  /realDailySmsOtpConsumption\(/.test(src),
);

console.log("\nthe real helpers call the real endpoints/services");
check(
  "campaign helper reads real engagement via listResults",
  /campaignService\.listResults\(/.test(src),
);
check("campaign helper lists campaigns via listAll", /campaignService\.listAll\(/.test(src));
check("otp helper reads GET /otp/requests", /["'`]\/otp\/requests["'`]/.test(src));
check(
  "daily SMS helper reads GET /otp/requests/sms-daily-consumption",
  /["'`]\/otp\/requests\/sms-daily-consumption["'`]/.test(src),
);

console.log("\nfabricated columns are GONE from the built reports");
check(
  "campaign-performance has no Sent/Delivered/Opened funnel columns",
  !/label:\s*"Sent"/.test(campaignPerfCols) &&
    !/label:\s*"Delivered"/.test(campaignPerfCols) &&
    !/label:\s*"Opened"/.test(campaignPerfCols),
  "campaigns are served in-session, not through a delivery channel",
);
check(
  "campaign-performance shows real Impressions/Responses/Clicked",
  /"impressions"/.test(campaignPerfCols) &&
    /"responses"/.test(campaignPerfCols) &&
    /"clicked"/.test(campaignPerfCols),
);
check("top-campaigns no longer ranks by fabricated Reach", !/"reach"/.test(topCampaignCols));
check("top-campaigns ranks by real impressions", /"impressions"/.test(topCampaignCols));
check(
  "otp-delivery has no fabricated Latency column",
  !/latencyMs/.test(otpCols),
  "this platform measures no OTP latency",
);
check(
  "otp-delivery has no fabricated Delivered/Failed status column",
  !/"status"/.test(otpCols),
  "no gateway delivery status is persisted",
);
check(
  "otp-delivery shows real channel + verified outcome",
  /"channel"/.test(otpCols) && /"verified"/.test(otpCols) && /"requestedAt"/.test(otpCols),
);
const smsDaywiseCols = block('"sms-daywise": [', "],");
check(
  "sms-daywise has no fabricated delivery stages",
  !/"sent"/.test(smsDaywiseCols) &&
    !/"delivered"/.test(smsDaywiseCols) &&
    !/"failed"/.test(smsDaywiseCols) &&
    !/"rate"/.test(smsDaywiseCols),
);
check(
  "sms-daywise shows real location request volume",
  /"location"/.test(smsDaywiseCols) && /"smsOtpRequests"/.test(smsDaywiseCols),
);

console.log("\ncampaign-performance is no longer falsely date-range scoped");
check(
  "campaign-performance removed from NEEDS_RANGE (results are lifetime totals)",
  !needsRange.includes('"campaign-performance"'),
);

console.log("\nthe honestly-unavailable types stay unavailable with a real reason");
for (const t of ["team-report", "campaign-daywise"]) {
  check(`${t} is still in UNAVAILABLE_REASON`, unavailable.includes(`"${t}"`));
  check(`${t} is NOT wired as real`, !realSet.includes(`"${t}"`));
}

console.log(
  failures === 0
    ? `\nall user-reports real-type checks passed\n`
    : `\n${failures} user-reports real-type check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
