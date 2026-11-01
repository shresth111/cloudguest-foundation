/**
 * REFERRAL-1 FE: helpers + wiring. Only the backend referral routes are
 * called, no money call is made from the page, settings are owner/admin only,
 * the page says when the flag is off, nav + route are registered.
 *
 * Run: node scripts/test-isp-partner-referrals.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-ref-"));
const outfile = join(outdir, "ref.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/referrals.ts")],
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
const base = { enabled: true, reward_paise: 10000, max_rewards_per_year: 12, window_days: 30 };
eq("valid settings", m.settingsError(base), null);
eq("on without reward refused", typeof m.settingsError({ ...base, reward_paise: 0 }), "string");
eq("off with zero reward ok", m.settingsError({ ...base, enabled: false, reward_paise: 0 }), null);
eq("reward cap", typeof m.settingsError({ ...base, reward_paise: 1_000_001 }), "string");
eq("bad rupees", typeof m.settingsError({ ...base, reward_paise: null }), "string");
eq("window 0 refused", typeof m.settingsError({ ...base, window_days: 0 }), "string");
eq(
  "per year 366 refused",
  typeof m.settingsError({ ...base, max_rewards_per_year: 366 }),
  "string",
);
eq("same subscriber", m.sameSubscriber("a", "a"), true);
eq("different subscribers", m.sameSubscriber("a", "b"), false);
eq("tone applied", m.referralTone("applied"), "paid");
eq("statuses", m.REFERRAL_STATUSES, ["pending", "earned", "applied", "rejected", "cancelled"]);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/referrals.ts");
for (const r of [
  '"/isp/referrals"',
  "`/isp/referrals/${id}/cancel`",
  '"/isp/referrals/settings"',
]) {
  eq(`service reaches ${r}`, svc.includes(r), true);
}
eq("no billing/invoice calls", /\/isp\/(billing|invoices)/.test(svc), false);
const page = read("src/components/isp-partner/referrals/ReferralsPage.tsx");
eq("flag off says so", page.includes("Referrals are not switched on"), true);
eq(
  "settings editable only with manage",
  page.includes('canEdit={can("isp_referrals.manage")}'),
  true,
);
eq("record only with create", page.includes('can("isp_referrals.create")'), true);
const shell = read("src/components/isp-partner/PartnerShell.tsx");
eq(
  "nav gated by isp_referrals.read",
  /to: "\/partner\/referrals",[\s\S]{0,120}anyOf: \["isp_referrals\.read"\]/.test(shell),
  true,
);
eq("route registered", read("src/routeTree.gen.ts").includes("'/partner/referrals'"), true);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
