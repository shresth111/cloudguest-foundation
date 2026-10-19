/**
 * Regression test for the monitored-hardware health words
 * (`src/lib/hardware-health.ts`, reached through `describeLiveness`).
 *
 * WHAT WENT WRONG (2026-10-19)
 *
 *   1. "Up · connected 16d 22h" -- time since an inactive->active flip the
 *      sweep happened to record, read by everyone as uptime. A reboot between
 *      two sweeps never reset it.
 *   2. HKM: the AP's router port ether3 was link-down since 07:09 and the row
 *      said only "Down". The owner reported it as our bug.
 *   3. One dropped sweep flipped a device to red DOWN (and alerted).
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. A DOWN ROW SAYS WHY -- port link down names the port and uses the
 *      router's own link-down time.
 *   2. WITH HEALTH PRESENT, "connected <duration>" IS NEVER SHOWN.
 *   3. ONE MISSED CHECK IS AMBER "Not responding", NOT RED "Down".
 *   4. A STALE VERDICT IS NOT SHOWN AS CURRENT.
 *   5. WITHOUT HEALTH (demo store, older backend) NOTHING CHANGES.
 *   6. The 24h strip never paints a state nobody observed.
 *
 * Run: node scripts/test-hardware-health.mjs
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
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "hardware-health-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { describeLiveness } from ${JSON.stringify(join(ROOT, "src/lib/device-liveness.ts"))};
   export { healthFacts, healthTimeline, toDeviceHealth }
     from ${JSON.stringify(join(ROOT, "src/lib/hardware-health.ts"))};`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});
const { describeLiveness, healthFacts, healthTimeline, toDeviceHealth } = await import(bundle);

// Local-time-independent clock: build instants from local components.
const NOW = new Date(2026, 9, 19, 12, 0, 0).getTime();
const HOUR = 3_600_000;
const at = (h, m = 0) => new Date(2026, 9, 19, h, m, 0).toISOString();

const raw = (over = {}) => ({
  state: "up",
  reason: "icmp",
  since: at(9, 30),
  checked_at: new Date(NOW - 20_000).toISOString(),
  consecutive_failures: 0,
  last_ok_at: new Date(NOW - 20_000).toISOString(),
  last_rtt_ms: 1.4,
  probe_method: "icmp",
  port_name: "ether3",
  port_running: true,
  port_last_link_down_at: null,
  port_last_link_up_at: null,
  link_flaps_24h: 0,
  clients_behind: 12,
  rx_bps: 300_000,
  tx_bps: 1_200_000,
  events_24h: [],
  ...over,
});
const row = (health, over = {}) => ({
  status: "up",
  lastSeenAt: new Date(NOW - 20_000).toISOString(),
  connectedAt: new Date(NOW - (16 * 24 + 22) * HOUR).toISOString(),
  uptimeSeconds: null,
  uptimeRecordedAt: null,
  health: toDeviceHealth(health),
  ...over,
});

console.log("\nHKM: port link down says which port, and since when");
{
  const live = describeLiveness(
    row(
      raw({
        state: "down",
        reason: "port_link_down",
        port_running: false,
        since: at(7, 10),
        port_last_link_down_at: at(7, 9),
        last_rtt_ms: null,
      }),
      { status: "down" },
    ),
    NOW,
  );
  eq("badge", live.state, "Down");
  eq(
    "detail names the port and the router's link-down time",
    live.detail,
    "since 07:09 · port ether3 link down",
  );
  check("explanation tells the owner what to check", /cable|power/i.test(live.explanation ?? ""));
  eq("tone", live.tone, "down");
}

console.log("\nan up device shows 'since', never 'connected <duration>'");
{
  const live = describeLiveness(row(raw()), NOW);
  eq("badge", live.state, "Up");
  eq("detail", live.detail, "since 09:30");
  check("no 'connected' wording", !/connected/.test(live.detail ?? ""));
  eq("detailKind", live.detailKind, "health");
}

console.log("\none missed check is amber, not red");
{
  const live = describeLiveness(
    row(raw({ state: "degraded", reason: "probe_failing", consecutive_failures: 1 })),
    NOW,
  );
  eq("badge", live.state, "Not responding");
  eq("tone", live.tone, "warning");
}

console.log("\nother down reasons all carry a reason");
for (const reason of ["no_arp_reply", "no_ping_reply", "not_on_lan", "port_disabled"]) {
  const live = describeLiveness(row(raw({ state: "down", reason }), { status: "down" }), NOW);
  check(`${reason} has a detail beyond the time`, (live.detail ?? "").includes(" · "), live.detail);
}

console.log("\nflapping port reads Unstable with the count");
{
  const live = describeLiveness(
    row(raw({ state: "degraded", reason: "link_flapping", link_flaps_24h: 4 })),
    NOW,
  );
  eq("badge", live.state, "Unstable");
  check("count shown", /dropped 4× in 24h/.test(live.detail ?? ""), live.detail);
}

console.log("\na stale verdict is not shown as current");
{
  const live = describeLiveness(
    row(raw({ state: "unknown", reason: "not_checked_recently" })),
    NOW,
  );
  eq("badge", live.state, "Status stale");
  check("not 'Up'", live.state !== "Up");
  const unreadable = describeLiveness(
    row(raw({ state: "unknown", reason: "not_checked_recently" }), {
      status: "down",
      observationIssue: "router_auth_failed",
    }),
    NOW,
  );
  eq(
    "a router-unreadable explanation wins over plain staleness",
    unreadable.state,
    "Can't reach router",
  );
}

console.log("\nwithout health, the old words are unchanged");
{
  const live = describeLiveness(row(null), NOW);
  check(
    "still 'connected ...' for an older backend",
    /^connected /.test(live.detail ?? ""),
    live.detail,
  );
}

console.log("\nevidence facts");
{
  const facts = healthFacts(toDeviceHealth(raw({ link_flaps_24h: 2 })));
  eq(
    "facts",
    facts.join(" | "),
    "port ether3 | 1 ms | 12 devices on port | ↓1.2 Mbps ↑300 kbps | 2 link drops in 24h",
  );
  const down = healthFacts(
    toDeviceHealth(raw({ state: "down", reason: "port_link_down", last_rtt_ms: 3 })),
  );
  check("no latency on a down row", !down.some((f) => / ms$/.test(f)));
}

console.log("\n24h strip");
{
  const h = toDeviceHealth(
    raw({
      state: "down",
      reason: "port_link_down",
      since: at(7, 9),
      events_24h: [
        {
          at: at(2),
          kind: "state",
          from_state: "up",
          to_state: "degraded",
          reason: "probe_failing",
          count: null,
          detail: null,
        },
        {
          at: at(2, 1),
          kind: "state",
          from_state: "degraded",
          to_state: "up",
          reason: "icmp",
          count: null,
          detail: null,
        },
        {
          at: at(7, 9),
          kind: "state",
          from_state: "up",
          to_state: "down",
          reason: "port_link_down",
          count: null,
          detail: null,
        },
        {
          at: at(7, 9),
          kind: "link_down",
          from_state: null,
          to_state: null,
          reason: null,
          count: 1,
          detail: "ether3",
        },
      ],
    }),
  );
  const segs = healthTimeline(h, NOW);
  eq("starts with the first event's from-state", segs[0].state, "up");
  eq("ends in the current state", segs.at(-1).state, "down");
  eq("covers the whole window", Math.round((segs.at(-1).end - segs[0].start) * 1000), 1000);
  const fresh = healthTimeline(toDeviceHealth(raw({ since: at(9, 30) })), NOW);
  eq("before the first observation is unknown, not up", fresh[0].state, "unknown");
  eq("then up", fresh.at(-1).state, "up");
}

console.log("\nwiring");
{
  const view = readFileSync(join(ROOT, "src/components/customer/BasicFeatureViews.tsx"), "utf8");
  check("Devices table renders HardwareHealthDetails", /<HardwareHealthDetails/.test(view));
  check(
    "add dialog warns about a duplicate MAC",
    /duplicateLocations/.test(view) && /registeredElsewhere/.test(view),
  );
  const service = readFileSync(join(ROOT, "src/services/deviceHardware.service.ts"), "utf8");
  check("service maps health", /toDeviceHealth\(r\.health\)/.test(service));
  check("service maps duplicate_locations", /r\.duplicate_locations/.test(service));
}

console.log(
  failures === 0
    ? "\nall hardware health checks passed\n"
    : `\n${failures} hardware health check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
