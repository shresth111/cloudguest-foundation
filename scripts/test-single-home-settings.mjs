/**
 * Regression test: one setting, one screen -- and nothing enforced left
 * without a screen at all.
 *
 * WHERE THIS CAME FROM
 * --------------------
 * A QA pass found two customer-dashboard settings living on two screens
 * each. Deleting the second copy is the easy half. The half that can
 * actually hurt a venue is the one this file guards: if the two copies were
 * writing *different* backend fields, deleting a screen hides a setting
 * that is still being enforced, and the venue's behaviour then disagrees
 * with the only UI left. That is strictly worse than the duplication.
 *
 * So both halves are asserted here.
 *
 *   1. "Always Allowed" has one home. `PoliciesHub` (Access Rules) used to
 *      mount `<WhiteList locationId={locationId} />` -- byte-for-byte the
 *      same component, with the same prop, that the sidebar's own "Always
 *      Allowed" row renders. Same component means the two could never
 *      disagree about a field, so this one really was a pure duplicate:
 *      the same screen reachable twice, with only the sidebar's copy
 *      having a URL. The sidebar's copy is the one that survives, and the
 *      nav entry has to stay for that to be true.
 *
 *   2. "Sign-in Methods" has one home. `SmartIdPage` and the Portal
 *      editor's Auth Methods both wrote the *same* `captive_portal_configs`
 *      row -- resolved by the same most-specific-wins order (this
 *      location's config, else the org default) -- through the same four
 *      flags. Those two really could disagree on screen, and which one was
 *      right depended on which tab you had open last. Portal keeps it.
 *
 *   3. THE ONE THAT MATTERS. `pin_login_enabled` was the one flag only the
 *      deleted tab wrote, and it is genuinely enforced: the backend's
 *      `GuestService._require_method_enabled` maps `GuestAuthMethod.PIN`
 *      straight to that column, so a guest's PIN login is refused when it
 *      is off. Deleting the tab without moving that row would have left a
 *      working, enforced setting with no UI anywhere in the product. This
 *      file asserts that every login flag the deleted screen could write
 *      is still writable from the screen that replaced it -- so the next
 *      person to consolidate two screens cannot quietly strand a third
 *      one.
 *
 *      Note what is deliberately NOT asserted: `social_login_enabled` is a
 *      schema-only readiness flag with no OAuth integration behind it
 *      anywhere in the codebase (the backend model's own docstring says
 *      so), so it is not in the enforced set. `username_password_enabled`
 *      IS enforced but has never had a customer-facing control on either
 *      screen -- that is a pre-existing gap, not one this change made, and
 *      it is called out rather than silently locked in.
 *
 *   4. Open Hours' day grid sizes off its own width, not the viewport's.
 *      See the "OPEN HOURS" section below for why that is a correctness
 *      assertion and not a style preference -- and for what this test
 *      honestly cannot check.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). Real
 * modules are bundled with esbuild and executed; component wiring is
 * checked against the real component sources.
 *
 * Run: node scripts/test-single-home-settings.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** Source with comments stripped. These files carry long explanatory
 * comments that quote the very JSX they explain -- `PoliciesHub` documents
 * the `<WhiteList locationId={locationId} />` it no longer renders, on
 * purpose, so the next reader knows where it went. A naive grep for the
 * mount would match the note about the mount. Strip block and line comments
 * (including `{/* ... *\/}` JSX comments, whose braces fall away with the
 * block) before asserting on what a file actually *does*. */
const readCode = (rel) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const POLICIES_HUB = "src/components/features/PoliciesHub.tsx";
const PORTAL_PAGE = "src/components/features/PortalPage.tsx";
const PORTAL_SERVICE = "src/services/portal.service.ts";
const CUSTOMER_FEATURES = "src/config/customerFeatures.tsx";
const OPS_FEATURES = "src/components/features/OperationsFeatures.tsx";

const hub = readCode(POLICIES_HUB);
const portalPage = readCode(PORTAL_PAGE);
const portalService = read(PORTAL_SERVICE);

// ---------------------------------------------------------------------------
// 1. ALWAYS ALLOWED -- one home, and it is the one with a URL
// ---------------------------------------------------------------------------
console.log("\nAlways Allowed");

check(
  "Access Rules no longer mounts WhiteList",
  !/<WhiteList\b/.test(hub),
  "PoliciesHub still renders <WhiteList>",
);
check(
  "Access Rules no longer imports WhiteList",
  !/^import\s+WhiteList\b/m.test(hub),
  "dead import left behind",
);
check(
  "Access Rules has no whitelist tab left in ACCESS_TABS",
  !/id:\s*"whitelist"/.test(hub),
  "a tab id survives its content",
);

