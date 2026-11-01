/**
 * Partner billing money helpers (`src/lib/isp-partner/money.ts`): rupees typed
 * by staff -> integer paise on the wire, with no float rounding, and back.
 * A wrong paise value is a wrong receipt, so the edges are pinned here.
 *
 * Run: node scripts/test-isp-partner-money.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-money-"));
const outfile = join(outdir, "money.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/money.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = Object.is(got, want);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${got}, want ${want}`}`);
};

eq("1499 -> 149900", m.parseRupeesToPaise("1499"), 149900);
eq("1499.5 -> 149950", m.parseRupeesToPaise("1499.5"), 149950);
eq("1,499.05 -> 149905", m.parseRupeesToPaise("1,499.05"), 149905);
eq("₹ 0.10 -> 10", m.parseRupeesToPaise("₹ 0.10"), 10);
eq("0.29 has no float error", m.parseRupeesToPaise("0.29"), 29);
eq("three decimals refused", m.parseRupeesToPaise("1.234"), null);
eq("negative refused", m.parseRupeesToPaise("-5"), null);
eq("text refused", m.parseRupeesToPaise("abc"), null);
eq("empty refused", m.parseRupeesToPaise(""), null);
eq("format 149905", m.formatRupees(149905), "₹1,499.05");
eq("format 0", m.formatRupees(0), "₹0.00");
eq("format lakh grouping", m.formatRupees(12345678900), "₹12,34,56,789.00");
eq("format null", m.formatRupees(null), "–");
eq("input round trip", m.paiseToInput(149905), "1499.05");
eq("upi needs reference", m.modeNeedsReference("upi"), true);
eq("bank needs reference", m.modeNeedsReference("bank_transfer"), true);
eq("cash does not", m.modeNeedsReference("cash"), false);

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
