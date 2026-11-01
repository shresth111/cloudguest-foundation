/**
 * LEFTOVERS #8: service methods that had no screen. Request shapes are
 * pinned against the backend routers (finance_router.py, plans_router.py),
 * and the static checks pin where each one is mounted, plus the verdict for
 * the ones left unused on purpose (superseded by another call).
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-unused-services.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-unused-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" ? undefined : a });
     return { data: { items: [], held_paise: 0, default_validity_days: 30 }, headers: {} };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "svc.mjs");
await build({
  stdin: {
    contents: `export { financeService } from "@/services/isp-partner/finance";
               export { plansService } from "@/services/isp-partner/plans";
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
const fin = m.financeService;
const plans = m.plansService;
const calls = m.calls;

let failures = 0;
let checks = 0;
const ok = (name, cond, extra = "") => {
  checks += 1;
  if (!cond) failures += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` -- ${extra}`}`);
};
const last = () => calls[calls.length - 1];
const read = (p) => readFileSync(join(ROOT, "src", p), "utf8");

console.log("request shapes");
await fin.contact("subscriber", "sub-1");
ok(
  "contact: GET /finance/contacts/{kind}/{id}",
  last().method === "get" && last().url === "/isp/finance/contacts/subscriber/sub-1",
  last().url,
);
await fin.saveContact("customer", "org-1", {
  alternate_email: "",
  alternate_name: null,
  exclude_from_reminders: true,
});
ok(
  "saveContact: PUT, ContactRequest keys only (extra=forbid)",
  last().method === "put" &&
    last().url === "/isp/finance/contacts/customer/org-1" &&
    Object.keys(last().body).every((k) =>
      ["alternate_email", "alternate_name", "exclude_from_reminders", "whatsapp_opt_in"].includes(
        k,
      ),
    ),
  JSON.stringify(last()),
);
await fin.deposits({ subscriber_id: "sub-1" });
ok(
  "deposits: subscriber row sends subscriber_id only",
  last().url === "/isp/finance/deposits" &&
    last().params.subscriber_id === "sub-1" &&
    !("isp_customer_id" in last().params),
  JSON.stringify(last().params),
);
await fin.deposits({ isp_customer_id: "org-1" });
ok(
  "deposits: customer row sends isp_customer_id only",
  last().params.isp_customer_id === "org-1" && !("subscriber_id" in last().params),
  JSON.stringify(last().params),
);
await fin.pricePreview({ amount_paise: 150000, price_includes_gst: true });
ok(
  "price preview: amount_paise + price_includes_gst, no empty state code",
  last().url === "/isp/finance/price-preview" &&
    String(last().params.amount_paise) === "150000" &&
    String(last().params.price_includes_gst) === "true" &&
    !("place_of_supply_state_code" in last().params),
  JSON.stringify(last().params),
);
await plans.putPlanSettings({ default_validity_days: 28 });
ok(
  "plan settings: PUT /isp/plan-settings {default_validity_days}",
  last().method === "put" &&
    last().url === "/isp/plan-settings" &&
    JSON.stringify(last().body) === '{"default_validity_days":28}',
  JSON.stringify(last()),
);

console.log("mounts");
const panels = read("components/isp-partner/finance/FinanceExtrasPanels.tsx");
const finance = read("components/isp-partner/finance/FinancePage.tsx");
const sub360 = read("components/isp-partner/subscribers/Subscriber360Page.tsx");
const custBilling = read("components/isp-partner/billing/CustomerBillingTab.tsx");
const pkgTab = read("components/isp-partner/plans/PackagesTab.tsx");
const planBtn = read("components/isp-partner/plans/PlanSettingsButton.tsx");
ok(
  "panels: contact + saveContact called",
  /financeService\.contact\(/.test(panels) && /financeService\.saveContact\(/.test(panels),
);
ok("panels: deposits called", /financeService\.deposits\(/.test(panels));
ok("panels: pricePreview called", /financeService\.pricePreview\(/.test(panels));
ok(
  "panels: contact card hides on 404 (flag off)",
  /isNotFound\(q\.error\)\) return null/.test(panels),
);
ok("panels: contact read gated on isp_billing.read", /can\("isp_billing\.read"\)/.test(panels));
ok("panels: contact edit gated on isp_billing.manage", /can\("isp_billing\.manage"\)/.test(panels));
ok("panels: whatsapp_opt_in is not sent (GET never returns it)", !/whatsapp_opt_in/.test(panels));
ok(
  "360: billing contact card for the subscriber",
  /<BillingContactCard kind="subscriber"/.test(sub360),
);
ok(
  "customer billing: billing contact card for the customer",
  /<BillingContactCard kind="customer"/.test(custBilling),
);
ok(
  "finance: lease dialog shows the price preview",
  /<LeasePricePreview amount=\{form\.amount\} incl=\{form\.incl\}/.test(finance),
);
ok(
  "finance: deposits tab mounts the history dialog",
  /<DepositHistoryDialog target=\{history\}/.test(finance),
);
ok("plans: PackagesTab mounts PlanSettingsButton", /<PlanSettingsButton \/>/.test(pkgTab));
ok("plans: putPlanSettings called", /plansService\.putPlanSettings\(/.test(planBtn));
ok(
  "plans: button gated on isp_plans.update + loaded value",
  /can\("isp_plans\.update"\) \|\| !settings\.data\) return null/.test(planBtn),
);

console.log("intentionally unused (superseded)");
const zonesLib = read("lib/isp-partner/zones.ts");
ok(
  "zones subtree: tree() + zoneDescendantIds cover it",
  /export function zoneDescendantIds/.test(zonesLib),
);
const fiberTypes = read("services/isp-partner/fiber-types.ts");
ok(
  "fiber route: node detail and subscriber location carry route[]",
  (fiberTypes.match(/route: FiberRouteHop\[\]/g) ?? []).length >= 2,
);
const netPanel = read("components/isp-partner/network/SubscriberNetworkPanel.tsx");
ok("nextFree: pool list's next_free + empty IP = auto-pick", /pool\.next_free/.test(netPanel));
const plansLib = read("lib/isp-partner/plans.ts");
ok(
  "suggestName: previewPackageName computes it locally",
  /export function previewPackageName/.test(plansLib) && /previewPackageName\(/.test(pkgTab),
);
const actions = read("components/isp-partner/subscribers/SubscriberActions.tsx");
ok("putProfile: already called by the 360 profile dialog", /svc\.putProfile\(/.test(actions));

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
