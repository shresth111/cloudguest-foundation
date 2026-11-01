/**
 * DISCOUNT-WIRE (partner console): the pure helpers in
 * `src/lib/isp-partner/discount-apply.ts` (taxable gross, pre-tax discount,
 * body field) and source guards: the code field sits in the recharge, renew,
 * queued-renewal and onboarding forms, previews through JAZE-5's existing
 * endpoint, hides itself while the BE probe 404s, and the Discounts tab only
 * drops its "not applied yet" note while codes apply.
 *
 * Run: node scripts/test-isp-partner-discount-apply.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-discount-apply-"));
const outfile = join(outdir, "da.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/discount-apply.ts")],
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

const gst = { gstEnabled: true, rateBp: 1800 };
eq(
  "excl. GST: gross is the price",
  m.taxableGross({ pricePaise: 100000, includesGst: false, ...gst }),
  100000,
);
eq(
  "x 3 cycles",
  m.taxableGross({ pricePaise: 100000, cycles: 3, includesGst: false, ...gst }),
  300000,
);
eq(
  "incl. GST Rs 1,180 -> Rs 1,000 taxable",
  m.taxableGross({ pricePaise: 118000, includesGst: true, ...gst }),
  100000,
);
eq(
  "GST off: inclusive price is the gross",
  m.taxableGross({ pricePaise: 118000, includesGst: true, gstEnabled: false, rateBp: 1800 }),
  118000,
);
eq(
  "10 % off Rs 1,000 at 18 %",
  m.afterDiscount({ taxableGrossPaise: 100000, discountPaise: 10000, ...gst }),
  {
    taxable: 90000,
    gst: 16200,
    total: 106200,
  },
);
eq(
  "discount never below 0",
  m.afterDiscount({ taxableGrossPaise: 5000, discountPaise: 9000, ...gst }).taxable,
  0,
);
eq(
  "no GST",
  m.afterDiscount({
    taxableGrossPaise: 100000,
    discountPaise: 10000,
    gstEnabled: false,
    rateBp: 0,
  }),
  {
    taxable: 90000,
    gst: 0,
    total: 90000,
  },
);
eq("empty code sends nothing", m.discountField("  "), {});
eq("code trimmed", m.discountField(" save10 "), { discount_code: "save10" });

const field = src("src/components/isp-partner/discounts/DiscountCodeField.tsx");
has("field hidden while the probe is off", field, "if (!enabled) return null;");
has("preview uses JAZE-5's existing endpoint", field, "appsService.previewDiscount(");
has("preview sends the taxable gross", field, "gross_paise: gross");
for (const [name, p] of [
  ["recharge", "src/components/isp-partner/plans/RechargeDialog.tsx"],
  ["360 renew", "src/components/isp-partner/subscribers/SubscriberActions.tsx"],
  ["queued renewal", "src/components/isp-partner/queued/QueuedRenewalCard.tsx"],
  ["onboarding", "src/components/isp-partner/onboarding/OnboardPage.tsx"],
]) {
  has(`${name} shows the code field`, src(p), "<DiscountCodeField");
}
for (const p of [
  "src/components/isp-partner/plans/RechargeDialog.tsx",
  "src/components/isp-partner/subscribers/SubscriberActions.tsx",
  "src/components/isp-partner/queued/QueuedRenewalCard.tsx",
]) {
  has(`${p.split("/").pop()} sends the code`, src(p), "...discountField(code)");
}
has(
  "onboarding sends the code",
  src("src/lib/isp-partner/onboarding.ts"),
  "discount_code: f.discount_code.trim()",
);
const tab = src("src/components/isp-partner/apps/DiscountsTab.tsx");
has("Discounts tab reads the probe", tab, "useDiscountApply().enabled");
has("'not applied yet' note kept while off", tab, "do not apply them to invoices yet");
has("note swapped only while on", tab, "{applies\n");
has(
  "probe path",
  src("src/services/isp-partner/discount-apply.ts"),
  '"/isp/billing/discount-apply"',
);

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
