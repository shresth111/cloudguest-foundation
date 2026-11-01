/**
 * PPPoE (lane JAZE-6, Phase 2b): the pure helpers in
 * `src/lib/isp-partner/pppoe.ts` (mirrors of the BE validators in
 * `pppoe_service.py` / `pppoe_script.py`) and the request shapes of
 * `src/services/isp-partner/pppoe.ts` against `pppoe_router.py`
 * (`PppoeCredentialBody` is extra=forbid; the script is text/plain).
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-pppoe.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-pppoe-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" ? undefined : a, cfg });
     return { data: { items: [], results: [] }, headers: {} };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), delete: rec("delete") };`,
);
const outfile = join(outdir, "pppoe.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/pppoe";
               export { pppoeService } from "@/services/isp-partner/pppoe";
               export { calls } from "@/services/api";`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "api-stub",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: stub }));
      },
    },
  ],
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
const last = () => m.calls[m.calls.length - 1];

console.log("validators (mirror pppoe_service.py)");
eq("username ok", m.usernameError("ravi.k@home-12"), null);
eq("username too short", typeof m.usernameError("ab"), "string");
eq("username space refused", typeof m.usernameError("ravi k"), "string");
eq("password ok", m.passwordError("Abcd1234!"), null);
eq("password 7 chars refused", typeof m.passwordError("Abc1234"), "string");
for (const bad of [" ", '"', "'", "\\", "$", "`"]) {
  eq(
    `password with ${JSON.stringify(bad)} refused`,
    typeof m.passwordError(`Abcd1234${bad}`),
    "string",
  );
}
eq("password non-ASCII refused", typeof m.passwordError("Abcd1234é"), "string");

console.log("credentialBody (only changed keys; extra=forbid)");
const KEYS = new Set(["username", "password", "generate_password", "static_ip", "ip_pool_name"]);
const blank = {
  username: "",
  passwordMode: "generate",
  password: "",
  static_ip: "",
  ip_pool_name: "",
};
const first = m.credentialBody(blank, null);
eq("create with blanks -> generate only (API defaults username)", first.body, {
  generate_password: true,
});
const cur = { username: "ravi", static_ip: null, ip_pool_name: null };
const same = m.credentialBody({ ...blank, username: "ravi", passwordMode: "keep" }, cur);
eq("no change -> empty body", same.body, {});
const changed = m.credentialBody(
  {
    username: "ravi2",
    passwordMode: "set",
    password: "Abcd1234!",
    static_ip: "10.0.0.5",
    ip_pool_name: "pool-a",
  },
  cur,
);
eq("changed fields sent", changed.body, {
  username: "ravi2",
  password: "Abcd1234!",
  static_ip: "10.0.0.5",
  ip_pool_name: "pool-a",
});
eq(
  "every key is a PppoeCredentialBody key",
  Object.keys(changed.body).every((k) => KEYS.has(k)),
  true,
);
eq(
  "clearing static IP sends null",
  m.credentialBody(
    { ...blank, username: "ravi", passwordMode: "keep" },
    { ...cur, static_ip: "10.0.0.5" },
  ).body,
  { static_ip: null },
);
eq(
  "blank username on edit refused",
  "error" in m.credentialBody({ ...blank, passwordMode: "keep" }, cur),
  true,
);
eq(
  "bad static IP refused",
  "error" in m.credentialBody({ ...blank, static_ip: "10.0.0" }, null),
  true,
);
eq(
  "bad pool name refused",
  "error" in m.credentialBody({ ...blank, ip_pool_name: "a b" }, null),
  true,
);
eq(
  "bad typed password refused",
  "error" in m.credentialBody({ ...blank, passwordMode: "set", password: "short" }, null),
  true,
);

console.log("scriptParams (mirror PppoeScriptParams.validated)");
const D = {
  interface: "bridge1",
  local_address: "100.64.0.1",
  pool_range: "100.64.0.10-100.64.3.254",
  pool_cidr: "100.64.0.0/22",
};
const E = { interface: "", local_address: "", pool_range: "", pool_cidr: "", dns_servers: "" };
eq("all blank -> no params (BE defaults)", m.scriptParams(E, D).params, {});
eq(
  "overrides kept, dns joined",
  m.scriptParams({ ...E, interface: "vlan20", dns_servers: " 1.1.1.1 , 8.8.8.8" }, D).params,
  { interface: "vlan20", dns_servers: "1.1.1.1,8.8.8.8" },
);
eq(
  "range outside cidr refused",
  "error" in m.scriptParams({ ...E, pool_range: "100.64.8.1-100.64.8.9" }, D),
  true,
);
eq(
  "range high-low refused",
  "error" in m.scriptParams({ ...E, pool_range: "100.64.0.20-100.64.0.10" }, D),
  true,
);
eq(
  "local outside cidr refused",
  "error" in m.scriptParams({ ...E, local_address: "10.0.0.1" }, D),
  true,
);
eq(
  "local inside the pool range refused",
  "error" in m.scriptParams({ ...E, local_address: "100.64.0.20" }, D),
  true,
);
eq("bad interface refused", "error" in m.scriptParams({ ...E, interface: "ether 1" }, D), true);
eq("bad dns refused", "error" in m.scriptParams({ ...E, dns_servers: "dns.google" }, D), true);
eq("ipv6 cidr refused", "error" in m.scriptParams({ ...E, pool_cidr: "fd00::/64" }, D), true);
eq("cidr /22 bounds", m.parseCidr("100.64.1.7/22"), [
  m.parseIpv4("100.64.0.0"),
  m.parseIpv4("100.64.3.255"),
]);

console.log("labels / roles");
eq(
  "script roles",
  ["isp-owner", "isp-admin", "isp-technician", "isp-billing"].map(m.canGetPppoeScript),
  [true, true, true, false],
);
eq("accepted label", m.authResultLabel("accepted"), "Accepted");
eq("never signed in", m.authResultLabel(null), "Never signed in");
eq("unknown reason readable", m.authResultLabel("max_sessions"), "Refused: max sessions");
eq("mac format", m.formatMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
eq("session seconds", m.sessionSeconds("2026-11-01T00:00:00Z", "2026-11-01T01:00:00Z"), 3600);
eq("kick summary none", m.kickSummary([]), "No live PPPoE session.");
eq(
  "kick summary partial",
  m.kickSummary([{ ended: true }, { ended: false }]).startsWith("1 ended, 1 not confirmed"),
  true,
);

console.log("request shapes (pppoe_router.py)");
const svc = m.pppoeService;
await svc.status();
eq("status path", last().url, "/isp/pppoe/status");
await svc.credential("s1");
eq("credential GET path", [last().method, last().url], ["get", "/isp/subscribers/s1/pppoe"]);
await svc.saveCredential("s1", { generate_password: true });
eq(
  "credential PUT",
  [last().method, last().url, last().body],
  ["put", "/isp/subscribers/s1/pppoe", { generate_password: true }],
);
await svc.setEnabled("s1", false);
eq("disable path", last().url, "/isp/subscribers/s1/pppoe/disable");
await svc.setEnabled("s1", true);
eq("enable path", last().url, "/isp/subscribers/s1/pppoe/enable");
await svc.disconnectSubscriber("s1");
eq("subscriber disconnect path", last().url, "/isp/subscribers/s1/pppoe/disconnect");
await svc.sessions({ status: "active", search: "", page: 1, page_size: 50 });
eq("sessions: blanks dropped", last().params, { status: "active", page: "1", page_size: "50" });
await svc.disconnectSession("p1");
eq("session disconnect path", last().url, "/isp/pppoe/sessions/p1/disconnect");
await svc.routerScript("r1", { interface: "vlan20" });
eq(
  "script path + params",
  [last().url, last().params],
  ["/isp/pppoe/routers/r1/script", { interface: "vlan20" }],
);
eq("script fetched as text", last().cfg.responseType, "text");

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
