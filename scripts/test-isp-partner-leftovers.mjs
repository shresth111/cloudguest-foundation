/**
 * LEFTOVERS FE: lead -> onboarding prefill (`formFromLead`, `lead_id` in the
 * built body), the thermal payment slip request, and static checks on where
 * they are mounted. `@/services/api` is replaced with a recorder.
 * BULKBAR: the directory bulk bar is hidden with nothing ticked, "all
 * matching" takes two steps, and Block / Move above 10 need a typed confirm.
 *
 * Run: node scripts/test-isp-partner-leftovers.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-left-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a) => {
     calls.push({ method, url, params: a?.params });
     return { data: new Blob(["x"]), headers: {} };
   };
   export const requestErrorOf = () => null;
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "left.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/onboarding";
               export * from "@/lib/isp-partner/bulkbar";
               export { financeService } from "@/services/isp-partner/finance";
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

const LEAD = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Asha  Kumari Devi",
  phone: "9876500009",
  email: null,
  address: "12 Main Rd",
  city: "Jaipur",
  latitude: 26.9,
  longitude: null,
  isp_customer_id: "22222222-2222-2222-2222-222222222222",
  interested_package_id: null,
};

console.log("lead prefill");
const pre = m.formFromLead(LEAD);
eq("names split", [pre.first_name, pre.last_name], ["Asha", "Kumari Devi"]);
eq("lead id carried", pre.lead_id, LEAD.id);
eq(
  "empty lead fields not written",
  ["email" in pre, "longitude" in pre, "package_id" in pre],
  [false, false, false],
);
eq(
  "address to billing + install",
  [pre.address, pre.install_address, pre.billing_city],
  ["12 Main Rd", "12 Main Rd", "Jaipur"],
);
eq("customer kept", pre.isp_customer_id, LEAD.isp_customer_id);

const ctx = {
  features: { pppoe: false, static_ip: false, kyc: false, install_task: true },
  can: { kyc: false, invoice: false, pay: false },
};
const f = { ...m.emptyOnboardForm(), ...pre, package_id: "p1", identifier: "asha-1" };
const built = m.buildOnboarding(f, ctx);
eq("built ok", "error" in built, false);
eq("lead_id sent", built.body.lead_id, LEAD.id);
const plain = m.buildOnboarding(
  {
    ...m.emptyOnboardForm(),
    isp_customer_id: "c",
    package_id: "p",
    identifier: "abc",
    first_name: "A",
    phone: "9876500001",
  },
  ctx,
);
eq("no lead -> no lead_id key", "error" in plain ? plain.error : "lead_id" in plain.body, false);

console.log("thermal receipt");
await m.financeService.thermalReceipt("PAY1", 80);
eq(
  "slip GET",
  [m.calls.at(-1).method, m.calls.at(-1).url],
  ["get", "/isp/finance/payments/PAY1/thermal.pdf"],
);

console.log("static");
const tables = readFileSync(
  join(ROOT, "src/components/isp-partner/billing/BillingTables.tsx"),
  "utf8",
);
eq(
  "slip on non-voided payments",
  /p\.status !== "voided" && <ThermalReceiptButton/.test(tables),
  true,
);
const dlg = readFileSync(
  join(ROOT, "src/components/isp-partner/billing/BillingDialogs.tsx"),
  "utf8",
);
eq(
  "slip hidden while finance tools are off",
  /if \(!probe\.isSuccess\) return null;[\s\S]*thermalReceipt/.test(dlg),
  true,
);
const route = readFileSync(join(ROOT, "src/routes/partner.subscribers.new.tsx"), "utf8");
eq("route validates lead_id as a uuid", /\^\[0-9a-f-\]\{36\}\$/.test(route), true);
const leads = readFileSync(join(ROOT, "src/components/isp-partner/apps/LeadsTab.tsx"), "utf8");
eq("leads link to onboarding", /search=\{\{ lead_id: l\.id \}\}/.test(leads), true);

// BULKBAR (founder-approved proposal #3): directory bulk bar rules.
eq("bulk bar hidden with 0 selected", m.bulkBarVisible(0), false);
eq("bulk bar shown with 1 selected", m.bulkBarVisible(1), true);
const pageOnly = { scope: "selected", allOnPage: false, selectedCount: 3, total: 1234 };
const pageAll = { scope: "selected", allOnPage: true, selectedCount: 25, total: 1234 };
eq(
  "all-matching not offered before the page is ticked",
  m.canOfferSelectAllMatching(pageOnly),
  false,
);
eq("one click cannot jump to all-matching", m.scopeAfterSelectAllMatching(pageOnly), "selected");
eq(
  "all-matching offered after ticking the page (step 1)",
  m.canOfferSelectAllMatching(pageAll),
  true,
);
eq("step 2 switches to the filter", m.scopeAfterSelectAllMatching(pageAll), "filter");
eq(
  "not offered when the page is everything",
  m.canOfferSelectAllMatching({ ...pageAll, total: 25 }),
  false,
);
eq(
  "not offered with nothing ticked",
  m.canOfferSelectAllMatching({ ...pageAll, selectedCount: 0 }),
  false,
);
eq("block 11 needs a typed confirm", m.needsTypedConfirm("block", 11), true);
eq("block 10 does not", m.needsTypedConfirm("block", 10), false);
eq("move 11 needs a typed confirm", m.needsTypedConfirm("move", 11), true);
eq("unblock 500 keeps a normal confirm", m.needsTypedConfirm("unblock", 500), false);
eq("unfreeze 500 keeps a normal confirm", m.needsTypedConfirm("unfreeze", 500), false);
eq("no apply without a dry run", m.canApply("unblock", null, ""), false);
eq("no apply when nobody is eligible", m.canApply("freeze", { eligible: 0 }, ""), false);
eq("block 11: blank confirm refused", m.canApply("block", { eligible: 11 }, ""), false);
eq("block 11: wrong count refused", m.canApply("block", { eligible: 11 }, "12"), false);
eq("block 11: count accepted", m.canApply("block", { eligible: 11 }, " 11 "), true);
eq(
  "block 1234: Indian-grouped count accepted",
  m.canApply("block", { eligible: 1234 }, "1,234"),
  true,
);
eq("block 11: the word accepted", m.canApply("block", { eligible: 11 }, "block"), true);
eq("block 11: another word refused", m.canApply("block", { eligible: 11 }, "MOVE"), false);
eq("freeze 50 applies after the dry run", m.canApply("freeze", { eligible: 50 }, ""), true);
eq("destructive set", [...m.DESTRUCTIVE_ACTIONS].sort(), ["block", "freeze", "move", "renew"]);
{
  const page = readFileSync(
    join(ROOT, "src/components/isp-partner/subscribers/SubscriberDirectoryPage.tsx"),
    "utf8",
  );
  const bar = readFileSync(
    join(ROOT, "src/components/isp-partner/subscribers/DirectoryBulkBar.tsx"),
    "utf8",
  );
  eq(
    "page mounts the bar only when bulkBarVisible",
    /barOpen = dir2\.available && bulkBarVisible\(selected\.size\)/.test(page) &&
      /\{barOpen && \(\s*<DirectoryBulkBar/.test(page),
    true,
  );
  eq("bar is keyed by the filters", /key=\{filterKey\}/.test(page), true);
  eq(
    "filter change clears the selection",
    /useEffect\(\(\) => \{\s*setSelected\(new Set\(\)\);\s*\}, \[filterKey\]\)/.test(page),
    true,
  );
  eq(
    "export stays available without a selection",
    /<DirectoryExportButtons filter=\{dirFilter\} \/>/.test(page),
    true,
  );
  eq(
    "apply button gated by canApply",
    /disabled=\{busy \|\| !canApply\(action, preview, typed\)\}/.test(bar),
    true,
  );
  eq(
    "success clears the selection",
    /onDone=\{done\}/.test(bar) && /const done = \(\) => \{[^}]*onClear\(\)/.test(bar),
    true,
  );
  eq(
    "all-matching label uses the dry-run count",
    /Select all \$\{matched\.toLocaleString/.test(bar) && /dry_run: true/.test(bar),
    true,
  );
  eq(
    "bottom sheet on a phone, inline from sm",
    /fixed inset-x-0 bottom-0/.test(bar) && /sm:static/.test(bar),
    true,
  );
  eq("no always-on scope select left", /All matching the filters<\/option>/.test(bar), false);
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
