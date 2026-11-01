/**
 * Render + model test for the Overview topology map
 * (src/components/customer/dashboard/overview/topology-model.ts + TopologyMap.tsx).
 *
 * The map is built ONLY from rows the page already reads -- ISP links,
 * the routers' liveness, monitored hardware or the Omada controller's own
 * inventory, and the online-guest count. These cases pin that:
 *   1. 0 devices        -- no ISP, no router, no hardware: honest placeholders,
 *                          never a healthy-looking chain, no guest node without
 *                          a count.
 *   2. 1 router + 3 APs -- one node per real row, statuses carried through,
 *                          MAC rendered in the tooltip data, links to Devices.
 *   3. dual ISP         -- both lines drawn, the backup's link dashed, a down
 *                          line is `crit` and makes the map's overall status crit.
 *   4. controller venue -- APs come from the controller inventory (not the
 *                          hardware list), an unknown controller status is
 *                          `unknown` (never assumed up); an unreachable
 *                          controller says so.
 * Plus: many APs collapse into "+N more" without hiding the one that is down.
 *
 * Server-rendered (renderToStaticMarkup), so nothing about hover or layout is
 * proven here -- look at it in a browser for that.
 *
 * Run: node scripts/test-dashboard-topology.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
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

const outdir = realpathSync(mkdtempSync(join(tmpdir(), "dashboard-topology-")));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { buildTopology } from "${p("src/components/customer/dashboard/overview/topology-model.ts")}";
   import { TopologyMap } from "${p("src/components/customer/dashboard/overview/TopologyMap.tsx")}";
   import { deriveLocationLiveness } from "${p("src/lib/location-liveness.ts")}";
   export { React, renderToStaticMarkup, buildTopology, TopologyMap, deriveLocationLiveness };`,
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
  alias: { "@": p("src") },
  loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json", ".css": "empty" },
  jsx: "automatic",
});
const m = createRequire(import.meta.url)(outfile);
// SSR has no layout; React warns about useLayoutEffect, which is expected.
const origError = console.error;
console.error = (...a) => (String(a[0]).includes("useLayoutEffect") ? undefined : origError(...a));
const render = (model) =>
  m.renderToStaticMarkup(m.React.createElement(m.TopologyMap, { model, onOpen: () => {} }));
const nodesIn = (html) => [...html.matchAll(/data-topology-node="([^"]+)"/g)].map((x) => x[1]);

const NOW = new Date();
const iso = (minAgo) => new Date(NOW.getTime() - minAgo * 60_000).toISOString();
const link = (over = {}) => ({
  id: "isp-1",
  routerId: "r1",
  organizationId: "o",
  locationId: "loc-1",
  providerName: "Airtel",
  linkType: "fiber",
  connectionMode: "static",
  role: "primary",
  isActiveUplink: true,
  autoFailback: true,
  isEnabled: true,
  priority: 0,
  interface: "ether1",
  gatewayIpAddress: "203.0.113.1",
  dnsPrimary: null,
  dnsSecondary: null,
  downloadBandwidthMbps: 500,
  uploadBandwidthMbps: 200,
  healthStatus: "healthy",
  healthStatusSource: "automated",
  unhealthySince: null,
  latencyMs: 12,
  packetLossPercentage: 0,
  currentDownloadMbps: 100,
  currentUploadMbps: 20,
  lastCheckedAt: iso(1),
  consecutiveUnhealthyCount: 0,
  createdAt: iso(9999),
  ...over,
});
const hw = (id, status, over = {}) => ({
  id,
  locationId: "loc-1",
  name: `AP ${id}`,
  mac: `AA:BB:CC:00:00:0${id}`,
  type: "Access Point",
  floor: "GF",
  status,
  lastSeenAt: status === "unknown" ? null : iso(2),
  connectedAt: status === "up" ? iso(600) : null,
  uptimeSeconds: null,
  uptimeRecordedAt: null,
  statusSource: "measured",
  ...over,
});
const lv = (routers) => m.deriveLocationLiveness(routers, NOW);
const base = {
  livenessLoading: false,
  hardwareLoading: false,
  controller: null,
  nasOnly: false,
};

console.log("\n1. 0 devices");
{
  const model = m.buildTopology({
    ...base,
    wan: { status: "empty" },
    liveness: lv([]),
    hardware: [],
    onlineGuests: null,
  });
  check("no ISP -> ispState none", model.ispState === "none" && model.isps.length === 0);
  check("no router -> gatewayState none", model.gatewayState === "none");
  check("no hardware -> downstreamState none", model.downstreamState === "none");
  check("no count -> no guest node (never a stand-in 0)", model.clients === null);
  check("overall is unknown, not ok", model.overall === "unknown", model.overall);
  const html = render(model);
  const ids = nodesIn(html);
  check(
    "renders three placeholders and nothing else",
    ids.length === 3 && ids.every((i) => i.startsWith("ghost:")),
    ids.join(","),
  );
  check(
    "placeholders say what's missing",
    /No ISP added/.test(html) && /No router yet/.test(html) && /No access points added/.test(html),
  );
  check("no node claims to be up", !/data-status="ok"/.test(html));
}

console.log("\n2. 1 router + 3 APs");
{
  const model = m.buildTopology({
    ...base,
    wan: { status: "ready", links: [link()], checks: {} },
    liveness: lv([
      {
        id: "r1",
        name: "Lobby router",
        status: "online",
        last_seen_at: iso(1),
        vendor: "mikrotik",
      },
    ]),
    hardware: [hw("1", "up"), hw("2", "up"), hw("3", "down")],
    onlineGuests: 7,
  });
  check(
    "one gateway from the one router row",
    model.gateways.length === 1 && model.gateways[0].label === "Lobby router",
  );
  check(
    "gateway is ok (heartbeat current)",
    model.gateways[0].status === "ok",
    model.gateways[0].status,
  );
  check(
    "three downstream nodes, one per row",
    model.downstream.length === 3 && model.downstreamTotal === 3,
  );
  check(
    "the down AP sorts first and is crit",
    model.downstream[0].label === "AP 3" && model.downstream[0].status === "crit",
  );
  check("counts are real", model.downstreamCounts.ok === 2 && model.downstreamCounts.crit === 1);
  check(
    "MAC is a mono fact",
    model.downstream[0].facts.some(
      (f) => f.key === "mac" && f.mono && f.value === "AA:BB:CC:00:00:03",
    ),
  );
  check(
    "AP nodes open Devices",
    model.downstream.every((n) => n.target === "devices"),
  );
  check("guest node carries the real count", model.clients?.count === 7);
  check("overall is crit because one AP is down", model.overall === "crit", model.overall);
  const ids = nodesIn(render(model));
  check("renders isp + router + 3 APs + guests", ids.length === 6, ids.join(","));
}

console.log("\n3. dual ISP");
{
  const model = m.buildTopology({
    ...base,
    wan: {
      status: "ready",
      links: [
        link(),
        link({
          id: "isp-2",
          providerName: "Jio",
          role: "backup",
          isActiveUplink: false,
          healthStatus: "unhealthy",
        }),
      ],
      checks: {},
    },
    liveness: lv([{ id: "r1", name: "R", status: "online", last_seen_at: iso(1) }]),
    hardware: [hw("1", "up")],
    onlineGuests: 3,
  });
  check("two ISP nodes", model.isps.length === 2);
  check("active uplink flagged", model.isps[0].active === true && model.isps[1].active === false);
  check("down backup is crit", model.isps[1].status === "crit");
  check("overall is crit", model.overall === "crit");
  const html = render(model);
  check(
    "both ISPs rendered",
    /data-topology-node="isp:isp-1"/.test(html) && /data-topology-node="isp:isp-2"/.test(html),
  );
  check("backup line drawn dashed", /stroke-dasharray="4 4"/.test(html));
}

console.log("\n4. controller venue");
{
  const omada = [
    {
      id: "c1",
      name: "Omada",
      status: "pending_provisioning",
      last_seen_at: null,
      vendor: "tplink_omada",
    },
  ];
  const ctl = {
    status: "ok",
    loading: false,
    devices: [
      {
        mac: "10:00:00:00:00:01",
        name: "Hall AP",
        deviceType: "ap",
        model: "EAP225",
        status: "connected",
        ipAddress: "10.0.0.5",
        firmwareVersion: "5.1",
        uptimeSeconds: 3600,
        clientCount: 4,
      },
      {
        mac: "10:00:00:00:00:02",
        name: null,
        deviceType: "switch",
        model: "SG2008",
        status: "weird-new-state",
        ipAddress: null,
        firmwareVersion: null,
        uptimeSeconds: null,
        clientCount: null,
      },
    ],
  };
  const model = m.buildTopology({
    ...base,
    wan: { status: "empty" },
    liveness: lv(omada),
    hardware: [hw("9", "unknown", { statusSource: "unmeasured" })],
    controller: ctl,
    onlineGuests: 0,
  });
  check(
    "downstream comes from the controller, not the hardware list",
    model.downstreamSource === "controller" && model.downstreamTotal === 2,
  );
  check(
    "controller gateway is not green (we never measure it)",
    model.gateways[0].status === "unknown",
    model.gateways[0].status,
  );
  check(
    "unrecognised controller status is unknown",
    model.downstream.find((n) => n.kind === "switch")?.status === "unknown",
  );
  check(
    "connected AP is ok, with IP + clients facts",
    (() => {
      const ap = model.downstream.find((n) => n.kind === "ap");
      return (
        ap?.status === "ok" &&
        ap.facts.some((f) => f.key === "ip" && f.value === "10.0.0.5") &&
        ap.facts.some((f) => f.key === "clients" && f.value === "4")
      );
    })(),
  );
  const down = m.buildTopology({
    ...base,
    wan: { status: "empty" },
    liveness: lv(omada),
    hardware: [],
    controller: { status: "unreachable", loading: false, devices: [] },
    onlineGuests: 0,
  });
  check(
    "unreachable controller is said, not drawn as empty",
    down.downstreamState === "controller-unreachable",
  );
  check("...and rendered as such", /Controller not answering/.test(render(down)));
}

console.log("\n5. many APs collapse without hiding a fault");
{
  const many = Array.from({ length: 12 }, (_, i) => hw(String(i + 10), i === 11 ? "down" : "up"));
  const model = m.buildTopology({
    ...base,
    wan: { status: "empty" },
    liveness: lv([]),
    hardware: many,
    onlineGuests: null,
    maxDownstream: 6,
  });
  check("drawn nodes capped at 6", model.downstream.length === 6);
  check(
    "last node is +7 more",
    model.downstream[5].kind === "more" && model.downstream[5].count === 7,
  );
  check(
    "the down AP is drawn, not folded away",
    model.downstream.slice(0, 5).some((n) => n.status === "crit"),
  );
  check("total still counts all 12", model.downstreamTotal === 12);
}

console.error = origError;
console.log(
  failures === 0 ? "\ndashboard topology: all checks passed" : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
