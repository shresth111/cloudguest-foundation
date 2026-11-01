/**
 * REVENUE-HUB + CHURN-RISK (partner console): the pure helpers in
 * `src/lib/isp-partner/revenue.ts` plus source guards on the pages:
 * read-only services, lists only with isp_billing.export, the nav item gated
 * on the flag probe, `in_zone` (never the header's `zone`), and win-back
 * actions that use existing endpoints only.
 *
 * Run: node scripts/test-isp-partner-revenue.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-revenue-"));
const outfile = join(outdir, "revenue.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/revenue.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);
const src = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const g = typeof got === "object" ? JSON.stringify(got) : got;
  const w = typeof want === "object" ? JSON.stringify(want) : want;
  const ok = Object.is(g, w);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${g}, want ${w}`}`);
};
const has = (name, text, needle) => eq(name, text.includes(needle), true);
const lacks = (name, text, needle) => eq(name, text.includes(needle), false);

const Z = "11111111-2222-3333-4444-555555555555";
console.log("params");
eq("empty filters send nothing", m.revParams({}), {});
eq("month + months", m.revParams({ month: "2026-11", months: 12 }), {
  month: "2026-11",
  months: "12",
});
eq("bad month dropped", m.revParams({ month: "2026-1" }), {});
eq("months out of range dropped", m.revParams({ months: 25 }), {});
eq("zone id", m.revParams({ zone_id: Z }), { zone_id: Z });
eq("no_zone wins over zone_id", m.revParams({ zone_id: Z, no_zone: true }), { no_zone: "true" });
eq("bad uuid dropped", m.revParams({ zone_id: "x", package_id: "y" }), {});
eq("package", m.revParams({ package_id: Z }), { package_id: Z });

console.log("format");
eq("rate null is a dash, never 0", m.formatRate(null), "–");
eq("rate 0", m.formatRate(0), "0.0%");
eq("rate rounds to 1 place", m.formatRate(0.4737), "47.4%");
eq("rate 1", m.formatRate(1), "100.0%");
eq("month label", m.monthLabel("2026-11"), "Nov 2026");
const opts = m.monthOptions(new Date(2026, 0, 15), 3);
eq(
  "month options newest first, across the year",
  opts.map((o) => o.value),
  ["2026-01", "2025-12", "2025-11"],
);

console.log("tiles");
const k = {
  mrr_paise: 80000,
  arpu_paise: null,
  active: 0,
  pending: 4,
  expired: 1,
  churned: 2,
  other: 0,
  total: 3,
  unpriced: 1,
  new: 1,
  lost: 2,
  churn_rate: null,
  billed_paise: 0,
  net_billed_paise: 0,
  collected_paise: 0,
  collection_rate: null,
  uncollected_paise: 0,
  dues_paise: 5000,
};
const tiles = m.kpiTiles({ kpis: k });
const byKey = Object.fromEntries(tiles.map((t) => [t.key, t]));
eq("MRR opens the active list", byKey.mrr.metric, "active");
eq("churn rate opens the lost list", byKey.churn_rate.metric, "lost");
eq("collection rate opens the uncollected list", byKey.collection_rate.metric, "uncollected");
eq("churned opens churned", byKey.churned.metric, "churned");
eq("ACTIVE-ALIGN: pending tile opens the pending list", byKey.pending.metric, "pending");
eq("ACTIVE-ALIGN: pending tile shows the Overview's pending count", byKey.pending.value, "4");
eq("dues total has no single list (ageing tiles do)", byKey.dues.metric, null);
eq("ARPU with nobody active is a dash", byKey.arpu.value, "–");
eq("churn rate with no base is a dash", byKey.churn_rate.value, "–");
eq("unpriced count shown under MRR", byKey.mrr.sub, "1 active without a price");
eq(
  "every tile has a definition key",
  tiles.every((t) => typeof t.def === "string"),
  true,
);
eq(
  "METRIC_LABEL covers every list metric",
  [
    "active",
    "pending",
    "expired",
    "churned",
    "other",
    "unpriced",
    "new",
    "lost",
    "dues_not_due",
    "dues_d0_30",
    "dues_d31_60",
    "dues_d61_90",
    "dues_d90_plus",
    "uncollected",
  ].every((x) => typeof m.METRIC_LABEL[x] === "string"),
  true,
);

console.log("churn risk");
eq(
  "six reasons, labelled",
  m.REASON_ORDER.every((r) => m.REASON_LABEL[r]),
  true,
);
eq("score 50 is red", m.scoreTone(50), "overdue");
eq("score 30 is amber", m.scoreTone(30), "warning");
eq("score 25 is info", m.scoreTone(25), "info");
eq("offer = usual price: renew only", m.offerRenewalSteps(50000, 50000, false), [
  { kind: "renew" },
]);
eq("no offer: renew only", m.offerRenewalSteps(null, null, false), [{ kind: "renew" }]);
eq("one-off offer: set, renew, put the usual back", m.offerRenewalSteps(null, 40000, false), [
  { kind: "set_override", price_paise: 40000 },
  { kind: "renew" },
  { kind: "restore_override", price_paise: null },
]);
eq("kept offer: set, renew", m.offerRenewalSteps(50000, 40000, true), [
  { kind: "set_override", price_paise: 40000 },
  { kind: "renew" },
]);
const past = m.winbackText({ name: "Asha", ispName: "Net", validUntil: "2020-01-05T00:00:00Z" });
has("expired note says it ended", past, "ended on");
has("note signs with the ISP", past, "- Net");
const later = m.winbackText({ name: null, ispName: "Net", validUntil: "2999-01-01T00:00:00Z" });
has("not-yet-expired note says due", later, "due for renewal");

console.log("source guards");
const svc = src("src/services/isp-partner/revenue.ts");
for (const verb of ["api.post", "api.put", "api.patch", "api.delete"])
  lacks(`revenue service is read-only (${verb})`, svc, verb);
const shell = src("src/components/isp-partner/PartnerShell.tsx");
has("nav item for /partner/revenue", shell, '"/partner/revenue"');
has(
  "nav item hidden unless the probe answers",
  shell,
  '(n.to !== "/partner/revenue" || revenue.enabled)',
);
const route = src("src/routes/partner.revenue.tsx");
has("route keeps the hub zone in in_zone", route, "s.in_zone");
lacks("route never reads the header's ?zone=", route, "s.zone ");
const overview = src("src/components/isp-partner/revenue/RevenueOverview.tsx");
has("lists open only with isp_billing.export", overview, 'can("isp_billing.export")');
has("tiles open only when allowed", overview, "canOpen={canList && t.metric !== null}");
const risk = src("src/components/isp-partner/revenue/ChurnRiskPanel.tsx");
has("risk list query off without export", risk, "useRiskList(filters, reason, page, canList)");
has("each reason's detail is on screen", risk, "{r.detail}");
const wb = src("src/components/isp-partner/revenue/WinBackActions.tsx");
for (const call of [
  "svc.renew(",
  "svc.putProfile(",
  "financeService.payLink(",
  "<RaiseTicketDialog",
])
  has(`win-back uses the existing ${call}`, wb, call);
for (const f of [overview, risk, wb, src("src/components/isp-partner/revenue/RevenuePage.tsx")]) {
  lacks("no direct api calls in pages", f.replace(/import api[^\n]*\n/, ""), "api.");
}
for (const f of [overview, risk, wb]) {
  lacks("no window.confirm", f, "window.confirm");
  lacks("no 10px text", f, "text-[10px]");
  lacks("no tunnel wording", f, "WireGuard");
}

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
