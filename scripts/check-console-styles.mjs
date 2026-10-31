#!/usr/bin/env node
/**
 * Guard for the customer console design system (docs/design/console-tokens.md).
 *
 * The design review (2026-10-31) measured 30 card styles, 94 button styles
 * and 6 corner radii across the customer dashboard, because 24 of its 30
 * screens were still the pre-console app: `premium-card`, rounded-2xl/3xl
 * cards, gradient heroes, and Tailwind palette status colours
 * (`bg-emerald-50 text-emerald-700`) instead of the `--wy-*` tokens. Those
 * screens are being migrated batch by batch onto the shared primitives in
 * `src/components/customer/console/`. This script keeps a migrated file
 * migrated, and keeps new files from starting out in the old style.
 *
 * WHAT IT BANS (comments stripped first -- docstrings describe the old style)
 *   - `premium-card` / `premium-card-hover`
 *   - `rounded-2xl`, `rounded-3xl`
 *   - gradient fills: `bg-gradient-*`, `bg-linear-*`, `bg-radial-*`
 *   - raw Tailwind chromatic palette utilities, e.g. `bg-emerald-50`,
 *     `text-amber-700`, `border-rose-500/20`, `from-indigo-500`: status
 *     colour must come from `--wy-ok/warn/crit/info/offline`, brand colour
 *     from `--wy-accent`.
 *
 * WHERE: the customer-rendered trees -- src/components/{customer,network,
 * features,security,traffic-lens,marketing,netlogs}/** plus routes/users.tsx.
 *
 * THE ALLOW-LIST (scripts/console-styles-allowlist.json) names the files
 * that are NOT migrated yet. It only ever shrinks:
 *   - a file not on it must have zero hits;
 *   - a file on it that has gone clean fails as "stale" until it is removed,
 *     so a migration cannot forget to tighten the guard;
 *   - adding a file to it needs a reason in the commit message.
 *
 * Usage: node scripts/check-console-styles.mjs   (wired as
 * `bun run check:console-styles`, and in CI through ci-gated-test.sh).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW_FILE = join(ROOT, "scripts/console-styles-allowlist.json");

const SCAN_DIRS = [
  "src/components/customer",
  "src/components/network",
  "src/components/features",
  "src/components/security",
  "src/components/traffic-lens",
  "src/components/marketing",
  "src/components/netlogs",
];
const SCAN_FILES = ["src/routes/users.tsx"];

/** Screens migrated so far. They must never reappear on the allow-list. */
const MIGRATED = [
  // batch 1 (2026-10-31): primitives + Network › Advanced + Alerts
  "src/components/customer/console/PageHeader.tsx",
  "src/components/customer/console/StatusBadge.tsx",
  "src/components/customer/console/DataTable.tsx",
  "src/components/customer/console/SubTabs.tsx",
  "src/components/customer/console/Callout.tsx",
  "src/components/customer/console/FormSection.tsx",
  "src/components/customer/console/Toolbar.tsx",
  "src/components/network/network-ui.tsx",
  "src/components/network/DhcpManagement.tsx",
  "src/components/network/VlanManagement.tsx",
  "src/components/network/PortForwardingManagement.tsx",
  "src/components/network/QosManagement.tsx",
  "src/components/features/AlertsView.tsx",
  // batch 2 (2026-10-31): Guests, Vouchers, Guest Groups, Reports, Fix a
  // Problem, and OperationsFeatures' Open Hours / Staff Activity / Trusted Devices
  "src/routes/users.tsx",
  "src/components/features/VouchersPage.tsx",
  "src/components/features/ManageTeamsPage.tsx",
  "src/components/features/UserReports.tsx",
  "src/components/customer/FixAProblem.tsx",
  "src/components/features/OperationsFeatures.tsx",
  // batch 3 (2026-10-31): Security -- Security Score, Blocking (+ Blocked
  // Guests and the Websites tab's boxes), Firewall, Access Rules, Allow-list
  "src/components/security/SecurityOverviewView.tsx",
  "src/components/security/BlockingView.tsx",
  "src/components/security/AppBlockBox.tsx",
  "src/components/security/WebsiteBlockBox.tsx",
  "src/components/security/WebFilteringView.tsx",
  "src/components/security/FirewallView.tsx",
  "src/components/security/FirewallDevicePicker.tsx",
  "src/components/features/BlockUsers.tsx",
  "src/components/features/PoliciesHub.tsx",
  "src/components/features/LocationPolicies.tsx",
  "src/components/features/CreateGroup.tsx",
  "src/components/features/WhiteList.tsx",
  // batch 3 (2026-10-31): Logs -- Guest Connection Records, NetLogs
  "src/components/features/NetworkActivityLog.tsx",
  "src/components/netlogs/NetLogsView.tsx",
  "src/components/netlogs/IpdrConnections.tsx",
  "src/components/netlogs/NetLogsCharts.tsx",
];

const PALETTE =
  "emerald|green|lime|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow";
