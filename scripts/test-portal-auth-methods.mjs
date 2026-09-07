/**
 * Which sign-in methods a guest is actually offered -- driven against the
 * real `src/lib/portal-auth-methods.ts`, not a reimplementation of it.
 *
 * Run: `node scripts/test-portal-auth-methods.mjs`
 *
 * WHY THIS EXISTS
 * ---------------
 * Password sign-in is retired from the guest portal (asked for twice by
 * the founder). The removal is one constant, `PASSWORD_SIGN_IN_OFFERED`,
 * enforced inside `isEnabled` -- the single chokepoint the real guest flow
 * (portal.welcome / portal.auth.index / portal.auth.$method) and the admin
 * preview (preview.portal.$locationId) both resolve methods through, which
 * is the property that module's own docstring exists to guarantee.
 *
 * A constant is exactly the kind of thing `tsc` and eslint cannot defend.
 * Nothing about `usernamePasswordEnabled: true` reaching a guest's screen
 * is a type error, and the venue flag is still `true` in production for
 * every location provisioned before this change -- so the ONLY thing
 * standing between a live venue's stored config and a password form is
 * this one boolean. That deserves a test that fails loudly, and it must
 * pin the two things a well-meaning refactor would break independently:
 *
 *   1. Password is not offered even when the venue's own flag is on.
 *      (A refactor that "simplifies" `isEnabled` back to reading the
 *      config directly restores the form for every existing venue at
 *      once, silently.)
 *   2. Nothing ELSE was removed with it. OTP (all three channels) and
 *      vouchers are the methods guests are left with, and the priority
 *      order that decides which form a guest lands on must be unchanged
 *      apart from password's absence.
 *
 * It also pins the two set-password prompts, because they are the half of
 * this that is easy to forget: a guest invited to save a password that no
 * sign-in form will ever offer to accept is worse off than under either
 * keeping the feature or removing it. Both prompts ask
 * `passwordSignInOffered`, so asserting on that helper covers both.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/ci-gated-test.sh`). `portal-auth-methods.ts` imports nothing at
 * runtime -- only types -- so esbuild can bundle the real module with no
 * stubs at all, and every assertion below runs against the shipped code.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-auth-methods-"));

await build({
  entryPoints: [join(SRC, "lib/portal-auth-methods.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const {
  AUTH_METHOD_PRIORITY,
  AUTH_METHOD_LABEL_KEY,
  PASSWORD_SIGN_IN_OFFERED,
  passwordSignInOffered,
  enabledAuthMethods,
  primaryAuthMethod,
  otherAuthMethods,
} = await import(join(work, "bundle.mjs"));

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

/** A resolved config with every method the backend can report turned on --
 * which is close to what a real venue provisioned before this change
 * actually has stored, since `username_password_enabled` defaulted to
 * `true` for every location. */
const ALL_ON = {
  otpSmsEnabled: true,
  otpEmailEnabled: true,
  otpWhatsappEnabled: true,
  usernamePasswordEnabled: true,
  voucherEnabled: true,
};

console.log("portal sign-in methods");

// --- 1. Password sign-in is retired ----------------------------------
{
  check(
    "the platform switch is off",
    PASSWORD_SIGN_IN_OFFERED === false,
    `PASSWORD_SIGN_IN_OFFERED is ${PASSWORD_SIGN_IN_OFFERED}`,
  );
  check(
    "password is NOT offered even when the venue's own flag is on",
    !enabledAuthMethods(ALL_ON).includes("username_password"),
    JSON.stringify(enabledAuthMethods(ALL_ON)),
  );
  check(
    "...and that is the venue state that actually exists in production",
    ALL_ON.usernamePasswordEnabled === true,
    "if this fixture is ever flipped to false the check above proves nothing",
  );
  check(
    "a venue with ONLY password enabled is offered nothing, not a password form",
    enabledAuthMethods({
      otpSmsEnabled: false,
      otpEmailEnabled: false,
      otpWhatsappEnabled: false,
      usernamePasswordEnabled: true,
      voucherEnabled: false,
    }).length === 0,
    "such a venue gets the portal's own 'contact reception' state, which is honest -- " +
      "offering a form nothing will accept is not",
  );
  check(
    "password is never the method a guest lands on",
    primaryAuthMethod(ALL_ON) !== "username_password",
    String(primaryAuthMethod(ALL_ON)),
  );
  check(
    "password is never a 'use X instead' fallback link either",
    !otherAuthMethods(ALL_ON, "otp_sms").includes("username_password"),
    JSON.stringify(otherAuthMethods(ALL_ON, "otp_sms")),
  );
}

