/**
 * Regression test: an active impersonation must not be bounced by the
 * master-hostname guards.
 *
 * FAILURE MODE THIS LOCKS DOWN: "View as this customer" could not reach a
 * single one of the pages it exists to show. Two hostname checks sent it
 * away, and neither knew impersonation existed:
 *
 *   1. `src/routes/index.tsx` -- master.customers.tsx ends the impersonation
 *      handshake with `navigate({ to: "/" })`. On the master hostname
 *      IndexRedirect's effect forwarded that to /master.
 *   2. `src/routes/_authenticated.tsx` -- on the master hostname every path
 *      not starting with /master was redirected to /master, which is every
 *      customer route the impersonated session would go on to try
 *      (/c/*, /workspace/*).
 *
 * Both landed on /master, whose own beforeLoad then rejected the session --
 * an impersonated session carries the TARGET's organization-scoped roles,
 * never a global one -- and bounced it to /master-login. The operator ended
 * up staring at the operator sign-in form with a live impersonation
 * countdown banner running above it. Reported live: "ye view as a customer
 * muje app.wyfyguest pr uske dashboard pr nahi le jata hai".
 *
 * Both guards must therefore consult the ACTIVE token's own impersonation
 * claim -- the same source ImpersonationBanner derives its presence from
 * (`getActiveImpersonationClaim`, src/lib/jwt.ts), never a second flag that
 * could drift from it.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * scripts/test-portal-cna-storage-safety.mjs's own note). The invariant is a
 * property of the guards themselves, so it is checked where they live.
 *
 * Run: node scripts/test-impersonation-reaches-customer-pages.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLAIM = "getActiveImpersonationClaim";

const GUARDS = [
  {
    file: "src/routes/index.tsx",
    what: "the bare root's master-hostname branch",
    // The hostname comparison that decides whether this is the operator
    // console, and the redirect it drives.
    anchor: /isMaster\s*=\s*hostname\s*===\s*"master\.wyfyguest\.com"/,
    consequence: 'navigate({ to: "/master" }) on the impersonated session',
  },
  {
    file: "src/routes/_authenticated.tsx",
    what: "the authenticated layout's master-hostname branch",
    anchor: /window\.location\.hostname\s*===\s*"master\.wyfyguest\.com"/,
    consequence: 'redirect({ to: "/master" }) from every customer route',
  },
];

/** Comments in these files discuss `getActiveImpersonationClaim` at length.
 *  A prose mention is not a call, and an earlier draft of this test happily
 *  passed against the un-fixed guards because of exactly that -- so strip
 *  comments before looking for one. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const failures = [];
for (const guard of GUARDS) {
  const source = stripComments(readFileSync(join(ROOT, guard.file), "utf8"));

  if (!guard.anchor.test(source)) {
    failures.push(
      `${guard.file}: could not find ${guard.what}.\n` +
        `    This test no longer checks what it claims to. Re-point the anchor\n` +
        `    at wherever the master-hostname decision moved to.`,
    );
    continue;
  }

  if (!new RegExp(`\\b${CLAIM}\\s*\\(`).test(source)) {
    failures.push(
      `${guard.file}: ${guard.what} never consults ${CLAIM}().\n` +
        `    (a mention in a comment does not count -- it must be called.)\n` +
        `    An active impersonation will get ${guard.consequence},\n` +
        `    and /master will bounce it to /master-login.`,
    );
  }
}

// The claim must keep coming from the token, not from a parallel flag.
const jwt = readFileSync(join(ROOT, "src/lib/jwt.ts"), "utf8");
if (!new RegExp(`export function ${CLAIM}\\b`).test(jwt)) {
  failures.push(
    `src/lib/jwt.ts: ${CLAIM} is gone. Both hostname guards and\n` +
      `    ImpersonationBanner derive "is an impersonation running" from it;\n` +
      `    they must keep sharing one source of truth.`,
  );
}

if (failures.length > 0) {
  console.error("FAIL: an impersonated session can be bounced off the customer pages\n");
  for (const failure of failures) console.error(failure + "\n");
  process.exit(1);
}

console.log(`PASS: ${GUARDS.length} master-hostname guards defer to an active impersonation`);
