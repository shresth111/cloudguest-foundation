/**
 * "I provision a TP-Link customer and nothing appears on the Omada side."
 *
 * THE ANSWER WAS THAT MOST OF IT WAS BUILT AND NEVER RAN
 * -----------------------------------------------------
 * `_configure_controller` writes the External Portal Server URL onto the
 * SSID, adds the Pre-Authentication Access entry, and creates the hotspot
 * operator account itself -- generating the password with `secrets` and
 * encrypting it before the controller is asked to make the account. The routes
 * existed at GLOBAL scope. Nothing in any console called them, so operators
 * were talked through doing all of it by hand, including inventing and
 * remembering an operator password the platform was willing to generate.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. THE OUTCOME MAPPER NEVER THROWS AND NEVER DROPS. The backend's
 *      `ControllerSetupOutcome` shape could not be read from any source when
 *      this was written -- it post-dates the checkout to hand and is in no
 *      contract document. So the mapper reads what it hopes for, keeps
 *      everything in `raw`, and survives a body shaped nothing like its
 *      guess. This is the assertion that stops a wrong guess becoming a blank
 *      panel over a run that changed a customer's controller. The same class
 *      of mistake -- frontend sending a shape the backend ignored, 201
 *      returned, nothing stored, test asserting the same wrong place -- has
 *      already cost this project once.
 *   2. PREVIEW BEFORE APPLY IS ENFORCED, not advised. Apply writes to a live
 *      controller.
 *   3. THE GAPS ARE RENDERED IN DEPENDENCY ORDER with the action that closes
 *      each. `OPENAPI_REQUIRED` must route to Replace credentials: the live QA
 *      venue was onboarded in hotspot-operator mode, which automatic setup
 *      refuses outright, so this is the gap real venues actually hit.
 *   4. TAKING OVER AN SSID'S PORTAL IS CONFIRMED and off by default.
 *   5. SUCCESS DOES NOT CLAIM A GUEST CAN GET ONLINE. Configuring a controller
 *      and a guest reaching the internet are different claims with different
 *      proofs.
 *   6. THE WRITTEN STEPS CARRY BOTH ENDS -- the prerequisites the platform
 *      will never create, and the fact that the automatic path does steps 1-2
 *      for you.
 *
 * Run: node scripts/test-controller-auto-setup.mjs
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
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = read("src/routes/master.integrations.tsx");
const pageCode = stripComments(page);
const service = read("src/services/network-integration.service.ts");
const serviceCode = stripComments(service);
const steps = read("src/components/network-integrations/OmadaPortalSetupSteps.tsx");

const outdir = mkdtempSync(join(tmpdir(), "auto-setup-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { CONTROLLER_SETUP_GAP_COPY, CONTROLLER_SETUP_GAP_ORDER, isControllerSetupGap }
     from "${join(ROOT, "src/types/network-integration.ts").replace(/\\/g, "/")}";`,
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
const { CONTROLLER_SETUP_GAP_COPY, CONTROLLER_SETUP_GAP_ORDER, isControllerSetupGap } =
  await import(`file://${outfile}`);

/* ── 1. The mapper tolerates a shape it has never seen ─────────────────── */

console.log("\n1. The outcome mapper never throws and never drops");

check(
  "the response is preserved verbatim in `raw`",
  /raw,\n  \};/.test(serviceCode) || /\braw,/.test(serviceCode),
  "an unverified contract must not be narrowed on the way in",
);
check(
  "both snake_case and camelCase are accepted",
  /pick\("dry_run", "dryRun"\)/.test(serviceCode),
  "guessing the casing wrong should not blank the panel",
);
check(
  "array fields tolerate non-strings rather than throwing",
  /typeof x === "string" \? x : JSON\.stringify\(x\)/.test(serviceCode),
);
check(
  "booleans are only read when they ARE booleans",
  /typeof v === "boolean" \? v : undefined/.test(serviceCode),
  "a truthy string must not be reported as applied:true",
);
check(
  "the drawer renders the raw payload for the operator to read",
  /JSON\.stringify\(outcome\.raw, null, 2\)/.test(pageCode),
  "showing the real answer beats showing this build's guess at it",
);

/* ── 2. Preview before apply ───────────────────────────────────────────── */

console.log("\n2. A preview is required before anything is written");

check("a dry run is offered", /configure\.mutate\(true\)/.test(pageCode));
check("and a real run", /configure\.mutate\(false\)/.test(pageCode));
check(
  "apply is disabled until a preview has run",
  /disabled=\{!previewed \|\| busy\}/.test(pageCode),
);
check("and says why", /Run the preview first — this writes to a live controller\./.test(page));
check("the dry run is sent as such", /dry_run: opts\.dryRun/.test(serviceCode));
check("the preview says nothing was changed", /nothing was changed on the controller/.test(page));

/* ── 3. Gaps, in dependency order, each with its fix ───────────────────── */

