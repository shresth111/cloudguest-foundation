/**
 * P3-SWEEP (partner console):
 * - inventory edit: only changed fields are sent, required fields are never
 *   emptied, a technician bag needs its technician (lib/isp-partner/inventory-edit);
 * - ISP-wide queued renewals: URL search parsing, request params, filters
 *   (lib/isp-partner/queued-list) and the service call;
 * - Subscriber 360 cards: collections / referrals summaries
 *   (lib/isp-partner/sub360-cards) and the referrals subscriber filter;
 * - source guards: where each piece is mounted, the keys and flag-off hiding,
 *   and no window.prompt left in the checkout queue (GAP #20).
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-p3-sweep.mjs
 */
import { build } from "esbuild";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-p3-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" ? undefined : a });
     return { data: { items: [], total: 0, page: 1, page_size: 50 }, headers: {} };
   };
   export const requestErrorOf = () => null;
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "p3.mjs");
await build({
  stdin: {
    contents: `export * as edit from "@/lib/isp-partner/inventory-edit";
               export * as ql from "@/lib/isp-partner/queued-list";
               export * as cards from "@/lib/isp-partner/sub360-cards";
               export { NAV_FLAG_PATHS } from "@/lib/isp-partner/nav-flags";
               export { queuedRenewalService } from "@/services/isp-partner/queued-renewal";
               export { referralsService } from "@/services/isp-partner/referrals";
               export { appsService } from "@/services/isp-partner/apps";
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
const src = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  const ok = a === b;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${a}, want ${b}`}`);
};
const has = (name, text, needle) => eq(name, text.includes(needle), true);
const lacks = (name, text, needle) => eq(name, text.includes(needle), false);

// ------------------------------------------------------------ inventory edit
console.log("inventory edit");
const item = { name: "ONT", sku: "ont-1", category: "ont", notes: null };
const d0 = m.edit.itemDraft(item);
eq("item draft: null notes -> empty", d0.notes, "");
eq("unchanged item sends nothing", m.edit.itemPatch(item, d0), { body: {} });
eq("nothingChanged on an empty body", m.edit.nothingChanged(m.edit.itemPatch(item, d0)), true);
eq("rename trims and sends only the name", m.edit.itemPatch(item, { ...d0, name: "  GPON ONT " }), {
  body: { name: "GPON ONT" },
});
eq("empty name refused", "error" in m.edit.itemPatch(item, { ...d0, name: "  " }), true);
eq("empty SKU refused", "error" in m.edit.itemPatch(item, { ...d0, sku: "" }), true);
eq(
  "notes typed then cleared is null",
  m.edit.itemPatch({ ...item, notes: "old" }, { ...d0, notes: " " }),
  { body: { notes: null } },
);
eq("category change", m.edit.itemPatch(item, { ...d0, category: "router" }), {
  body: { category: "router" },
});
const loc = {
  name: "Store",
  kind: "warehouse",
  holder_user_id: null,
  address: null,
  active: true,
};
const l0 = m.edit.locationDraft(loc);
eq("unchanged location sends nothing", m.edit.locationPatch(loc, l0), { body: {} });
eq(
  "bag without technician refused",
  "error" in m.edit.locationPatch(loc, { ...l0, kind: "technician_bag" }),
  true,
);
eq(
  "bag with technician sends kind + holder",
  m.edit.locationPatch(loc, { ...l0, kind: "technician_bag", holder: "u1" }),
  { body: { kind: "technician_bag", holder_user_id: "u1" } },
);
eq("mark not in use", m.edit.locationPatch(loc, { ...l0, active: false }), {
  body: { active: false },
});
eq("empty location name refused", "error" in m.edit.locationPatch(loc, { ...l0, name: "" }), true);

// ----------------------------------------------------------- queued renewals
console.log("queued renewals list");
const U = "0b8c1a3e-1111-4c2a-9d6e-0123456789ab";
eq("empty search", m.ql.parseQueuedSearch({}), {});
eq(
  "valid search kept",
  m.ql.parseQueuedSearch({ status: "all", q: " ravi ", package: U, within: "7", page: "3" }),
  { status: "all", q: "ravi", package: U, within: 7, page: 3 },
);
eq(
  "junk dropped (bad status, non-uuid package, odd within, page 1)",
  m.ql.parseQueuedSearch({ status: "bogus", package: "x", within: "5", page: "1" }),
  {},
);
eq("default query is pending page 1", m.ql.queuedListQuery({}), {
  status: "pending",
  page: 1,
  page_size: 50,
});
eq(
  "query maps URL names to API names",
  m.ql.queuedListQuery({ status: "cancelled", q: "a", package: U, within: 30, page: 2 }),
  {
    status: "cancelled",
    q: "a",
    package_id: U,
    starts_within_days: 30,
    page: 2,
    page_size: 50,
  },
);
eq("hasFilters: default view", m.ql.hasFilters({}), false);
eq("hasFilters: status pending is default", m.ql.hasFilters({ status: "pending" }), false);
eq("hasFilters: search", m.ql.hasFilters({ q: "x" }), true);
eq("pagesOf", [m.ql.pagesOf(0), m.ql.pagesOf(50), m.ql.pagesOf(51)], [1, 1, 2]);

m.calls.length = 0;
await m.queuedRenewalService.list(m.ql.queuedListQuery({ q: "ravi", within: 7 }));
eq("list hits the ISP-wide route", m.calls[0]?.url, "/isp/queued-renewals");
eq("list params (empty ones dropped)", m.calls[0]?.params, {
  status: "pending",
  q: "ravi",
  starts_within_days: "7",
  page: "1",
  page_size: "50",
});
eq(
  "nav probe key = the list route's key",
  m.NAV_FLAG_PATHS["/partner/queued-renewals"],
  "isp_subscribers.read",
);

// --------------------------------------------------------------- 360 cards
console.log("Subscriber 360 cards");
const ev = (o) => ({ detail: {}, at: "2026-11-01T10:00:00Z", actor: null, body: "", ...o });
const tl = {
  items: [
    ev({ id: "1", source: "billing", kind: "payment" }),
    ev({ id: "2", source: "collections", kind: "promise_kept" }),
    ev({ id: "3", source: "collections", kind: "note", body: "Will pay Friday" }),
    ev({ id: "4", source: "collections", kind: "note", body: "older" }),
  ],
  promises: [],
  open_promise: null,
  overdue_paise: 5000,
  open_paise: 9000,
};
const cs = m.cards.collectionsSummary(tl);
eq("open dues from open_paise", cs.openPaise, 9000);
eq("overdue", cs.overduePaise, 5000);
eq("last note = newest collections note", cs.lastNote?.id, "3");
eq(
  "old backend without open_paise -> null (shown as not available)",
  m.cards.collectionsSummary({ ...tl, open_paise: undefined }).openPaise,
  null,
);
const party = (id) => ({ subscriber_id: id, label: id, identifier: id });
const ref = (id, from, to, status, applied = null) => ({
  id,
  referrer: party(from),
  referred: party(to),
  status,
  applied_paise: applied,
});
const sides = m.cards.referralSides(
  [
    ref("r1", "me", "x", "applied", 10000),
    ref("r2", "me", "y", "pending"),
    ref("r3", "old", "me", "cancelled"),
    ref("r4", "p", "me", "earned"),
  ],
  "me",
);
eq("referred by = the live one", sides.referredBy?.id, "r4");
eq(
  "referred list",
  sides.referred.map((r) => r.id),
  ["r1", "r2"],
);
eq("credited sum", sides.creditedPaise, 10000);
eq(
  "only a cancelled inbound -> still shown",
  m.cards.referralSides([ref("r3", "old", "me", "cancelled")], "me").referredBy?.id,
  "r3",
);
m.calls.length = 0;
await m.referralsService.list({ subscriber_id: "S1" });
eq("referrals list passes subscriber_id", m.calls[0]?.params, {
  page_size: 50,
  subscriber_id: "S1",
});

// ------------------------------------------------------ inventory services
m.calls.length = 0;
await m.appsService.patchItem("I1", { name: "x" });
await m.appsService.patchLocation("L1", { active: false });
eq(
  "item / location PATCH routes",
  m.calls.map((c) => `${c.method} ${c.url}`),
  ["patch /isp/apps/inventory/items/I1", "patch /isp/apps/inventory/locations/L1"],
);

// ------------------------------------------------------------ source guards
console.log("source guards");
const tab = src("src/components/isp-partner/apps/InventoryTab.tsx");
const admin = src("src/components/isp-partner/apps/InventoryAdmin.tsx");
const editUi = src("src/components/isp-partner/apps/InventoryEdit.tsx");
has("items table opens the edit dialog", tab, "<EditItemDialog item={editing}");
has("items Edit only for managers", tab, "{c.manage && (");
has("locations table opens the edit dialog", admin, "<EditLocationDialog location={editing}");
has("edit dialog patches the item", editUi, "appsService.patchItem(item.id, body)");
has("edit dialog patches the location", editUi, "appsService.patchLocation(location.id,");
has(
  "unit links hide locations not in use",
  tab,
  ".filter((l) => l.active || l.id === unit.location_id)",
);
lacks("no window.prompt in the checkout queue (GAP #20)", admin, "window.prompt(");
has("reject asks in a dialog", admin, "<RejectCheckoutDialog");

const shell = src("src/components/isp-partner/PartnerShell.tsx");
has("nav item for queued renewals", shell, 'to: "/partner/queued-renewals"');
const navHook = src("src/hooks/isp-partner/useNavFlags.ts");
has(
  "flag-off probe for queued renewals",
  navHook,
  '"/partner/queued-renewals": () => queuedRenewalService.list(',
);
eq("route file exists", existsSync(join(ROOT, "src/routes/partner.queued-renewals.tsx")), true);
has("route registered", src("src/routeTree.gen.ts"), "'/partner/queued-renewals'");
const page = src("src/components/isp-partner/queued/QueuedRenewalsPage.tsx");
has("page says when the flag is off", page, "Queued renewals are not switched on");
has("cancel only with isp_invoices.manage", page, 'can("isp_invoices.manage")');
has("cancel reuses the 360 dialog", page, "<CancelDialog");
has(
  "360 card refresh covers the ISP-wide list",
  src("src/components/isp-partner/queued/QueuedRenewalCard.tsx"),
  'qc.invalidateQueries({ queryKey: ["isp", "queued"] });',
);

const s360 = src("src/components/isp-partner/subscribers/Subscriber360Page.tsx");
has("360 mounts the collections card", s360, "<SubscriberCollectionsCard subscriberId={s.id} />");
has("360 mounts the referrals card", s360, "<SubscriberReferralsCard subscriberId={s.id} />");
const extra = src("src/components/isp-partner/subscribers/Sub360ExtraCards.tsx");
has("collections card needs its key", extra, 'can("isp_collections.read")');
has("referrals card needs its key", extra, 'can("isp_referrals.read")');
eq(
  "both cards hide on error / flag off",
  (extra.match(/if \(!allowed \|\| q\.error \|\| !q\.data\) return null;/g) ?? []).length,
  2,
);
lacks("cards are read-only (no mutations)", extra, "useMutation");

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