// The surviving copy. `customerFeatures.tsx` is the nav-driven registry --
// this is the mount that has a real route behind it (`/whitelist`), which is
// exactly why it is the copy that was kept.
const customerFeatures = readCode(CUSTOMER_FEATURES);
check(
  "the sidebar's Always Allowed still mounts WhiteList",
  /<WhiteList\b/.test(customerFeatures),
  "the surviving copy is gone too -- the feature has NO home now",
);

// ---------------------------------------------------------------------------
// 2. SIGN-IN METHODS -- one home
// ---------------------------------------------------------------------------
console.log("\nSign-in Methods");

check(
  "SmartIdPage.tsx is deleted, not just unmounted",
  !existsSync(join(ROOT, "src/components/features/SmartIdPage.tsx")),
  "orphaned component still on disk",
);
check(
  "Access Rules no longer mounts SmartIdPage",
  !/<SmartIdPage\b/.test(hub) && !/^import\s+SmartIdPage\b/m.test(hub),
);
check("Access Rules has no smartid tab left in ACCESS_TABS", !/id:\s*"smartid"/.test(hub));
check(
  "nothing anywhere still imports SmartIdPage",
  !/from\s+["'][^"']*SmartIdPage["']/.test(hub + portalPage + customerFeatures),
);

// ---------------------------------------------------------------------------
// 3. NOTHING ENFORCED WAS ORPHANED
//
// The five `captive_portal_configs` columns the deleted screen could write.
// Four of them the Portal editor already wrote; `pin_login_enabled` is the
// one it did not, and the one that made deleting the screen a data-behaviour
// change rather than a cleanup.
// ---------------------------------------------------------------------------
console.log("\nEvery enforced login flag still has a screen");

const ENFORCED_FLAGS = [
  ["otp_sms_enabled", "mobile_otp"],
  ["otp_email_enabled", "email_otp"],
  ["otp_whatsapp_enabled", "whatsapp_otp"],
  ["voucher_enabled", "voucher"],
  ["pin_login_enabled", "pin"],
];

for (const [flag, method] of ENFORCED_FLAGS) {
  // READ path: the flag has to come back off the backend row into the
  // editor's state, or the toggle renders "off" for a venue that has it on.
  check(
    `${flag} is in portal.service's LOGIN_METHOD_FLAGS`,
    new RegExp(`method:\\s*"${method}",\\s*flag:\\s*"${flag}"`).test(portalService),
    "the Portal editor cannot read this flag",
  );
  // WRITE path: `loginMethodFlags` is what the PUT body is built from. A flag
  // missing here is the exact failure mode portal.service.ts's own "this
  // whitelist is where a new field goes to die" comment describes -- the
  // switch moves, the toast says saved, the column never changes.
  check(
    `${flag} is written by loginMethodFlags`,
    new RegExp(`${flag}:\\s*set\\.has\\("${method}"\\)`).test(portalService),
    "the Portal editor cannot write this flag",
  );
  // And the operator has to be able to reach it at all.
  check(
    `"${method}" is offered in Portal's AUTH_OPTIONS`,
    new RegExp(`\\["${method}",`).test(
      portalPage.slice(
        portalPage.indexOf("const AUTH_OPTIONS"),
        portalPage.indexOf("];", portalPage.indexOf("const AUTH_OPTIONS")),
      ),
    ),
    "no switch on screen for a flag the backend enforces",
  );
}

// The flag has to be declared on the backend row type too, or the read path
// above type-errors into `undefined` and every venue reads as "off".
check(
  "pin_login_enabled is declared on BackendCaptivePortalConfig",
  /pin_login_enabled:\s*boolean;/.test(portalService),
);

// The Live Preview used to hardcode this to `false` because nothing wrote it.
// Something does now, so a hardcoded `false` would show the venue a preview
// of a portal it is not running.
check(
  "the Live Preview's pinLoginEnabled follows the switch, not a constant",
  /pinLoginEnabled:\s*authMethods\.includes\("pin"\)/.test(portalPage),
  "preview pinned to a literal again",
);

// `social` is deliberately NOT in ENFORCED_FLAGS -- it is a readiness flag
// with nothing behind it. Asserted explicitly so that if someone ever builds
// real social login, this line is where they find out the distinction was
// intentional rather than an oversight.
check(
  "social_login_enabled is still treated as the unenforced one",
  /schema-only readiness flag/.test(portalService),
  "the honest-boundary note went missing",
);

