/**
 * Regression test for the guest portal's error boundary.
 *
 * WHY THIS EXISTS
 * ---------------
 * TanStack Router does NOT inherit `errorComponent` down the route tree. A
 * route that defines none falls through to the router's
 * `defaultErrorComponent` (src/router.tsx), never to its parent's. That was
 * verified live rather than assumed: with a deliberate `throw` in
 * `/portal/session`'s render and a unique marker string installed as
 * `/portal`'s own `errorComponent`, the marker never rendered -- the
 * app-wide dashboard error screen did.
 *
 * So `/portal` having an `errorComponent` protected exactly one route:
 * `/portal`. Every other `/portal/*` route rendered `__root.tsx`'s
 * `ErrorComponent` to a guest standing in a cafe -- English-only on a
 * ten-language surface, in the dashboard's colour tokens rather than the
 * venue's, with a "Go home" that is `<a href="/">` (behind a captive portal
 * that is the operator's dashboard login, and it discards the
 * organizationId/locationId/routerId the sign-in depends on), and silent on
 * the only question a guest on a captive portal has: is my internet working?
 *
 * THE FAILURE MODE THIS GUARDS
 * ----------------------------
 * The fix is per-route, so it is exactly the kind that rots: someone adds
 * `src/routes/portal.whatever.tsx`, does not add the one line, and that
 * single screen silently reverts to the dashboard error page. Nothing in
 * tsc, eslint or the build can see it -- a missing optional route option is
 * not a type error. Hence a test that enumerates the route files from disk
 * rather than from a hand-maintained list: a new portal route is caught the
 * moment it exists.
 *
 * It also pins the properties that make the screen safe to render *while
 * something else is already broken* -- no context, no Web Storage (which
 * THROWS inside Apple's Captive Network Assistant, so a storage read in an
 * error boundary turns a caught error into an uncaught one, which really is
 * a blank page), and no typed `<Link>` (an invalid search param is one of
 * the things that lands a guest here in the first place).
 *
 * Run: node scripts/test-portal-error-boundary.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ROUTES_DIR = join(ROOT, "src/routes");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

console.log("\n1. every /portal route declares an errorComponent");

const routeFiles = readdirSync(ROUTES_DIR)
  .filter((f) => f.startsWith("portal.") && f.endsWith(".tsx"))
  .sort();

// A floor, so this suite cannot pass vacuously if the glob ever stops
// matching (a rename, a move to a subdirectory). 18 is what exists today.
check(
  `found the portal route files (${routeFiles.length})`,
  routeFiles.length >= 18,
  `only ${routeFiles.length} matched`,
);

for (const file of routeFiles) {
  const src = readFileSync(join(ROUTES_DIR, file), "utf8");
  check(`${file} declares errorComponent`, /errorComponent:/.test(src));
  check(
    `${file} routes it to PortalErrorScreen`,
    src.includes("PortalErrorScreen"),
    "a portal route must not fall back to the dashboard error screen",
  );
}

console.log("\n2. no /portal route falls back to the dashboard error screen");

for (const file of routeFiles) {
  const src = readFileSync(join(ROUTES_DIR, file), "utf8");
  check(
    `${file} does not import __root's ErrorComponent`,
    !/ErrorComponent\s+as\s+RootErrorComponent/.test(src),
  );
}

console.log("\n3. the screen is safe to render when everything else is broken");

const screenSrc = readFileSync(
  join(ROOT, "src/components/portal-runtime/PortalErrorScreen.tsx"),
  "utf8",
);

/** Assert against CODE, not prose. This component's own docstring names
 * `usePortalRuntime` and `<Link>` precisely to explain why it does not use
 * them, so a naive substring check on the raw file fails on the explanation
 * of the very rule it is checking. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const screen = stripComments(screenSrc);

check(
  "does not call usePortalRuntime (the provider may be the thing that threw, " +
    "and on /portal itself the boundary sits above it)",
  !screen.includes("usePortalRuntime"),
);
check(
  "touches no Web Storage (it THROWS inside Apple's CNA -- a throw here is " +
    "an uncaught error, i.e. a genuinely blank page)",
  !/localStorage|sessionStorage/.test(screen),
);
check(
  "uses no typed <Link> (an invalid search param is one of the things that " +
    "lands a guest here)",
  !/<Link\b/.test(screen),
);
check(
  "reads the language from the URL, not from storage or context",
  screen.includes("readLanguageFromUrl"),
);
check(
  "resolves copy through translate(), whose lookup cannot throw",
  screen.includes("translate("),
);
check("guards window access for SSR", screen.includes('typeof window === "undefined"'));
check(
  "carries the venue's search params into the sign-in-again link",
  screen.includes("/portal/welcome${search}"),
);
check(
  "reports the error so a crash a guest cannot report is still seen",
  screen.includes("reportLovableError"),
);

console.log("\n4. its copy answers the question a captive-portal guest actually has");

const i18n = readFileSync(join(ROOT, "src/lib/portal-i18n.ts"), "utf8");

// Ten dictionaries, and the refusal-screen precedent (#231) is the standard:
// no silent per-key fallback to English on a screen a guest only ever sees
// when something has already gone wrong.
for (const key of ["portalErrorTitle", "portalErrorBody"]) {
  const count = (i18n.match(new RegExp(`^  ${key}:`, "gm")) || []).length;
  check(`${key} exists in all ten dictionaries`, count === 10, `found ${count}`);
}

// The reason the copy exists at all: the NAS gate is opened by
// portal.success.tsx's form POST, which has already fired by the time the
// connected-side screens render. A guest who crashes there IS online.
const enBody = i18n.match(/^ {2}portalErrorBody:\n {4}"([^"]+)"/m);
check(
  "the English body mentions WiFi possibly already working",
  !!enBody && /WiFi/.test(enBody[1]),
);

check(
  "reuses the existing retry/sign-in-again keys rather than inventing new ones",
  screen.includes('t("retry")') && screen.includes('t("signInAgainLink")'),
);

console.log(
  failures === 0
    ? "\nportal error boundary: all checks passed"
    : `\nportal error boundary: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
