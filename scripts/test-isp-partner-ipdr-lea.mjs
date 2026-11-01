/**
 * IPDR-2 LEA trace form (`src/lib/isp-partner/ipdr-lea.ts`) + page wiring.
 * Pins: the LEA reference and reason are mandatory; times go as IST wall
 * time with tz Asia/Kolkata; the LEA tab needs the owner/admin key; event
 * and receipt times are rendered in separate columns.
 *
 * Run: node scripts/test-isp-partner-ipdr-lea.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-lea-"));
const outfile = join(outdir, "lea.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/ipdr-lea.ts")],
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
const good = {
  ...m.EMPTY_LEA,
  public_ip: "203.0.113.9",
  public_port: "40001",
  at: "2026-10-30T15:30",
  lea_reference: "DCP/CYB/2026/0912",
  reason: "Notice u/s 94",
};
const r = m.buildLeaBody(good);
eq("valid form", r.ok, true);
eq("body", r.body, {
  public_ip: "203.0.113.9",
  public_port: 40001,
  at: "2026-10-30T15:30:00",
  tz: "Asia/Kolkata",
  tolerance_seconds: 60,
  lea_reference: "DCP/CYB/2026/0912",
  reason: "Notice u/s 94",
  gap_minutes: 5,
});
const errs = (p) => {
  const x = m.buildLeaBody({ ...good, ...p });
  return x.ok ? [] : Object.keys(x.errors).sort();
};
eq("reference mandatory", errs({ lea_reference: "" }), ["lea_reference"]);
eq("reason mandatory", errs({ reason: " " }), ["reason"]);
eq("bad ip", errs({ public_ip: "999.1.1.1" }), ["public_ip"]);
eq("ipv6 ok", errs({ public_ip: "2001:db8::1" }), []);
eq("port range", errs({ public_port: "70000" }), ["public_port"]);
eq("port optional", m.buildLeaBody({ ...good, public_port: "" }).body.public_port, null);
eq("time required", errs({ at: "" }), ["at"]);
eq("tolerance cap", errs({ tolerance_seconds: "901" }), ["tolerance_seconds"]);
eq("gap range", errs({ gap_minutes: "0" }), ["gap_minutes"]);
eq("control chars refused", errs({ lea_reference: "A\nB" }), ["lea_reference"]);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const page = read("src/components/isp-partner/compliance/CompliancePage.tsx");
eq("LEA tab needs isp_ipdr.export", /value: "lea"[^}]*perm: "isp_ipdr.export"/.test(page), true);
eq(
  "retention tab needs isp_ipdr.read",
  /value: "retention"[^}]*perm: "isp_ipdr.read"/.test(page),
  true,
);
const view = read("src/components/isp-partner/compliance/LeaTraceView.tsx");
eq(
  "event and receipt columns apart",
  view.includes("Event time (IST)") && view.includes("Receipt time (IST)"),
  true,
);
eq("missing event time shown as missing", view.includes("Not reported by the router"), true);
eq("no innerHTML", view.includes("dangerouslySetInnerHTML"), false);
eq("no full Aadhaar field", /id_number(?!_masked)/.test(view), false);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