// ---------------------------------------------------------------------------
// 4. OPEN HOURS -- the day grid measures itself, not the window
//
// WHAT THIS CANNOT TEST, said plainly: whether the switches visually escape
// their cards, and whether the browser's native `type="time"` control is wide
// enough to still draw its AM/PM segment, are both rendered-pixel questions.
// This repo has no component renderer and no browser harness for this screen,
// and a JSDOM assertion would report layout that no user ever sees -- it
// would pass before and after the fix and be worth nothing. Those two were
// verified by screenshot at 1024px and 1280px, sidebar expanded and
// collapsed, and the screenshots are in the PR.
//
// What IS mechanically checkable is the cause, and it is a real invariant:
// this grid's available width is the viewport MINUS a 16rem sidebar (3rem
// collapsed) MINUS up to 4rem of main padding, capped at max-w-7xl. So a
// viewport-keyed breakpoint is measuring the wrong box -- `xl:grid-cols-7`
// fired at a 1280px window while the grid itself was ~960px, i.e. seven
// ~127px columns. Every symptom followed from that. If someone reintroduces
// a viewport breakpoint here, both bugs come back together.
// ---------------------------------------------------------------------------
console.log("\nOpen Hours day grid");

const ops = readCode(OPS_FEATURES);
const gridStart = ops.indexOf('<div className="@container">');
check("the day grid is wrapped in a container-query context", gridStart !== -1);

if (gridStart !== -1) {
  // The grid element itself, and the day card up to its time inputs.
  const dayGrid = ops.slice(gridStart, gridStart + 6000);
  const gridClasses = (dayGrid.match(/className="(grid [^"]*)"/) || [])[1] ?? "";

  check(
    "the day grid sizes off its container, not the viewport",
    /@\[\d+(\.\d+)?rem\]:grid-cols-/.test(gridClasses),
    gridClasses,
  );
  check(
    "no viewport breakpoint is left driving the day grid's column count",
    !/(?:^|\s)(?:sm|md|lg|xl|2xl):grid-cols-/.test(gridClasses),
    gridClasses,
  );
  // Seven columns is what produced ~127px cards. Nothing this grid can be
  // given is wide enough for seven day cards side by side.
  check(
    "the day grid never asks for more than 4 columns",
    !/grid-cols-([5-9]|1[0-9])\b/.test(gridClasses),
    gridClasses,
  );

  // The row that overflowed. A flex child defaults to `min-width: auto`, so
  // an untruncatable day name set a hard floor the row could not shrink
  // below -- and the switch on the far end was what got pushed out.
  check(
    "the day label can shrink and truncate",
    /className="flex min-w-0 items-center gap-2"/.test(dayGrid) &&
      /className="truncate text-sm font-medium"/.test(dayGrid),
    "the label row can still refuse to shrink",
  );

  // The time inputs. `min-w-0` let the native control shrink to its padding,
  // and the browser clips its trailing segment first -- which is AM/PM.
  const timeInputs = dayGrid.match(/type="time"[\s\S]{0,240}?className="([^"]*)"/g) ?? [];
  check("both time inputs were found", timeInputs.length === 2, `found ${timeInputs.length}`);
  for (const [i, input] of timeInputs.entries()) {
    const cls = (input.match(/className="([^"]*)"/) || [])[1] ?? "";
    check(
      `time input ${i + 1} has a real minimum width`,
      /min-w-\[\d+(\.\d+)?rem\]/.test(cls) && !/\bmin-w-0\b/.test(cls),
      cls,
    );
  }
}

// ---------------------------------------------------------------------------
// 5. The nav itself still offers Always Allowed as its own destination --
// executed for real, not regex'd, since this is a plain module.
// ---------------------------------------------------------------------------
console.log("\nNav");

const outdir = mkdtempSync(join(tmpdir(), "single-home-settings-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(entry, `export * from "${p("src/lib/customerNav.ts")}";`);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const nav = await import(outfile);

const whitelistItem = nav.CUSTOMER_NAVS.find((i) => i.id === "whitelist");
check("whitelist is still its own sidebar destination", Boolean(whitelistItem));
check(
  'it is still labelled "Always Allowed"',
  whitelistItem?.label === "Always Allowed",
  whitelistItem?.label,
);
check(
  "it still resolves to its own URL",
  nav.customerFeatureHref("whitelist") === "/whitelist",
  nav.customerFeatureHref("whitelist"),
);
// Access Rules keeps its own destination -- it lost two tabs, not the page.
check(
  "Access Rules is still its own destination",
  nav.CUSTOMER_NAVS.some((i) => i.id === "policies"),
);
check(
  "Portal is still its own destination (it now owns sign-in methods)",
  nav.CUSTOMER_NAVS.some((i) => i.id === "portal"),
);

console.log(
  failures === 0
    ? `\nall single-home settings checks passed\n`
    : `\n${failures} single-home settings check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
