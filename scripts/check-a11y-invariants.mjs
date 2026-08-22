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
 *
 * v7 Part 8 update. Two things changed under this file and it was retuned
 * rather than left to pass vacuously:
 *
 *   - The OTP control is no longer `input-otp`. §8.1 replaced six slots
 *     with one plain `<input>`, so the old "forwarded" check (which
 *     asserted `autoComplete={autoComplete}` on `<InputOTP>`) would have
 *     matched nothing and quietly reported success forever. It now
 *     asserts the attribute on the real `<input>`, and a new check makes
 *     going *back* to six boxes a failure rather than a silent
 *     regression of the paste/autofill/accessible-name behaviour §8.1
 *     exists to protect.
 *   - §8.2's 16px floor is now enforced numerically, from the real class
 *     strings, so a future tweak that drops a field back under it fails
 *     here instead of on an iPhone in a lobby.
 *
 * `scripts/test-portal-signin-fields.mjs` is the render-level companion this
 * file's original note asked for: it drives a real Chromium and proves
 * both the attribute and a real six-digit paste reach a real DOM. This
 * file stays as the cheap always-run gate.
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
  /<input[\s\S]{0,1200}?autoComplete=\{autoComplete\}/.test(otpSource),
  `${OTP_COMPONENT} must forward autoComplete to the real <input> it renders`,
);

// ---------------------------------------------------------------------------
// 1b. v7 §8.1 -- one OTP box, not six.
//
// GOV.UK's Design System is explicit that a code the user has not
// memorised belongs in a single box, and in *this* runtime the segmented
// version is specifically a liability: it breaks paste, it breaks
// `autocomplete="one-time-code"` autofill in restricted webviews, it
// fragments the accessible name, and every slot is another piece of focus
// choreography in a browser that cannot be opened in Web Inspector at all
// (§0.2). Re-introducing `input-otp` here would restore all four at once,
// and none of them are visible to `tsc`.
// ---------------------------------------------------------------------------
check(
  "otp-single-input",
  !/InputOTP/.test(otpSource),
  `${OTP_COMPONENT} must render one plain <input>, not input-otp's six slots (v7 §8.1)`,
);
check(
  "otp-input-attrs",
  /inputMode="numeric"/.test(otpSource) &&
    /maxLength=\{6\}/.test(otpSource) &&
    /pattern="\[0-9\]\*"/.test(otpSource),
  `${OTP_COMPONENT}: the OTP <input> must keep inputMode="numeric", pattern="[0-9]*" and maxLength={6} (v7 §8.1)`,
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
// 5. The guest-portal font stack: one source of truth, and zero font bytes.
//
//    The stack used to exist as FOUR hand-copied literals (PG_FONT_STACK,
//    PG_FALLBACK_FONT_STACK, `.portal-runtime .font-display`, and the
//    `-apple-system-body` Dynamic Type restore), each carrying a comment
//    asking the next person to keep them identical. Three of those are now
//    one import from `src/lib/portal-font-stack.ts`, which the type system
//    enforces for free. The fourth -- CSS -- genuinely cannot import a JS
//    constant, so that one duplicate is checked here instead of hoped for.
//
//    This is also where the "zero font bytes" decision is made mechanical.
//    It is a hard requirement, not a preference: Android's
//    `CaptivePortalLoginActivity` calls `webview.clearCache(true)` on every
//    activity creation, so a webfont on this surface is re-downloaded on
//    every visit forever and never amortises, and the standard mitigation
//    (a metric-override fallback via `size-adjust`) is unavailable because
//    ~68% of the Indian market runs an OEM UI font whose metrics are not
//    published. A future edit that quietly adds a face to the body stack
//    should fail a test, not a code review.
// ---------------------------------------------------------------------------
const normaliseStack = (v) => v.replace(/\s+/g, " ").trim();

const jsStack = stripComments(read("src/lib/portal-font-stack.ts")).match(
  /export const PG_FONT_STACK\s*=\s*'([^']+)'/,
)?.[1];
check("font-stack-js-found", !!jsStack, "PG_FONT_STACK not found in src/lib/portal-font-stack.ts");

const cssStack = stripComments(css).match(/--pg-font-stack:\s*([^;]+);/)?.[1];
check("font-stack-css-found", !!cssStack, "--pg-font-stack not found in src/styles.css");

