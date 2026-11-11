/**
 * IPLOGS-SELFSERVE FE: labels/tones, the 404 -> null rule (flag off = card
 * and strip render nothing), the endpoints the service calls (must match the
 * backend's `iplogs_router.py`), partner wording in the new UI, and the three
 * one-line mount points.
 *
 * Run: node scripts/test-isp-partner-iplogs.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-iplogs-"));
const outfile = join(outdir, "iplogs.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/iplogs.ts")],
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
const read = (p) => readFileSync(join(ROOT, p), "utf8");

// labels + tones ----------------------------------------------------------
const STATES = [
  "logs_arriving",
  "waiting",
  "not_set_up",
  "offline",
  "silent",
  "needs_link",
  "not_supported",
  "partial", // [POSTFIX-1] D12
];
const PIPES = ["receiving", "silent", "awaiting_first", "not_set_up", "collector_off"];
eq(
  "every overall state has a short label",
  STATES.filter((s) => !m.IP_LOGS_STATE_SHORT[s]),
  [],
);
eq("summary order covers every state", [...m.IP_LOGS_SUMMARY_ORDER].sort(), [...STATES].sort());
eq(
  "every pipe state has a label",
  PIPES.filter((s) => !m.IP_LOGS_PIPE_STATE_LABEL[s]),
  [],
);
eq("arriving is green", m.ipLogsStateTone("logs_arriving"), "online");
eq("offline is red", m.ipLogsStateTone("offline"), "offline");
eq("partial is not green (D12)", m.ipLogsStateTone("partial"), "warning");
eq("receiving pipe is green", m.ipLogsPipeTone("receiving"), "online");
eq("silent pipe warns", m.ipLogsPipeTone("silent"), "warning");

// service paths = backend routes ------------------------------------------
const svc = read("src/services/isp-partner/iplogs.ts");
for (const path of [
  "/isp/routers/${ispRouterId}/ip-logs`",
  "/isp/routers/${ispRouterId}/ip-logs/script`",
  "/isp/routers/${ispRouterId}/ip-logs/enable`",
  "/isp/routers/${ispRouterId}/ip-logs/disable`",
  '"/isp/ip-logs/routers"',
]) {
  eq(`service calls ${path}`, svc.includes(path), true);
}
eq("fleet filter is isp_customer_id", svc.includes("isp_customer_id: ispCustomerId"), true);

// flag off: 404 resolves to null, and both components render nothing then
const hooks = read("src/hooks/isp-partner/useIpLogs.ts");
eq("404 -> null", /ispErrorStatus\(e\) === 404\) return null/.test(hooks), true);
const step = read("src/components/isp-partner/routers/PartnerIpLogsStep.tsx");
eq("card hidden on null", step.includes("q.data === null) return null"), true);
const strip = read("src/components/isp-partner/log-views/IpLogsStatusStrip.tsx");
eq(
  "strip hidden on null/empty",
  strip.includes("if (!data || data.items.length === 0) return null"),
  true,
);
eq("script needs isp_partner.execute", step.includes('can("isp_partner.execute")'), true);

// partner wording: never the tunnel technology -----------------------------
for (const [name, src] of [
  ["PartnerIpLogsStep", step],
  ["IpLogsStatusStrip", strip],
  ["iplogs lib", read("src/lib/isp-partner/iplogs.ts")],
]) {
  const text = src.replace(/^\s*(\*|\/\/|\/\*\*).*$/gm, "");
  eq(`${name}: no WireGuard / tunnel wording`, /wireguard|tunnel/i.test(text), false);
}

// mount points (one line each) ---------------------------------------------
eq(
  "router page mounts the card",
  /<PartnerIpLogsStep\s+routerId=\{routerId\}/.test(
    read("src/components/isp-partner/routers/RouterDetailPage.tsx"),
  ),
  true,
);
eq(
  "NetLogs page mounts the strip",
  read("src/components/isp-partner/log-views/LogsPage.tsx").includes("<IpLogsStatusStrip />"),
  true,
);
eq(
  "Compliance mounts the strip on the NAT / trace / LEA / retention tabs",
  read("src/components/isp-partner/compliance/CompliancePage.tsx").includes(
    '{["nat", "trace", "lea", "retention"].includes(tab) && <IpLogsStatusStrip />}',
  ),
  true,
);

// DEFAULT-LOGS: the "IP logs: ON / OFF" switch ------------------------------
eq("switch: set_up counts as on", m.ipLogsSwitchOn({ set_up: true }), true);
eq(
  "switch: wanted (no rows yet) is on",
  m.ipLogsSwitchOn({ set_up: false, switch_on: true }),
  true,
);
eq("switch: off", m.ipLogsSwitchOn({ set_up: false, switch_on: false }), false);
const st = (o) => ({ set_up: false, switch_on: false, wanted: null, blocker: null, ...o });
eq("prompt for a router added before the default (never asked)", m.ipLogsNeedsPrompt(st({})), true);
eq("no prompt once the ISP chose off", m.ipLogsNeedsPrompt(st({ wanted: false })), false);
eq("no prompt when on", m.ipLogsNeedsPrompt(st({ switch_on: true, wanted: true })), false);
eq("no prompt for a non-MikroTik", m.ipLogsNeedsPrompt(st({ blocker: "not_mikrotik" })), false);
for (const on of [true, false])
  for (const link of [true, false]) {
    const c = m.ipLogsConfirmCopy(on, link);
    eq(
      `confirm copy ${on ? "ON" : "OFF"}/${link ? "no link" : "link"} is complete`,
      [!!c.title, !!c.body, c.confirm],
      [true, true, on ? "Turn ON" : "Turn OFF"],
    );
    eq(
      `result copy ${on ? "ON" : "OFF"}/${link ? "no link" : "link"}`,
      /setup script/.test(m.ipLogsResultCopy(on, link)),
      link,
    );
  }
const sw = read("src/components/isp-partner/routers/IpLogsSwitch.tsx");
const routerPage = read("src/components/isp-partner/routers/RouterDetailPage.tsx");
const table = read("src/components/isp-partner/routers/RoutersTable.tsx");
const drawer = read("src/components/isp-partner/routers/RouterFormDrawer.tsx");
for (const [name, src] of [
  ["IpLogsSwitch", sw],
  ["PartnerIpLogsStep", step],
]) {
  const text = src.replace(/^\s*(\*|\/\/|\/\*\*).*$/gm, "");
  eq(`${name}: no browser confirm()`, /window\.confirm/.test(text), false);
  eq(`${name}: no WireGuard / tunnel wording`, /wireguard|tunnel/i.test(text), false);
}
eq(
  "switch is a real switch",
  sw.includes('role="switch"') && sw.includes("aria-checked={on}"),
  true,
);
eq("switch label IP logs: ON / OFF", sw.includes('`IP logs: ${on ? "ON" : "OFF"}`'), true);
eq("switch asks first (in-app dialog)", (sw.match(/<MDialog/g) ?? []).length, 2);
eq("switch uses the same enable/disable routes", sw.includes("useIpLogsToggle(routerId)"), true);
eq("switch needs isp_partner.execute", sw.includes('can("isp_partner.execute")'), true);
eq("switch never bubbles to a row click", sw.includes("e.stopPropagation()"), true);
eq("OFF shows the removal script", sw.includes('mode={result.on ? "enable" : "disable"}'), true);
eq(
  "router page: switch at the top",
  routerPage.includes("<HeaderIpLogsSwitch routerId={routerId} />"),
  true,
);
eq(
  "router page: Generate folds IP logs only when the probe answers",
  routerPage.includes(
    "partnerIpLogsLines={ipLogsFeatures.data?.setup_script_lines ? ipLogsLines : undefined}",
  ),
  true,
);
eq(
  "routers list: IP logs column only with fleet data",
  table.includes("{ipLogs && <MTh>IP logs</MTh>}"),
  true,
);
eq(
  "Add router: switch on by default",
  drawer.includes("useState(true)") && drawer.includes("IP logs (recommended)"),
  true,
);
eq(
  "Add router: ip_logs sent only when offered",
  drawer.includes("...(ipLogsOffered ? { ip_logs: ipLogs } : {})"),
  true,
);
eq("service: features probe", svc.includes('"/isp/ip-logs/features"'), true);
// FR-IPLOGS-ZONE: a franchisee's switch is read-only outside its zones.
eq(
  "switch: read-only when the backend says can_change false",
  sw.includes("status.can_change === false") && sw.includes("!outsideZones"),
  true,
);
eq("switch: plain note outside zones", sw.includes("This router is not in your zones"), true);
eq("service: can_change typed", svc.includes("can_change?: boolean"), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
