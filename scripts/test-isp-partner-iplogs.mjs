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
  read("src/components/isp-partner/routers/RouterDetailPage.tsx").includes(
    "<PartnerIpLogsStep routerId={routerId} />",
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

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
