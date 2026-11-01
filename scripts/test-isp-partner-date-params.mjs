/**
 * P0 regression (2026-11-01): `/partner/invoices` showed "Request validation
 * failed" on its default view. The billing/invoice API takes calendar dates
 * (`since`/`until: date`, `until` inclusive on the issue date); the page sent
 * `new Date(...).toISOString()`, which in IST is "2026-10-31T18:30:00.000Z"
 * -- pydantic rejects a datetime with a non-zero time for a `date` param.
 *
 * Guards:
 *  1. No partner file that calls a `date`-typed billing endpoint builds
 *     `since`/`until` with `.toISOString()`.
 *  2. Every invoice date preset yields `YYYY-MM-DD` under Asia/Kolkata and
 *     UTC (the exact default query the page sends).
 *
 * Run: node scripts/test-isp-partner-date-params.mjs
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let checks = 0;
const ok = (name, cond, extra = "") => {
  checks += 1;
  if (!cond) failures += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` -- ${extra}`}`);
};

// Files whose since/until go to `date` params (billing_router.py).
const DATE_PARAM_FILES = [
  "src/components/isp-partner/invoices/InvoicesPage.tsx",
  "src/components/isp-partner/reports/BillingReports.tsx",
  "src/components/isp-partner/billing/BillingPage.tsx",
];
for (const f of DATE_PARAM_FILES) {
  const src = readFileSync(join(ROOT, f), "utf8");
  const bad = /(since|until)\s*:\s*new Date\([^\n]*toISOString\(\)/.test(src);
  ok(
    `${f}: since/until are not ISO datetimes`,
    !bad,
    "found since/until: new Date(...).toISOString()",
  );
  const badExport = /exportCsv\([\s\S]{0,80}\.toISOString\(\)/.test(src);
  ok(`${f}: export dates are not ISO datetimes`, !badExport, "exportCsv(..., x.toISOString())");
}

if (process.env.__DATE_CHILD !== "1") {
  mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
  const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-date-params-"));
  const outfile = join(outdir, "invoices.mjs");
  await build({
    entryPoints: [join(ROOT, "src/lib/isp-partner/invoices.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "silent",
  });
  for (const tz of ["Asia/Kolkata", "UTC", "America/Los_Angeles"]) {
    const out = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(outfile)});
         const presets = ["this_month","last_month","this_fy","last_fy"];
         const res = {};
         for (const p of presets) { try { res[p] = m.presetRange(p); } catch (e) { res[p] = String(e); } }
         console.log(JSON.stringify(res));`,
      ],
      { env: { ...process.env, TZ: tz }, encoding: "utf8" },
    );
    const res = JSON.parse(out.trim().split("\n").pop());
    for (const [p, v] of Object.entries(res)) {
      if (!Array.isArray(v)) continue; // preset not offered by this build
      const [from, to] = v;
      ok(
        `${tz} ${p} -> ${from}..${to} are calendar dates`,
        /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to,
        JSON.stringify(v),
      );
    }
  }
}

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
