/**
 * Portal logo / background image are the plan's `white_label` feature: every
 * /branding call answers 402 without it. The editor must lock both uploads
 * with the reason (from GET /me/entitlements) instead of offering a pick that
 * can only fail, and must stay exactly as it was while the answer is unknown.
 *
 * Run: node scripts/test-portal-white-label-lock.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const page = readFileSync(join(ROOT, "src/components/features/PortalPage.tsx"), "utf8");

let failures = 0;
function check(name, ok) {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}`);
  }
}

check(
  "locked only when the backend says white_label is off (null = unknown stays open)",
  /useFeatureEntitled\("white_label"\) === false/.test(page),
);
check(
  "the logo upload input is disabled when locked",
  /disabled=\{uploadingLogo \|\| brandingLocked\}/.test(page),
);
check(
  "the background upload input is disabled when locked",
  /disabled=\{uploadingBg \|\| brandingLocked\}/.test(page),
);
check(
  "both pickers show a lock icon when locked",
  (page.match(/brandingLocked \? \(\s*<Lock/g) ?? []).length === 2,
);
check("the reason is shown as a note", /data-testid="portal-branding-locked"/.test(page));
check(
  "the reason names the plan feature and who to ask",
  /White label\)\. Ask your " \+\s*"Wyfy Guest contact/.test(page),
);

if (failures) {
  console.log(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nportal white label lock: all checks passed");
