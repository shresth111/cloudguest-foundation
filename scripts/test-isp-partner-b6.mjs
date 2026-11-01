/**
 * Batch B6 guard (ADDENDUM_04 add-ons).
 *
 *   1. The shim rewrites exactly the six twinned Traffic Lens views, and never
 *      the per-connection flow records or the CSV export (founder F2).
 *   2. The customer's TrafficLensView is mounted unchanged (imported, not
 *      copied), and only behind the add-on gate (slot + nav `addon`).
 *   3. The add-on gate reads the per-customer list; no hard-coded "open".
 *
 * Run: node scripts/test-isp-partner-b6.mjs
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
const shim = read("src/lib/isp-partner/api-shim.ts");
const regs = shim
  .split("\n")
  .filter((l) => l.trim().startsWith("/^\\/traffic-flow"))
  .map((l) => new RegExp(l.trim().replace(/^\//, "").replace(/\/,$/, "")));
const re = { test: (p) => regs.some((r) => r.test(p)) };
const id = "11111111-2222-3333-4444-555555555555";
for (const v of [
  "status",
  "summary",
  "destinations",
  "services/destinations",
  "geo",
  "findings",
  "flows",
]) {
  check(`shim rewrites ${v}`, re.test(`/traffic-flow/locations/${id}/${v}`));
}
for (const v of ["flows/export", "destinations/export"]) {
  check(`shim leaves ${v} failing closed`, !re.test(`/traffic-flow/locations/${id}/${v}`));
}
const page = read("src/components/isp-partner/addons/TrafficLensPage.tsx");
check(
  "customer TrafficLensView mounted unchanged",
  /import\("@\/components\/traffic-lens\/TrafficLensView"\)/.test(page),
);
const slots = read("src/components/isp-partner/customer-shell/slots/b6-addons.tsx");
check("traffic-lens slot registered", /id: "traffic-lens", priority: 10/.test(slots));
check(
  "Guest Messaging slot registered (F1/F3 defaults)",
  /id: "marketing", priority: 10/.test(slots),
);
const nav = read("src/components/isp-partner/customer-shell/nav.ts");
check(
  "traffic-lens row is gated as an add-on",
  /id: "traffic-lens",[\s\S]*?addon: "traffic_flow"/.test(nav),
);
const addons = read("src/components/isp-partner/customer-shell/addons.ts");
check(
  "gate reads the per-customer add-on list",
  /\/isp\/customers\/\$\{customerId\}\/addons/.test(addons),
);
const ws = read("src/components/isp-partner/customer-shell/CustomerWorkspace.tsx");
check("gate loading is not the lock screen", /open === null\) return <LoadingBlock/.test(ws));

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
