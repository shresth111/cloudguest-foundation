/**
 * Omada RADIUS mode (`authType 2`) -- the submit contract, and the wiring
 * that decides when it is used.
 *
 * Run: `node scripts/test-portal-radius-mode.mjs`
 *
 * WHY THIS EXISTS: a venue on `authType 2` and a venue on `authType 4` get
 * completely different treatment from the same page, and the thing that
 * chooses between them is a single stored value carried on the URL. Three
 * ways this goes wrong silently, each pinned below:
 *
 *   1. the page starts INFERRING the contract from which parameters
 *      arrived, so a firmware revision that adds or drops one moves every
 *      guest at a venue onto the wrong path;
 *   2. the submit goes to `/portal/radius/auth` (the XHR endpoint), which
 *      delivers the request and cannot read the answer cross-origin --
 *      measured: no `Access-Control-Allow-Origin` on the response, and a
 *      preflight that allows only OPTIONS;
 *   3. the submit becomes a `fetch`, which hangs iOS's Captive Network
 *      Assistant forever -- the exact incident `submitHotspotLogin` was
 *      rewritten to fix for MikroTik.
 *
 * Behaviour is checked against the REAL `src/lib/portal-radius-submit.ts`
 * (bundled, no stubs); the wiring is checked at source level, like
 * test-portal-post-login.mjs, because the render path needs framework
 * stubs that would test nothing real.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-radius-mode-"));

await build({
  entryPoints: [join(SRC, "lib/portal-radius-submit.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const { buildOmadaRadiusSubmission, OMADA_RADIUS_BROWSERAUTH_PATH } = await import(
  join(work, "bundle.mjs")
);

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

// A real `authType 2` redirect, captured verbatim off the live controller
// (Omada Software Controller 5.15.24.19, 2026-09-11). Note what is NOT in
// it: no `site`, no `t`, no `redirectUrl`.
const REDIRECT = {
  target: "13.126.39.79",
  targetPort: 8843,
  scheme: "https",
  clientMac: "AA-BB-CC-DD-EE-20",
  clientIp: "103.84.202.195",
  apMac: "B8-FB-B3-5D-64-3E",
  gatewayMac: "",
  ssidName: "WyfyRadTest",
  vid: "",
  radioId: 1,
};
const WHO = {
  identifier: "+919000000000",
  password: "welcome123",
  landingUrl: "https://auth.wyfyguest.com/portal/session?organizationId=o",
};

console.log("omada radius mode -- the submit contract");

const built = buildOmadaRadiusSubmission(REDIRECT, WHO);
check("a real redirect builds a submission", !("refused" in built));

check(
  "posts to the form endpoint, on the controller's own address and port",
  built.action === `https://13.126.39.79:8843${OMADA_RADIUS_BROWSERAUTH_PATH}`,
  built.action,
);
check(
  "the endpoint is browserauth, never the XHR sibling",
  OMADA_RADIUS_BROWSERAUTH_PATH === "/portal/radius/browserauth",
);
check("authType is the External RADIUS Server value", built.fields.authType === "2");
check("the identifier goes in username", built.fields.username === WHO.identifier);
check(
  "originUrl is OUR post-login destination, not the captured one",
  built.fields.originUrl === WHO.landingUrl,
);

// --- captured, never derived -----------------------------------------
check(
  "every controller value travels exactly as it arrived",
  built.fields.clientMac === "AA-BB-CC-DD-EE-20" &&
    built.fields.apMac === "B8-FB-B3-5D-64-3E" &&
    built.fields.ssidName === "WyfyRadTest" &&
    built.fields.clientIp === "103.84.202.195",
);
check(
  "a numeric parameter keeps its own value as text, not a re-derived one",
  built.fields.radioId === "1",
);
check(
  "an empty parameter is omitted, never sent as an invented empty string",
  !("gatewayMac" in built.fields) && !("vid" in built.fields),
);
const noMac = buildOmadaRadiusSubmission(
  { target: "13.126.39.79", targetPort: "8843", scheme: "https" },
  WHO,
);
check(
  "an absent parameter stays absent all the way to the wire",
  !("refused" in noMac) && !("clientMac" in noMac.fields),
);

// --- refusals ---------------------------------------------------------
//
// Each of these is a real misconfiguration, and none of them is
// recoverable by guessing: only the controller ever knew its own address,
// so a default would post this guest's identifier to whatever we made up.
const noTarget = buildOmadaRadiusSubmission({ clientMac: "AA-BB" }, WHO);
check(
  "a venue recorded as RADIUS whose redirect has no target is refused",
  noTarget.refused === "missing-target",
);
check(
  "a non-http(s) scheme is refused",
  buildOmadaRadiusSubmission({ ...REDIRECT, scheme: "javascript" }, WHO).refused === "bad-scheme",
);
for (const hostile of [
  "13.126.39.79/evil.example.com",
  "evil.example.com@13.126.39.79",
  "13.126.39.79?x=1",
  "13.126.39.79#f",
]) {
  check(
    `a target that is not a bare host is refused (${hostile})`,
    buildOmadaRadiusSubmission({ ...REDIRECT, target: hostile }, WHO).refused === "bad-target",
  );
}
for (const port of ["0", "70000", "84 43", "https"]) {
  check(
    `a port that is not a port is refused (${port})`,
    buildOmadaRadiusSubmission({ ...REDIRECT, targetPort: port }, WHO).refused === "bad-target",
  );
}

// --- the wiring -------------------------------------------------------
console.log("omada radius mode -- the wiring");

const successSrc = readFileSync(join(SRC, "routes/portal.success.tsx"), "utf8");
const searchSrc = readFileSync(join(SRC, "lib/portal-search.ts"), "utf8");
const portalSrc = readFileSync(join(SRC, "routes/portal.tsx"), "utf8");
const submitSrc = readFileSync(join(SRC, "lib/portal-radius-submit.ts"), "utf8");

check("the success page dispatches on the STORED mode", /portalMode === "radius"/.test(successSrc));
check(
  "and reads it from the runtime, not from the redirect's parameters",
  /portalMode,/.test(successSrc) && !/target\s*&&\s*targetPort/.test(successSrc),
);
check(
  "the RADIUS branch is inside the omada branch, before the RouterOS guards",
  successSrc.indexOf('portalMode === "radius"') > successSrc.indexOf('netProvider === "omada"') &&
    successSrc.indexOf('portalMode === "radius"') <
      successSrc.indexOf("if (!guestIdentifier) return;"),
);
check(
  "the External Portal Server path is untouched by the new branch",
  /void authorizeOnController\(\);/.test(successSrc),
);
check(
  "the submit is a real form POST, never a fetch",
  /form\.method = "POST"/.test(submitSrc) &&
    !/fetch\(/.test(submitSrc) &&
    /form\.submit\(\)/.test(submitSrc),
);
check(
  "the XHR endpoint is not reachable from the submit module",
  !submitSrc.includes('"/portal/radius/auth"'),
);
check(
  "the search schema declares the four RADIUS redirect parameters",
  ["target:", "targetPort:", "scheme:", "originUrl:"].every((k) => searchSrc.includes(k)),
);
check("the search schema declares portalMode", /portalMode: z\.string/.test(searchSrc));
check(
  "the route captures them into the one redirect object",
  /targetPort,/.test(portalSrc) && /originUrl,/.test(portalSrc),
);
check(
  "and mirrors the mode alongside the controller's parameters",
  /portalMode: urlPortalMode,/.test(portalSrc),
);
check(
  "the mode falls back to the mirror per key, never the other way round",
  /const portalMode = urlPortalMode \?\? persistedOmada\?\.portalMode;/.test(portalSrc),
);

console.log(
  failures === 0 ? "\nportal RADIUS mode: all checks passed" : `\n${failures} check(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
