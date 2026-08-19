#!/usr/bin/env node
/**
 * Guest-portal accessibility regression gate.
 *
 * Run: `npm run test:a11y`
 *
 * Why this exists in this shape
 * -----------------------------
 * captive-portal-v7-design-spec.md §7.2 asks for "a regression test
 * asserting the attribute". This repo has no unit-test runner at all --
 * no vitest, no jest, no @testing-library, and `node_modules` is not ours
 * to add one to in this branch -- so this is a zero-dependency static gate
 * over the real sources rather than a DOM render assertion. Be honest
 * about what that buys and what it does not:
 *
 *   IT CATCHES  someone deleting `autoComplete="one-time-code"` from a call
 *               site, hand-rolling a replacement OTP control that forgets
 *               it, or quietly dropping `<Label htmlFor>` off a sign-in
 *               field.
 *   IT DOES NOT prove the attribute reaches the rendered DOM. A real
 *               render assertion is strictly better and should replace the
 *               `otp-autocomplete` check the day this repo gains a test
 *               runner.
 *
 * The type system carries the other half of the same invariant:
 * `OtpCodeInput`'s `autoComplete` prop is *required* and typed to the
 * literal `"one-time-code"`, so `tsc --noEmit` already fails if a call
 * site drops it or changes it. This file covers the case the type system
 * cannot see -- the component itself being replaced.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

/** Every check below is a shape check over source text, so comments have to
 * come out first -- this file's own subject matter means the sources it
 * inspects are full of prose *about* `<Input>`, `<Label htmlFor>` and
 * `placeholder:text-[var(--pg-ink-faint)]`, and counting those would make
 * the gate both over- and under-report. Block comments first, then any line
 * that is nothing but a line comment or a JSDoc continuation. */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
const readCode = (p) => stripComments(read(p));

const failures = [];
const check = (name, ok, detail) => {
  if (!ok) failures.push(`${name}: ${detail}`);
};

// ---------------------------------------------------------------------------
// 1. SC 3.3.8 Accessible Authentication (Minimum), AA.
//
// W3C is explicit that requiring a user to manually transcribe a
// verification code is non-conforming: the user agent must at minimum be
// able to autofill it. Today that works only because the `input-otp`
// dependency happens to default the attribute
// (`autoComplete: a.autoComplete || "one-time-code"` in its dist bundle).
// An AA obligation on the critical sign-in path must not live inside a
// third-party default, so it is set explicitly at every call site and
// asserted here.
// ---------------------------------------------------------------------------
const OTP_COMPONENT = "src/components/portal-runtime/AuthFields.tsx";
const OTP_CALL_SITES = [
  "src/components/portal-runtime/OtpForm.tsx",
  "src/routes/portal.verify.tsx",
];

const otpSource = readCode(OTP_COMPONENT);
check(
  "otp-autocomplete/component",
  /autoComplete:\s*"one-time-code"/.test(otpSource),
  `${OTP_COMPONENT} must type OtpCodeInput's autoComplete prop as the literal "one-time-code"`,
);
check(
  "otp-autocomplete/forwarded",
  /<InputOTP[\s\S]{0,400}?autoComplete=\{autoComplete\}/.test(otpSource),
  `${OTP_COMPONENT} must forward autoComplete to the real <input> that InputOTP renders`,
);
check(
  "otp-accessible-name",
  /<Label\s+htmlFor=\{inputId\}/.test(otpSource) && /id=\{inputId\}/.test(otpSource),
  `${OTP_COMPONENT}: the OTP <input> must have a real <label for> -- it is a visually transparent input behind decorative slots and has no other source of an accessible name`,
);

for (const file of OTP_CALL_SITES) {
  const src = readCode(file);
  const uses = /<OtpCodeInput\b/.test(src);
  check(
    "otp-autocomplete/call-site",
    !uses || /autoComplete="one-time-code"/.test(src),
    `${file} renders <OtpCodeInput> without an explicit autoComplete="one-time-code"`,
  );
}

