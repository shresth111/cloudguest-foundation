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

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
