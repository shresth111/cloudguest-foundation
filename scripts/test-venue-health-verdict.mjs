/**
 * ONE HONEST HEALTH VERDICT (PM review 2026-10-31, must-fix 1).
 *
 * On a "healthy" venue the console used to show three green verdicts -- the
 * top-bar pill ("All systems normal"), a Dashboard status bar ("All core
 * systems operational") and the Uptime tile ("All systems healthy") -- beside
 * "1 critical alert is open", an Unstable access point and a Degraded ISP
 * line. All three read router liveness only. And on a partly-live venue the
 * pill said "1 issue" while Needs attention listed 4 and the bell was empty.
 *
 * Now there is one issue list (`buildNeedsAttention`), the Dashboard publishes
 * it, and the pill (`venueVerdict`) and bell read it back. This pins:
 *   - the list now carries degraded/down ISP lines and unstable devices;
 *   - the routers rows carry WHICH routers are silent (the explainer panel
 *     they replaced);
 *   - "All systems normal" needs the full list, fully answered and empty;
 *   - a router-only list never claims more than "Routers checking in";
 *   - the pill's count is the list's length (the card's number);
 *   - the source shape: no status bar, no verdict footer, bell + pill wired
 *     to the shared list, Dashboard publishes it.
 *
 * Run: node scripts/test-venue-health-verdict.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const code = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const outdir = mkdtempSync(join(tmpdir(), "venue-verdict-"));
const entry = join(outdir, "entry.ts");
writeFileSync(
  entry,
  `export { buildNeedsAttention } from "${join(ROOT, "src/components/customer/dashboard/needsAttentionModel.ts")}";
   export { venueVerdict } from "${join(ROOT, "src/components/customer/venueVerdict.ts")}";`,
);
const outfile = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
});
const { buildNeedsAttention, venueVerdict } = createRequire(import.meta.url)(outfile);

const router = (key, status) => ({
  key,
  label: key,
  status,
  state: status === "pass" ? "live" : "gone-quiet",
  shortLabel: status === "pass" ? "Live" : "Gone quiet",
  detail: "",
  nextStep: status === "pass" ? null : "Check its power.",
  lastContactIso: null,
  lastContactKind: "never",
  rawStatus: "",
});
const lv = (state, routers) => ({
  state,
  label: state === "live" ? "Live" : "Partly live",
  summary: "",
  nextStep: null,
  routers,
  routersOnline: routers.filter((r) => r.status === "pass").length,
  routersTotal: routers.length,
});
const ready = (value) => ({ state: "ready", value });
const skip = { state: "skip" };
const line = (providerName, healthStatus, isActiveUplink = false) => ({
  id: providerName,
  providerName,
  healthStatus,
  isEnabled: true,
  isActiveUplink,
});
const dev = (status, healthState) => ({
  id: Math.random().toString(36),
  status,
  statusSource: "measured",
  observationIssue: null,
  health: healthState ? { state: healthState } : null,
});
const full = (over = {}) => ({
  liveness: ready(lv("live", [router("a", "pass")])),
  failedLogins: ready(0),
  alerts: ready({ critical: 0, warning: 0 }),
  devices: ready([dev("up", "up")]),
  plan: skip,
  isp: ready([line("Airtel", "healthy", true), line("Jio", "healthy")]),
  canOpen: () => true,
  ...over,
});
const asFull = (s) => ({ ...s, source: "full", checkedAt: 1 });
const asRouters = (s) => ({ ...s, source: "routers", checkedAt: null });

console.log("\nthe shared list");
{
  const s = buildNeedsAttention(full());
  check("a clean venue has an empty list", s.items.length === 0, JSON.stringify(s.items));
  check("internet lines are a checked source", s.checked.includes("isp"));
  const v = venueVerdict(asFull(s));
  check(
    "...and only then is it 'All systems normal'",
    v.label.key === "allNormal" && v.status === "ok",
  );
}
{
  // The PM's Mumbai HQ: router live, 1 critical alert, an Unstable AP, Jio degraded.
  const s = buildNeedsAttention(
    full({
      alerts: ready({ critical: 1, warning: 0 }),
      devices: ready([dev("up", "degraded"), dev("up", "up")]),
      isp: ready([line("Airtel", "healthy", true), line("Jio", "degraded")]),
    }),
  );
  const kinds = s.items.map((i) => i.kind);
  check("an unstable device is on the list", kinds.includes("devicesUnstable"), kinds.join());
  check(
    "a degraded ISP line is on the list, named",
    kinds.includes("ispDegraded") &&
      s.items.find((i) => i.kind === "ispDegraded").params.names === "Jio",
  );
  check(
    "ISP rows open Internet Connection",
    s.items.find((i) => i.kind === "ispDegraded").actionId === "isp-details",
  );
  const v = venueVerdict(asFull(s));
  check("the pill does NOT say normal", v.label.key !== "allNormal");
  check(
    "the pill counts the list (3, the card's number)",
    v.label.key === "needAttention" && v.label.count === s.items.length && s.items.length === 3,
  );
  check("a critical alert makes it red", v.status === "crit");
}
{
  const s = buildNeedsAttention(full({ isp: ready([line("Airtel", "unhealthy", true)]) }));
  check(
    "the line guests are on, down, is an error",
    s.items[0]?.kind === "ispDown" && s.items[0].severity === "error",
  );
  const v = venueVerdict(asFull(s));
  check(
    "one issue gets its own short label",
    v.label.key === "single" && v.label.item.kind === "ispDown",
  );
  const b = buildNeedsAttention(
    full({ isp: ready([line("Airtel", "healthy", true), line("Jio", "unhealthy")]) }),
  );
  check(
    "a dead backup line is a warning",
    b.items[0]?.kind === "ispDown" && b.items[0].severity === "warning",
  );
}
{
  const s = buildNeedsAttention(full({ devices: ready([dev("down", "down")]) }));
  check(
    "a down device is counted once (down, not also unstable)",
    s.items.length === 1 && s.items[0].kind === "devicesDown",
  );
}
{
  const s = buildNeedsAttention(
    full({
      liveness: ready(lv("partly-live", [router("Ground", "pass"), router("First", "fail")])),
    }),
  );
  const row = s.items.find((i) => i.kind === "routersPartlyOffline");
  check(
    "the routers row names the silent router",
    row?.routers?.length === 1 && row.routers[0].key === "First",
  );
  check(
    "...with its next step (the explainer it replaced)",
    row?.routers?.[0].nextStep === "Check its power.",
  );
}
{
  const s = buildNeedsAttention(full({ alerts: { state: "error" } }));
  const v = venueVerdict(asFull(s));
  check("a failed read is never 'normal'", v.label.key === "notAllChecked" && v.status !== "ok");
  const p = venueVerdict(asFull(buildNeedsAttention(full({ isp: { state: "loading" } }))));
  check("still loading is 'Checking…', not 'normal'", p.label.key === "checking");
}
{
  const s = buildNeedsAttention({
    liveness: ready(lv("live", [router("a", "pass")])),
    failedLogins: skip,
    alerts: skip,
    devices: skip,
    plan: skip,
    canOpen: () => true,
  });
  check("a router-only list without isp input skips isp", !s.checked.includes("isp"));
  const v = venueVerdict(asRouters(s));
  check(
    "router liveness alone says 'Routers checking in', never 'normal'",
    v.label.key === "routersCheckingIn",
  );
  const off = venueVerdict(
    asRouters(
      buildNeedsAttention({
        liveness: ready(lv("not-live", [router("a", "fail")])),
        failedLogins: skip,
        alerts: skip,
        devices: skip,
        plan: skip,
        canOpen: () => true,
      }),
    ),
  );
  check(
    "a dead venue on router liveness alone is red",
    off.status === "crit" && off.label.key === "single",
  );
}

console.log("\nwho reads it");
const dash = code("src/components/customer/CustomerDashboardPage.tsx");
check(
  "the Dashboard has no status bar of its own",
  !/data-testid="status-bar"/.test(dash) && !/\bVERDICT\b/.test(dash),
);
check(
  "...and no 'All core systems operational' sentence",
  !/status\.live|All core systems operational/.test(dash),
);
check(
  "the Uptime tile states its window, not a verdict",
  /t\("kpi\.uptimeFooter"/.test(dash) && !/allHealthy|All systems healthy/.test(dash),
);
check(
  "the Dashboard computes the list once, with the WAN read it already has",
  (dash.match(/useNeedsAttention\(/g) ?? []).length === 1 &&
    /useNeedsAttention\(locationId, \{ wan \}\)/.test(dash),
);
check("...renders it", /<NeedsAttentionCardView state=\{attention\} \/>/.test(dash));
check("...and publishes it for the top bar", /publishIssues\(locationId, attention\)/.test(dash));
check(
  "the liveness explainer is not a second statement of the outage",
  !/<LocationLivenessExplainer/.test(dash),
);
const pill = code("src/components/customer/ConsoleHealth.tsx");
check(
  "the pill reads the shared list",
  /useVenueIssues\(locationId/.test(pill) && /venueVerdict\(issues\)/.test(pill),
);
check("the pill words each issue as the card does", /rowCopy\(item, tna, lang\)/.test(pill));
check("the pill no longer counts failing routers itself", !/failingRouters/.test(pill));
const header = code("src/components/customer/CustomerHeader.tsx");
check(
  "the bell gets the same list",
  /useVenueIssues\(locationId\)/.test(header) && /attention=\{attention\}/.test(header),
);
const bell = code("src/components/notifications/NotificationBell.tsx");
check(
  "the bell's badge counts that list when it has one",
  /attentionItems\.length \+ \(attention\.includesAlerts \? 0 : unread\.length\)/.test(bell),
);
check(
  "the bell cannot say 'No new notifications' over open issues",
  /attentionItems\.length > 0 \? null :/.test(bell),
);

console.log(
  failures ? `\n${failures} check(s) failed` : "\nall venue health verdict checks passed",
);
process.exit(failures ? 1 : 0);
