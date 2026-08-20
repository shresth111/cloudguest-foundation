/**
 * Render-level regression test for the guest portal's two sign-in fields.
 *
 * Run: `npm run test:signin-fields`
 * (needs Playwright's Chromium: `npx playwright install chromium`)
 *
 * WHY THIS EXISTS
 * ---------------
 * captive-portal-v7-design-spec.md §8.1 replaced `input-otp`'s six
 * segmented slots with one plain `<input>`. The three things that change
 * bought are all *runtime* behaviours, and none of them are visible to
 * `tsc` or to `scripts/check-a11y-invariants.mjs`'s source-text checks:
 *
 *   1. A guest can paste the code. SC 3.3.8 Accessible Authentication
 *      (Minimum), Level AA -- W3C is explicit that requiring manual
 *      transcription of a verification code is non-conforming.
 *   2. `autocomplete="one-time-code"` actually reaches the DOM, so the
 *      user agent can autofill it where it does work.
 *   3. The field is >= 16px, so iOS does not zoom the page on focus
 *      (§8.2).
 *
 * `check-a11y-invariants.mjs`'s own header note asked for exactly this --
 * "a real render assertion is strictly better" -- and deferred it because
 * the repo has no test runner. It still has none, but Playwright is
 * already a devDependency, so this drives a real Chromium against the
 * real component instead of adding one.
 *
 * The component under test is the real `OtpCodeInput` from
 * `src/components/portal-runtime/AuthFields.tsx`, bundled with esbuild
 * (already present transitively via Vite). The only thing substituted is
 * `PortalRuntimeContext`, which would drag in axios, the router and the
 * whole runtime service for the sake of one `t()` lookup.
 */
import { build } from "esbuild";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "otp-paste-test-"));

