/**
 * A rejected controller must be repairable from the Master console.
 *
 * THE DEFECT, AND WHY IT GATES FIX-PLAN FE-0
 * ------------------------------------------
 * A live integration sits in `auth_failed`, whose status text reads: "The
 * controller rejected our sign-in. The stored credentials are no longer valid
 * -- replace them to reconnect." The sentence names an action, and the only UI
 * that offered it was the CUSTOMER Network Integrations page.
 *
 * FE-0 retires that page, because backend `074d719` made every
 * `network_integrations.*` route GLOBAL-scoped and dropped the org-scoped
 * grants, so it 403s for a venue owner. Retiring it without this change would
 * leave a rejected controller unfixable by anybody, from anywhere -- the venue
 * owner cannot reach the page, and the operator never had the control. Hence
 * this ships before or with FE-0, not after it.
 *
 * Same for delete: `DELETE /{integration_id}` has existed all along with
 * nothing in Master calling it, so "remove it and re-run provisioning" was not
 * available either.
 *
 * WHAT WAS ALREADY THERE, and is deliberately not rebuilt: the connectivity
 * probe and the enable/disable pair. Both exist in `IntegrationDrawer` and
 * landed in `d4acedb`; a report that the page has "no per-row action of any
 * kind" was made against PRODUCTION, which predates that commit. Asserted
 * below so a future reader does not remove them believing they were never
 * real.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. CREDENTIAL REPLACEMENT EXISTS AND IS REACHABLE, and it honours
 *      `auth_mode` -- the operator pair always, the app pair additionally for
 *      `openapi`, validated with the same predicate the connect wizard uses.
 *   2. IT DOES NOT CLAIM TO HAVE RECONNECTED. Storing a secret is not proof
 *      the controller accepts it. A green toast with nothing behind it is
 *      this codebase's characteristic bug.
 *   3. THE OPERATOR'S CALL CARRIES THE INTEGRATION'S OWN ORG ID, not the
 *      caller's membership. A platform operator is not a member of the tenant
 *      whose controller they are repairing.
 *   4. DELETE IS GUARDED BY TYPING THE NAME and says what it costs the venue.
 *   5. THE TILES NEVER RENDER AN UNRESOLVED COUNT AS ZERO.
 *   6. THE PAGE HEADER DESCRIBES CONTROLS THAT EXIST.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The credential
 * predicate is bundled and executed; the screen and service are asserted
 * against their real sources.
 *
 * Run: node scripts/test-master-integration-repair.mjs
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
/** Comments here quote the defects they replaced, so assertions about what
 * the code DOES must read code. Same reason as
 * `scripts/test-master-locations-safety.mjs`. */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = read("src/routes/master.integrations.tsx");
const pageCode = stripComments(page);
const service = read("src/services/network-integration.service.ts");
const serviceCode = stripComments(service);

/* ── 1. Credential replacement exists and honours auth_mode ────────────── */

console.log("\n1. A rejected controller can have its credentials replaced");

