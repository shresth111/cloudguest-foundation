/**
 * Regression test for the whitelist-only refusal screen: the discriminator
 * (`src/lib/portal-whitelist-refusal.ts`), its wiring into the two moments
 * a refusal can arrive at (`src/components/portal-runtime/
 * useGuestSignIn.ts`), and the screen's own two hard rules
 * (`src/routes/portal.not-listed.tsx`).
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * A property in whitelist-only mode admits only guests on its Always
 * Allowed list and refuses everyone else *at the portal*. The backend
 * models that refusal as its own exception -- `WhitelistOnlyAccessDenied
 * Error`, deliberately separate from `GuestAccessDeniedError` -- because
 * the two are different facts. A blocklist hit means "an operator wrote a
 * rule about YOU". A whitelist-only refusal means "an operator wrote a
 * rule about EVERYONE ELSE", and that guest has not been blocked
 * anywhere; they would sign in normally at the same chain's next
 * property.
 *
 * The catch, and the reason this file exists: **that distinction does not
 * currently survive the trip to the browser.** Both exceptions serialise
 * as a bare 403 with the human message and an empty `data`, and this
 * app's `toAppError` collapses every 403 to `code: "forbidden"`. So the
 * portal has to tell them apart from the message, and the ways that can
 * go wrong are both bad:
 *
 *   1. A BLOCKLIST DENIAL MISREAD AS A WHITELIST REFUSAL would tell a
 *      barred person "ask reception and they can add you in a moment",
 *      sending them to a front desk that is going to refuse them.
 *   2. A WHITELIST REFUSAL MISREAD AS A GENERIC AUTH ERROR puts the
 *      guest back where this feature started: a red line under a field
 *      and no idea what to do.
 *
 * And underneath both, the rule that must never break: the matched rule's
 * `reason` is operator-authored ("ex-employee, do not readmit") and must
 * never reach a guest's screen.
 *
 * So the assertions below are, in order of how much damage the failure
 * does:
 *
 *   1. THE DISCRIMINATOR. The backend's default denied message and a
 *      venue's own customised one are both recognised; a blocklist
 *      message, a 401/422/500, and an empty message are all rejected.
 *   2. THE FORWARD-COMPATIBLE CODE PATH. The day the backend starts
 *      sending a real machine-readable code, it must win -- and an
 *      unrecognised code must fall through to the message check rather
 *      than hard-failing.
 *   3. BOTH REFUSAL MOMENTS ARE WIRED. The backend gates this at
 *      `POST /otp/request` (so a refused guest never costs the venue an
 *      SMS) *and* at the login call. Handling only one leaves a real
 *      path landing on a red inline error.
 *   4. THE SCREEN'S HARD RULES. It must never render `AppError.message`
 *      (the reason-leak path) and must carry no "request access" control
 *      (there is no staff notification path behind it).
 *   5. TEN-LANGUAGE COVERAGE. `translate()` falls back per key in
 *      silence, so a missing key ships as English inside an otherwise
 *      translated refusal screen.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs` for the same note). The pure
 * module is bundled with esbuild and executed for real; the wiring is
 * checked against the real component source.
 *
 * Run: node scripts/test-portal-whitelist-refusal.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "portal-whitelist-refusal-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(ROOT, "src/lib/portal-whitelist-refusal.ts"))};\n`,
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
const { isWhitelistOnlyRefusal, BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE } = await import(
  bundle
);

const err = (over = {}) => ({ status: 403, code: "forbidden", message: "", data: {}, ...over });

// The venue's own words, as an operator would write them.
const VENUE = "Ask the front desk to add your number to the guest list.";
// What a BLOCKLIST denial actually looks like on the wire -- note that the
// backend appends the operator's reason to the message, which is exactly
// why this must never be routed to a screen, nor rendered verbatim.
const BLOCKLIST =
  "Access denied by an active guest access control rule: ex-employee, do not readmit";

console.log("\n1. the discriminator: what is, and is not, a whitelist-only refusal");
check(
  "the backend's own default denied message is recognised",
  isWhitelistOnlyRefusal(err({ message: BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE })),
);
check(
  "a venue's customised message is recognised when the config is passed",
  isWhitelistOnlyRefusal(err({ message: VENUE }), VENUE),
);
check(
  "...and whitespace/case skew between the stored and returned copy still matches",
  isWhitelistOnlyRefusal(err({ message: `  ${VENUE.toUpperCase()}\n` }), VENUE),
);
check(
  "A BLOCKLIST DENIAL IS NOT ROUTED HERE -- the assertion that matters most",
  !isWhitelistOnlyRefusal(err({ message: BLOCKLIST }), VENUE),
);
check(
  "a venue message that was never configured cannot widen the match",
  !isWhitelistOnlyRefusal(err({ message: VENUE }), null),
);
check("an empty message is not a refusal", !isWhitelistOnlyRefusal(err({ message: "" }), VENUE));
for (const status of [400, 401, 404, 422, 429, 500]) {
  check(
    `a ${status} carrying the very same text is not a refusal (403 only)`,
    !isWhitelistOnlyRefusal(
      err({ status, message: BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE }),
      VENUE,
    ),
  );
}

console.log("\n2. the forward-compatible machine-readable code");
check(
  "a real code wins, whatever the message says",
  isWhitelistOnlyRefusal(
    err({
      message: "some future rewording nobody told the frontend about",
      data: { code: "whitelist_only_access_denied" },
    }),
  ),
);
check(
  "...and is read from error_code too",
  isWhitelistOnlyRefusal(
    err({ message: "x", data: { error_code: "WHITELIST_ONLY_ACCESS_DENIED" } }),
  ),
);
check(
  "an unrecognised code falls THROUGH to the message check, never hard-fails",
  isWhitelistOnlyRefusal(
    err({
      message: BACKEND_DEFAULT_WHITELIST_ONLY_DENIED_MESSAGE,
      data: { code: "something_else" },
    }),
  ),
);
check(
  "a blocklist carrying its own future code is still not routed here",
  !isWhitelistOnlyRefusal(
    err({ message: BLOCKLIST, data: { code: "guest_access_denied" } }),
    VENUE,
  ),
);

console.log("\n3. both refusal moments are wired into the sign-in hook");
const hook = readFileSync(join(ROOT, "src/components/portal-runtime/useGuestSignIn.ts"), "utf8");
check("the hook imports the discriminator", hook.includes("isWhitelistOnlyRefusal"));
// The OTP-request gate is the one that stops a refused guest costing the
// venue a real SMS; the login gate is the one that was always there and
// still fires when check_portal_admission fails open.
const sendOtpBlock = hook.slice(hook.indexOf("const sendOtp"), hook.indexOf("const verifyOtp"));
const verifyBlock = hook.slice(
  hook.indexOf("const verifyOtp"),
  hook.indexOf("const loginPassword"),
);
const passwordBlock = hook.slice(
  hook.indexOf("const loginPassword"),
  hook.indexOf("async function afterLogin"),
);
check("moment 1: POST /otp/request is routed", sendOtpBlock.includes("handledAsWhitelistRefusal"));
check("moment 2: the OTP login call is routed", verifyBlock.includes("handledAsWhitelistRefusal"));
check(
  "the password login path is routed too (same _enforce_access_control)",
  passwordBlock.includes("handledAsWhitelistRefusal"),
);
check(
  "the refusal short-circuits before the inline error is set",
  /handledAsWhitelistRefusal\([^)]*\)\) return;/.test(sendOtpBlock),
);
check(
  "...and before a server cooldown is applied (no SMS was sent, nothing to wait out)",
  sendOtpBlock.indexOf("handledAsWhitelistRefusal") < sendOtpBlock.indexOf("applyServerCooldown"),
);
check(
  "preview/demo flows never navigate to a real refusal",
  /previewMode \|\| demoMode/.test(
    hook.slice(hook.indexOf("function handledAsWhitelistRefusal"), hook.indexOf("const sendOtp")),
  ),
);

console.log("\n4. the screen's two hard rules");
const screen = readFileSync(join(ROOT, "src/routes/portal.not-listed.tsx"), "utf8");
const code = screen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check(
  "NEVER renders the operator-authored reason: no AppError/error message is read",
  !/\berror\.message\b|\be\.message\b|AppError/.test(code),
);
check(
  "the only free text is the venue's own whitelistOnlyDeniedMessage",
  code.includes("whitelistOnlyDeniedMessage"),
);
check(
  "no 'request access' control (there is no staff notification path behind it)",
  !/request[\s_-]?access/i.test(code),
);
check("exactly one action on the page", (code.match(/<button/g) || []).length === 1);
check("...and it is the retry, back to the sign-in card", code.includes('to: "/portal/auth"'));
check(
  "the venue message replaces the default body, it does not stack with it",
  code.includes("venueMessage ??") && code.includes("!venueMessage &&"),
);

console.log("\n5. every guest-facing key exists in all ten dictionaries");
const i18n = readFileSync(join(ROOT, "src/lib/portal-i18n.ts"), "utf8");
const DICTS = ["EN", "HI", "BN", "MR", "TE", "TA", "GU", "KN", "ML", "PA"];
const KEYS = [
  "notListedTitle",
  "notListedBody",
  "notListedNextStepLead",
  "notListedNextStep",
  "notListedRetryPrompt",
  "notListedRetry",
  "notListedContactPhone",
  "notListedContactEmail",
];
// Slice the file into its ten dictionaries so a key present ten times in
// one dictionary cannot pass for a key present once in each.
const bounds = DICTS.map((d) => ({ d, at: i18n.indexOf(`const ${d}: Dict = {`) }));
check(
  "all ten dictionaries are present and in order",
  bounds.every((b, i) => b.at > 0 && (i === 0 || b.at > bounds[i - 1].at)),
);
for (const [i, { d, at }] of bounds.entries()) {
  const end = i + 1 < bounds.length ? bounds[i + 1].at : i18n.length;
  const body = i18n.slice(at, end);
  const missing = KEYS.filter((k) => !new RegExp(`^  ${k}:`, "m").test(body));
  check(`${d}: all ${KEYS.length} refusal keys present`, missing.length === 0, missing.join(", "));
}
// The {contact} placeholder is substituted by the route; a dictionary that
// dropped it would render "Try a different" with nothing after it.
for (const key of [
  "notListedBody",
  "notListedNextStep",
  "notListedRetryPrompt",
  "notListedRetry",
]) {
  const occurrences = (i18n.match(new RegExp(`^  ${key}:[\\s\\S]*?",$`, "gm")) || []).filter((m) =>
    m.includes("{contact}"),
  );
  check(`${key} keeps the {contact} placeholder in all ten`, occurrences.length === 10);
}
check(
  "the route substitutes the placeholder rather than printing it",
  screen.includes('replace("{contact}"'),
);

console.log(
  failures === 0
    ? "\nwhitelist-only refusal: all checks passed"
    : `\nwhitelist-only refusal: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
