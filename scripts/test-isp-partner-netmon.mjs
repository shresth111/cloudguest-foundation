/**
 * NETMON-2 FE (`src/lib/isp-partner/netmon.ts`) + wiring: sparkline maths,
 * search validation (plain dates, <= 93 days, MAC/IP), no tunnel wording in
 * the new UI, and the router list kept as is while the flag is off.
 *
 * Run: node scripts/test-isp-partner-netmon.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-netmon-"));
const outfile = join(outdir, "netmon.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/netmon.ts")],
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
const pts = [
  { at: "2026-11-01T00:00:00Z", in_mbps: 0, out_mbps: 0 },
  { at: "2026-11-01T01:00:00Z", in_mbps: 10, out_mbps: 5 },
];
const sp = m.sparkPaths(pts, 100, 50);
eq("spark in path", sp.inPath, "0.0,50.0 100.0,0.0");
eq("spark out path", sp.outPath, "0.0,50.0 100.0,25.0");
eq("spark max", sp.max, 10);
eq("empty spark", m.sparkPaths([], 100, 50).inPath, "");
eq(
  "ok filters",
  m.completedError({
    date_from: "2026-10-01",
    date_to: "2026-10-31",
    mac: "aa-bb-cc-dd-ee-ff",
    ip: "10.0.0.1",
  }),
  null,
);
eq("iso refused", typeof m.completedError({ date_from: "2026-09-30T18:30:00.000Z" }), "string");
eq(
  "94 days refused",
  typeof m.completedError({ date_from: "2026-01-01", date_to: "2026-04-05" }),
  "string",
);
eq("bad mac", typeof m.completedError({ mac: "zz" }), "string");
eq("bad ip", typeof m.completedError({ ip: "10.0.0" }), "string");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const ui =
  read("src/components/isp-partner/routers/NetmonTabs.tsx") + read("src/lib/isp-partner/netmon.ts");
const visible = ui.replace(/FORBIDDEN_WORDS = \[[^\]]*\]/, "");
eq(
  "no tunnel wording",
  m.FORBIDDEN_WORDS.some((w) => visible.toLowerCase().includes(w)),
  false,
);
const page = read("src/components/isp-partner/routers/RoutersPage.tsx");
eq(
  "router list stays as the fallback",
  page.includes("<NetmonTabs") && page.includes("<RoutersTable"),
  true,
);
console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
