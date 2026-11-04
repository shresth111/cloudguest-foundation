/**
 * Regression test: signing in at the bare "/" must not navigate from LoginPage.
 *
 * FAILURE MODE THIS LOCKS DOWN: IndexRedirect renders LoginPage in place at
 * "/" and sends a fresh session to /switch-location. LoginPage also ran a 50ms
 * timer navigating to "/", which cancelled that navigation while the picker's
 * chunk was loading. The URL fell back to "/", IndexRedirect stayed mounted so
 * its effect never re-ran, and the visitor sat on a spinner until a refresh.
 *
 * The path must be read at mount: by the time login() resolves, router state
 * may already say /switch-location, and a check made then passes the "/" test
 * wrongly and brings the race back.
 *
 * This repo has no test runner, so the invariant is checked in the source.
 *
 * Run: node scripts/test-login-root-navigation.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "src/components/auth/LoginPage.tsx"), "utf8");
const failures = [];

const navigations = src.match(/navigate\(\{\s*to:\s*redirect \|\| "\/"/g) ?? [];
if (navigations.length !== 1) {
  failures.push(
    `expected one post-login navigate, in navigateAfterLogin; found ${navigations.length}`,
  );
}
if (!/useRef\(router\.state\.location\.pathname === "\/"\)/.test(src)) {
  failures.push('the "/" check must be captured with useRef at mount');
}
if (
  !/navigateAfterLogin = \(\) => \{\s*if \(!redirect && renderedInPlaceAtRoot\.current\) return;/.test(
    src,
  )
) {
  failures.push(
    "navigateAfterLogin must return early when rendered in place at / with no redirect",
  );
}
const calls = src.match(/\bnavigateAfterLogin\(\);/g) ?? [];
if (calls.length !== 2) {
  failures.push(`both sign-in handlers must use navigateAfterLogin; found ${calls.length} calls`);
}

if (failures.length) {
  for (const f of failures) console.error(`FAIL: ${f}`);
  process.exit(1);
}
console.log("OK: login at / leaves the navigation to IndexRedirect");
