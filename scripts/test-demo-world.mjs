/**
 * THE DEMO MUST AGREE WITH ITSELF -- and must never reach a real session.
 *
 * The demo workspace is the sales demo, the product video and the website
 * screenshots. A PM review (2026-10-31) found its screens contradicting each
 * other: 378 guests on the dashboard vs 24 on Guests, 1 router vs 2 on
 * Security vs a different router model on Internet Connection, "All 2 ISPs
 * online" vs "Jio Degraded", Reports listing venues the demo does not have,
 * and Fix a Problem saying "Your internet is working" at a venue whose router
 * had gone quiet. Every demo fixture now derives from `src/lib/demo-world.ts`.
 *
 * This test collects each screen's demo numbers -- through the real service
 * functions and fixture modules those screens call -- for EVERY demo venue,
 * and asserts they agree:
 *
 *   venue switcher  listLocations()            names, routers, ISP label
 *   dashboard       getDashboard()             online now, 24h guests, alerts
 *                   getDashboardSeries("24h")  guests, peak online
 *   Guests          getUsers(), getOnlineCount() total guests, online now
 *   insight cards   demoGuestMix / demoLocationComparison
 *   Devices         demoRouterDevices (devices/demo-fixtures)
 *   Internet        demoIspRouters / demoIspLinksFor (isp.demo)
 *   Security        demoSecurityOverview (firewall-demo)
 *   Alerts page     demoAllAlerts
 *   Fix a Problem   pickSubjectRouter + venueVerdict over the venue's routers
 *   Reports / Logs  venue pickers list exactly the demo venues
 *
 * And the gate: with the demo flag off, the same service calls return what
 * the (stubbed) API returned -- never a demo-world venue, guest or count.
 *
 * Run: node scripts/test-demo-world.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let passes = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const work = realpathSync(mkdtempSync(join(tmpdir(), "demo-world-")));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

writeFileSync(
  join(work, "api-stub.js"),
  `globalThis.__CALLS = [];
   const ok = (url) => { globalThis.__CALLS.push(url); return { data: { items: [], total_items: 0 } }; };
   export const api = { get: async (u) => ok(u), post: async (u) => ok(u), put: async (u) => ok(u), delete: async (u) => ok(u) };
   export const ORGS_STORAGE_KEY = "cloudguest_organizations";
   export const ROLES_STORAGE_KEY = "cloudguest_roles";
   export const TOKEN_STORAGE_KEY = "cloudguest_token";
   export const DEMO_ACCESS_TOKEN = "demo-access-token";
   export function resolveActiveOrganizationId() { return "org-real"; }
   export default api;`,
);
writeFileSync(
  join(work, "demo-host-stub.js"),
  `export const isHonouredDemoToken = () => globalThis.__DEMO === true;
   export const isDemoSession = () => globalThis.__DEMO === true;
   export const isDemoLoginEnabled = () => globalThis.__DEMO === true;
   export const isDemoLogin = () => false;`,
);

const entry = join(work, "entry.ts");
writeFileSync(
  entry,
  `export * as world from "${p("src/lib/demo-world.ts")}";
   export { customerService } from "${p("src/services/customer.service.ts")}";
   export { demoGuestMix, demoLocationComparison, demoLoginFunnel } from "${p("src/components/customer/dashboard/insights/insights.demo.ts")}";
   export { demoRouterDevices as devicesDemoRouters, withDemoHealth } from "${p("src/components/customer/devices/demo-fixtures.ts")}";
   export { demoIspRouters, demoIspLinksFor, demoIspChecks } from "${p("src/components/customer/isp/isp.demo.ts")}";
   export { demoSecurityOverview, demoVenueRouters } from "${p("src/lib/firewall-demo.ts")}";
   export { DEMO_NETLOGS_LOCATIONS, demoNetLogsRoutersFor } from "${p("src/lib/netlogs-demo.ts")}";
   export { venueVerdict } from "${p("src/lib/connection-verdicts.ts")}";
   export { pickSubjectRouter } from "${p("src/lib/fix-problem-subject.ts")}";
   export { useDeviceStore } from "${p("src/stores/deviceStore.ts")}";`,
);
const outfile = join(work, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "error",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: { "@": p("src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
        b.onResolve({ filter: /^\.\/api$/ }, () => ({ path: join(work, "api-stub.js") }));
        b.onResolve({ filter: /^@\/lib\/demo-host$/ }, () => ({
          path: join(work, "demo-host-stub.js"),
        }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx" },
  jsx: "automatic",
});

// A browser-ish global for the services (`isDemo()` returns false without
// a window) and the persisted demo device store.
const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
localStorage.setItem("cloudguest_token", "demo-access-token");
localStorage.setItem("cloudguest_organizations", JSON.stringify([{ id: "org-real" }]));

const m = createRequire(import.meta.url)(outfile);
const { world, customerService: svc } = m;
const DAY = 86_400_000;

/* ── the demo session ────────────────────────────────────────────────── */

