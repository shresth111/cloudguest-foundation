/**
 * FRANCHISE-2 FE (`src/lib/isp-partner/franchise.ts`) + wiring: the preview
 * mirrors the backend share maths, ranges use plain dates, no zone login is
 * offered, and the JAZE-4 zone ledger stays in place.
 *
 * Run: node scripts/test-isp-partner-franchise.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-fr-"));
const outfile = join(outdir, "fr.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/franchise.ts")],
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
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`,
  );
};
// same cases as backend test_isp_franchise.py::test_isp_share
eq("percent 30% zone", m.previewIspShare("percent", 50000, 3000, 0), 35000);
eq("percent 0%", m.previewIspShare("percent", 50000, 0, 0), 50000);
eq("percent 100%", m.previewIspShare("percent", 50000, 10000, 0), 0);
eq("floor", m.previewIspShare("percent", 50001, 3000, 0), 35000);
eq("clamped", m.previewIspShare("percent", 50000, 12000, 0), 0);
eq("wholesale", m.previewIspShare("wholesale", 50000, 3000, 12000), 12000);
eq("wholesale negative", m.previewIspShare("wholesale", 50000, 3000, -5), 0);
eq("range ok", m.rangeError("2026-10-01", "2026-10-31"), null);
eq("range iso refused", typeof m.rangeError("2026-09-30T18:30:00Z", "2026-10-31"), "string");
eq("range reversed", typeof m.rangeError("2026-11-02", "2026-11-01"), "string");
eq("day 28 ok", m.chargeDayError(28), null);
eq("day 31 refused", typeof m.chargeDayError(31), "string");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const ui = read("src/components/isp-partner/finance/FranchisePanel.tsx");
eq("no zone login offered", /password|sign[- ]?in|invite/i.test(ui), false);
eq("PAID/UNPAID badge", ui.includes('"PAID"') && ui.includes('"UNPAID"'), true);
const fin = read("src/components/isp-partner/finance/FinancePage.tsx");
eq("JAZE-4 ledger kept", fin.includes("<ZonesTab />") && fin.includes("<FranchisePanel />"), true);
console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
