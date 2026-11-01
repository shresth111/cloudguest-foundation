/**
 * Batch B4 guard (ADDENDUM_04: Security, Fix a Problem, Devices).
 *
 *   1. Every B4 call goes to an `/isp/venue/...` twin path that the backend
 *      B4 PR mounts (list below, kept in step with twins_security_ops.py).
 *   2. Nothing in B4 names the Wyfy firewall band (Master-only).
 *   3. The DNS policy calls use the id-free twin paths, never the customer's
 *      `/organizations/{id}/policy` / `/locations/{id}/policy`.
 *   4. The B4 slot file registers the five rows at priority 10.
 *
 * Run: node scripts/test-isp-partner-b4.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/venue-security.ts");
const pages = read("src/components/isp-partner/security-ops/B4Pages.tsx");
const slots = read("src/components/isp-partner/customer-shell/slots/b4-security-ops.tsx");

const TWINS = [
  /^\/security\/(overview|capabilities)$/,
  /^\/content-filter-rules(\/\$\{id\}(\/push)?)?$/,
  /^\/dns-filtering\/(categories|location-policy|routers\/\$\{routerId\}(\/\$\{[^}]+\})?)$/,
  /^\/firewall-rules(\/\$\{id\})?$/,
  /^\/firewall-rules\/routers\/\$\{routerId\}\/(push|flood-limit|guest-isolation)$/,
  /^\/network-diagnostics\/(runs|routers\/\$\{routerId\}\/\$\{kind\})$/,
  /^\/connected-devices(\/sync\/\$\{routerId\}|\/\$\{id\}\/disconnect)?$/,
  /^\/monitored-hardware(\/\$\{id\})?$/,
];
const calls = [...svc.matchAll(/`\$\{V\}([^`]*)`/g)].map((m) => m[1]);
check("service makes venue calls", calls.length >= 20, String(calls.length));
for (const c of calls)
  check(
    `twinned path ${c}`,
    TWINS.some((re) => re.test(c)),
  );
check("service builds every path on /isp/venue", /const V = "\/isp\/venue";/.test(svc));
check("no raw api path outside /isp/venue", !/api\.(get|post|put|delete)<?[^(]*\(\s*"\//.test(svc));
for (const [name, src] of [
  ["service", svc],
  ["pages", pages],
]) {
  check(`${name}: never calls the firewall band`, !/\/band\b/.test(src));
  check(`${name}: no WireGuard wording`, !/wireguard/i.test(src));
  check(`${name}: no customer store`, !/useCustomerStore/.test(src));
  check(
    `${name}: no customer DNS path-id policy routes`,
    !/organizations\/\$\{|locations\/\$\{/.test(src),
  );
}
for (const id of ["security", "blocking", "firewall", "debugging", "devices"]) {
  check(
    `slot ${id} registered at priority 10`,
    new RegExp(`id: "${id}", priority: 10`).test(slots),
  );
}

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