// --- 2. The set-password prompts go with it --------------------------
{
  check(
    "passwordSignInOffered is false for a venue with the flag on",
    passwordSignInOffered(ALL_ON) === false,
    "portal.verify.tsx's post-OTP hand-off and portal.session.tsx's nudge both ask this -- " +
      "a guest must never be asked to save a credential nothing will accept",
  );
  check(
    "passwordSignInOffered tolerates a config that has not resolved yet",
    passwordSignInOffered(undefined) === false && passwordSignInOffered(null) === false,
    "both call sites reach it as `config?`, which is undefined on first render",
  );
}

// --- 3. Nothing else was removed -------------------------------------
{
  const left = enabledAuthMethods(ALL_ON);
  check(
    "OTP over SMS, email and WhatsApp all survive",
    ["otp_sms", "otp_email", "otp_whatsapp"].every((m) => left.includes(m)),
    JSON.stringify(left),
  );
  check("vouchers survive", left.includes("voucher"), JSON.stringify(left));
  check(
    "the four surviving methods keep their existing priority order",
    JSON.stringify(left) === JSON.stringify(["otp_sms", "otp_email", "otp_whatsapp", "voucher"]),
    JSON.stringify(left),
  );
  check(
    "SMS OTP is still what a guest lands on when it is enabled",
    primaryAuthMethod(ALL_ON) === "otp_sms",
    String(primaryAuthMethod(ALL_ON)),
  );
  check(
    "a venue with only vouchers still gets vouchers",
    primaryAuthMethod({
      ...ALL_ON,
      otpSmsEnabled: false,
      otpEmailEnabled: false,
      otpWhatsappEnabled: false,
    }) === "voucher",
  );
  check(
    "an unconfigured venue still resolves to null, not a crash",
    primaryAuthMethod({
      otpSmsEnabled: false,
      otpEmailEnabled: false,
      otpWhatsappEnabled: false,
      usernamePasswordEnabled: false,
      voucherEnabled: false,
    }) === null,
  );
}

// --- 4. The enum member itself stays --------------------------------
//
// `username_password` is still the `auth_method` on live and historical
// `guest_sessions` rows, and the backend endpoint is deliberately left in
// place (gated by the venue flag) so a venue running on it today is not
// cut off mid-visit. Deleting the member, its label key or its i18n string
// would break rendering of data that already exists -- which is a
// different and worse bug than the one being fixed.
{
  check(
    "the RuntimeAuthMethod value is still known to the priority list",
    AUTH_METHOD_PRIORITY.includes("username_password"),
    "historical guest_sessions rows carry this value; it must stay renderable",
  );
  check(
    "...and still has a label key for rendering those rows",
    AUTH_METHOD_LABEL_KEY.username_password === "passwordLogin",
    String(AUTH_METHOD_LABEL_KEY.username_password),
  );
}

// --- 5. The direct URL is closed too ---------------------------------
//
// `/portal/auth/$method` used to validate its param STRUCTURALLY only --
// "is this a known method name" -- against its own hardcoded `METHODS`
// list, never against the venue's config. So `/portal/auth/username_password`
// typed by hand or reached from a bookmark rendered a full password form
// at a venue that has the method off, and every submission was refused by
// the backend's own `_require_method_enabled`. (Same for
// `/portal/auth/otp_whatsapp` at a venue with no WhatsApp template -- this
// is a pre-existing gap, not one password login introduced.)
//
// It matters more now. A form still reachable by URL is exactly the "the
// UI is gone but the door is open" half-removal that makes a retirement
// not a retirement. The route now redirects such a method to `/portal/auth`,
// which is itself a `beforeLoad` redirect on to `/portal/welcome` -- the
// real sign-in card, offering what the venue actually has.
//
// Source-level, deliberately: rendering that route for real would need
// stubs for the router, the query client, five form components, toast and
// the whole runtime context -- and the thing being asserted is that the
// route CONSULTS the config at all, which the text shows directly. The
// behaviour those two symbols produce is what everything above this point
// already tests.
{
  const route = readFileSync(join(SRC, "routes/portal.auth.$method.tsx"), "utf8");
  check(
    "the per-method route asks which methods the venue actually offers",
    /enabledAuthMethods/.test(route),
    "without it the route validates the method name and nothing else, so any method's " +
      "form renders at any venue -- including the retired password form",
  );
  check(
    "...and a method the venue does not offer never renders its form",
    /notOffered/.test(route) &&
      (route.match(/\{m === "[a-z_]+" && !notOffered &&/g) || []).length === 5,
    "each of the five forms must be gated: the redirect is an effect, so the render " +
      "before it still happens and would flash the form -- a credential field, for password",
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
