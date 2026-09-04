#!/usr/bin/env node
/**
 * THE PLATFORM OVERVIEW MUST NOT FAN OUT PER ORGANIZATION FOR DATA IT
 * ALREADY HAS.
 *
 * A single load of the Master Console's /master route issued 81 `/api/v1/`
 * requests against 14 real organizations. The shape looked like duplication
 * -- 14 identical `GET /invoices?page_size=100`, 14 identical
 * `GET /payments?page_size=100`, 12 identical `GET /dashboard/organization`
 * -- but it was not: every one of those endpoints resolves its tenant from
 * the `X-Organization-Id` HEADER (backend list_payments / list_invoices /
 * get_organization_dashboard all take `Depends(RequireOrganization)`), so 14
 * identical URLs were 14 different reads and no cache key could have
 * collapsed them. A network panel showing only the URL column is what makes
 * this misread as duplication.
 *
 * The real waste was that the page asked for the data at all. It called
 * `useBillingSnapshot`, whose `5 + 4N` fan-out fetches every organization's
 * subscriptions, payments, invoices and usage, and then read exactly three
 * things out of the result: the trial count, the billing reminders, and the
 * Organizations table's Plan/MRR/Status columns. All three are derivable
 * from the single `/billing/dashboard/super-admin` response that
 * `useBillingOverview` was already fetching on the same page -- its
 * `customers` items carry organization_id, organization_name, plan_id,
 * plan_name and subscription_status, and `subscriptions.counts_by_status`
 * carries the trial count. `payments`, `invoices` and `usage` -- 3N of the
 * 4N requests -- were fetched purely to compute KPIs /master never renders.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 *   1. getOverview() costs a FIXED 3 requests, whatever N is, and never
 *      touches /payments, /invoices, /usage, /organizations or
 *      /subscriptions. This is the assertion that fails if someone folds a
 *      per-org lookup back into the cheap path.
 *   2. The Platform Overview has NO per-organization fan-out left at all.
 *      Its billing cost is 3 requests at any tenant count. The one thing
 *      that bought was the expiry reminders ("expires in 3 days"), which
 *      need each subscription's own current_period_end and have no bulk
 *      endpoint to come from -- backend/app/domains/billing/router.py
 *      exposes only `GET /subscriptions/{organization_id}` -- so they are
 *      one request per organization or nothing. This page chose nothing and
 *      says so on the card; /master/billing still lists them.
 *   3. getSnapshot() is UNCHANGED at 5 + 4N. /master/billing and /billing
 *      genuinely render per-org payments, invoices and usage, so the
 *      expensive path had to keep working -- this test is here to prove the
 *      refactor did not quietly narrow it.
 *   4. All seven backend PlanType values survive the round trip. planTier()
 *      recognized only four and mapped the rest to "custom", so real
 *      `free_trial`, `business` and `msp` plans were relabeled Custom
 *      everywhere -- including the Plan Tier chart, where three of seven
 *      tiers had no bar of their own.
 *   5. A 404 from /subscriptions/{org} is a legitimate "no subscription",
 *      not a failure: two seeded `deadbeef-` fixture organizations and one
 *      real organization return it in production today.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (same note as
 * scripts/test-device-health.mjs). The real service module is bundled with
 * esbuild against a counting fake of `@/services/api` and executed for real,
 * so the numbers below are the module's actual HTTP behaviour, not a
 * restatement of it.
 */

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}
function eq(name, actual, expected) {
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// ---------------------------------------------------------------------------
// Fixtures. 14 organizations, matching the production tenant count the 81
// was measured against -- including the two `deadbeef-` fixture orgs and one
// real org whose /subscriptions call 404s.
// ---------------------------------------------------------------------------

const ORG_COUNT = 14;
const NO_SUBSCRIPTION = new Set([
  "deadbeef-0001-4000-8000-000000000001",
  "deadbeef-0001-4000-8000-000000000002",
  "c0d49e84-b125-485f-82e4-a5738a6eac7a",
]);

const orgIds = [
  "deadbeef-0001-4000-8000-000000000001",
  "deadbeef-0001-4000-8000-000000000002",
  "c0d49e84-b125-485f-82e4-a5738a6eac7a",
  ...Array.from({ length: ORG_COUNT - 3 }, (_, i) => `org-${i + 1}`),
];

// One plan per backend PlanType, so the tier round trip is exercised for all
// seven rather than only the four the frontend used to know.
const PLAN_TYPES = [
  "free_trial",
  "starter",
  "professional",
  "business",
  "enterprise",
  "msp",
  "custom",
];
const plans = PLAN_TYPES.map((t, i) => ({
  id: `plan-${t}`,
  name: `${t} plan`,
  plan_type: t,
  base_price: (i + 1) * 1000,
  billing_cycle: "monthly",
  currency: "INR",
  is_active: true,
  is_public: true,
  features: [],
}));

const IN_9_DAYS = new Date(Date.now() + 9 * 86_400_000).toISOString();
const FAR_OFF = new Date(Date.now() + 300 * 86_400_000).toISOString();

const customers = orgIds.map((id, i) => ({
  organization_id: id,
  organization_name: `Org ${i + 1}`,
  plan_id: plans[i % plans.length].id,
  plan_name: plans[i % plans.length].name,
  plan_slug: plans[i % plans.length].plan_type,
  // Two orgs are trialing; one carries unpaid invoices.
  subscription_status: i < 2 ? "trialing" : "active",
  lifetime_revenue: 5000,
  outstanding_invoice_count: i === 4 ? 3 : 0,
}));

const dashboard = {
  revenue: {
    total_revenue: 0,
    total_refunded: 0,
    mrr: 42000,
    arr: 504000,
    active_paying_subscription_count: 12,
    // Empty on purpose: revenue_by_month returns one row per month that has
    // at least one captured payment and does NOT zero-fill, and this
    // platform has zero payment rows. The Revenue Trend chart's empty state
    // is the honest rendering of exactly this.
    trend: [],
  },
  subscriptions: {
    counts_by_status: { trialing: 2, active: 11, cancelled: 1 },
    counts_by_plan_type: {},
    churn: { active_at_period_start: 0, cancelled_this_period: 0, churn_rate: null },
  },
  customers: {
    items: customers,
    page: 1,
    page_size: 100,
    total_items: ORG_COUNT,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  },
  failed_payments: {
    items: [
      {
        payment: {
          id: "pay-1",
          organization_id: orgIds[6],
          amount: 999,
          status: "failed",
          provider: "razorpay",
          provider_payment_id: "rzp_1",
          idempotency_key: "k1",
          failure_reason: "Card declined",
          updated_at: "2026-09-01T00:00:00.000Z",
          refunded_amount: 0,
        },
        retry_eligible: true,
      },
    ],
    total_items: 1,
  },
};

function subscriptionFor(orgId) {
  const i = orgIds.indexOf(orgId);
  return {
    id: `sub-${i}`,
    organization_id: orgId,
    license_id: `lic-${i}`,
    plan_id: plans[i % plans.length].id,
    status: i < 2 ? "trialing" : "active",
    billing_cycle: "monthly",
    current_period_start: "2026-08-01T00:00:00.000Z",
    // One active org expires inside the 14-day reminder window.
    current_period_end: i === 5 ? IN_9_DAYS : FAR_OFF,
    trial_end: null,
    auto_renew: true,
    cancel_at_period_end: false,
    started_at: "2026-01-01T00:00:00.000Z",
    cancelled_at: null,
    applied_coupon_id: null,
  };
}

const emptyList = {
  items: [],
  page: 1,
  page_size: 100,
  total_items: 0,
  total_pages: 0,
  has_next: false,
  has_previous: false,
};

// ---------------------------------------------------------------------------
// A counting fake of the axios instance. Records every request the real
// service module makes, with the header that scopes it.
// ---------------------------------------------------------------------------

const calls = [];
function reset() {
  calls.length = 0;
}
function routeOf(url) {
  return url.startsWith("/subscriptions/")
    ? "/subscriptions/{org}"
    : url.startsWith("/usage/")
      ? "/usage/{org}"
      : url;
}
function counts() {
  return calls.reduce((acc, c) => {
    const k = routeOf(c.url);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

const apiStub = `
export const api = {
  get: async (url, config = {}) => {
    globalThis.__calls.push({ url, params: config.params, headers: config.headers });
    if (url === "/billing/dashboard/super-admin") return { data: globalThis.__fx.dashboard };
    if (url === "/plans") {
      return { data: { ...globalThis.__fx.emptyList, items: config.params.is_active ? globalThis.__fx.plans : [] } };
    }
    if (url === "/organizations") {
      return { data: { ...globalThis.__fx.emptyList, items: globalThis.__fx.orgIds.map((id, i) => ({ id, name: "Org " + (i + 1) })) } };
    }
    if (url === "/coupons") return { data: globalThis.__fx.emptyList };
    if (url === "/payments" || url === "/invoices") return { data: globalThis.__fx.emptyList };
    if (url.startsWith("/usage/")) return { data: { metrics: [], limit_checks: [] } };
    if (url.startsWith("/subscriptions/")) {
      const orgId = url.slice("/subscriptions/".length);
      if (globalThis.__fx.noSubscription.includes(orgId)) {
        const err = new Error("Request failed with status code 404");
        err.response = { status: 404 };
        throw err;
      }
      return { data: globalThis.__fx.subscriptionFor(orgId) };
    }
    throw new Error("unexpected request: " + url);
  },
};
`;

const customerStub = `export const isDemo = () => false;\n`;

const dir = mkdtempSync(join(tmpdir(), "platform-overview-"));
writeFileSync(join(dir, "api-stub.js"), apiStub);
writeFileSync(join(dir, "customer-stub.js"), customerStub);
writeFileSync(
  join(dir, "entry.mjs"),
  `export { billingService } from "${p("src/services/billing.service.ts")}";`,
);

const outfile = join(dir, "bundle.mjs");
await build({
  entryPoints: [join(dir, "entry.mjs")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  tsconfig: join(ROOT, "tsconfig.json"),
  alias: {
    "@/services/api": join(dir, "api-stub.js"),
    "@/services/customer.service": join(dir, "customer-stub.js"),
  },
});

globalThis.__calls = calls;
globalThis.__fx = {
  dashboard,
  plans,
  orgIds,
  emptyList,
  subscriptionFor,
  noSubscription: [...NO_SUBSCRIPTION],
};

const { billingService } = await import(outfile);

// ---------------------------------------------------------------------------
// 1. The cheap path: fixed 3 requests, no per-org anything.
// ---------------------------------------------------------------------------
console.log("\ngetOverview -- the whole page except the reminders card");
reset();
const overview = await billingService.getOverview();
const overviewCalls = calls.length;
const overviewCounts = counts();

eq("total requests is 3, independent of the 14 organizations", overviewCalls, 3);
eq("one /billing/dashboard/super-admin", overviewCounts["/billing/dashboard/super-admin"], 1);
eq("two /plans (the active and inactive slices)", overviewCounts["/plans"], 2);
for (const forbidden of [
  "/payments",
  "/invoices",
  "/organizations",
  "/coupons",
  "/subscriptions/{org}",
  "/usage/{org}",
]) {
  eq(`never requests ${forbidden}`, overviewCounts[forbidden] ?? 0, 0);
}

console.log("\ngetOverview -- and it still answers everything the page asks");
eq("trial count read from counts_by_status.trialing", overview.trialOrganizations, 2);
eq(
  "one row per organization for the Organizations table",
  overview.organizations.length,
  ORG_COUNT,
);
const row = overview.organizations.find((o) => o.organizationId === orgIds[3]);
eq("row carries the plan name", row.planName, plans[3 % plans.length].name);
eq("row carries the subscription status", row.status, "active");
eq(
  "row carries the plan's recurring price, not lifetime_revenue",
  row.amount,
  plans[3 % plans.length].base_price,
);
eq(
  "reminders: the failed payment",
  overview.reminders.filter((r) => r.type === "payment_failed").length,
  1,
);
eq(
  "failed payment resolves its organization name",
  overview.reminders.find((r) => r.type === "payment_failed").organizationName,
  "Org 7",
);
eq(
  "reminders: the outstanding invoices",
  overview.reminders.filter((r) => r.type === "invoice_due").length,
  1,
);
eq(
  "reminders: no expiry rows on the cheap path",
  overview.reminders.filter((r) => r.type === "expiry").length,
  0,
);

// ---------------------------------------------------------------------------
// 2. There is no second billing query on this page any more.
// ---------------------------------------------------------------------------
console.log("\nthe page's billing cost is fixed, not per-tenant");
check(
  "the service exposes no per-org expiry fetch for the overview to call",
  typeof billingService.getExpiringReminders === "undefined",
  "getExpiringReminders still exists -- if it came back, the overview must still not call it",
);

// ---------------------------------------------------------------------------
// 3. The expensive path is untouched -- /master/billing still needs it.
// ---------------------------------------------------------------------------
console.log("\ngetSnapshot -- unchanged, because /master/billing renders its rows");
reset();
const snapshot = await billingService.getSnapshot();
const snapshotCalls = calls.length;
const snapshotCounts = counts();

eq("still 5 + 4N requests", snapshotCalls, 5 + 4 * ORG_COUNT);
eq("still fans out /payments per organization", snapshotCounts["/payments"], ORG_COUNT);
eq("still fans out /invoices per organization", snapshotCounts["/invoices"], ORG_COUNT);
eq("still fans out /usage per organization", snapshotCounts["/usage/{org}"], ORG_COUNT);
eq(
  "still fans out /subscriptions per organization",
  snapshotCounts["/subscriptions/{org}"],
  ORG_COUNT,
);
eq(
  "still produces expiry reminders",
  snapshot.reminders.filter((r) => r.type === "expiry").length,
  1,
);
eq(
  "still produces the failed-payment reminder",
  snapshot.reminders.filter((r) => r.type === "payment_failed").length,
  1,
);

// ---------------------------------------------------------------------------
// 4. All seven backend PlanType values survive.
// ---------------------------------------------------------------------------
console.log("\nplan tiers -- all seven backend PlanType values, not four");
eq("planDistribution has one entry per backend PlanType", overview.planDistribution.length, 7);
check(
  "in the documented order",
  overview.planDistribution.map((d) => d.tier).join(",") ===
    "free_trial,starter,professional,business,enterprise,msp,custom",
  overview.planDistribution.map((d) => d.tier).join(","),
);
for (const t of ["free_trial", "business", "msp"]) {
  const bucket = overview.planDistribution.find((d) => d.tier === t);
  check(
    `${t} keeps its own tier instead of collapsing into custom`,
    bucket.count > 0,
    `count=${bucket.count}`,
  );
}
eq(
  "custom counts only genuinely-custom plans",
  overview.planDistribution.find((d) => d.tier === "custom").count,
  customers.filter((c) => c.plan_slug === "custom").length,
);
check(
  "the Revenue Trend series is empty, so the chart must say so rather than draw a frame",
  overview.trend.length === 0,
);

// ---------------------------------------------------------------------------
// The number this whole change is about.
// ---------------------------------------------------------------------------
const before = overviewCalls + snapshotCalls;
const after = overviewCalls;
console.log(`\n  billing requests for one /master load at N=${ORG_COUNT}`);
console.log(`    before  ${before}  (getOverview ${overviewCalls} + getSnapshot ${snapshotCalls})`);
console.log(`    after   ${after}  (getOverview ${overviewCalls}, and nothing else)`);
console.log(`    saved   ${before - after}`);
eq("the billing half of one /master load is exactly 3 requests", after, 3);
check("which is 61 fewer than before", before - after === 61, `saved ${before - after}`);
// The assertion that actually matters: doubling the tenant count must not
// change the number above. Everything the page reads is in the one dashboard
// response, so this is the property, not the constant, that must hold.
reset();
const doubled = {
  ...dashboard,
  customers: { ...dashboard.customers, items: [...customers, ...customers] },
};
globalThis.__fx.dashboard = doubled;
await billingService.getOverview();
eq("still 3 requests with twice the organizations", calls.length, 3);
globalThis.__fx.dashboard = dashboard;

console.log(
  failures === 0
    ? "\nAll platform-overview request checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
