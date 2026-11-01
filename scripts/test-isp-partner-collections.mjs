/**
 * COLLECTIONS-1 FE (`src/lib/isp-partner/collections.ts`) + wiring:
 * helpers, every backend route reached and nothing else, cash goes through
 * the collections endpoint with an Idempotency-Key (never a direct
 * /isp/billing/payments post), plain dates, the nav gate, the flag-off
 * state, and no self-approval of a handover.
 *
 * Run: node scripts/test-isp-partner-collections.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-coll-"));
const outfile = join(outdir, "coll.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/collections.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
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
const rupees = (p) => `₹${p / 100}`;

// helpers ------------------------------------------------------------------
eq("band tone high", m.bandTone("high"), "overdue");
eq("band tone medium", m.bandTone("medium"), "warning");
eq("promise tone kept", m.promiseTone("kept"), "paid");
eq("promise tone broken", m.promiseTone("broken"), "overdue");
eq("promise date today ok", m.promiseDateError("2026-11-04", "2026-11-04"), null);
eq("promise date +60 ok", m.promiseDateError("2027-01-03", "2026-11-04"), null);
eq("promise date +61 refused", typeof m.promiseDateError("2027-01-04", "2026-11-04"), "string");
eq("promise date past refused", typeof m.promiseDateError("2026-11-03", "2026-11-04"), "string");
eq(
  "promise date ISO datetime refused",
  typeof m.promiseDateError("2026-11-04T18:30:00Z", "2026-11-04"),
  "string",
);
eq("handover today ok", m.handoverDateError("2026-11-04", "2026-11-04"), null);
eq("handover -31 ok", m.handoverDateError("2026-10-04", "2026-11-04"), null);
eq("handover -32 refused", typeof m.handoverDateError("2026-10-03", "2026-11-04"), "string");
eq("handover future refused", typeof m.handoverDateError("2026-11-05", "2026-11-04"), "string");
eq("difference matches", m.differenceText(0, rupees), "matches");
eq("difference short", m.differenceText(-10000, rupees), "₹100 short");
eq("difference over", m.differenceText(5000, rupees), "₹50 over");
eq("tel 10 digits", m.telHref("98765 43210"), "tel:+919876543210");
eq("tel with 91", m.telHref("+91 98765 43210"), "tel:+919876543210");
eq("tel too short", m.telHref("12345"), null);
eq("party subscriber", m.partyOf({ subscriber_id: "s", isp_customer_id: "c" }), {
  subscriber_id: "s",
});
eq("party customer", m.partyOf({ subscriber_id: null, isp_customer_id: "c" }), {
  isp_customer_id: "c",
});
const k1 = m.newIdempotencyKey();
const k2 = m.newIdempotencyKey();
eq("idempotency key unique", k1 !== k2 && k1.startsWith("coll-") && k1.length <= 100, true);
eq("event label", m.eventLabel("promise_broken"), "Promise missed");
eq("event label fallback", m.eventLabel("some_new_kind"), "some new kind");
eq("percent", m.percent(0.6), "60%");

// wiring -------------------------------------------------------------------
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/collections.ts");
const BE_ROUTES = [
  "`${BASE}/overdue`",
  "`${BASE}/forecast`",
  "`${BASE}/subscribers/${party.subscriber_id}/timeline`",
  "`${BASE}/customers/${party.isp_customer_id}/timeline`",
  "`${BASE}/notes`",
  "`${BASE}/promises`",
  "`${BASE}/promises/${id}/cancel`",
  "`${BASE}/cash`",
  "`${BASE}/payments/${paymentId}/slip.pdf`",
  "`${BASE}/cash/mine`",
  "`${BASE}/handovers`",
  "`${BASE}/handovers/${id}`",
  "`${BASE}/handovers/${id}/approve`",
  "`${BASE}/handovers/${id}/reject`",
];
for (const r of BE_ROUTES) eq(`service reaches ${r}`, svc.includes(r), true);
eq('base is "/isp/collections"', svc.includes('const BASE = "/isp/collections";'), true);
const used = new Set(svc.match(/`\$\{BASE\}[^`]*`/g) ?? []);
eq(
  "no route outside the backend list",
  [...used].filter((u) => !BE_ROUTES.includes(u)),
  [],
);
eq(
  "cash never posts to /isp/billing/payments",
  /billing\/payments/.test(svc.replace(/^\s*\*.*$/gm, "")),
  false,
);
eq("cash sends Idempotency-Key", svc.includes('"Idempotency-Key": idempotencyKey'), true);

const drawer = read("src/components/isp-partner/collections/PartyDrawer.tsx");
eq("one key per cash dialog", drawer.includes("useState(newIdempotencyKey)"), true);
eq("cash gated by collect", drawer.includes('can("isp_collections.collect")'), true);
eq("note/promise gated by update", drawer.includes('can("isp_collections.update")'), true);
eq("promise date is a plain day", drawer.includes("promised_on: day"), true);

const cash = read("src/components/isp-partner/collections/CashTab.tsx");
eq("no self-approval offered", cash.includes("h.collector.id !== me?.user.id"), true);
eq("send back needs a note", cash.includes("disabled={!note.trim() || reject.isPending}"), true);

const page = read("src/components/isp-partner/collections/CollectionsPage.tsx");
eq("flag off says not switched on", page.includes("Collections is not switched on"), true);
eq("cash tab only for collectors/approvers", page.includes('can("isp_collections.collect")'), true);

const shell = read("src/components/isp-partner/PartnerShell.tsx");
eq(
  "nav item gated by isp_collections.read",
  /to: "\/partner\/collections",[\s\S]{0,120}anyOf: \["isp_collections\.read"\]/.test(shell),
  true,
);
const tree = read("src/routeTree.gen.ts");
eq("route registered", tree.includes("'/partner/collections'"), true);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
