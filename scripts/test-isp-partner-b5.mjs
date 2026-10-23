/**
 * Batch B5 guard (ADDENDUM_04: Alerts, Support Tickets, Staff Activity,
 * How It Works).
 *
 *   1. Every call is an ISP route the B5 backend mounts.
 *   2. No call reaches an alert-RULE by-id route (open path-id defect upstream).
 *   3. The four slots are registered; the guide never names WireGuard.
 *
 * Run: node scripts/test-isp-partner-b5.mjs
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
const svc = read("src/services/isp-partner/monitor-support.ts");
const pages = read("src/components/isp-partner/monitor-support/B5Pages.tsx");
const slots = read("src/components/isp-partner/customer-shell/slots/b5-monitor-support.tsx");

const ROUTES = [
  /^\/isp\/venue\/alerts(\/\$\{id\}\/(acknowledge|resolve))?$/,
  /^\/isp\/venue\/alert-rules$/,
  /^\/isp\/alerts$/,
  /^\/isp\/support-tickets(\/\$\{ticketId\}\/replies)?$/,
  /^\/isp\/staff-activity$/,
];
const calls = [...svc.matchAll(/api\.(?:get|post|put|delete)<?[^(]*\(\s*[`"]([^`"]+)[`"]/g)].map(
  (m) => m[1],
);
check("service makes calls", calls.length >= 9, String(calls.length));
for (const c of calls)
  check(
    `mounted B5 route ${c}`,
    ROUTES.some((re) => re.test(c)),
  );
check("no alert-rule by-id route", !/alerts\/rules/.test(svc + pages));
for (const id of ["alerts", "tickets", "admin-logs", "how-it-works"]) {
  check(`slot ${id} registered`, new RegExp(`id: "${id}", priority: 10`).test(slots));
}
check("no WireGuard wording", !/wireguard/i.test(pages));
check("no customer store", !/useCustomerStore/.test(pages + svc));

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
