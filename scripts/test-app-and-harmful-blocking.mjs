/**
 * Block Websites -> Apps, and the "Block known harmful websites" switch.
 *
 * WHAT THIS IS ABOUT
 * ------------------
 * Two new controls on the Block Websites screen, each a thin layer over
 * something that already works:
 *
 *   - an app switch blocks every website name an app uses, through the same
 *     per-name push a typed-in website gets (cloud-guest content_filtering
 *     app catalogue);
 *   - the harmful-sites switch adds or removes Cloudflare's Security threats
 *     category from the venue's category list.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. AN APP IS NEVER DRAWN AS BLOCKED WHEN IT IS NOT ON THE ROUTER. A
 *      block that failed half-way says so; it is not "Blocked on the
 *      router".
 *   2. TURNING HARMFUL SITES OFF REMOVES ONLY THAT CATEGORY. Every other
 *      category the owner chose survives the switch.
 *   3. THE COPY SAYS PLAINLY THAT APP BLOCKING IS NAME MATCHING and that
 *      some apps may still get through -- in English and in Hindi.
 *   4. THE WEBSITE LIST DOES NOT FILL UP WITH APP ROWS.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-block-scope.mjs`). The pure modules are bundled with esbuild
 * and executed for real; the wiring is checked against the real sources.
 *
 * Run: node scripts/test-app-and-harmful-blocking.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "app-harmful-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(ROOT, "src/lib/app-blocking.ts"))};`,
    `export { securityThreatIds, harmfulSitesOn, withHarmfulSites, harmfulRouterStep } from ${JSON.stringify(join(ROOT, "src/lib/web-filtering.ts"))};`,
  ].join("\n"),
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const m = await import(bundle);

console.log("\nan app switch never claims more than the router holds");
eq(
  "nothing blocked -> allowed",
  m.appToggleView({ state: "not_blocked", pushStatus: null }),
  "allowed",
);
eq(
  "all blocked and active -> blocked",
  m.appToggleView({ state: "blocked", pushStatus: "active" }),
  "blocked",
);
eq(
  "blocked but pending -> sending",
  m.appToggleView({ state: "blocked", pushStatus: "pending" }),
  "sending",
);
eq("any failure -> failed", m.appToggleView({ state: "blocked", pushStatus: "failed" }), "failed");
eq(
  "a failure outranks partial",
  m.appToggleView({ state: "partly_blocked", pushStatus: "failed" }),
  "failed",
);
eq(
  "partly blocked -> partial",
  m.appToggleView({ state: "partly_blocked", pushStatus: "pending" }),
  "partial",
);
for (const view of ["blocked", "sending", "failed", "partial"]) {
  check(
    `${view}: switch reads blocked, so switching it back means remove`,
    m.appSwitchBlocked(view),
  );
}
check("allowed: switch reads allowed", !m.appSwitchBlocked("allowed"));

const app = {
  targets: [
    { value: "youtube.com", ruleId: "r1", owned: true, devicePushStatus: "active" },
    { value: "ytimg.com", ruleId: "r2", owned: true, devicePushStatus: "failed" },
    { value: "youtu.be", ruleId: "r3", owned: false, devicePushStatus: "active" },
    { value: "googlevideo.com", ruleId: null, owned: false, devicePushStatus: null },
  ],
};
eq("failed names are the ones that did not land", m.appFailedNames(app), ["ytimg.com"]);
eq("a hand-made block is named, never claimed", m.appHandBlockedNames(app), ["youtu.be"]);

console.log("\nthe harmful-sites switch touches only Security threats");
const items = [
  {
    id: 2,
    isSecurity: false,
    categoryClass: "free",
    subcategories: [{ id: 67, categoryClass: "free", subcategories: [] }],
  },
  {
    id: 21,
    isSecurity: true,
    categoryClass: "free",
    subcategories: [
      { id: 80, categoryClass: "free", subcategories: [] },
      { id: 83, categoryClass: "free", subcategories: [] },
      { id: 99, categoryClass: "noBlock", subcategories: [] },
    ],
  },
];
eq(
  "the Security threats ids (unselectable ones left out)",
  m.securityThreatIds(items),
  [21, 80, 83],
);
check("off when the list lacks it", !m.harmfulSitesOn([2, 67], items));
check("off when only half of it is there", !m.harmfulSitesOn([21, 80], items));
check("on when all of it is there", m.harmfulSitesOn([2, 21, 80, 83], items));
eq(
  "switching on keeps the owner's own choices",
  m.withHarmfulSites([2, 67], items, true),
  [2, 21, 67, 80, 83],
);
eq(
  "switching off removes only Security threats",
  m.withHarmfulSites([2, 21, 67, 80, 83], items, false),
  [2, 67],
);
eq("switching off an empty list stays empty", m.withHarmfulSites([], items, false), []);
check("no Security threats group -> never on", !m.harmfulSitesOn([1, 2], [items[0]]));

console.log("\nwhat the switch says about each router");
eq("filtering -> nothing to say", m.harmfulRouterStep({ state: "active" }), "on");
eq("disabled -> one step left", m.harmfulRouterStep({ state: "disabled" }), "needs_turn_on");
eq("pending -> one step left", m.harmfulRouterStep({ state: "pending" }), "needs_turn_on");
eq("failed -> says it failed", m.harmfulRouterStep({ state: "failed" }), "failed");
eq("unread -> silent rather than wrong", m.harmfulRouterStep(undefined), "unknown");

console.log("\nthe screens are wired to it");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const blocking = read("src/components/security/BlockingView.tsx");
check(
  'Block Websites has an "apps" section',
  /apps: "apps"/.test(blocking) && /AppBlockBox/.test(blocking),
);
const box = read("src/components/security/WebsiteBlockBox.tsx");
check("the website list asks for hand-made rows only", /excludeAppRules: true/.test(box));
check("and filters app rows itself for an older backend", /!r\.appKey/.test(box));
const wf = read("src/components/security/WebFilteringView.tsx");
check(
  "the harmful switch sits above the category list",
  wf.indexOf("<HarmfulSitesSwitch") > 0 &&
    wf.indexOf("<HarmfulSitesSwitch") < wf.indexOf("<CategoriesCard"),
);
check(
  "it saves through the existing venue-policy mutation",
  /function HarmfulSitesSwitch[\s\S]*useSetWebFilterLocationPolicy/.test(wf),
);
check(
  "it turns a router on with the existing router action",
  /function HarmfulRouterStep[\s\S]*kind: "enable"/.test(wf),
);
const appBox = read("src/components/security/AppBlockBox.tsx");
check(
  "the app box does not render the toggle from a local guess",
  /appToggleView\(app\)/.test(appBox),
);

console.log("\nthe honest copy is there, in both languages");
const en = JSON.parse(read("src/lib/i18n/locales/en/nav.json"));
const hi = JSON.parse(read("src/lib/i18n/locales/hi/nav.json"));
check(
  "English says some apps may still get through",
  /some apps may still get through/.test(en.blockApps.hint),
);
check("English says it matches website names", /website names/.test(en.blockApps.hint));
check("the website box mentions QUIC", /QUIC/.test(en.firewallPage.siteHttpsHint));
const keys = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );
for (const ns of ["blockApps", "harmfulSites"]) {
  const missing = keys(en[ns]).filter((k) => {
    const v = k.split(".").reduce((o, part) => o?.[part], hi[ns]);
    return typeof v !== "string" || v.length === 0;
  });
  eq(`every ${ns} string has Hindi`, missing, []);
}
check(
  "Hindi uses मेहमान for guest",
  /मेहमान/.test(hi.blockApps.hint) && /मेहमान/.test(hi.harmfulSites.body),
);
for (const k of ["apps", "harmful"]) check(`link.${k} in Hindi`, !!hi.securityScore.link[k]);
for (const k of ["domain_blocking_sni", "application_control", "threat_intelligence"]) {
  check(`copy.${k} in Hindi`, !!hi.securityScore.copy?.[k]);
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
