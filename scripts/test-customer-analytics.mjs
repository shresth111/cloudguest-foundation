/**
 * Regression test for the customer Analytics pages
 * (analytics.guest/network/device/isp/executive), which shipped as
 * `ComingSoon` placeholders while the org-scoped `/analytics/*` endpoints
 * and `useDomain*Analytics` hooks already existed and were correct.
 *
 * Two things are pinned:
 *
 *   1. THE FORMATTERS NEVER FABRICATE A ZERO. The domain endpoints return
 *      `null` (with `available: false`) for a metric they genuinely can't
 *      produce, never a stand-in 0. `analytics-format` is bundled and run,
 *      so a `null` reading must render an em dash, not "0".
 *   2. EACH PAGE IS WIRED to the right real hook(s) and to the resolved org
 *      id, and no page still renders a ComingSoon placeholder. The ISP and
 *      Network pages must still say, in prose, which metrics this fleet
 *      cannot measure (jitter/packet-loss/SLA, per-application DPI) rather
 *      than charting a fabricated value.
 *
 * No test runner in this repo (see test-campaign-results.mjs); the pure
 * formatter module is bundled with esbuild and executed.
 *
 * Run: node scripts/test-customer-analytics.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const R = (rel) => join(ROOT, rel);
const read = (rel) => readFileSync(R(rel), "utf8");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// ---------------------------------------------------------------------------
// 1. Formatters: null → em dash, never a fabricated zero.
// ---------------------------------------------------------------------------
const outdir = mkdtempSync(join(tmpdir(), "customer-analytics-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from "${R("src/lib/analytics-format.ts").replace(/\\/g, "/")}";`);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const fmt = await import(`file://${outfile}`);
const DASH = "—";

console.log("\nformatters render an em dash for a genuinely-absent reading, never 0");
eq("formatBytes(null)", fmt.formatBytes(null), DASH);
eq("formatBytes(undefined)", fmt.formatBytes(undefined), DASH);
eq("formatPercent(null)", fmt.formatPercent(null), DASH);
eq("formatBitrate(null)", fmt.formatBitrate(null), DASH);
eq("formatCount(null)", fmt.formatCount(null), DASH);

console.log("\nformatters render real values sensibly");
eq("formatBytes(0) is a real zero, not a dash", fmt.formatBytes(0), "0 B");
eq("formatBytes(1500)", fmt.formatBytes(1500), "1.5 KB");
eq("formatBytes(2_000_000)", fmt.formatBytes(2_000_000), "2.0 MB");
eq("formatPercent(98.4)", fmt.formatPercent(98.4), "98.4%");
eq("formatCount(1234)", fmt.formatCount(1234), (1234).toLocaleString());

// ---------------------------------------------------------------------------
// 2. Each page is wired to the right hook(s); no ComingSoon left.
// ---------------------------------------------------------------------------
console.log("\neach analytics page is wired to its real domain hook(s)");
const guest = read("src/routes/_authenticated/analytics.guest.tsx");
const network = read("src/routes/_authenticated/analytics.network.tsx");
const device = read("src/routes/_authenticated/analytics.device.tsx");
const isp = read("src/routes/_authenticated/analytics.isp.tsx");
const exec = read("src/routes/_authenticated/analytics.executive.tsx");

for (const [label, src] of [
  ["guest", guest],
  ["network", network],
  ["device", device],
  ["isp", isp],
  ["executive", exec],
]) {
  check(`${label} page resolves the org id`, /useResolvedOrganizationId\(/.test(src));
  check(`${label} page no longer renders ComingSoonPanel`, !/ComingSoonPanel/.test(src));
}
check("guest page calls useDomainGuestAnalytics", /useDomainGuestAnalytics\(/.test(guest));
check("network page calls useDomainNetworkAnalytics", /useDomainNetworkAnalytics\(/.test(network));
check(
  "device page calls useDomainGuestAnalytics (device breakdown)",
  /useDomainGuestAnalytics\(/.test(device),
);
check(
  "isp page calls both network and router analytics",
  /useDomainNetworkAnalytics\(/.test(isp) && /useDomainRouterAnalytics\(/.test(isp),
);
check(
  "executive page composes guest + network + auth analytics",
  /useDomainGuestAnalytics\(/.test(exec) &&
    /useDomainNetworkAnalytics\(/.test(exec) &&
    /useDomainAuthAnalytics\(/.test(exec),
);

// ---------------------------------------------------------------------------
// 3. The panels are honest about what this fleet can't measure.
// ---------------------------------------------------------------------------
console.log("\nthe panels document the metrics this fleet cannot produce");
const panels = read("src/components/analytics/customer/CustomerAnalyticsPanels.tsx");
check(
  "ISP panel names jitter / packet loss / SLA as unmeasured",
  /jitter/i.test(panels) && /packet loss/i.test(panels),
);
check("Network panel names per-application DPI as unavailable", /DPI/.test(panels));
check(
  "Executive panel names revenue/NPS as out of scope",
  /revenue/i.test(panels) && /NPS/.test(panels),
);
check(
  "panels route metrics through the honest formatters",
  /formatBytes/.test(panels) && /formatPercent/.test(panels),
);
check("panels never invent a metric with Math.random", !/Math\.random/.test(panels));

// ---------------------------------------------------------------------------
// 4. The org-id resolver hook exists and uses the shared resolver.
// ---------------------------------------------------------------------------
console.log("\nthe resolved-org hook uses the shared /me/organizations resolver");
const hooks = read("src/hooks/useAnalytics.ts");
check(
  "useResolvedOrganizationId is exported",
  /export function useResolvedOrganizationId/.test(hooks),
);
check("it calls resolveOrganizationId", /resolveOrganizationId\(\)/.test(hooks));

console.log(
  failures === 0
    ? `\nall customer analytics checks passed\n`
    : `\n${failures} customer analytics check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