check(
  "the service exposes an operator-scoped credential replacement",
  /async replacePlatformCredentials\(/.test(serviceCode),
);
check(
  "it posts to the only credential route that exists",
  /\$\{BASE\}\/\$\{integration\.id\}\/credentials/.test(serviceCode),
  "there is no /platform/.../credentials route",
);
check("the drawer calls it", /replacePlatformCredentials\(/.test(pageCode));
check(
  "the form is reachable from the drawer",
  /Replace credentials/.test(page) && /setCredsOpen\(true\)/.test(pageCode),
);
check(
  "it opens already when the status is the one it repairs",
  /useState\(integration\.status === "auth_failed"\)/.test(pageCode),
);
check(
  "completeness is judged by the shared predicate, not a local rule",
  /credentialsCompleteForMode\(integration\.authMode, creds\)/.test(pageCode),
  "the wizard and this form must agree on what a complete credential set is",
);
check(
  "the app pair is asked for only in openapi mode",
  /integration\.authMode === "openapi" && \(/.test(pageCode),
);
check(
  "the operator pair is always asked for",
  /Operator username/.test(page) && /Operator password/.test(page),
);
check(
  "save is disabled until the set is complete, with a reason",
  /disabled=\{!credsComplete \|\| busy\}/.test(pageCode) &&
    /Fill in the operator username and password/.test(page),
);
check("secrets are typed as passwords", /type=\{secret \? "password" : "text"\}/.test(pageCode));
check("and are not offered to a password manager", /autoComplete="off"/.test(pageCode));

/* ── 2. It does not claim more than it did ─────────────────────────────── */

console.log("\n2. Storing a secret is not claimed as reconnecting");

check(
  "success says stored, not connected",
  /New credentials stored\./.test(page) && !/Reconnected/.test(page),
);
check("and points at the probe that would prove it", /Run Test connectivity to confirm/.test(page));
check("the draft is cleared once it leaves the browser", /setCreds\(\{\}\)/.test(pageCode));

/* ── 3. The operator acts on the tenant's integration ──────────────────── */

console.log("\n3. The request carries the integration's org, not the caller's");

check(
  "replacePlatformCredentials sends the integration's own organization id",
  /headers: \{ "X-Organization-Id": integration\.organizationId \}/.test(serviceCode),
);
check(
  "it does not use the membership-scoped resolver",
  !/async replacePlatformCredentials[\s\S]{0,900}orgHeaders\(\)/.test(serviceCode),
  "a platform operator is not a member of the tenant they are repairing",
);

/* ── 4. Delete, guarded ────────────────────────────────────────────────── */

console.log("\n4. Delete is guarded and states what it costs");

check("the service exposes it", /async deletePlatformIntegration\(/.test(serviceCode));
check("the drawer offers it", /deletePlatformIntegration\(integration\)/.test(pageCode));
check(
  "it is gated on typing the integration's name",
  /deleteConfirmed/.test(pageCode) &&
    /deleteTyped\.trim\(\)\.toLowerCase\(\) === integration\.name\.trim\(\)\.toLowerCase\(\)/.test(
      pageCode,
    ),
);
check(
  "the destructive button is disabled until it matches, with a reason",
  /disabled=\{!deleteConfirmed \|\| remove\.isPending\}/.test(pageCode) &&
    /Type the integration's name to confirm/.test(page),
);
check(
  "the dialog says what it costs the venue's guests",
  /Guests at this venue stop being signed in/.test(page),
);
check(
  "and points at the cheaper fix first",
  /Replace credentials above fixes that/.test(page),
  "an operator reaching for delete over a credential problem should be told",
);

/* ── 5. Tiles never render an unresolved count as zero ─────────────────── */

console.log("\n5. The tiles and the table cannot contradict each other");

check("no tile falls back to zero", !/summary\.data\?\.\w+ \?\? 0\}/.test(pageCode));
check("an absent count renders as an em dash", /function statValue\(/.test(page));
check(
  "every count tile goes through it",
  (pageCode.match(/statValue\(summary\.data\?\./g) ?? []).length >= 8,
  `${(pageCode.match(/statValue\(summary\.data\?\./g) ?? []).length} tiles`,
);

/* ── 6. The header describes controls that exist ───────────────────────── */

console.log("\n6. The page header no longer promises what it lacks");

check(
  "the 'read-only apart from' claim is gone",
  !/Read-only apart from/.test(page),
  "it promised a switch and a probe as the only controls, and now understates",
);
check(
  "the header names the real controls",
  /replace its credentials/.test(page) && /remove it/.test(page),
);

// Already present before this change, and asserted so nobody removes them
// believing the production report that they never existed.
check("the connectivity probe still exists", /testPlatformConnection\(id\)/.test(pageCode));
check(
  "enable and disable still exist",
  /enablePlatformIntegration\(id\)/.test(pageCode) &&
    /disablePlatformIntegration\(id\)/.test(pageCode),
);

/* ── 7. The shared credential predicate ────────────────────────────────── */

console.log("\n7. auth_mode decides which credentials are required");

const outdir = mkdtempSync(join(tmpdir(), "integration-repair-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { credentialsCompleteForMode } from "${join(ROOT, "src/types/network-integration.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { credentialsCompleteForMode } = await import(`file://${outfile}`);

const operator = { username: "u", password: "p" };
const app = { clientId: "c", clientSecret: "s" };

check("legacy needs the operator pair", credentialsCompleteForMode("legacy", operator));
check("legacy rejects a half pair", !credentialsCompleteForMode("legacy", { username: "u" }));
check("openapi needs BOTH pairs", credentialsCompleteForMode("openapi", { ...operator, ...app }));
check(
  "openapi rejects the app pair alone",
  !credentialsCompleteForMode("openapi", app),
  "guests are let online through the operator account whichever mode is chosen",
);
check("openapi rejects the operator pair alone", !credentialsCompleteForMode("openapi", operator));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
