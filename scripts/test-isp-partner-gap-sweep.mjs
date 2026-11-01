/**
 * GAP-SWEEP FE: flag-gated nav items (Collections, Incidents, Referrals, PPPoE,
 * Fiber plant) hide only on their flag-off answer, never on a 403 / 5xx /
 * stale zone; the shell wires the probe in next to Apps and Revenue. The
 * discount-code tab does not claim codes change invoices (no billing path
 * applies them yet).
 *
 * Run: node scripts/test-isp-partner-gap-sweep.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-gap-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const requestErrorOf = (v) => (v && typeof v === "object" && "status" in v ? v : null);
   export default {};`,
);
const outfile = join(outdir, "gap.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/nav-flags.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "api-stub",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: stub }));
      },
    },
  ],
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
const err = (status, code) => ({ status, message: "x", data: code ? { code } : {} });

console.log("isFlagOff");
eq("bare 404 (PPPoE / fiber flag off)", m.isFlagOff(err(404)), true);
eq("404 ISP_COLLECTIONS_DISABLED", m.isFlagOff(err(404, "ISP_COLLECTIONS_DISABLED")), true);
eq("404 ISP_INCIDENTS_DISABLED", m.isFlagOff(err(404, "ISP_INCIDENTS_DISABLED")), true);
eq("404 ISP_REFERRALS_DISABLED", m.isFlagOff(err(404, "ISP_REFERRALS_DISABLED")), true);
eq("stale zone 404 keeps the item", m.isFlagOff(err(404, "ISP_ZONE_NOT_FOUND")), false);
eq("other 404 code keeps the item", m.isFlagOff(err(404, "ISP_FIBER_NOT_FOUND")), false);
eq("403 keeps the item", m.isFlagOff(err(403)), false);
eq("500 keeps the item", m.isFlagOff(err(500)), false);
eq("network error keeps the item", m.isFlagOff(new Error("Network Error")), false);
eq("no error keeps the item", m.isFlagOff(null), false);

console.log("wiring");
const shell = readFileSync(join(ROOT, "src/components/isp-partner/PartnerShell.tsx"), "utf8");
const hook = readFileSync(join(ROOT, "src/hooks/isp-partner/useNavFlags.ts"), "utf8");
eq("shell calls useFlagOffNav", /const flagOff = useFlagOffNav\(\);/.test(shell), true);
eq("shell filters on it", /!flagOff\.has\(n\.to\)/.test(shell), true);
eq(
  "apps / revenue probes untouched",
  shell.includes('(n.to !== "/partner/apps" || apps.enabled)') &&
    shell.includes('(n.to !== "/partner/revenue" || revenue.enabled)'),
  true,
);
for (const [to, perm] of Object.entries(m.NAV_FLAG_PATHS)) {
  eq(`${to} is a nav item`, shell.includes(`to: "${to}"`), true);
  eq(`${to} has a probe`, hook.includes(`"${to}": () =>`), true);
  eq(`${to} probe key looks like a key`, /^isp_[a-z_]+\.read$/.test(perm), true);
}
eq("probes never retry (a 404 is final)", /retry: false/.test(hook), true);
eq("probe only with the key", /enabled: can\(NAV_FLAG_PATHS\[to\]\)/.test(hook), true);

console.log("honest copy");
const disc = readFileSync(join(ROOT, "src/components/isp-partner/apps/DiscountsTab.tsx"), "utf8");
eq(
  "discounts say codes are not applied to invoices yet",
  /do\s+not\s+apply\s+them\s+to\s+invoices\s+yet/.test(disc),
  true,
);
eq(
  "no claim that codes reduce an invoice today",
  /Codes reduce the taxable amount/.test(disc),
  false,
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
