/**
 * Regression test: every auth form must submit a TRIMMED email address.
 *
 * FAILURE MODE THIS LOCKS DOWN: `LoginPage.handleSubmit` validated
 * `email.trim()` but handed the raw `email` to `login()`. A single trailing
 * space -- which a phone keyboard appends after autocomplete, and which a
 * paste out of a welcome email carries invisibly -- therefore passed every
 * check on screen and was sent to the backend verbatim. The backend matched
 * no such user, the visitor saw only "Login failed" next to an address that
 * looked perfectly correct, and five of those tripped
 * `account_lockout_minutes` (30) with nothing to show for it. The same split
 * existed on `MasterLoginPage`, and on both forgot-password paths -- where it
 * is worse still, because their replies are deliberately
 * account-existence-agnostic, so a mistyped address produces the same
 * cheerful "link is on its way" as a correct one and the reset mail that
 * never arrives looks like a mail-delivery problem instead of a typo.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * scripts/test-portal-cna-storage-safety.mjs's own note). The invariant is a
 * property of the call sites themselves -- "the value handed to the auth
 * layer is trimmed" -- so it is checked where it lives, in the source.
 *
 * Run: node scripts/test-auth-email-trimmed.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Call shapes that send an email onward to the auth layer. Each entry is
 *  [description, regex that matches the UNTRIMMED spelling]. */
const FORBIDDEN = [
  ["login({ email, ... }) with an untrimmed address", /\blogin\(\{\s*email\s*[,}]/],
  ["forgotPassword(<untrimmed>)", /\bforgotPassword\(\s*(?!["'])[A-Za-z_$][\w$.]*\s*\)/],
];

/** `forgotPassword(x)` is fine when `x` is already-trimmed; these names are
 *  the ones the components bind their trimmed values to. */
const TRIMMED_NAMES = /\bforgotPassword\(\s*(trimmed[\w$]*|[\w$.]*\.trim\(\))\s*\)/;

const FILES = [
  "src/components/auth/LoginPage.tsx",
  "src/components/auth/MasterLoginPage.tsx",
  "src/components/auth/ForgotPasswordPage.tsx",
];

const failures = [];
for (const rel of FILES) {
  const source = readFileSync(join(ROOT, rel), "utf8");
  source.split("\n").forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    for (const [what, pattern] of FORBIDDEN) {
      if (!pattern.test(line)) continue;
      if (TRIMMED_NAMES.test(line)) continue;
      failures.push(`${rel}:${i + 1}  ${what}\n    ${line.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error("FAIL: auth form submits an untrimmed email address\n");
  for (const failure of failures) console.error(failure + "\n");
  console.error(
    "Trim the address before handing it to the auth layer, and validate the\n" +
      "same trimmed value -- validation and submission must agree on one\n" +
      "spelling. See this file's header for what a stray space costs.",
  );
  process.exit(1);
}

console.log(`PASS: ${FILES.length} auth components submit trimmed email addresses`);
