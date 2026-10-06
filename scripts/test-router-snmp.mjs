/**
 * Master console SNMP panel: mapping, honest presentation, and the wiring
 * rules around it.
 *
 * WHAT THIS LOCKS DOWN
 * --------------------
 *  1. NEVER "WORKING" WITHOUT A SUCCESSFUL POLL. Enabled-but-never-polled is
 *     "Waiting for first poll"; a vendor the platform cannot poll (Omada,
 *     Instant On, anything unassessed) is never shown as working, and an
 *     unrecognised `support` value maps to "unknown", not "supported".
 *  2. NO FABRICATED VALUES. A missing time or uptime renders "—".
 *  3. SECRETS ARE WRITE-ONLY. A blank secret box is not sent (it would
 *     otherwise wipe or overwrite the stored one), v2c never sends v3
 *     fields and vice versa.
 *  4. MASTER ONLY. No customer-facing module imports the SNMP lib, service,
 *     hook or panel.
 *  5. THE PASTE SCRIPT NEVER TOUCHES /snmp. SNMP is turned on by the
 *     platform over the RouterOS API after enrollment; the backend's parity
 *     test covers the writer and the renderer, this covers the third path.
 *  6. EVERY VENDOR GETS THE PANEL, so Omada/Instant On are told why, rather
 *     than the feature silently missing.
 *
 * Run: node scripts/test-router-snmp.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "router-snmp-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/router-snmp.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);

const base = {
  router_id: "r1",
  vendor: "mikrotik",
  support: "supported",
  support_reason: "RouterOS has a standard SNMP agent.",
  metrics_via: null,
  enabled: true,
  version: "2c",
  port: 161,
  has_community: true,
  uses_platform_default_community: false,
  allowed_sources: ["172.31.38.118/32"],
  poll_interval_seconds: 300,
  last_poll_at: null,
  last_poll_status: null,
  last_poll_detail: null,
  last_success_at: null,
  device_applied_at: null,
};
const st = (over) => m.toSnmpStatus({ ...base, ...over });

// 1. headline honesty
check("enabled-never-polled-is-waiting", m.snmpHeadline(st({})).label === "Waiting for first poll");
check("ok-poll-is-working", m.snmpHeadline(st({ last_poll_status: "ok" })).label === "Working");
check(
  "no-response-is-red",
  m.snmpHeadline(st({ last_poll_status: "no_response" })).tone === "offline",
);
check(
  "disabled-is-off",
  m.snmpHeadline(st({ enabled: false, last_poll_status: "ok" })).label === "Off",
);
for (const support of ["not_supported", "not_reachable", "unknown", "something-new"]) {
  const h = m.snmpHeadline(st({ support, last_poll_status: "ok" }));
  check(`${support}-never-working`, h.label !== "Working" && h.tone === "muted");
}
check("unrecognised-support-maps-unknown", st({ support: "yes-please" }).support === "unknown");
check(
  "unrecognised-poll-status-maps-null",
  st({ last_poll_status: "great" }).lastPollStatus === null,
);
check("null-status-not-checked", m.snmpHeadline(null).label === "Not checked");

// 2. no fabricated values
check("when-null-dash", m.whenText(null) === "—");
check("when-garbage-dash", m.whenText("not-a-date") === "—");
check("uptime-null-dash", m.uptimeText(null) === "—");
check("uptime-real", m.uptimeText(90_061) === "1d 1h");
check(
  "when-relative",
  m.whenText("2026-10-06T10:00:00Z", new Date("2026-10-06T10:10:00Z")) === "10 min ago",
);
const t = m.toSnmpTestResult({ ok: false, status: "no_response", identity: null });
check("failed-test-has-no-identity", t.sysName === null && t.uptimeSeconds === null && !t.ok);

// 3. write-only secrets
const b1 = m.toSnmpConfigBody({ enabled: true, version: "2c", community: "   " });
check("blank-community-not-sent", !("community" in b1));
const b2 = m.toSnmpConfigBody({
  version: "2c",
  community: "abc123x",
  v3Username: "u",
  v3AuthPassword: "authpass1",
});
check(
  "v2c-sends-no-v3",
  b2.community === "abc123x" && !("v3_username" in b2) && !("v3_auth_password" in b2),
);
const b3 = m.toSnmpConfigBody({
  version: "3",
  community: "abc123x",
  v3Username: "wyfy",
  v3AuthPassword: "authpass1",
  v3PrivPassword: "",
  v3AuthProtocol: "SHA1",
});
check("v3-sends-no-community", !("community" in b3) && b3.v3_username === "wyfy");
check("v3-blank-priv-not-sent", !("v3_priv_password" in b3));
check("enabled-false-is-sent", m.toSnmpConfigBody({ enabled: false }).enabled === false);
const s0 = st({ has_community: false });
check("enable-needs-community", m.missingForEnable(s0, { version: "2c" }) !== null);
check("enable-ok-with-typed-community", m.missingForEnable(s0, { community: "abcdef1" }) === null);
check(
  "enable-v3-needs-passphrase",
  m.missingForEnable(s0, { version: "3", v3Username: "wyfy" }) !== null,
);
check(
  "platform-default-counts",
  m.missingForEnable(st({ has_community: false, uses_platform_default_community: true }), {}) ===
    null,
);

// apply result mapping
const a = m.toSnmpApplyResult({
  action: "apply",
  verified: false,
  mismatches: ["agent:enabled"],
  state: { agent_enabled: false, default_public_open: true },
});
check("apply-unverified-kept", a.verified === false && a.mismatches[0] === "agent:enabled");
check("apply-state-mapped", a.state?.defaultPublicOpen === true && a.state.agentEnabled === false);
check("mismatch-text-plain", m.mismatchText("agent:enabled").includes("still off"));

// ---------------------------------------------------------------------------
// Source rules
// ---------------------------------------------------------------------------

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(join(ROOT, "src"));
const ALLOWED_IMPORTERS = new Set([
  "src/components/master/RouterSnmpPanel.tsx",
  "src/services/router-snmp.service.ts",
  "src/hooks/useRouterSnmp.ts",
  "src/routes/master.routers.tsx",
]);
const importers = files
  .filter((f) =>
    /from "@\/(lib\/router-snmp|services\/router-snmp\.service|hooks\/useRouterSnmp|components\/master\/RouterSnmpPanel)"/.test(
      readFileSync(f, "utf8"),
    ),
  )
  .map((f) => relative(ROOT, f));
const strays = importers.filter((f) => !ALLOWED_IMPORTERS.has(f));
check("snmp-modules-master-only", strays.length === 0, strays.join(", "));
check("panel-is-mounted", importers.includes("src/routes/master.routers.tsx"));

// 5. the paste/first-setup script paths never touch /snmp
const setupPaths = files.filter((f) => {
  const r = relative(ROOT, f);
  return (
    r === "src/components/routers/RouterDetailTabs.tsx" ||
    r === "src/components/routers/RouterSetupScriptAdvanced.tsx" ||
    r.startsWith("src/components/routers/guided-setup/") ||
    r.startsWith("src/components/routers/manual-wizard/") ||
    r.startsWith("src/components/routers/fleet-wizard/")
  );
});
check("setup-paths-found", setupPaths.length >= 5, String(setupPaths.length));
const touchesSnmp = setupPaths.filter((f) => /\/snmp\b/.test(readFileSync(f, "utf8")));
check(
  "paste-script-never-touches-snmp",
  touchesSnmp.length === 0,
  touchesSnmp.map((f) => relative(ROOT, f)).join(", "),
);

// 6. every vendor gets the panel (not gated on controller-managed)
const drawer = readFileSync(join(ROOT, "src/routes/master.routers.tsx"), "utf8");
check(
  "panel-for-every-vendor",
  /\{!demo && <RouterSnmpPanel routerId=\{sel\.id\}/.test(drawer),
  "the panel must not be hidden for Omada/Instant On; it explains why there is no SNMP",
);

// The panel never renders a secret: the status type carries no secret field.
const lib = readFileSync(join(ROOT, "src/lib/router-snmp.ts"), "utf8");
const statusBlock = lib.slice(
  lib.indexOf("export interface RouterSnmpStatus"),
  lib.indexOf("export interface RouterSnmpTestResult"),
);
check("status-type-has-no-secret", !/\b(community|password|passphrase)\s*:/i.test(statusBlock));
const panel = readFileSync(join(ROOT, "src/components/master/RouterSnmpPanel.tsx"), "utf8");
check("secret-inputs-are-password-type", (panel.match(/type="password"/g) || []).length >= 3);
check("no-modal-dialog-in-drawer", !/AlertDialog/.test(panel.replace(/\/\*[\s\S]*?\*\//g, "")));

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
