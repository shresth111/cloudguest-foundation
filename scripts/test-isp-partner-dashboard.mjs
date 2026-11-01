/**
 * DASH-1 overview dashboard (`src/lib/isp-partner/dashboard.ts`) and the NAT
 * banner's "View details" path.
 *
 * Pins: the filters send plain `YYYY-MM-DD` days only for a custom period
 * (the invoices P0 rule); the eight partition tiles are exactly the backend
 * buckets and must add up to the total; the online ring drops PPPoE while it
 * is off; and "View details" on the NAT banner lands on the per-router NAT
 * log-age table.
 *
 * Run: node scripts/test-isp-partner-dashboard.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-dash-"));
const outfile = join(outdir, "dashboard.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/dashboard.ts")],
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

// params
eq("7d sends only the period", m.dashParams({ period: "7d" }), { period: "7d" });
eq(
  "dates dropped unless custom",
  m.dashParams({ period: "30d", date_from: "2026-10-01", date_to: "2026-10-31" }),
  { period: "30d" },
);
eq(
  "custom sends plain days",
  m.dashParams({ period: "custom", date_from: "2026-10-01", date_to: "2026-10-31" }),
  { period: "custom", date_from: "2026-10-01", date_to: "2026-10-31" },
);
eq(
  "an ISO datetime is never sent",
  m.dashParams({ period: "custom", date_from: "2026-09-30T18:30:00.000Z", date_to: "2026-10-31" }),
  { period: "custom", date_to: "2026-10-31" },
);
eq(
  "filters pass through under the API's names",
  m.dashParams({ period: "today", isp_router_id: "r", package_id: "p", connection_type: "fiber" }),
  { period: "today", isp_router_id: "r", package_id: "p", connection_type: "fiber" },
);
eq("range ok", m.customRangeError("2026-10-01", "2026-10-31"), null);
eq("range missing", typeof m.customRangeError("2026-10-01", ""), "string");
eq("range reversed", typeof m.customRangeError("2026-10-02", "2026-10-01"), "string");
eq("range 401 days ok", m.customRangeError("2025-01-01", "2026-02-05"), null);
eq("range too long", typeof m.customRangeError("2025-01-01", "2026-02-06"), "string");

// tiles
const BE_BUCKETS = [
  "active",
  "pending",
  "suspended",
  "frozen",
  "blocked",
  "expired",
  "churned",
  "other",
];
eq(
  "partition tiles are the backend buckets",
  [...m.PARTITION_TILES].sort(),
  [...BE_BUCKETS].sort(),
);
eq(
  "every tile has a label",
  [...m.PARTITION_TILES, ...m.OVERLAY_TILES, "online"].every((t) => !!m.TILE_LABEL[t]),
  true,
);
eq("total is not a partition tile", m.PARTITION_TILES.includes("total"), false);
const tiles = Object.fromEntries(BE_BUCKETS.map((b, i) => [b, i + 1]));
eq("adds up", m.partitionAddsUp({ buckets: BE_BUCKETS, tiles: { ...tiles, total: 36 } }), true);
eq(
  "does not add up",
  m.partitionAddsUp({ buckets: BE_BUCKETS, tiles: { ...tiles, total: 37 } }),
  false,
);

// ring
const segs = m.onlineSegments({
  hotspot_sessions: 3,
  pppoe_sessions: 1,
  total_sessions: 4,
  subscribers: 2,
  pppoe_enabled: true,
});
eq(
  "ring segments",
  segs.map((s) => [s.key, s.value, s.from, s.to]),
  [
    ["hotspot", 3, 0, 0.75],
    ["pppoe", 1, 0.75, 1],
  ],
);
eq(
  "PPPoE off: hotspot only",
  m
    .onlineSegments({
      hotspot_sessions: 2,
      pppoe_sessions: 0,
      total_sessions: 2,
      subscribers: 1,
      pppoe_enabled: false,
    })
    .map((s) => s.key),
  ["hotspot"],
);
eq(
  "nobody online: zero-length segments",
  m
    .onlineSegments({
      hotspot_sessions: 0,
      pppoe_sessions: 0,
      total_sessions: 0,
      subscribers: 0,
      pppoe_enabled: true,
    })
    .map((s) => s.to - s.from),
  [0, 0],
);
eq("full ring path drawn", m.arcPath(0, 1, 46, 12).startsWith("M "), true);
eq("empty arc", m.arcPath(0.2, 0.2, 46, 12), "");

// NAT banner -> per-router log-age list (source checks: no DOM here)
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const banner = read("src/components/isp-partner/compliance/NatFeedBanner.tsx");
eq("banner links to Compliance", banner.includes('to="/partner/compliance"'), true);
eq("banner opens the NAT tab", /search=\{\{\s*tab:\s*"nat"\s*\}\}/.test(banner), true);
eq("banner says View details", banner.includes("View details"), true);
const route = read("src/routes/partner.compliance.tsx");
eq("route keeps ?tab=", route.includes("validateSearch") && route.includes("search.tab"), true);
const page = read("src/components/isp-partner/compliance/CompliancePage.tsx");
eq(
  "nat tab needs no extra grant",
  /\{\s*value:\s*"nat",\s*label:[^}]*\}/.test(page) && !/value:\s*"nat"[^}]*perm/.test(page),
  true,
);
eq("nat tab renders the feed view", page.includes('tab === "nat" && <NatFeedView />'), true);
const view = read("src/components/isp-partner/compliance/NatFeedView.tsx");
eq("feed view lists each router", view.includes("d?.routers ?? []"), true);
eq(
  "feed view shows the NAT log age",
  view.includes("Last NAT record") && view.includes("formatAgo(r.last_nat_record_at)"),
  true,
);

// the overview mounts the dashboard with the JAZE-3 counters as fallback
const overview = read("src/components/isp-partner/OverviewPage.tsx");
eq(
  "overview extends, not duplicates, the counters",
  overview.includes("<SubscriberOpsCard fallback={<CountersCard />} />") &&
    (overview.match(/<CountersCard/g) ?? []).length === 1,
  true,
);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