globalThis.__DEMO = true;
const locations = await svc.listLocations();

console.log("\nvenue switcher = the demo world");
check(
  "venue list is exactly the demo world's venues",
  locations.map((l) => l.name).join("|") === world.DEMO_VENUE_NAMES.join("|"),
  locations.map((l) => l.name).join("|"),
);
check(
  "the five liveness states are all demonstrable",
  ["live", "partly-live", "not-live", "no-router"].every((s) =>
    locations.some((l) => l.liveness.state === s),
  ),
);

for (const venue of world.DEMO_VENUES) {
  const loc = locations.find((l) => l.id === venue.id);
  const tag = venue.name;
  console.log(`\n${tag}`);

  // Dashboard and Guests, read in the same minute.
  const now = world.demoNow();
  const dash = await svc.getDashboard(venue.id);
  const series = await svc.getDashboardSeries(venue.id, "24h");
  const guests = await svc.getUsers(venue.id, undefined, undefined, 1, 20);
  const everyone = await svc.getUsers(venue.id, undefined, undefined, 1, 1_000_000);
  const onlineRows = await svc.getUsers(venue.id, undefined, "online", 1, 1_000_000);
  const onlineCount = await svc.getOnlineCount(venue.id);
  if (world.demoNow() !== now) {
    console.log("  (minute rolled over mid-read; counts compared within one roster)");
  }

  // Guests
  const distinct = (rows) => new Set(rows.map((r) => `${r.name}|${r.phone}`)).size;
  check(
    `${tag}: dashboard "Currently online" == Guests "Online now"`,
    dash.kpis.onlineUsers === onlineCount,
    `${dash.kpis.onlineUsers} vs ${onlineCount}`,
  );
  check(
    `${tag}: "Online now" == distinct guests on the Guests list's Online filter`,
    onlineCount === distinct(onlineRows.users),
    `${onlineCount} vs ${distinct(onlineRows.users)}`,
  );
  check(
    `${tag}: dashboard 24h guests == series 24h guests`,
    dash.kpis.todayGuests === series.guests,
    `${dash.kpis.todayGuests} vs ${series.guests}`,
  );
  const since = Date.now() - DAY - 60_000;
  const last24 = everyone.users.filter((u) => new Date(u.connectedAt).getTime() >= since);
  check(
    `${tag}: 24h guests == distinct guests on the Guests list who connected in the last 24h`,
    Math.abs(distinct(last24) - series.guests) <= 1,
    `${distinct(last24)} vs ${series.guests}`,
  );
  check(
    `${tag}: Guests "Total guests" (on file) >= 24h guests, and is the list's own distinct count`,
    guests.uniqueGuests >= series.guests && guests.uniqueGuests === distinct(everyone.users),
    `${guests.uniqueGuests} / ${series.guests} / ${distinct(everyone.users)}`,
  );
  check(`${tag}: session footer == rows in the list`, guests.total === everyone.users.length);
  check(
    `${tag}: 24h peak online >= online now`,
    series.peakOnline >= dash.kpis.onlineUsers,
    `${series.peakOnline} vs ${dash.kpis.onlineUsers}`,
  );
  check(
    `${tag}: venue switcher online == dashboard online`,
    loc.onlineUsers === dash.kpis.onlineUsers,
  );
  const live = venue.routers.filter(world.demoRouterIsLive).length;
  if (live === 0) {
    check(`${tag}: no router checking in, so nobody is online`, dash.kpis.onlineUsers === 0);
  }

  // Routers: switcher, dashboard, Devices, Internet Connection, Security.
  const names = venue.routers.map((r) => r.name).join("|");
  check(
    `${tag}: dashboard routers == world (${live}/${venue.routers.length})`,
    dash.kpis.totalRouters === venue.routers.length && dash.kpis.routersOnline === live,
    `${dash.kpis.routersOnline}/${dash.kpis.totalRouters}`,
  );
  const devices = m.devicesDemoRouters(venue.id, loc.liveness.routers);
  check(
    `${tag}: Devices lists the same routers, same models`,
    devices.map((d) => `${d.name}:${d.model}`).join("|") ===
      venue.routers.map((r) => `${r.name}:${r.model}`).join("|"),
    devices.map((d) => `${d.name}:${d.model}`).join("|"),
  );
  const ispRouters = m.demoIspRouters(venue.id);
  check(
    `${tag}: Internet Connection lists the same routers, same models`,
    ispRouters.map((d) => `${d.name}:${d.model}`).join("|") ===
      venue.routers.map((r) => `${r.name}:${r.model}`).join("|"),
  );
  const sec = m.demoSecurityOverview(venue.id);
  check(
    `${tag}: Security counts the same routers, and the same ones reporting`,
    sec.fleet.routersTotal === venue.routers.length && sec.fleet.routersReporting === live,
    `${sec.fleet.routersReporting}/${sec.fleet.routersTotal}`,
  );
  check(
    `${tag}: Security lists the same router names`,
    m
      .demoVenueRouters(venue.id)
      .map((r) => r.name)
      .join("|") === names,
    m
      .demoVenueRouters(venue.id)
      .map((r) => r.name)
      .join("|"),
  );
  check(
    `${tag}: Security "no gateway" only when the venue has no router`,
    sec.fleet.noManagedGateway === (venue.routers.length === 0),
  );

  // Internet lines: status bar, WAN card / ISP page.
  const links = ispRouters.flatMap((r) => m.demoIspLinksFor(venue.id, r.id));
  const inUse = links.find((l) => l.isActiveUplink);
  check(
    `${tag}: status-bar ISP == the line in use on the Internet Connection page`,
    dash.health.isp === (inUse ? inUse.providerName : "No ISP link"),
    `${dash.health.isp} vs ${inUse?.providerName}`,
  );
  check(`${tag}: venue switcher ISP == status-bar ISP`, loc.isp === dash.health.isp);
  for (const l of links) {
    const newest = m.demoIspChecks(l.id)[0];
    const want = l.healthStatus === "healthy" ? "healthy" : l.healthStatus;
    check(
      `${tag}: ${l.providerName} latest check agrees with its status (${l.healthStatus})`,
      newest.status === want,
      `${newest.status}`,
    );
  }

  // Alerts: dashboard Needs attention, Alerts page, Security.
  const worldAlerts = world.demoVenueAlerts(venue);
  check(
    `${tag}: dashboard alerts == the venue's alerts on the Alerts page`,
    dash.recentAlerts.map((a) => a.msg).join("|") ===
      world
        .demoAllAlerts()
        .filter((a) => a.venueId === venue.id)
        .sort((a, b) => worldAlerts.indexOf(a) - worldAlerts.indexOf(b))
        .map((a) => a.title)
        .join("|"),
  );
  const openCounter = sec.counters.find((c) => c.key === "open_alerts");
  check(
    `${tag}: Security "Unresolved alerts" == dashboard alerts`,
    openCounter.count === dash.recentAlerts.length,
    `${openCounter.count} vs ${dash.recentAlerts.length}`,
  );
  const critical = dash.recentAlerts.filter((a) => a.type === "error").length;
  const silent = venue.routers.filter((r) => r.status === "online" && !world.demoRouterIsLive(r));
  const downLines = venue.isp.filter((l) => l.health === "unhealthy");
  check(
    `${tag}: one critical alert per silent router or down line`,
    critical === silent.length + downLines.length,
    `${critical}`,
  );
  for (const l of venue.isp.filter((x) => x.health === "degraded")) {
    check(
      `${tag}: degraded ${l.provider} line is an open alert`,
      dash.recentAlerts.some((a) => a.msg.includes(l.provider)),
    );
  }

  // Hardware: the store, the drawer health, the alerts.
  const hw = m.useDeviceStore.getState().devices.filter((d) => d.locationId === venue.id);
  check(
    `${tag}: Devices hardware == the world's hardware`,
    hw.map((d) => d.name).join("|") === venue.hardware.map((h) => h.name).join("|"),
  );
  const health = m.withDemoHealth(hw);
  for (const h of venue.hardware) {
    const row = health.find((r) => r.mac === h.mac);
    const want = h.state === "down" ? "down" : h.state === "unstable" ? "degraded" : "up";
    check(`${tag}: ${h.name} reads ${want} on Devices`, row?.health?.state === want);
    if (h.state !== "up") {
      check(
        `${tag}: ${h.name} is an open alert`,
        dash.recentAlerts.some((a) => a.msg.startsWith(h.name)),
      );
    }
  }

  // Insight cards and the venue comparison: same roster.
  const mix = m.demoGuestMix(venue.id, 28);
  const counted = world.demoGuestCounts(venue.id, world.demoNow() - 28 * DAY, world.demoNow());
  check(
    `${tag}: Guest mix 28-day guests == roster count`,
    mix.unique_guests === counted.guests && mix.sessions === counted.sessions,
    `${mix.unique_guests} vs ${counted.guests}`,
  );
  const funnel = m.demoLoginFunnel(venue.id, 28);
  const otpMax = Math.max(
    0,
    ...funnel.methods.filter((x) => x.auth_method.startsWith("otp")).map((x) => x.guests),
  );
  check(
    `${tag}: login funnel -- no OTP method has more guests than asked for a code`,
    otpMax <= funnel.otp_requested_guests,
    `${otpMax} vs ${funnel.otp_requested_guests}`,
  );

  // Fix a Problem: the same routers and lines through the real verdict.
  const subject = m.pickSubjectRouter(ispRouters);
  const reachable = subject
    ? Date.now() - new Date(subject.lastSeenAt).getTime() < 15 * 60_000
    : null;
  const verdict = m.venueVerdict({
    hasRouter: ispRouters.length > 0,
    links: links.map((l) => ({
      id: l.id,
      providerName: l.providerName,
      isPrimary: l.role === "primary",
      status:
        l.healthStatus === "healthy" ? "up" : l.healthStatus === "degraded" ? "degraded" : "down",
      latencyMs: l.latencyMs,
      packetLossPercent: l.packetLossPercentage,
      checkedAt: l.lastCheckedAt,
    })),
    routerLastSeenAt: subject?.lastSeenAt ?? null,
    routerReachable: reachable,
    guestsOnline: onlineCount,
    routerLivenessMeasured: true,
    controllerReportedDown: false,
    controllerVendorLabel: null,
  });
  if (loc.liveness.state === "live") {
    check(
      `${tag}: Fix a Problem is not alarmed at a live venue`,
      verdict.tone !== "danger",
      verdict.headline,
    );
  } else if (loc.liveness.state === "no-router") {
    check(`${tag}: Fix a Problem says there is no router`, verdict.status === "no-router");
  } else {
    check(
      `${tag}: Fix a Problem does NOT say the internet is simply working (${loc.liveness.state})`,
      verdict.tone !== "ok" && verdict.tone !== "success" && !/is working/i.test(verdict.headline),
      `${verdict.tone}: ${verdict.headline}`,
    );
  }
}