const RULES = [
  { id: "premium-card", re: /\bpremium-card(?:-hover)?\b/g },
  { id: "rounded-2xl/3xl", re: /\brounded-(?:[trbl]{1,2}-)?(?:2xl|3xl)\b/g },
  { id: "gradient", re: /\bbg-(?:gradient|linear|radial)-[\w-[\]#]+/g },
  {
    id: "raw-palette",
    re: new RegExp(
      String.raw`\b(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|outline|divide|fill|stroke|from|via|to|shadow|accent|decoration|caret|placeholder)-(?:${PALETTE})-\d{2,3}(?:\/\d{1,3})?\b`,
      "g",
    ),
  },
];

const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? `\n${detail}` : ""}`);
  }
};

/** Block and line comments out, string contents kept (class names live in strings). */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, (m) => m.replace(/[^\n]/g, " "));
}

function hits(src) {
  const code = stripComments(src);
  const out = [];
  for (const rule of RULES) {
    for (const m of code.matchAll(rule.re)) {
      const line = code.slice(0, m.index).split("\n").length;
      out.push({ rule: rule.id, match: m[0], line });
    }
  }
  return out;
}

function walk(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
  }
  return acc;
}

// --- 1. the detector is not vacuous ---------------------------------------
console.log("\nthe detector catches every banned pattern");
const FIXTURE = [
  `<div className="premium-card p-4" />`,
  `<div className="rounded-2xl" />`,
  `<div className="rounded-t-3xl" />`,
  `<div className="bg-gradient-to-br from-[#4f46e5] to-[#a78bfa]" />`,
  `<span className="bg-emerald-50 text-emerald-700" />`,
  `<span className="border-rose-500/20 dark:text-amber-400" />`,
];
const fixtureRules = new Set(FIXTURE.flatMap((f) => hits(f).map((h) => h.rule)));
check(
  "a fixture with each banned pattern trips all four rules",
  RULES.every((r) => fixtureRules.has(r.id)),
  `     caught: ${[...fixtureRules].join(", ")}`,
);
check(
  "token-based console classes are not flagged",
  hits(
    `<div className="rounded-[var(--wy-radius)] bg-[var(--wy-ok-soft)] text-[var(--wy-ok)] rounded-full rounded-xl text-muted-foreground" />`,
  ).length === 0,
);
check(
  "a banned class that only appears in a comment is not flagged",
  hits(`/* was bg-emerald-50 rounded-2xl */\nconst a = 1; // premium-card\n`).length === 0,
);

// --- 2. the scan ------------------------------------------------------------
console.log("\nthe customer console trees");
const allow = JSON.parse(readFileSync(ALLOW_FILE, "utf8"));
const allowSet = new Set(allow.files);
const files = [
  ...SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [])),
  ...SCAN_FILES.map((f) => join(ROOT, f)).filter(existsSync),
].map((p) => relative(ROOT, p));
check(`scanned ${files.length} files`, files.length > 100, "     the scan roots moved?");

const dirty = new Map();
for (const f of files) {
  const h = hits(readFileSync(join(ROOT, f), "utf8"));
  if (h.length) dirty.set(f, h);
}

const offenders = [...dirty.keys()].filter((f) => !allowSet.has(f));
check(
  "every file outside the allow-list uses console tokens only",
  offenders.length === 0,
  offenders
    .map((f) =>
      dirty
        .get(f)
        .slice(0, 6)
        .map((h) => `     ${f}:${h.line}  ${h.rule}  ${h.match}`)
        .join("\n"),
    )
    .join("\n") +
    (offenders.length
      ? "\n     Use the --wy-* tokens / console primitives (docs/design/console-tokens.md)."
      : ""),
);

const stale = allow.files.filter((f) => existsSync(join(ROOT, f)) && !dirty.has(f));
check(
  "no allow-list entry is stale (a clean file comes off the list)",
  stale.length === 0,
  stale.map((f) => `     ${f}  -> remove it from scripts/console-styles-allowlist.json`).join("\n"),
);

const missing = allow.files.filter((f) => !existsSync(join(ROOT, f)));
check(
  "every allow-list entry exists",
  missing.length === 0,
  missing.map((f) => `     ${f}`).join("\n"),
);

const backslid = MIGRATED.filter((f) => allowSet.has(f) || dirty.has(f));
check(
  `the ${MIGRATED.length} migrated files stay clean and off the allow-list`,
  backslid.length === 0 && MIGRATED.every((f) => existsSync(join(ROOT, f))),
  backslid.map((f) => `     ${f}`).join("\n"),
);

const total = [...dirty.values()].reduce((n, h) => n + h.length, 0);
console.log(
  `\n  ${allow.files.length} files still to migrate, ${total} legacy class uses left in them.`,
);

if (failures.length) {
  console.log(`\nconsole styles: ${failures.length} check(s) FAILED`);
  process.exit(1);
}
console.log("\nconsole styles: all checks passed");
