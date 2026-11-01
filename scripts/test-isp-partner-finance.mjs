/**
 * `/isp/finance/*` request shapes (lane JAZE-4), pinned against
 * `finance_router.py`. The JAZE-1 P0 was a `date` param fed `toISOString()`;
 * here `/finance/zones/revenue` takes `date_from/date_to: date`, so those
 * must be plain YYYY-MM-DD in the local calendar day.
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-finance.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-finance-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" ? undefined : a });
     return { data: { items: [], queued: [], url: "" }, headers: {} };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "finance.mjs");
await build({
  stdin: {
    contents: `export { financeService } from "@/services/isp-partner/finance";
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
const svc = m.financeService;
const calls = m.calls;

let failures = 0;
let checks = 0;
const ok = (name, cond, extra = "") => {
  checks += 1;
  if (!cond) failures += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` -- ${extra}`}`);
};
const last = () => calls[calls.length - 1];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

await svc.zoneRevenue("2026-11-01", "2026-11-30");
ok("zone revenue: path", last().url === "/isp/finance/zones/revenue");
ok(
  "zone revenue: date_from/date_to are plain dates",
  DATE.test(last().params.date_from) && DATE.test(last().params.date_to),
  JSON.stringify(last().params),
);
await svc.tds();
ok("tds: no fy param when omitted", !("fy" in last().params));
await svc.tds("26-27");
ok("tds: fy YY-YY", /^\d{2}-\d{2}$/.test(last().params.fy));

await svc.endLease("lease-1");
ok("end lease: empty body without a date", JSON.stringify(last().body) === "{}");
await svc.endLease("lease-1", "2026-11-30");
ok("end lease: active_until plain date", DATE.test(last().body.active_until));

await svc.emailInvoice("inv-1", "both", "");
ok("email: POST /finance/invoices/{id}/email", last().url === "/isp/finance/invoices/inv-1/email");
ok(
  "email: blank message omitted (max_length, extra=forbid)",
  last().body.send_to === "both" && last().body.message === undefined,
);

await svc.pricePreview({ amount_paise: 49900, price_includes_gst: false });
ok("price preview: no empty state code", !("place_of_supply_state_code" in last().params));

await svc.messages({ page: 2 });
ok(
  "messages: page_size within 1..100",
  String(last().params.page_size) === "25" && String(last().params.page) === "2",
);

await svc.publicPay("a/b c");
ok("public pay: token is path-encoded", last().url === "/isp/public/pay/a%2Fb%20c");

// The UI's own "today" default for the revenue range must be the local day,
// not the UTC day (toISOString) -- the same class of bug as the P0.
const page = readFileSync(join(ROOT, "src/components/isp-partner/finance/FinancePage.tsx"), "utf8");
ok(
  "FinancePage: no toISOString().slice(0, 10) date defaults",
  !/toISOString\(\)\.slice\(0,\s*10\)/.test(page),
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