// ---------------------------------------------------------------------------
// 2. SC 1.3.1 / 3.3.2 / 4.1.2 -- every primary-path sign-in field is named.
//
// Before v7 the phone, country-code, email, identifier and password inputs
// had no <label>, no aria-label and no autocomplete: a placeholder was the
// only naming, which means a guest using a screen reader reached an unnamed
// text field and could not complete sign-in at all.
// ---------------------------------------------------------------------------
const NAMED_FIELD_FILES = [
  "src/components/portal-runtime/AuthFields.tsx",
  "src/components/portal-runtime/PasswordSignInForm.tsx",
  "src/components/portal-runtime/AuthMethodForms.tsx",
];

for (const file of NAMED_FIELD_FILES) {
  const src = readCode(file);
  const inputs = src.match(/<Input\b/g)?.length ?? 0;
  const labels = src.match(/<Label\s+htmlFor=/g)?.length ?? 0;
  check(
    "field-labels",
    labels >= inputs,
    `${file} renders ${inputs} <Input> but only ${labels} <Label htmlFor> -- every sign-in field needs a real label, not a placeholder`,
  );
  check(
    "field-autocomplete",
    (src.match(/autoComplete=/g)?.length ?? 0) >= inputs,
    `${file} renders ${inputs} <Input> but sets autoComplete on fewer of them`,
  );
}

// ---------------------------------------------------------------------------
// 3. §7.1 -- the root CSS filter must never come back.
//
// `contrast-125 saturate-150` on the shell root took --pg-ink-faint
// (#94A3B8) on white from 2.56:1 to 2.30:1: the "high contrast" control
// measurably reduced contrast on the only labelling the sign-in form had.
// Contrast is a token concern; it is never a filter (v7 §7.5).
// ---------------------------------------------------------------------------
check(
  "no-contrast-filter",
  !/\b(contrast-125|saturate-150)\b/.test(
    readCode("src/components/portal-runtime/PortalShell.tsx"),
  ),
  "PortalShell.tsx must not apply a CSS filter for contrast -- re-declare tokens instead (v7 §7.1/§7.5)",
);

// ---------------------------------------------------------------------------
// 4. §7.4-4 -- --pg-ink-faint is retired from the placeholder role and both
//     muted/faint clear 4.5:1. Recomputed here from the real token values so
//     the numbers in the comments cannot drift away from the CSS.
// ---------------------------------------------------------------------------
const css = read("src/styles.css");
const tokenOf = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1];

const srgb = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The worst *real* composite of the text zones these two tokens are used
// in: the GUEST_LEGIBILITY_CARD backing (--pg-surface at 85% alpha) over a
// near-black region of an arbitrary venue photo. 0.85 * 255 = 216.75.
const WORST_COMPOSITE = "#D9D9D9";

for (const token of ["pg-ink-muted", "pg-ink-faint"]) {
  const value = tokenOf(token);
  check("token-exists", !!value, `--${token} not found in src/styles.css`);
  if (!value) continue;
  const r = ratio(value, WORST_COMPOSITE);
  check(
    "token-contrast",
    r >= 4.5,
    `--${token} (${value}) is ${r.toFixed(2)}:1 against the worst real composite of its zone (${WORST_COMPOSITE}); AA needs 4.5:1`,
  );
}

check(
  "placeholder-not-faint",
  !/placeholder:text-\[var\(--pg-ink-faint/.test(
    readCode("src/components/portal-runtime/PortalGuestUi.tsx"),
  ),
  "PG_INPUT must not use --pg-ink-faint as its placeholder colour (v7 §7.4-4: a placeholder is not a label)",
);

// ---------------------------------------------------------------------------
if (failures.length) {
  console.error("Portal accessibility invariants FAILED:\n");
  for (const f of failures) console.error(`  x ${f}`);
  console.error(
    "\nSee docs/captive-portal-v7-design-spec.md Part 7 before changing any of these.\n",
  );
  process.exit(1);
}
console.log("Portal accessibility invariants: all checks passed.");
