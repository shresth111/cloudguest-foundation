/**
 * F1-F3 guard (ADDENDUM_04, coordinator defaults) for the partner console.
 *
 *   1. The customer's Marketing page is mounted unchanged and every call its
 *      services make is under /marketing/ (covered by one twinned prefix) or a
 *      known pass-through, so nothing reaches a customer endpoint unrewritten.
 *   2. The ISP messaging calls are ISP routes only.
 *   3. Provider forms reuse the customer form's secret rule (never prefilled).
 *   4. The Messaging nav item and the Guest Messaging slot are registered.
 *
 * Run: node scripts/test-isp-partner-f13.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
check("shim twins every /marketing/ path", shim.includes("/^\\/marketing(\\/|$)/,"));
check(
  "shim answers /me/entitlements via the venue twin",
  shim.includes("/^\\/me\\/entitlements$/,"),
);

const mk = readdirSync(resolve(ROOT, "src/services"))
  .filter((f) => f.startsWith("marketing") && f.endsWith(".ts"))
  .map((f) => read(join("src/services", f)))
  .join("\n");
const paths = [...mk.matchAll(/[`"](\/[a-z][^`"?$]*)/g)].map((m) => m[1]);
// /platform/* are the Master console's marketing services, never called by
// the customer view; /me/permissions and /support-tickets fail closed (the
// view then offers everything / hides the BYO request button).
const ALLOWED = [
  /^\/marketing(\/|$)/,
  /^\/me\/permissions$/,
  /^\/support-tickets/,
  /^\/platform\//,
];
const bad = paths.filter((p) => !ALLOWED.some((re) => re.test(p)));
check("marketing services call only /marketing/*", bad.length === 0, bad.join(", "));

const svc = read("src/services/isp-partner/messaging.ts");
const ispCalls = [...svc.matchAll(/api\.(?:get|put|post|delete)<?[^(]*\(\s*[`"]([^`"]+)[`"]/g)].map(
  (m) => m[1],
);
check("messaging service makes calls", ispCalls.length >= 9, String(ispCalls.length));
check(
  "messaging calls are ISP routes",
  ispCalls.every((p) => p.startsWith("/isp/")),
  ispCalls.join(","),
);

const pages = read("src/components/isp-partner/messaging/MessagingPages.tsx");
check(
  "customer MarketingView mounted unchanged",
  /import\("@\/components\/marketing\/MarketingView"\)/.test(pages),
);
check(
  "provider form uses the shared secret rule",
  /initialProviderValues\(/.test(pages) && /buildProviderPut\(/.test(pages),
);
check(
  "secrets are password inputs, never prefilled",
  /type=\{f\.secret \? "password" : "text"\}/.test(pages),
);
check("SMS DLT stays the ISP's", /DLT registration/.test(pages));
check("no customer store", !/useCustomerStore/.test(pages + svc));

const shell = read("src/components/isp-partner/PartnerShell.tsx");
check("Messaging nav item", /to: "\/partner\/messaging"[^}]*isp_engage\.read/.test(shell));
const slots = read("src/components/isp-partner/customer-shell/slots/b6-addons.tsx");
check(
  "Guest Messaging slot",
  /id: "marketing", priority: 10, component: GuestMessagingPage/.test(slots),
);

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
