/**
 * BE-HARDEN "Sync now" (partner console): the toast text, and source guards:
 * the button posts to /isp/subscribers/sync, is gated on the route's own key
 * (isp_subscribers.update), refetches both subscriber lists, and is mounted
 * on the Subscribers directory and Plans -> Subscribers.
 *
 * Run: node scripts/test-isp-partner-sync-now.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = Object.is(got, want);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${got}, want ${want}`}`);
};
const has = (name, text, needle) => eq(name, text.includes(needle), true);

const btn = src("src/components/isp-partner/subscribers/SyncNowButton.tsx");
const svc = src("src/services/isp-partner/plans.ts");
has(
  "service posts to the BE-HARDEN route",
  svc,
  'api.post<{ applied: number }>("/isp/subscribers/sync")',
);
has("gated on the route's key", btn, 'if (!can("isp_subscribers.update")) return null;');
has("toast shows the count", btn, "toast.success(syncToast(r.applied))");
has("refetches the 360 directory", btn, 'queryKey: ["isp", "sub360"]');
has("refetches Plans -> Subscribers", btn, 'queryKey: ["isp", "plans", "subscribers"]');
// ERROR-COPY: failures toast through ispToastError (worded, with a support reference).
has("failure toasts", btn, "ispToastError(");
// the toast text (pure; copied by regex from the component so it stays in sync)
const lib = src("src/lib/isp-partner/sync-now.ts");
const body = lib.match(/export function syncToast\(applied: number\): string \{([\s\S]*?)\n\}/)[1];
const syncToast = new Function("applied", body);
eq("0 says up to date", syncToast(0), "Up to date: no new coupon sign-ins to add.");
eq("1 is singular", syncToast(1), "Synced 1 subscriber.");
eq("n is counted", syncToast(7), "Synced 7 subscribers.");
for (const p of [
  "src/components/isp-partner/subscribers/SubscriberDirectoryPage.tsx",
  "src/components/isp-partner/plans/SubscribersTab.tsx",
]) {
  has(`${p.split("/").pop()} mounts Sync now`, src(p), "<SyncNowButton />");
}

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