if (jsStack && cssStack) {
  check(
    "font-stack-in-sync",
    normaliseStack(jsStack) === normaliseStack(cssStack),
    `--pg-font-stack (src/styles.css) has drifted from PG_FONT_STACK (src/lib/portal-font-stack.ts).\n` +
      `      js : ${normaliseStack(jsStack)}\n` +
      `      css: ${normaliseStack(cssStack)}`,
  );

  // `ui-sans-serif` is Safari-only per MDN's browser-compat data (not
  // Chrome, not Chrome Android, not WebView Android, not Firefox), and on
  // Safari `-apple-system` has already won at position 1. It never did
  // anything on this stack on any platform.
  check(
    "font-stack-no-ui-sans-serif",
    !/\bui-sans-serif\b/.test(jsStack),
    "PG_FONT_STACK must not contain ui-sans-serif -- Safari-only, and -apple-system already wins there",
  );

  // The Indic families carry complete Latin sets ("Noto Sans Devanagari"
  // renders "Welcome to the Wi-Fi" perfectly well). CSS font matching is
  // per character, left to right, so any of them placed ahead of the
  // generics silently restyles the ENTIRE English portal on every machine
  // where the family resolves -- a Linux/ChromeOS guest with
  // fonts-noto-devanagari installed, today.
  const generics = jsStack.indexOf("system-ui");
  const firstIndic = Math.min(
    ...['"Noto Sans', '"Nirmala UI"'].map((n) => {
      const i = jsStack.indexOf(n);
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    }),
  );
  check(
    "font-stack-indic-after-system-ui",
    generics !== -1 && firstIndic > generics,
    "every Indic family in PG_FONT_STACK must come AFTER system-ui -- they carry Latin glyphs, " +
      "so ahead of the generics they capture English too (see portal-font-stack.ts)",
  );

  // Zero font bytes: every entry has to be a name the device already has.
  check(
    "font-stack-no-webfont",
    !/url\(|@font-face|https?:/.test(jsStack),
    "PG_FONT_STACK must name only fonts the device already has -- no url(), no @font-face",
  );
}

// Exactly two definitions of the stack are allowed to exist: the JS module
// and the CSS custom property. Anything else is a fifth hand-copied literal
// growing back.
for (const file of [
  "src/components/portal-runtime/PortalShell.tsx",
  "src/lib/portal-guest-fonts.ts",
]) {
  check(
    "font-stack-not-recopied",
    !/-apple-system,/.test(readCode(file)),
    `${file} re-declares the font stack inline; import PG_FONT_STACK from @/lib/portal-font-stack instead`,
  );
}

// The portal must not reach for fonts.googleapis.com. It is not a
// walled-garden host, so pre-authentication that request is a
// guaranteed-failing DNS lookup and connection attempt, for five families
// the guest flow does not use, on the worst connection in the product.
//
// Read RAW here, not through `readCode`. `stripComments` is a line-based
// approximation that pairs `/*` with the next `*/`, and the injector it
// has to inspect is a template literal sitting right below a long prose
// comment -- one stray "/*" in that prose (a path glob, say) silently
// swallows the whole script and turns this check into a no-op that still
// reports green. Found exactly that way, by deleting the guard and
// watching this test pass. The subject here is a template literal, so
// there is nothing for comment-stripping to buy anyway.
const rootRouteRaw = read("src/routes/__root.tsx");
const injector = rootRouteRaw.match(/const LOAD_FONTS_SCRIPT = `([\s\S]*?)`;/)?.[1];
check(
  "google-fonts-injector-found",
  !!injector,
  "LOAD_FONTS_SCRIPT not found in src/routes/__root.tsx",
);
if (injector) {
  check(
    "google-fonts-gated-off-portal",
    !/fonts\.googleapis\.com/.test(injector) ||
      (/location\.pathname/.test(injector) && /"\/portal/.test(injector)),
    "LOAD_FONTS_SCRIPT injects fonts.googleapis.com without a portal.* pathname guard -- " +
      "that host is not in the walled garden, so pre-auth it is a guaranteed-failing " +
      "DNS lookup and connection attempt on the worst connection in the product",
  );
}

// 5. v7 §8.2 -- every input on the guest path is >= 16px.
//
// Under 16px, iOS zooms the page the moment the field takes focus. That is
// not a cosmetic wobble on a layout already committed to `viewport-fit=
// cover` and `dvh`: the primary button can land off-screen while the guest
// is typing into the field above it. `PG_INPUT` measured 15px right up
// until Part 8, and the base `<Input>`'s own `md:text-sm` (14px) was
// winning from 768px up on top of that -- so both the bare and the `md:`
// font-size are read out of the real class string here rather than trusted
// to a comment. Sizes are written as `calc(<n>rem * var(--pg-type-scale))`,
// and `--pg-type-scale` only ever scales *up* (v7 §7.3), so the rem
// coefficient is the floor.
// ---------------------------------------------------------------------------
const MIN_INPUT_REM = 1; // 16px at a 16px root.

const guestUi = readCode("src/components/portal-runtime/PortalGuestUi.tsx");
const pgInput = guestUi.match(/export const PG_INPUT\s*=\s*"([^"]*)"/)?.[1];
check("pg-input-found", !!pgInput, "PG_INPUT not found in PortalGuestUi.tsx");
if (pgInput) {
  const sizes = [...pgInput.matchAll(/(?:^|\s)(md:)?text-\[length:calc\(([0-9.]+)rem/g)];
  check(
    "input-font-size/declared",
    sizes.some((m) => !m[1]) && sizes.some((m) => m[1]),
    "PG_INPUT must declare both a bare and an md: font-size -- the shared <Input> base carries `text-base md:text-sm`, and a bare size alone leaves md:text-sm (14px) winning at >=768px (v7 §8.2)",
  );
  for (const m of sizes) {
    check(
      "input-font-size",
      parseFloat(m[2]) >= MIN_INPUT_REM,
      `PG_INPUT's ${m[1] ?? ""}font-size is ${m[2]}rem; v7 §8.2 requires >= ${MIN_INPUT_REM}rem (16px) or iOS auto-zooms on focus`,
    );
  }
}

const otpFontSize = otpSource.match(/fontSize:\s*"calc\(([0-9.]+)rem/)?.[1];
check(
  "otp-font-size/found",
  !!otpFontSize,
  `${OTP_COMPONENT}: OTP input declares no rem font-size`,
);
if (otpFontSize) {
  check(
    "otp-font-size",
    parseFloat(otpFontSize) >= MIN_INPUT_REM,
    `${OTP_COMPONENT}: the OTP input is ${otpFontSize}rem; v7 §8.2 requires >= ${MIN_INPUT_REM}rem (16px)`,
  );
}

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
