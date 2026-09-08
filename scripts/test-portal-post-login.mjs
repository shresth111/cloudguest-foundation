/**
 * The post-login destination decision -- the founder's "session page,
 * then a 3-2-1 timer, then the URL" complaint, pinned against the REAL
 * `src/lib/portal-post-login.ts` plus source-level checks on the two
 * routes that must consume it identically.
 *
 * Run: `node scripts/test-portal-post-login.mjs`
 *
 * WHY THIS EXISTS: the single-page post-login fix is a *decision* that
 * two routes both make -- portal.success.tsx picks the NAS `dst`, and
 * portal.session.tsx renders or bounces. If one drifts (success hardcodes
 * the session URL again, or session grows its own countdown page back),
 * the founder's exact bug returns even though every other test passes.
 * Like test-portal-auth-methods.mjs, this bundles the real decision
 * module (no stubs) for behaviour, and reads the route files at source
 * level for the wiring assertions -- the render paths need framework
 * stubs that would test nothing real.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-post-login-"));

await build({
  entryPoints: [join(SRC, "lib/portal-post-login.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});

const { resolvePostLoginDestination, isSafeRedirectTarget } = await import(
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

const CFG = {
  postLoginHtml: null,
  redirectUrl: null,
};

console.log("post-login destination");

// --- 1. Mode selection ------------------------------------------------
{
  check(
    "no venue content, no URL -> default connected page",
    resolvePostLoginDestination({ postLoginHtml: null, redirectUrl: null }).mode === "default",
  );
  check(
    "venue HTML page -> html mode (the page IS the destination)",
    resolvePostLoginDestination({ postLoginHtml: "<h1>Hi</h1>", redirectUrl: null }).mode ===
      "html",
  );
  check(
    "HTML outranks a URL -- an external page can't host the session strip",
    resolvePostLoginDestination({
      postLoginHtml: "<h1>Hi</h1>",
      redirectUrl: "https://venue.example",
    }).mode === "html",
  );
  check(
    "redirect URL only -> redirect mode",
    resolvePostLoginDestination({
      postLoginHtml: null,
      redirectUrl: "https://venue.example",
    }).mode === "redirect",
  );
  check(
    "guest's own pre-hotspot destination (link-orig) -> redirect mode too",
    resolvePostLoginDestination(CFG, "https://guest-was-going.example").mode === "redirect",
  );
  check(
    "destinationUrl beats the venue redirect (old Continue-button precedence kept)",
    resolvePostLoginDestination(
      { postLoginHtml: null, redirectUrl: "https://venue.example" },
      "https://guest-was-going.example",
    ).url === "https://guest-was-going.example",
  );
  check(
    "empty-string HTML is treated as no page",
    resolvePostLoginDestination({ postLoginHtml: "   ", redirectUrl: null }).mode === "default",
  );
  check(
    "undefined config (not yet resolved) is default, not a crash",
    resolvePostLoginDestination(undefined).mode === "default",
  );
}

// --- 2. The navigation-sink guard -------------------------------------
{
  check("http URL passes the guard", isSafeRedirectTarget("http://venue.example/wifi") === true);
  check("https URL passes the guard", isSafeRedirectTarget("https://venue.example/wifi") === true);
  check(
    "javascript: scheme is refused",
    isSafeRedirectTarget("javascript:alert(1)") === false,
    "a javascript: value in window.location.href runs script in the portal's own origin",
  );
  check("data: scheme is refused", isSafeRedirectTarget("data:text/html,hi") === false);
  check(
    "relative URLs resolve to the portal's own origin and pass (unchanged from portal.redirect.tsx's own original guard -- the check is scheme-based, not same-origin-hostile)",
    isSafeRedirectTarget("/portal/session") === true,
  );
  check(
    "a bad redirect URL produces no url and mode falls back to default",
    resolvePostLoginDestination({ postLoginHtml: null, redirectUrl: "javascript:alert(1)" })
      .mode === "default",
  );
}

// --- 3. Routes consume the decision (source-level) --------------------
//
// The behaviour above is only worth anything if the two real post-login
// routes actually call it -- success.tsx must not hardcode the session URL
// back, and session.tsx must not re-grow its own countdown page. Both are
// real-file assertions, deliberately: the render paths would need stubs
// for the router, query client, PortalShell and ten form components, and
// the wiring is exactly what a refactor can silently break while the
// render still "looks fine".
{
  const session = readFileSync(join(SRC, "routes/portal.session.tsx"), "utf8");
  check(
    "portal.session.tsx resolves the destination through the shared module",
    /resolvePostLoginDestination/.test(session),
  );
  check(
    "portal.session.tsx renders the venue's HTML page directly (no /portal/redirect hop)",
    /destination\.mode === "html"/.test(session) && /PostLoginHtmlFrame/.test(session),
  );
  check(
    "portal.session.tsx has no Continue button to /portal/redirect anymore",
    !/to: "\/portal\/redirect"/.test(session),
    "a fresh login must never be routed through the old countdown page",
  );
  check(
    "redirect mode leaves the page via window.location.assign",
    /window\.location\.assign\(destination\.url\)/.test(session),
  );

  const success = readFileSync(join(SRC, "routes/portal.success.tsx"), "utf8");
  check(
    "portal.success.tsx resolves the same destination",
    /resolvePostLoginDestination/.test(success),
  );
  check(
    "the NAS dst goes straight to the venue URL for redirect mode",
    /destination\.mode === "redirect" && destination\.url/.test(success) &&
      /destination\.url/.test(success.split("const dst")[1] ?? ""),
    "the NAS must send redirect-mode guests straight to the URL, no portal page",
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
