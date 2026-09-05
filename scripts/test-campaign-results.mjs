/**
 * Regression test for campaign results -- the read half of a feature whose
 * write half has shipped for months.
 *
 * FAILURE MODE THIS LOCKS DOWN: the star rating was a half-feature in
 * production. An owner could author a `rating_5` question, the guest
 * portal really rendered five stars, guests really submitted answers
 * (`campaign-portal.service.ts`'s `submitResponse`), impressions were
 * really recorded -- and **nothing in the dashboard ever read any of it
 * back**. `GET /campaigns/{id}/results` existed with no frontend caller,
 * so the admin table hardcoded `impressions: 0, conversions: 0` for every
 * real campaign while the demo fixtures showed 2841/423. A venue asked
 * "How was your visit?" and could never see a single reply.
 *
 * The load-bearing assertions, worst-regression-first:
 *
 *   1. STAR BUCKETS SURVIVE THE JSON BOUNDARY. The backend types
 *      `rating_distribution` as `dict[int, int]`, but JSON object keys are
 *      always strings, so it arrives as {"1".."5"}. A consumer doing
 *      `dist[5]` against string keys silently reads `undefined` and every
 *      star bar renders zero -- which looks exactly like "nobody rated us"
 *      rather than like a bug. The mapping normalises to real numbers and
 *      this pins it.
 *   2. ONE BAD CAMPAIGN MUST NOT BLANK THE TABLE. `listResults` fans out
 *      per campaign; a 403/404 on one must leave the others intact and
 *      simply omit the failed one, so the caller can render "--" for it
 *      rather than a confident 0.
 *   3. ABSENT IS NOT ZERO. A campaign whose counters could not be fetched
 *      must be distinguishable from one genuinely seen by nobody.
 *   4. NULLABLE BREAKDOWN FIELDS ARE RESPECTED. Every per-question field
 *      is nullable server-side; the mapping must not invent {} or [].
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * real service module is bundled with esbuild against a stubbed `api`, so
 * the actual mapping code runs; the wiring is checked against the real
 * component source.
 *
 * Run: node scripts/test-campaign-results.mjs
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

// ---------------------------------------------------------------------------
// Bundle the real service against a stubbed API client.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "campaign-results-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

// The fixture the stub serves, and the log of what was asked for.
// State hangs off globalThis rather than being re-exported: esbuild can
// end up with two instances of a stub module reached by two different
// import paths (the entry's, and the one onResolve rewrites), and then the
// fixtures the test sets are invisible to the code under test. A global is
// immune to that and this is a throwaway harness, not shipped code.
const stubModule = `
globalThis.__stub ??= { calls: [], responses: new Map(), fail: new Set() };
export const api = {
  get: async (url) => {
    globalThis.__stub.calls.push(url);
    const id = url.split("/").filter(Boolean)[1];
    if (globalThis.__stub.fail.has(id)) throw new Error("boom");
    return { data: globalThis.__stub.responses.get(id) };
  },
};
export function toAppError(e) { return { message: String(e), status: null, data: null }; }
`;
writeFileSync(join(outdir, "api-stub.mjs"), stubModule);

const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export { campaignService } from "${p("src/services/campaign.service.ts")}";`);

const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /services\/api$/ }, () => ({
          path: join(outdir, "api-stub.mjs"),
        }));
        b.onResolve({ filter: /organization-id$/ }, () => ({ path: "orgid", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: `export async function resolveOrganizationId() { return "org-1"; }`,
          loader: "js",
        }));
      },
    },
  ],
});

const { campaignService } = await import(`file://${outfile}`);
const __state = globalThis.__stub;
const __calls = __state.calls;

/** A results payload exactly as FastAPI serialises it -- note the star
 * buckets arrive as STRING keys even though the backend types them int. */
const payload = (id, over = {}) => ({
  campaign_id: id,
  total_responses: 12,
  total_impressions: 40,
  total_skipped: 3,
  total_clicked: 5,
  question_breakdowns: [
    {
      question_id: "q1",
      question_text: "How was your visit?",
      answer_type: "rating_5",
      total_answers: 12,
      option_counts: null,
      average_rating: 4.25,
      rating_distribution: { 1: 1, 2: 0, 3: 1, 4: 3, 5: 7 },
      free_text_answers: null,
    },
    {
      question_id: "q2",
      question_text: "What did you order?",
      answer_type: "single_choice",
      total_answers: 9,
      option_counts: { Coffee: 6, Tea: 3 },
      average_rating: null,
      rating_distribution: null,
      free_text_answers: null,
    },
  ],
  ...over,
});

// ---------------------------------------------------------------------------
// 1. Star buckets survive the JSON boundary.
// ---------------------------------------------------------------------------