console.log("\nthe whole org");
{
  const cmp = m.demoLocationComparison(28);
  const now = world.demoNow();
  check(
    "venue comparison lists every demo venue",
    cmp.locations.map((l) => l.location_name).join("|") === world.DEMO_VENUE_NAMES.join("|"),
  );
  for (const row of cmp.locations) {
    const loc = locations.find((l) => l.id === row.location_id);
    const c = world.demoGuestCounts(row.location_id, now - 28 * DAY, now, now);
    check(
      `comparison ${row.location_name}: guests == roster, routers == switcher`,
      row.guests === c.guests &&
        row.routers_total === (loc.routersTotal ?? 0) &&
        row.routers_online === (loc.routersOnline ?? 0),
    );
  }
  check(
    "Logs venue picker == the demo venues",
    m.DEMO_NETLOGS_LOCATIONS.map((l) => l.name).join("|") === world.DEMO_VENUE_NAMES.join("|"),
  );
  check(
    "Logs router picker == the venue's routers (Bangalore DC)",
    m
      .demoNetLogsRoutersFor("loc-3")
      .map((r) => r.name)
      .join("|") === "Ground floor router|First floor router",
  );
  // Venue pickers in Reports, Vouchers, Guest Groups, Policies, Only Allowed,
  // Block guests, Staff Access: every one reads the demo world.
  for (const f of [
    "src/components/features/UserReports.tsx",
    "src/components/features/VouchersPage.tsx",
    "src/components/features/ManageTeamsPage.tsx",
    "src/components/features/LocationPolicies.tsx",
    "src/components/features/WhiteList.tsx",
    "src/components/features/BlockUsers.tsx",
    "src/stores/agentPermissionStore.ts",
  ]) {
    const src = readFileSync(join(ROOT, f), "utf8");
    check(
      `${f.split("/").pop()}: demo venue list comes from the demo world`,
      /DEMO_VENUE_NAMES/.test(src) &&
        !/"Marina Bay Hotel"|"Downtown CoWork"|"Eastside Cafe"|"Airport Lounge T3"/.test(src),
    );
  }
}

