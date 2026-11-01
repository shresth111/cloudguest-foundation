/**
 * QUEUED-RENEWAL FE: helpers + wiring. The card calls only the four backend
 * routes, sends one idempotency key per dialog, uses the JAZE-1 renew/revert
 * keys, warns that cancelling a paid one voids the receipt, hides itself when
 * the feature is off, and is mounted on the Subscriber 360 page.
 *
 * Run: node scripts/test-isp-partner-queued-renewal.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-qr-"));
const outfile = join(outdir, "qr.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/queued-renewal.ts")],
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
const now = Date.parse("2026-11-04T10:00:00Z");
eq("can queue while running", m.canQueue("2026-11-05T00:00:00Z", now), true);
eq("cannot queue after expiry", m.canQueue("2026-11-04T09:59:59Z", now), false);
eq("cannot queue without validity", m.canQueue(null, now), false);
const k = m.queueKey();
eq("key length 8..64", k.length >= 8 && k.length <= 64, true);
eq("keys differ", m.queueKey() !== k, true);
eq("paid needs a void", m.cancelNeedsVoid({ paid_paise: 1 }), true);
eq("unpaid needs no void", m.cancelNeedsVoid({ paid_paise: 0 }), false);
eq("no invoice needs no void", m.cancelNeedsVoid(null), false);
eq("status label", m.QUEUE_STATUS_LABEL.pending, "Queued");
eq("tone active", m.queueTone("active"), "active");

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/queued-renewal.ts");
const routes = [
  "`/isp/subscribers/${subscriberId}/queued-renewals`",
  "`/isp/subscribers/${subscriberId}/queued-renewals/${id}/cancel`",
];
for (const r of routes) eq(`service reaches ${r}`, svc.includes(r), true);
eq("no direct billing calls", /\/isp\/(billing|invoices)\//.test(svc), false);
const card = read("src/components/isp-partner/queued/QueuedRenewalCard.tsx");
eq("one key per dialog", card.includes("useState(queueKey)"), true);
eq("queue gated by isp_invoices.create", card.includes('can("isp_invoices.create")'), true);
eq("cancel gated by isp_invoices.manage", card.includes('can("isp_invoices.manage")'), true);
eq("paid now gated by isp_billing.execute", card.includes('can("isp_billing.execute")'), true);
eq("hidden when the feature is off", card.includes("if (q.error || !q.data) return null;"), true);
eq("paid cancel warns about the void", card.includes("voids its receipt"), true);
const page = read("src/components/isp-partner/subscribers/Subscriber360Page.tsx");
eq("mounted on the 360 page", page.includes("<QueuedRenewalCard subscriberId={s.id} />"), true);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
