/**
 * RAKESH-FS (P0 #6): data limits in GB at the form, whole MB on the wire.
 * Pins `src/lib/isp-partner/data-units.ts` and the GB mode of the package
 * policy form in `src/lib/isp-partner/network.ts` (MB mode stays as before).
 *
 * Run: node scripts/test-isp-partner-data-units.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-units-"));
const entry = join(outdir, "entry.ts");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/isp-partner/data-units.ts"))};
export { policyToForm, formToPolicyBody } from ${JSON.stringify(join(ROOT, "src/lib/isp-partner/network.ts"))};`,
);
const outfile = join(outdir, "units.mjs");
await build({
  entryPoints: [entry],
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

// GB -> MB
// DECISIONS-1 (2026-11-10): 1 GB = 1000 MB (decimal, as telecom plans are sold)
eq("factor is 1000", m.MB_PER_GB, 1000);
eq("3000 GB -> 3000000 MB", m.parseGbToMb("3000"), { ok: true, mb: 3_000_000 });
eq("3,000 GB (comma) -> 3000000 MB", m.parseGbToMb("3,000"), { ok: true, mb: 3_000_000 });
eq("1.5 GB -> 1500 MB", m.parseGbToMb("1.5"), { ok: true, mb: 1500 });
eq("0.5 GB -> 500 MB", m.parseGbToMb(" 0.5 "), { ok: true, mb: 500 });
eq("0.001 GB rounds to 1 MB, never 0", m.parseGbToMb("0.001"), { ok: true, mb: 1 });
eq("1.0006 GB rounds to nearest MB", m.parseGbToMb("1.0006"), { ok: true, mb: 1001 });
eq("empty -> no limit", m.parseGbToMb(""), { ok: true, mb: null });
eq("1,000,000 GB (max) -> 1000000000 MB", m.parseGbToMb("1000000"), {
  ok: true,
  mb: 1_000_000_000,
});
eq("above max refused", m.parseGbToMb("1000001").ok, false);
eq("0 refused", m.parseGbToMb("0").ok, false);
eq("negative refused", m.parseGbToMb("-5").ok, false);
eq("text refused", m.parseGbToMb("3TB").ok, false);
eq("custom max", m.parseGbToMb("100001", { max: 100_000 }).ok, false);
// the BE column data_cap_mb is int4: max entry must fit
checks += 1;
if (m.MAX_GB * m.MB_PER_GB > 2_147_483_647) {
  failures += 1;
  console.log("  FAIL max GB overflows int4");
} else console.log("  ok   max GB fits int4");

// MB -> GB
eq("3000000 MB -> '3000'", m.mbToGbText(3_000_000), "3000");
eq("1500 MB -> '1.5'", m.mbToGbText(1500), "1.5");
eq("500 MB -> '0.5'", m.mbToGbText(500), "0.5");
eq("old 1024 MB cap -> '1.024'", m.mbToGbText(1024), "1.024");
eq("null -> ''", m.mbToGbText(null), "");
eq("display 3000000 MB", m.formatMbAsGb(3_000_000), "3,000 GB");
eq("display null", m.formatMbAsGb(null), "None");
eq("display 1500", m.formatMbAsGb(1500), "1.5 GB");
// byte counters (FUP meter, sessions, reports) on the same scale as limits
eq(
  "bytes: 3000 GB allowance reads 3.0 TB (decimal, same as formatMb)",
  m.formatDataBytes(3_000_000 * m.BYTES_PER_MB),
  "3.0 TB",
);
eq("bytes: 300 GB allowance", m.formatDataBytes(300_000 * m.BYTES_PER_MB), "300 GB");
eq("bytes: 1.5 GB", m.formatDataBytes(1500 * m.BYTES_PER_MB), "1.5 GB");
eq("bytes: 999 MB stays MB", m.formatDataBytes(999 * m.BYTES_PER_MB), "999 MB");
eq("bytes: 1000 MB -> 1.0 GB", m.formatDataBytes(1000 * m.BYTES_PER_MB), "1.0 GB");
eq("bytes: 512 B", m.formatDataBytes(512), "512 B");
eq("bytes: 12 KB", m.formatDataBytes(12 * 1024), "12.0 KB");
eq("bytes: null", m.formatDataBytes(null), "–");
eq("bytes: 2 TB", m.formatDataBytes(2_000_000 * m.BYTES_PER_MB), "2.0 TB");
eq("units: 1000 MB -> 1 GB", m.formatMbUnits(1000), "1 GB");
// round trip of every whole GB value stays exact
let rt = true;
for (const g of [1, 2, 10, 100, 999, 3000, 50000, 1_000_000]) {
  const r = m.parseGbToMb(String(g));
  if (!r.ok || m.mbToGbText(r.mb) !== String(g)) rt = false;
}
eq("whole GB round trip", rt, true);

// policy form, GB mode
const formGb = m.policyToForm({ fup_limit_mb: 3_000_000 }, { gb: true });
eq("policy form shows GB", formGb.fup_limit_mb, "3000");
const bodyGb = m.formToPolicyBody(
  { ...m.policyToForm(null, { gb: true }), fup_limit_mb: "3000" },
  { gb: true },
);
eq("policy body sends MB", bodyGb.ok && bodyGb.body.fup_limit_mb, 3_000_000);
const badGb = m.formToPolicyBody({ ...m.policyToForm(null), fup_limit_mb: "abc" }, { gb: true });
eq("policy GB error", badGb.ok, false);
// MB mode unchanged
const formMb = m.policyToForm({ fup_limit_mb: 3_072_000 });
eq("MB mode form unchanged", formMb.fup_limit_mb, "3072000");
const bodyMb = m.formToPolicyBody({ ...m.policyToForm(null), fup_limit_mb: "1024" });
eq("MB mode body unchanged", bodyMb.ok && bodyMb.body.fup_limit_mb, 1024);
const fracMb = m.formToPolicyBody({ ...m.policyToForm(null), fup_limit_mb: "1.5" });
eq("MB mode still refuses fractions", fracMb.ok, false);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
