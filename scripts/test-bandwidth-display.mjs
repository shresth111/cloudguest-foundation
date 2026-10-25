/**
 * Regression test for the customer dashboard's Bandwidth Utilization card.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 * 2026-10-25, Library Hall (RB4011, Airtel 300 Mbps): the ISP sweep was
 * measuring correctly -- 0.057 Mbps down / 0.225 Mbps up, matching the
 * router's own ether1 counters -- but the card printed "0 Mbps ↓ 0 Mbps ↑
 * 0% of plan" and drew a flat line on a 330 Mbps axis. The owner read that
 * as "it isn't working". A real, small reading must never render the same
 * as no traffic:
 *
 *   1. Sub-1-Mbps rates keep their digits (formatMbps, shared with the
 *      per-port chart), never `toFixed(0)`.
 *   2. Utilization above zero that rounds below 1% reads "<1%", not "0%".
 *   3. The y-axis is pinned to the plan only when traffic is big enough
 *      to be visible on that scale.
 *   4. The component uses these helpers, not its own rounding.
 *
 * Run: node scripts/test-bandwidth-display.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "bandwidth-display-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/components/customer/dashboard/bandwidth-display.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const { formatMbps, utilizationLabel, anchorAxisToPlan } = await import(outfile);

// 1. Rates
check("library-hall-down-is-not-zero", formatMbps(0.057) === "0.06 Mbps", formatMbps(0.057));
check("library-hall-up-is-not-zero", formatMbps(0.225) === "0.23 Mbps", formatMbps(0.225));
check("mid-rate-one-decimal", formatMbps(12.34) === "12.3 Mbps", formatMbps(12.34));
check("high-rate-integer", formatMbps(287.6) === "288 Mbps", formatMbps(287.6));
check("null-is-no-reading", formatMbps(null) === "No reading", formatMbps(null));

// 2. Utilization
check(
  "tiny-load-is-under-1pct",
  utilizationLabel(0.057, 300)?.label === "<1%",
  JSON.stringify(utilizationLabel(0.057, 300)),
);
check("tiny-load-pct-stays-numeric-for-colour", utilizationLabel(0.057, 300)?.pct === 0);
check(
  "true-zero-is-0pct",
  utilizationLabel(0, 300)?.label === "0%",
  JSON.stringify(utilizationLabel(0, 300)),
);
check("real-load-rounds", utilizationLabel(150, 300)?.label === "50%");
check("no-plan-no-pill", utilizationLabel(10, null) === null && utilizationLabel(10, 0) === null);
check("no-reading-no-pill", utilizationLabel(null, 300) === null);

// 3. Axis
check("idle-venue-axis-follows-data", anchorAxisToPlan(0.25, 300) === false);
check("busy-venue-axis-shows-plan", anchorAxisToPlan(120, 300) === true);
check("no-plan-never-anchors", anchorAxisToPlan(120, null) === false);
check("no-data-never-anchors", anchorAxisToPlan(null, 300) === false);

// 4. Wiring
const view = readFileSync(
  join(ROOT, "src/components/customer/dashboard/BandwidthUtilizationCard.tsx"),
  "utf8",
);
check(
  "card-has-no-integer-rounding-of-rates",
  !/Mbps\??\.toFixed\(0\)/.test(view),
  "toFixed(0) on a rate rounds real traffic to 0",
);
check("card-uses-formatMbps", (view.match(/formatMbps\(/g) || []).length >= 4);
check("card-uses-utilizationLabel", view.includes("utilizationLabel("));
check(
  "card-gates-plan-axis",
  view.includes("anchorAxisToPlan(") &&
    /showPlanOnAxis && capacityDownload != null && \(\s*<ReferenceLine/.test(view),
);
check("card-breaks-lines-at-gaps", (view.match(/connectNulls=\{false\}/g) || []).length >= 2);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
