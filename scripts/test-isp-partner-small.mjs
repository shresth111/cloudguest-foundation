/**
 * SMALL-n lanes (partner console): source guards for the small follow-ups.
 *
 * SMALL-1: discount code on DIR-2 bulk renew (dry run shows per-subscriber
 * discount + discount skip reasons; the input hides while DISCOUNT-WIRE's
 * probe 404s).
 *
 * Run: node scripts/test-isp-partner-small.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
const ok = (name, cond) => {
  checks += 1;
  if (!cond) failures += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}`);
};
const has = (name, text, needle) => ok(name, text.includes(needle));
const lacks = (name, text, needle) => ok(name, !text.includes(needle));

// ---------------------------------------------------------------- SMALL-1
console.log("SMALL-1 bulk renew discount");
{
  const svc = src("src/services/isp-partner/dir2.ts");
  has("renew sends discount_code only when set", svc, "...(code ? { discount_code: code } : {})");
  has("BulkResult.discount typed", svc, "discount?: BulkDiscountSummary;");
  for (const r of [
    "discount_not_for_package",
    "discount_below_minimum",
    "discount_nothing_to_discount",
    "discount_used_up",
  ]) {
    has(`skip label for ${r}`, svc, `${r}:`);
  }
  const bar = src("src/components/isp-partner/subscribers/DirectoryBulkBar.tsx");
  has("dialog passes the code to renew", bar, "discount_code: discountCode");
  has(
    "code input only for renew",
    bar,
    '{action === "renew" && (\n          <BulkDiscountCodeInput',
  );
  has("editing the code invalidates the dry run", bar, "onChange={edit(setDiscountCode)}");
  has(
    "dry run shows the per-subscriber quote",
    bar,
    "<BulkDiscountPreview summary={preview.discount} />",
  );
  const p = "src/components/isp-partner/subscribers/BulkDiscountPreview.tsx";
  ok("preview component exists", existsSync(join(ROOT, p)));
  const prev = src(p);
  has("input hidden while the probe 404s", prev, "if (!enabled) return null;");
  has("uses DISCOUNT-WIRE probe hook", prev, "useDiscountApply()");
  has("replays are called out", prev, "no new use");
  lacks("no client-side discount maths (BE quote only)", prev, "afterDiscount(");
}

// ---------------------------------------------------------------- SMALL-2
console.log("SMALL-2 customer invoice discount");
{
  const types = src("src/services/isp-partner/invoices-types.ts");
  has("manual body carries discount_code", types, "discount_code?: string;");
  const btypes = src("src/services/isp-partner/billing-types.ts");
  has("1b body carries discount_code", btypes, "discount_code?: string;");
  const manual = src("src/components/isp-partner/invoices/InvoiceDialogs.tsx");
  has("manual dialog shows the code field", manual, "<DiscountCodeField");
  has("manual dialog previews on the whole-invoice gross", manual, "pricePaise={discountGross}");
  has(
    "manual dialog sends the code only when typed",
    manual,
    "...(discountCode.trim() ? { discount_code: discountCode.trim() } : {}),",
  );
  has("manual dialog resets the code on open", manual, 'setDiscountCode("");');
  const bill = src("src/components/isp-partner/billing/BillingDialogs.tsx");
  has("1b dialog shows the code field", bill, "<DiscountCodeField");
  has(
    "1b dialog sends the code only when typed",
    bill,
    "...(discountCode.trim() ? { discount_code: discountCode.trim() } : {}),",
  );
  const hook = src("src/hooks/isp-partner/useInvoiceTaxableGross.ts");
  has("gross sums lines through the shared helper", hook, "taxableGross({");
  has("gross is 0 while the probe is off", hook, "if (!status) return 0;");
}

// ---------------------------------------------------------------- SMALL-3
console.log("SMALL-3 win-back save rate");
{
  const svc = src("src/services/isp-partner/winback.ts");
  has("records to the BE action log", svc, '"/isp/revenue/churn-risk/actions"');
  has("reads the save rate", svc, '"/isp/revenue/churn-risk/save-rate"');
  lacks("revenue service stays read-only", src("src/services/isp-partner/revenue.ts"), "api.post");
  const hook = src("src/hooks/isp-partner/useWinback.ts");
  has("recording is best effort (never fails the action)", hook, ".catch(() => {");
  has("recording refreshes the rate", hook, "invalidateQueries({ queryKey: SAVE_RATE_KEY })");
  const card = src("src/components/isp-partner/revenue/SaveRateCard.tsx");
  has("card hides on 404/403", card, "if (q.isError || !q.data) return null;");
  has(
    "rate shows a dash before anything is decided",
    src("src/lib/isp-partner/winback.ts"),
    'r === null ? "–"',
  );
  const panel = src("src/components/isp-partner/revenue/ChurnRiskPanel.tsx");
  has("card on the Churn risk tab", panel, "<SaveRateCard />");
  const wb = src("src/components/isp-partner/revenue/WinBackActions.tsx");
  for (const a of ["offer_renew", "ticket", "whatsapp_share"]) {
    has(`records ${a}`, wb, `action: "${a}"`);
  }
  ok(
    "offer is logged before the renewal runs",
    wb.indexOf('action: "offer_renew"') < wb.indexOf("await run.mutateAsync(undefined);"),
  );
  has("ticket logged only once created, with its id", wb, "onCreated={(ticketId) =>");
  const tk = src("src/components/isp-partner/subscribers/workbench/Workbench.tsx");
  has("ticket dialog reports the new id", tk, "onCreated?.(t.id);");
}

// ---------------------------------------------------------------- SMALL-4
console.log("SMALL-4 MRR history + DSO");
{
  const types = src("src/services/isp-partner/revenue-types.ts");
  has("trend row carries mrr_source", types, 'mrr_source?: "snapshot" | "live" | "billed_proxy";');
  has("kpis carry dso_days", types, "dso_days?: number | null;");
  const ov = src("src/components/isp-partner/revenue/RevenueOverview.tsx");
  has("trend table has an MRR column", ov, "<MrrCell row={t} />");
  has(
    "billed stand-in is labelled",
    src("src/lib/isp-partner/mrr-history.ts"),
    'billed_proxy: "billed (no snapshot)"',
  );
  has("DSO line shows the BE number", ov, "formatDso(d.kpis.dso_days)");
  has("DSO line hidden on an older BE", ov, "d.kpis.dso_days !== undefined &&");
  has("DSO definition from the BE", ov, 'title={d.definitions.dso ?? ""}');
  has("empty DSO is a dash", src("src/lib/isp-partner/mrr-history.ts"), '? "–"');
}

// ---------------------------------------------------------------- SMALL-5
console.log("SMALL-5 auto incidents");
{
  const svc = src("src/services/isp-partner/incident-auto.ts");
  has("own prefix (never /incidents/{id})", svc, 'const BASE = "/isp/incident-auto";');
  const card = src("src/components/isp-partner/incidents/AutoIncidentsCard.tsx");
  has("card hides while the flag 404s", card, "if (q.isError || !q.data) return null;");
  has("only incidents.manage edits", card, 'can("isp_incidents.manage")');
  has("says auto-resolved get no automatic grace", card, "never get automatic grace");
  has("says controller venues are skipped", card, "vendor controller are skipped");
  const lib = src("src/lib/isp-partner/incident-auto.ts");
  has("minutes validated 1..240 like the BE", lib, "n < 1 || n > 240");
  const page = src("src/components/isp-partner/incidents/IncidentsPage.tsx");
  has("card on the incidents page", page, "<AutoIncidentsCard />");
  has("Auto tag on auto-opened rows", page, '<MTag label="Auto" tone="info" />');
  lacks("no tunnel wording", card, "WireGuard");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
