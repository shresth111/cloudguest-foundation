/**
 * Partner plans helpers (`src/lib/isp-partner/plans.ts`, ADDENDUM_02): kbps
 * display, the package-name preview, relative validity, and the defaults the
 * founder fixed (30-day validity, the 17-step speed ladder).
 *
 * Run: node scripts/test-isp-partner-plans.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-plans-"));
const outfile = join(outdir, "plans.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/plans.ts")],
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

eq("15360 kbps is 15 Mbps", m.formatKbps(15360), "15 Mbps");
eq("512 kbps stays kbps", m.formatKbps(512), "512 Kbps");
eq("1536 kbps is 1.5 Mbps", m.formatKbps(1536), "1.5 Mbps");
eq("0 is unlimited", m.formatKbps(0), "Unlimited");
eq("15 Mbps -> 15360 kbps (matches contract example)", m.mbpsToKbps(15), 15360);
eq("name preview", m.previewPackageName("15 Mbps", "prepaid", 90), "15 Mbps · Prepaid · 90 days");
eq(
  "name preview postpaid singular",
  m.previewPackageName("5 Mbps", "postpaid", 1),
  "5 Mbps · Postpaid · 1 day",
);
const now = Date.UTC(2026, 9, 22, 12);
eq(
  "in 12 days",
  m.relativeValidity(new Date(now + 12 * 86400000).toISOString(), now),
  "in 12 days",
);
eq(
  "expired 3 days ago",
  m.relativeValidity(new Date(now - 3 * 86400000).toISOString(), now),
  "expired 3 days ago",
);
eq("default validity is 30 (founder Q12)", m.DEFAULT_VALIDITY_DAYS, 30);
eq("ladder has 17 speeds", m.DEFAULT_LADDER_SPEEDS.length, 17);

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