console.log("\nstar buckets survive the JSON string-key boundary");

__state.responses.set("c1", payload("c1"));
const r1 = await campaignService.getResults("c1");
const stars = r1.questionBreakdowns[0].ratingDistribution;

eq("5-star bucket is readable by number", stars[5], 7);
eq("4-star bucket is readable by number", stars[4], 3);
eq("1-star bucket is readable by number", stars[1], 1);
check(
  "a zero bucket stays zero rather than vanishing",
  stars[2] === 0,
  `got ${JSON.stringify(stars[2])}`,
);
check(
  "every key is a real number, not a string",
  Object.keys(stars).every((k) => Number.isInteger(Number(k))) &&
    [5, 4, 3, 2, 1].every((n) => typeof stars[n] === "number"),
);
eq("the average survives intact", r1.questionBreakdowns[0].averageRating, 4.25);

console.log("\nthe rest of the payload maps across");
eq("impressions", r1.totalImpressions, 40);
eq("responses", r1.totalResponses, 12);
eq("skipped", r1.totalSkipped, 3);
eq("clicked", r1.totalClicked, 5);
eq("both questions are present", r1.questionBreakdowns.length, 2);
eq("choice counts map", r1.questionBreakdowns[1].optionCounts.Coffee, 6);

// ---------------------------------------------------------------------------
// 2/4. Nullable fields stay null; nothing is invented.
// ---------------------------------------------------------------------------

console.log("\nnullable breakdown fields are respected, not invented");

check("a rating question has no optionCounts", r1.questionBreakdowns[0].optionCounts === null);
check(
  "a choice question has no ratingDistribution",
  r1.questionBreakdowns[1].ratingDistribution === null,
);
check("a choice question has no averageRating", r1.questionBreakdowns[1].averageRating === null);
check(
  "neither question invents free-text answers",
  r1.questionBreakdowns.every((q) => q.freeTextAnswers === null),
);

__state.responses.set("c-empty", payload("c-empty", { question_breakdowns: undefined }));
const rEmpty = await campaignService.getResults("c-empty");
check(
  "a payload with no breakdowns yields an empty list, not undefined",
  Array.isArray(rEmpty.questionBreakdowns) && rEmpty.questionBreakdowns.length === 0,
);

// ---------------------------------------------------------------------------
// 3. One failing campaign must not blank the others.
// ---------------------------------------------------------------------------

console.log("\none failing campaign does not blank the rest");

__state.responses.set("c2", payload("c2", { total_impressions: 99 }));
__state.fail.add("c3");
__calls.length = 0;

const many = await campaignService.listResults(["c1", "c2", "c3"]);
eq("all three were asked for", __calls.length, 3);
check("the two that answered are present", !!many.c1 && !!many.c2);
eq("the healthy neighbour keeps its real number", many.c2.totalImpressions, 99);
check(
  "the failed one is ABSENT, not zero",
  !("c3" in many),
  "a zero here would read as 'nobody saw it' rather than 'we could not ask'",
);

// ---------------------------------------------------------------------------
// 5. Wiring.
// ---------------------------------------------------------------------------

console.log("\nthe real screen is wired to this");

const page = readFileSync(join(ROOT, "src/components/features/CampaignsPage.tsx"), "utf8");
const service = readFileSync(join(ROOT, "src/services/campaign.service.ts"), "utf8");

check(
  "service calls the real results endpoint",
  /\/campaigns\/\$\{campaignId\}\/results/.test(service),
);
check("listResults uses allSettled so one failure is contained", /allSettled/.test(service));
check("CampaignsPage loads results for the table", /campaignService\.listResults\(/.test(page));
check(
  "CampaignsPage opens a per-campaign answers view",
  /campaignService\.getResults\(/.test(page),
);
check(
  "impressions/conversions are no longer hardcoded zeros",
  !/impressions:\s*0,\s*\n\s*conversions:\s*0,\s*\n\s*\}\)\),/.test(page),
);
check(
  "an unfetched counter renders as -- rather than 0",
  /impressions === null/.test(page) && /conversions === null/.test(page),
);
// Strip comments first: this file now *documents* the old
// `setItems(DEMO_SEED)` fallback in prose, and matching that would make the
// assertion pass or fail on a comment rather than on code.
const pageCode = page
  .split("\n")
  .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*"))
  .join("\n");
check(
  "the campaigns table no longer falls back to DEMO_SEED on a failed fetch",
  !/setItems\(DEMO_SEED\)/.test(pageCode),
  "a real account would see six invented campaigns with invented engagement numbers",
);

console.log(
  failures === 0
    ? `\nall campaign results checks passed\n`
    : `\n${failures} campaign results check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
