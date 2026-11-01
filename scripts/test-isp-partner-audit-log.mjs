/**
 * AUDIT-LOG FE: helpers + wiring. Read-only service (GET only), plain dates,
 * IP shown as "not recorded" when missing, owner/admin-only nav key, CSV only
 * with isp_audit.export, flag-off state, route registered.
 *
 * Run: node scripts/test-isp-partner-audit-log.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-aud-"));
const outfile = join(outdir, "aud.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/audit-log.ts")],
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
eq("open range ok", m.rangeError("", ""), null);
eq("range ok", m.rangeError("2026-11-01", "2026-11-02"), null);
eq("reversed refused", typeof m.rangeError("2026-11-03", "2026-11-02"), "string");
eq("ISO time refused", typeof m.rangeError("2026-11-01T18:30:00Z", ""), "string");
eq("ip shown", m.ipText("203.0.113.7", true), "203.0.113.7");
eq("ip missing", m.ipText(null, false), "not recorded");
eq(
  "detail text",
  m.detailText({ invoice_number: "INV/1", amount: 5 }),
  "invoice number: INV/1 · amount: 5",
);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/audit-log.ts");
eq("read-only service", /api\.(post|put|patch|delete)/.test(svc), false);
for (const r of ['"/isp/audit-log"', '"/isp/audit-log/facets"', '"/isp/audit-log/export.csv"'])
  eq(`service reaches ${r}`, svc.includes(r), true);
const page = read("src/components/isp-partner/audit/AuditLogPage.tsx");
eq("flag off says so", page.includes("The audit log is not switched on"), true);
eq("CSV needs export key", page.includes('can("isp_audit.export")'), true);
const shell = read("src/components/isp-partner/PartnerShell.tsx");
eq(
  "nav gated by isp_audit.read",
  /to: "\/partner\/audit-log",[\s\S]{0,120}anyOf: \["isp_audit\.read"\]/.test(shell),
  true,
);
eq("route registered", read("src/routeTree.gen.ts").includes("'/partner/audit-log'"), true);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