console.log("\n3. Preconditions are named, in fix order, with what closes them");

const EXPECTED = [
  "INTEGRATION_DISABLED",
  "PROVIDER_UNSUPPORTED",
  "OPENAPI_REQUIRED",
  "CREDENTIALS_MISSING",
  "LOCATION_NOT_MAPPED",
  "SITE_NOT_SELECTED",
  "FLEET_DEVICE_MISSING",
  "GUEST_SSID_MISSING",
];
check(
  "every gap the backend can return has copy",
  EXPECTED.every((g) => isControllerSetupGap(g) && CONTROLLER_SETUP_GAP_COPY[g]?.fix),
);
check(
  "the order matches the backend's fix order exactly",
  CONTROLLER_SETUP_GAP_ORDER.join(",") === EXPECTED.join(","),
  CONTROLLER_SETUP_GAP_ORDER.join(","),
);
check(
  "credentials come before the things that need them",
  CONTROLLER_SETUP_GAP_ORDER.indexOf("CREDENTIALS_MISSING") <
    CONTROLLER_SETUP_GAP_ORDER.indexOf("SITE_NOT_SELECTED"),
  "choosing a site needs the credentials that can list sites",
);
check(
  "OPENAPI_REQUIRED routes to Replace credentials",
  /Replace credentials/.test(CONTROLLER_SETUP_GAP_COPY.OPENAPI_REQUIRED.fix),
  "the live QA venue is in hotspot-operator mode, which automatic setup refuses",
);
check("an unrecognised gap is not accepted as known", !isControllerSetupGap("SOMETHING_NEW"));
check(
  "and is still shown rather than dropped",
  /copy\?\.title \?\? g/.test(pageCode),
  "a precondition nobody renders is a refusal with no reason given",
);
check("gaps are sorted before rendering", /orderedGaps\(outcome\.gaps\)/.test(pageCode));

/* ── 4. Taking over someone else's portal ──────────────────────────────── */

console.log("\n4. Overwriting an existing portal is a deliberate act");

check(
  "it defaults to off",
  /useState\(false\)[\s\S]{0,80}confirmTakeOver/.test(pageCode) ||
    /const \[takeOver, setTakeOver\] = useState\(false\)/.test(pageCode),
);
check("turning it on asks first", /setConfirmTakeOver\(true\)/.test(pageCode));
check(
  "the dialog says what is lost",
  /Whatever it was doing\s*\n?\s*stops/.test(page) || /Whatever it was doing/.test(page),
);
check(
  "turning it on invalidates the previous preview",
  /setPreviewed\(false\);[\s\S]{0,60}setOutcome\(null\)/.test(pageCode),
  "a preview computed without take-over no longer describes what Apply would do",
);
check(
  "it is sent to the backend",
  /take_over_ssid_portal: opts\.takeOverSsidPortal/.test(serviceCode),
);

/* ── 5. Success claims only what it achieved ───────────────────────────── */

console.log("\n5. Configuring a controller is not a guest getting online");

check(
  "the applied toast does not claim the venue is live",
  // `pageCode`, not `page`: the comment above the toast QUOTES the claim it
  // refuses to make ('NOT "the venue is live"'), and a search over prose
  // finds that and reports the defect as present -- failing for the exact
  // opposite of the real reason.
  !/venue is (now )?live/i.test(pageCode) && !/guests can now/i.test(pageCode),
);
check(
  "it names the two separate proofs",
  /not yet proof a guest can get online/.test(page) &&
    /Test connectivity, then try a real device/.test(page),
);

/* ── 6. The written steps carry both ends ──────────────────────────────── */

console.log("\n6. The steps say what the platform will never do, and what it will");

check(
  "the prerequisites are stated",
  /Before you start/.test(steps) &&
    /adopted/.test(steps) &&
    /guest SSID/.test(steps) &&
    /Open API/.test(steps),
);
check(
  "and that the platform does not create them",
  /The platform does not create any of these, and will not\./.test(steps),
  "otherwise an operator waits for something that is never coming",
);
check(
  "the automatic path is presented before the manual one",
  steps.indexOf("Configure controller") < steps.indexOf("1. External Portal Server"),
);
check("it says which manual steps it replaces", /Steps 1 and 2 below are done for you/.test(steps));
check("and that it needs Open API", /It needs an <strong>Open API<\/strong> client/.test(steps));
check(
  "the cloud controller's Omada ID requirement is stated",
  /The Omada ID is required\./.test(steps),
);
check(
  "so is the per-device licence and the Unactivated state",
  /Omada Central Standard licence/.test(steps) && /Unactivated/.test(steps),
);
check(
  "and that no NAS row is created, where someone would look for it",
  /No NAS or RADIUS entry is created, and that is correct/.test(steps),
  "a MikroTik operator seeing NAS for one vendor and not the other assumes a failure",
);
check("the External Portal Server is distinguished from RADIUS", /which is not RADIUS/.test(steps));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
