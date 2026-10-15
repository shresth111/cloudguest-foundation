/**
 * The "Rate us on Google" page (`/portal/review`, SPEC google-review §5.1),
 * pinned against the REAL `src/lib/portal-review-page.ts` plus source-level
 * checks on the route and the page component.
 *
 * Run: `node scripts/test-portal-review-page.mjs`
 *
 * What it guards:
 *   - a stale, forwarded or non-due link continues straight on and renders
 *     no CTA (AC 16);
 *   - Continue never comes from a query parameter (no open redirect on the
 *     portal host);
 *   - preview / demo render the page and send nothing (AC 17);
 *   - no Web Storage anywhere on the page (Apple's CNA throws on access);
 *   - the page is never a gate: Continue is always rendered.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const work = mkdtempSync(join(tmpdir(), "portal-review-page-"));

await build({
  entryPoints: [join(SRC, "lib/portal-review-page.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile: join(work, "bundle.mjs"),
  logLevel: "silent",
  alias: { "@": SRC },
});
const M = await import(join(work, "bundle.mjs"));

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const ON = {
  reviewCardEnabled: true,
  reviewUrl: "https://g.page/r/abc/review",
  postLoginHtml: null,
  redirectUrl: null,
};
const SESSION = { sessionId: "s-1", reviewPromptDue: true };
const SESSION_URL =
  "https://portal.example/portal/session?organizationId=o&locationId=l&routerId=r";

console.log("review page decision");
check(
  "shows for the live, due session it was built for",
  M.reviewPageDecision({ config: ON, session: SESSION, sid: "s-1" }) === "show",
);
check(
  "continues when sid is another session (stale / forwarded link)",
  M.reviewPageDecision({ config: ON, session: SESSION, sid: "s-OTHER" }) === "continue",
);
check(
  "continues when there is no sid",
  M.reviewPageDecision({ config: ON, session: SESSION, sid: null }) === "continue",
);
check(
  "continues when there is no session",
  M.reviewPageDecision({ config: ON, session: undefined, sid: "s-1" }) === "continue",
);
check(
  "continues when the server says not due",
  M.reviewPageDecision({
    config: ON,
    session: { ...SESSION, reviewPromptDue: false },
    sid: "s-1",
  }) === "continue",
);
check(
  "continues when the switch is off",
  M.reviewPageDecision({
    config: { ...ON, reviewCardEnabled: false },
    session: SESSION,
    sid: "s-1",
  }) === "continue",
);
check(
  "continues when the link is unsafe",
  M.reviewPageDecision({
    config: { ...ON, reviewUrl: "javascript:alert(1)" },
    session: SESSION,
    sid: "s-1",
  }) === "continue",
);

console.log("continue target");
{
  const t = M.reviewContinueTarget({
    config: ON,
    inCaptiveSheet: false,
    sessionUrl: SESSION_URL,
    sessionId: "s-1",
  });
  const u = new URL(t);
  check("default mode -> /portal/session", u.pathname === "/portal/session", t);
  check(
    "... carrying review=<sid> for the same-visit guard",
    u.searchParams.get("review") === "s-1",
  );
}
{
  const t = M.reviewContinueTarget({
    config: { ...ON, redirectUrl: "https://venue.example/menu" },
    inCaptiveSheet: false,
    sessionUrl: SESSION_URL,
    sessionId: "s-1",
  });
  check("redirect mode -> the venue's redirect URL", t === "https://venue.example/menu", t);
}
{
  const t = M.reviewContinueTarget({
    config: { ...ON, redirectUrl: "https://venue.example/menu" },
    inCaptiveSheet: true,
    sessionUrl: SESSION_URL,
    sessionId: "s-1",
  });
  check(
    "redirect mode inside a captive sheet -> the session page (the sheet cannot go elsewhere)",
    new URL(t).pathname === "/portal/session",
    t,
  );
}
{
  const t = M.reviewContinueTarget({
    config: { ...ON, redirectUrl: "javascript:alert(1)" },
    inCaptiveSheet: false,
    sessionUrl: SESSION_URL,
    sessionId: "s-1",
  });
  check("an unsafe redirect URL is never followed", new URL(t).pathname === "/portal/session", t);
}
{
  const t = M.reviewContinueTarget({
    config: {
      ...ON,
      postLoginHtml: "<h1>Menu</h1>",
      redirectUrl: "https://venue.example/menu",
    },
    inCaptiveSheet: false,
    sessionUrl: SESSION_URL,
    sessionId: "s-1",
  });
  check(
    "html mode -> the session page, which renders the venue's page",
    new URL(t).pathname === "/portal/session",
    t,
  );
}
check(
  "the continue rule takes no URL-derived destination at all",
  !/next|continue=|searchParams\.get\(/i.test(
    stripComments(readFileSync(join(SRC, "lib/portal-review-page.ts"), "utf8")).replace(
      /reviewContinueTarget/g,
      "",
    ),
  ),
);

console.log("timeouts and reachability");
{
  const slow = new Promise((r) => setTimeout(() => r("late"), 200));
  const out = await M.withTimeout(slow, 20, "fallback");
  check("withTimeout returns the fallback when the call is slow", out === "fallback");
  const failed = await M.withTimeout(Promise.reject(new Error("x")), 50, "fallback");
  check("withTimeout never rejects", failed === "fallback");
  const fast = await M.withTimeout(Promise.resolve("ok"), 50, "fallback");
  check("withTimeout passes a fast result through", fast === "ok");
}
{
  let img;
  const p = M.probeGoogleReachable(() => (img = { onload: null, onerror: null, src: "" }), 500);
  img.onload();
  check("reachable when the probe image loads", (await p) === true);
  check("the probe is cache-busted", /favicon\.ico\?_=\d+/.test(img.src), img.src);
  const q = M.probeGoogleReachable(() => (img = { onload: null, onerror: null, src: "" }), 500);
  img.onerror();
  check("not reachable when the probe errors (gate still shut)", (await q) === false);
  const r = M.probeGoogleReachable(() => ({ onload: null, onerror: null, src: "" }), 20);
  check("not reachable when the probe times out", (await r) === false);
}

console.log("route + component");
{
  const route = stripComments(readFileSync(join(SRC, "routes/portal.review.tsx"), "utf8"));
  const page = stripComments(
    readFileSync(join(SRC, "components/portal-runtime/GoogleReviewPage.tsx"), "utf8"),
  );
  const lib = stripComments(readFileSync(join(SRC, "lib/portal-review-page.ts"), "utf8"));
  for (const [name, src] of [
    ["route", route],
    ["page", page],
    ["lib", lib],
  ]) {
    check(`${name}: no Web Storage`, !/localStorage|sessionStorage|indexedDB/.test(src));
  }
  check(
    "route reads only `sid` from the URL",
    (route.match(/\.get\("([^"]+)"\)/g) ?? []).every((g) => g === '.get("sid")'),
  );
  check(
    "route continues with location.replace when not due",
    /window\.location\.replace\(continueTarget\(\)\)/.test(route),
  );
  check(
    "route records 'shown' only when not simulated",
    /if \(isSimulated\) return;\s*portalRuntimeService\s*\.recordReviewPromptShown/.test(route),
  );
  check(
    "route records the tap only when not simulated",
    /if \(isSimulated\) return true;[\s\S]*recordReviewLinkOpened/.test(route),
  );
  check(
    "the tap waits on the record with a timeout, never unbounded",
    /withTimeout\(\s*portalRuntimeService\.recordReviewLinkOpened/.test(route),
  );
  check(
    "route latches its decision (recording 'shown' must not bounce the guest)",
    /if \(decision \|\| !ready\) return;/.test(route),
  );
  check(
    "page always renders Continue",
    /reviewPageContinue/.test(page) && /onClick=\{onContinue\}/.test(page),
  );
  check("page renders the CTA from the stored link", /href=\{reviewUrl\}/.test(page));
  check("page link is noopener noreferrer", /rel="noopener noreferrer"/.test(page));
  check("page has no rating control", !/rating|stars?=|<input/i.test(page.replace(/Star\b/g, "")));
  check("page has no countdown", !/setInterval|countdown/i.test(page));
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