const failures = [];
const check = (name, ok, detail) => {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL ${name}`);
  }
};

// --- bundle the real component ---------------------------------------
const RUNTIME_STUB = `
export function usePortalRuntime() {
  return { t: (k) => ({ otpCodeLabel: "6-digit code", otpCodeHint: "Enter the 6-digit code we sent you." })[k] ?? k };
}
`;
writeFileSync(join(work, "runtime-stub.js"), RUNTIME_STUB);

writeFileSync(
  join(work, "entry.jsx"),
  `import { createRoot } from "react-dom/client";
   import { useState } from "react";
   import { OtpCodeInput, PhoneNumberFields } from "@/components/portal-runtime/AuthFields";
   function Harness() {
     const [code, setCode] = useState("");
     const [phone, setPhone] = useState("");
     return (
       <>
         <div id="otp">
           <OtpCodeInput value={code} onChange={setCode} autoComplete="one-time-code" />
         </div>
         <div id="phone">
           <PhoneNumberFields
             label="Mobile number"
             hint="We text your one-time sign-in code to this number."
             dialCode="+91"
             phone={phone}
             onPhoneChange={setPhone}
           />
         </div>
       </>
     );
   }
   createRoot(document.getElementById("root")).render(<Harness />);`,
);

await build({
  entryPoints: [join(work, "entry.jsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outfile: join(work, "bundle.js"),
  logLevel: "error",
  // The entry lives in a temp dir, so bare specifiers ("react",
  // "react-dom/client") have no node_modules above them to walk into --
  // point esbuild at the repo's own instead. It is the real React the app
  // ships, not a stub: the whole point is to exercise a real DOM.
  nodePaths: [resolve(ROOT, "node_modules")],
  plugins: [
    {
      name: "portal-aliases",
      setup(b) {
        b.onResolve({ filter: /^@\/context\/PortalRuntimeContext$/ }, () => ({
          path: join(work, "runtime-stub.js"),
        }));
        // `@/x` -> `<root>/src/x`, with the extension probing esbuild
        // would otherwise do for us (an onResolve result must be an exact
        // file path).
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          for (const p of [base, `${base}.tsx`, `${base}.ts`, join(base, "index.tsx")]) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

writeFileSync(
  join(work, "index.html"),
  `<!doctype html><meta charset=utf-8>
   <title>OTP field harness</title>
   <style>
     /* The real portal shell's own font stack and type scale -- the field
        inherits both, and 1ch (which the segmented background is pitched
        on) is a property of the resolved font. */
     :root { --pg-type-scale: 1; --pg-border: #E2E8F0; --pg-surface: #fff; --pg-ink: #0F172A; }
     body { font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans Devanagari", ui-sans-serif, sans-serif; margin: 24px; }
     .sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
   </style>
   <div id=root></div>
   <script type=module src="./bundle.js"></script>`,
);

// --- serve it (clipboard permissions are per-origin; file:// has none) --
const MIME = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const name = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = readFileSync(join(work, name));
    res.writeHead(200, { "content-type": MIME[extname(name)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// --- drive a real browser --------------------------------------------
const { chromium } = await import("playwright");
const browser = await chromium.launch();
const context = await browser.newContext();
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
const page = await context.newPage();
await page.goto(origin);
await page.waitForSelector("#otp input");

console.log("\nOTP field, rendered:");

// 1 -- one box, not six.
check(
  "single-input",
  (await page.locator("#otp input").count()) === 1,
  `expected exactly 1 <input>, found ${await page.locator("#otp input").count()} (v7 §8.1)`,
);

const input = page.locator("#otp input");

// 2 -- the AA-critical attribute survives into the real DOM.
check(
  "autocomplete-attribute",
  (await input.getAttribute("autocomplete")) === "one-time-code",
  `autocomplete is ${JSON.stringify(await input.getAttribute("autocomplete"))}, must be "one-time-code" (SC 3.3.8, AA)`,
);
check(
  "numeric-keypad",
  (await input.getAttribute("inputmode")) === "numeric" &&
    (await input.getAttribute("pattern")) === "[0-9]*",
  "the OTP input must ask for a numeric keypad (v7 §8.1)",
);

// 3 -- a real paste of "123456", through the OS clipboard and a real
//      Ctrl/Cmd-V, not a synthetic value assignment.
const paste = async (text) => {
  await input.fill("");
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await input.focus();
  await page.keyboard.press("ControlOrMeta+V");
  return input.inputValue();
};

check(
  "paste-plain",
  (await paste("123456")) === "123456",
  "pasting 123456 must land all six digits in one box",
);
check(
  "paste-spaced",
  (await paste("123 456")) === "123456",
  'a code copied as "123 456" must normalise to 123456',
);
check(
  "paste-with-surrounding-text",
  (await paste("Your Wyfy code is 123456")) === "123456",
  "a whole copied SMS line must reduce to its six digits -- guests copy the sentence, not the code",
);
check(
  "paste-overlong-truncates",
  (await paste("1234567890")) === "123456",
  "a longer paste must be bounded to six digits rather than silently accepted",
);

// 4 -- typing still works, and non-digits are rejected.
await input.fill("");
await input.focus();
await page.keyboard.type("12a34b56");
check(
  "typed-digits-only",
  (await input.inputValue()) === "123456",
  `typing "12a34b56" produced ${JSON.stringify(await input.inputValue())}`,
);

// 5 -- v7 §8.2's 16px floor, measured rather than asserted from source.
const fontPx = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
check(
  "font-size-16px-floor",
  fontPx >= 16,
  `computed font-size is ${fontPx}px; under 16px iOS zooms the page on focus (v7 §8.2)`,
);

// 6 -- accessible name and description (v7 §7.2). A placeholder is not a
//      label, and this input has no visible text of its own at all.
const naming = await input.evaluate((el) => {
  const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
  const describedBy = el.getAttribute("aria-describedby");
  const desc = describedBy ? document.getElementById(describedBy) : null;
  return { name: label?.textContent?.trim() ?? "", desc: desc?.textContent?.trim() ?? "" };
});
check(
  "accessible-name",
  naming.name.length > 0,
  "the OTP input has no <label for> -- it would reach a screen reader as an unnamed text field",
);
check(
  "accessible-description",
  naming.desc.length > 0,
  "aria-describedby must resolve to real text",
);

// 7 -- the segmented *look* is a background, not six elements. If this
//      ever stops being true the paste/focus problems come back with it.
const segmented = await input.evaluate((el) => {
  const cs = getComputedStyle(el);
  return {
    hasDashes: cs.backgroundImage.includes("repeating-linear-gradient"),
    letterSpacing: cs.letterSpacing,
  };
});
check(
  "segmented-look-is-css-only",
  segmented.hasDashes && segmented.letterSpacing !== "normal",
  "the six-box look must come from letter-spacing + a repeating background, not from markup (v7 §8.1)",
);

// --- the phone field --------------------------------------------------
console.log("\nPhone field, rendered:");

const phone = page.locator("#phone input");

// One input, and the dialling code is not one of them (v7 §8.1: a fixed
// non-editable prefix, not a country dropdown and not a second box).
check(
  "phone-single-input",
  (await page.locator("#phone input").count()) === 1,
  `expected exactly 1 <input> in the phone row, found ${await page.locator("#phone input").count()} -- the dialling code must be a fixed prefix, not an editable box (v7 §8.1)`,
);
check(
  "phone-prefix-visible",
  (await page.locator("#phone").innerText()).includes("+91"),
  "the venue's dialling code must be visible next to the field",
);
check(
  "phone-numeric-keypad",
  (await phone.getAttribute("type")) === "tel" &&
    (await phone.getAttribute("inputmode")) === "numeric",
  'the phone field must be type="tel" with inputmode="numeric" (v7 §8.1)',
);
check(
  "phone-autocomplete",
  (await phone.getAttribute("autocomplete")) === "tel-national",
  "the phone field must autocomplete as tel-national -- the number without the country code, which is what it now holds",
);

const typePhone = async (text) => {
  await phone.fill("");
  await phone.focus();
  await page.keyboard.type(text);
  return phone.inputValue();
};
const pastePhone = async (text) => {
  await phone.fill("");
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await phone.focus();
  await page.keyboard.press("ControlOrMeta+V");
  return phone.inputValue();
};

check(
  "phone-strips-pasted-dial-code",
  (await pastePhone("+91 98765 43210")) === "9876543210",
  "a pasted +91 number must lose the prefix and the spaces (v7 §8.1)",
);
check(
  "phone-strips-leading-zero",
  (await pastePhone("098765 43210")) === "9876543210",
  "a pasted trunk-prefixed number must lose the leading zero (v7 §8.1)",
);
check(
  "phone-strips-separators-typed",
  (await typePhone("98765-43210")) === "9876543210",
  "typed dashes and spaces must be stripped as they are typed",
);
check(
  "phone-keeps-real-number-starting-91",
  (await pastePhone("9198765432")) === "9198765432",
  "a bare 10-digit number that happens to start 91 is a real Indian number and must not be mistaken for a country code",
);

// No font-size check here, unlike the OTP field's: `PG_INPUT` is a class
// string and this harness deliberately does not build the app's Tailwind
// stylesheet, so the input would measure the UA default and the assertion
// would be about the harness rather than the code. That invariant is owned
// numerically by `scripts/check-a11y-invariants.mjs`, which reads the real
// `PG_INPUT` and rejects anything under 1rem in either the bare or the
// `md:` variant. The OTP field is checked here because its size is an
// inline style and therefore really is under test.

const phoneNaming = await phone.evaluate((el) => {
  const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
  const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
  return {
    name: label?.textContent?.trim() ?? "",
    described: ids.map((i) => document.getElementById(i)?.textContent?.trim() ?? ""),
  };
});
check("phone-accessible-name", phoneNaming.name.length > 0, "the phone input has no <label for>");
check(
  "phone-prefix-is-announced",
  phoneNaming.described.some((d) => d.includes("+91")),
  "the fixed dialling-code prefix must be in the field's accessible description -- otherwise a screen-reader guest reaches an unexplained ten-digit field (v7 §7.2)",
);
check(
  "phone-reason-is-announced",
  phoneNaming.described.some((d) => d.length > 20),
  "the 'why we ask' sentence must be wired to the field, not just placed near it (v7 §8.3-2)",
);

await browser.close();
server.close();

if (failures.length) {
  console.error("\nSign-in field regression test FAILED:\n");
  for (const f of failures) console.error(`  x ${f}`);
  console.error("\nSee docs/captive-portal-v7-design-spec.md §8.1/§8.2.\n");
  process.exit(1);
}
console.log("\nSign-in field regression test: all checks passed.");