/* ── a real session ──────────────────────────────────────────────────── */

console.log("\nreal session: never the demo world");
{
  globalThis.__DEMO = false;
  globalThis.__CALLS.length = 0;
  const realLocations = await svc.listLocations();
  check(
    "listLocations: no demo venue",
    !realLocations.some((l) => world.DEMO_VENUE_NAMES.includes(l.name)),
    JSON.stringify(realLocations.map((l) => l.name)),
  );
  const users = await svc.getUsers("loc-1", undefined, undefined, 1, 20);
  check(
    "getUsers: the API's (empty) answer, not the roster",
    users.users.length === 0 && users.total === 0,
    JSON.stringify(users).slice(0, 120),
  );
  check("getOnlineCount: not the roster's count", (await svc.getOnlineCount("loc-1")) === 0);
  let seriesThrew = false;
  try {
    await svc.getDashboardSeries("loc-1", "24h");
  } catch {
    seriesThrew = true;
  }
  check(
    "getDashboardSeries: asks the API (and fails on a wrong shape), never the roster",
    seriesThrew,
  );
  check(
    "a real session asked the API (and got nothing back) instead of reading the roster",
    globalThis.__CALLS.length > 0,
    globalThis.__CALLS.join(","),
  );
}

console.log(
  failures === 0
    ? `\ndemo world: all ${passes} checks passed`
    : `\n${failures} check(s) failed, ${passes} passed`,
);
process.exit(failures === 0 ? 0 : 1);
