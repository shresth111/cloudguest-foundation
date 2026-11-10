/**
 * RAKESH-P1: the short "New plan" form (template first, Unlimited / FUP,
 * device rules from the template) and the template device-rules dialog.
 * Pins `src/lib/isp-partner/p1-plan.ts` and the flag-off paths in the
 * existing Plans tabs (old form, no new button).
 *
 * Run: node scripts/test-isp-partner-p1.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-p1-"));
const entry = join(outdir, "entry.ts");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/isp-partner/p1-plan.ts"))};`,
);
const outfile = join(outdir, "p1.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
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

const base = () => ({ ...m.emptyPlanForm(30), groupId: "g1", price: "499" });
const rules = {
  speed_group_id: "g1",
  configured: true,
  max_devices: 3,
  mac_bind_count: 2,
  mac_restriction: true,
  max_simultaneous: 2,
};

// defaults
eq("new plan is Unlimited", m.emptyPlanForm(30).kind, "unlimited");
eq("FUP resets monthly by default", m.emptyPlanForm(30).rules.fup_reset, "month");
eq("validity from settings", m.emptyPlanForm(28).validity, "28");

// template device rules
const withR = m.withTemplateRules(base(), rules);
eq("template devices copied", withR.devices, "3");
eq("template bind copied", withR.rules.mac_bind_count, "2");
eq("template restriction copied", withR.rules.mac_restriction, true);
eq("template online copied", withR.rules.max_simultaneous, "2");
eq("matches template", m.matchesTemplateRules(withR, rules), true);
eq(
  "edited devices no longer match",
  m.matchesTemplateRules({ ...withR, devices: "4" }, rules),
  false,
);
eq(
  "unconfigured template leaves the form alone",
  m.withTemplateRules(base(), { ...rules, configured: false }).devices,
  "1",
);
eq("no template rules leaves the form alone", m.withTemplateRules(base(), undefined).devices, "1");

// unlimited
const u = m.planToBodies(withR, { gb: true });
eq("unlimited ok", u.ok, true);
eq("unlimited sends no FUP", u.ok && u.policy.fup_limit_mb, null);
eq("unlimited sends no fallback", u.ok && u.policy.fup_fallback_speed_group_id, null);
eq(
  "device rules reach the policy",
  u.ok && [u.policy.mac_bind_count, u.policy.mac_restriction, u.policy.max_simultaneous],
  [2, true, 2],
);
eq("device limit reaches the package", u.ok && u.pkg.max_devices, 3);
eq("price in paise", u.ok && u.pkg.price_paise, 49900);
eq("no hotspot hard cap from the short form", u.ok && u.pkg.data_cap_mb, null);
eq("validity from activation by default", u.ok && u.policy.validity_starts, "activation");
const stale = {
  ...withR,
  rules: { ...withR.rules, fup_limit_mb: "100", fup_fallback_speed_group_id: "g2" },
};
eq(
  "unlimited clears leftover FUP inputs",
  m.planToBodies(stale, { gb: true }).ok && m.planToBodies(stale, { gb: true }).policy.fup_limit_mb,
  null,
);

// first login
const fl = m.planToBodies({ ...withR, firstLogin: true }, { gb: true });
eq("first login -> validity_starts", fl.ok && fl.policy.validity_starts, "first_login");

// FUP
const fupNoFallback = m.planToBodies(
  { ...withR, kind: "fup", rules: { ...withR.rules, fup_limit_mb: "100" } },
  { gb: true },
);
eq("FUP needs the speed after the limit", fupNoFallback.ok, false);
eq(
  "FUP fallback error named",
  !fupNoFallback.ok && !!fupNoFallback.errors.fup_fallback_speed_group_id,
  true,
);
const fupNoLimit = m.planToBodies(
  { ...withR, kind: "fup", rules: { ...withR.rules, fup_fallback_speed_group_id: "g2" } },
  { gb: true },
);
eq("FUP needs a limit", !fupNoLimit.ok && !!fupNoLimit.errors.fup_limit_mb, true);
const fupSame = m.planToBodies(
  {
    ...withR,
    kind: "fup",
    rules: { ...withR.rules, fup_limit_mb: "100", fup_fallback_speed_group_id: "g1" },
  },
  { gb: true },
);
eq("FUP fallback must differ from the plan template", fupSame.ok, false);
const fup = m.planToBodies(
  {
    ...withR,
    kind: "fup",
    rules: {
      ...withR.rules,
      fup_limit_mb: "100",
      fup_reset: "day",
      fup_fallback_speed_group_id: "g2",
      fup_exclude_upload: true,
      fup_carry_forward: true,
    },
  },
  { gb: true },
);
eq("FUP ok", fup.ok, true);
eq("FUP 100 GB -> MB (DECISIONS-1: 1 GB = 1000 MB)", fup.ok && fup.policy.fup_limit_mb, 100_000);
eq("FUP daily", fup.ok && fup.policy.fup_reset, "day");
eq(
  "FUP download only + carry forward",
  fup.ok && [fup.policy.fup_exclude_upload, fup.policy.fup_carry_forward],
  [true, true],
);
const fupMb = m.planToBodies(
  {
    ...withR,
    kind: "fup",
    rules: { ...withR.rules, fup_limit_mb: "2048", fup_fallback_speed_group_id: "g2" },
  },
  { gb: false },
);
eq("MB mode (workflow flag off) sends MB as typed", fupMb.ok && fupMb.policy.fup_limit_mb, 2048);

// validation
eq("template required", m.planToBodies({ ...base(), groupId: "" }, { gb: true }).ok, false);
eq("bad price refused", m.planToBodies({ ...base(), price: "abc" }, { gb: true }).ok, false);
eq("validity 0 refused", m.planToBodies({ ...base(), validity: "0" }, { gb: true }).ok, false);
eq(
  "online at once above the device limit refused",
  m.planToBodies(
    { ...base(), devices: "1", rules: { ...base().rules, max_simultaneous: "2" } },
    { gb: true },
  ).ok,
  false,
);
eq(
  "suggested name is not sent",
  m.planToBodies(base(), { gb: true }).ok && m.planToBodies(base(), { gb: true }).pkg.name,
  null,
);

// summaries
eq("Unlimited summary", m.planKindSummary(null), "Unlimited");
eq(
  "FUP summary",
  m.planKindSummary({ fup_limit_mb: 100_000, fup_reset: "month" }, "2 Mbps"),
  "FUP 100 GB a month, then 2 Mbps",
);
eq("validity summary", m.validitySummary(30, true), "30 days · from first login");
eq("validity summary 1 day", m.validitySummary(1, false), "1 day");
eq(
  "device summary",
  m.deviceRulesSummary(rules),
  "3 devices · first 2 bound · bound devices only · 2 online at once",
);

// template rules dialog
const ok = m.rulesFormToBody({
  max_devices: "3",
  mac_bind_count: "2",
  mac_restriction: true,
  max_simultaneous: "",
});
eq("rules ok, empty online = no limit", ok.ok && ok.body, {
  max_devices: 3,
  mac_bind_count: 2,
  mac_restriction: true,
  max_simultaneous: null,
});
eq(
  "bound only needs a bound device",
  m.rulesFormToBody({
    max_devices: "3",
    mac_bind_count: "0",
    mac_restriction: true,
    max_simultaneous: "",
  }).ok,
  false,
);
eq(
  "online above limit refused",
  m.rulesFormToBody({
    max_devices: "2",
    mac_bind_count: "0",
    mac_restriction: false,
    max_simultaneous: "3",
  }).ok,
  false,
);
eq(
  "devices 51 refused",
  m.rulesFormToBody({
    max_devices: "51",
    mac_bind_count: "0",
    mac_restriction: false,
    max_simultaneous: "",
  }).ok,
  false,
);
eq(
  "bind 17 refused",
  m.rulesFormToBody({
    max_devices: "5",
    mac_bind_count: "17",
    mac_restriction: false,
    max_simultaneous: "",
  }).ok,
  false,
);

// flag-off paths in the existing tabs (source checks)
const pk = readFileSync(join(ROOT, "src/components/isp-partner/plans/PackagesTab.tsx"), "utf8");
eq(
  "Add package opens the old form unless the workflow flag is on",
  /gb \? setPlanOpen\(true\) : setEditing\("new"\)/.test(pk),
  true,
);
eq("short form is mounted once", (pk.match(/<IspPlanDrawer/g) ?? []).length, 1);
const sg = readFileSync(join(ROOT, "src/components/isp-partner/plans/SpeedGroupsTab.tsx"), "utf8");
eq(
  "device-rules button is mounted once per row",
  (sg.match(/<TemplateDeviceRulesButton group=\{g\} \/>/g) ?? []).length,
  1,
);
const dlg = readFileSync(
  join(ROOT, "src/components/isp-partner/plans/TemplateDeviceRulesDialog.tsx"),
  "utf8",
);
eq("button hides while the BE flag is off", /!rules\.available\) return null/.test(dlg), true);
const drawer = readFileSync(
  join(ROOT, "src/components/isp-partner/plans/IspPlanDrawer.tsx"),
  "utf8",
);
eq("billing basis only when the BE answers", /cycleBasis\.available &&/.test(drawer), true);
eq("connection only when package labels are on", /meta\.available &&/.test(drawer), true);

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
