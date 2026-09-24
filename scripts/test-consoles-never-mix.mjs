/**
 * Regression test: the two consoles never render on each other's hostname.
 *
 * The Master Console (master.wyfyguest.com) and the customer app
 * (app.wyfyguest.com) are two products on two addresses. Neither belongs on
 * the other's host -- not the customer dashboard under master branding, not
 * the operator console under the address customers are given. Asked for
 * directly: "master dashboard alag khule aur customer alag, ek mai mix na
 * kro".
 *
 * Both directions must be enforced, at every door into each surface:
 *
 *   customer surface, master host -> bounce to the customer host
 *     - src/routes/index.tsx      (the bare root)
 *     - src/routes/_authenticated.tsx (everything under that layout)
 *     - src/lib/authGuards.ts     (the top-level customer routes -- /agents,
 *                                  /users, /switch-location -- that never
 *                                  pass through _authenticated)
 *
 *   master surface, customer host -> bounce to the master host
 *     - src/routes/master.tsx     (#289, already in place)
 *
 * The customer-route trio is the half that leaked: #288/#289 fixed the
 * master routes and the bare root, but /agents et al. still rendered the
 * customer dashboard at master.wyfyguest.com because their guard
 * (requireCustomerSession) never looked at the hostname.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * scripts/test-portal-cna-storage-safety.mjs's own note). Each guard's
 * hostname decision is a property of its own source, so it is checked there.
 *
 * Run: node scripts/test-consoles-never-mix.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Each guard must, in code (not a comment), both name the foreign hostname
 *  and send the visitor to the other host. */
const GUARDS = [
  {
    file: "src/routes/index.tsx",
    host: "master.wyfyguest.com",
    // the bare root decides which console it is by hostname
    decides: /hostname\s*===\s*"master\.wyfyguest\.com"/,
  },
  {
    file: "src/routes/_authenticated.tsx",
    host: "master.wyfyguest.com",
    decides: /window\.location\.hostname\s*===\s*"master\.wyfyguest\.com"/,
    // and it must still redirect the non-/master paths away
    andSends: /redirect\(\{\s*to:\s*"\/master"\s*\}\)/,
  },
  {
    file: "src/lib/authGuards.ts",
    host: "master.wyfyguest.com",
    decides: /hostname\s*===\s*MASTER_CONSOLE_HOSTNAME/,
    // to the customer host, carrying the same path
    andSends: /window\.location\.href\s*=\s*`https:\/\/\$\{CUSTOMER_APP_HOSTNAME\}/,
  },
  {
    file: "src/routes/master.tsx",
    host: "app.wyfyguest.com",
    decides: /hostname\s*===\s*CUSTOMER_APP_HOSTNAME/,
    andSends: /window\.location\.href\s*=\s*`https:\/\/\$\{MASTER_CONSOLE_HOSTNAME\}/,
  },
];

const failures = [];
for (const guard of GUARDS) {
  const source = stripComments(readFileSync(join(ROOT, guard.file), "utf8"));
  if (!guard.decides.test(source)) {
    failures.push(
      `${guard.file}: no hostname check for the foreign host (${guard.host}).\n` +
        `    This surface can render on the wrong console's address.`,
    );
  }
  if (guard.andSends && !guard.andSends.test(source)) {
    failures.push(
      `${guard.file}: checks the hostname but never redirects to the other host.\n` +
        `    A check that does not send the visitor away still renders the page.`,
    );
  }
}

// The Master Console must not link into the customer-layout tree. A link to a
// non-/master path from a /master page is either bounced to the Master home
// by _authenticated.tsx (the "Manage this router" button did exactly that)
// or, worse, renders the old surface on the master host. The router screen
// has its own /master address for this reason.
const ROUTES = join(ROOT, "src/routes");
for (const name of readdirSync(ROUTES)) {
  if (!/^master[.-]/.test(name) || name.startsWith("master-login")) continue;
  const source = stripComments(readFileSync(join(ROUTES, name), "utf8"));
  if (
    /to=["{`]*"?\/routers\/\$routerId/.test(source) ||
    /to:\s*"\/routers\/\$routerId"/.test(source)
  ) {
    failures.push(
      `src/routes/${name}: links to /routers/$routerId, which the master host redirects away.\n` +
        `    Link to /master/routers/$routerId instead.`,
    );
  }
}
const masterRouterRoute = stripComments(
  readFileSync(join(ROUTES, "master.routers.$routerId.tsx"), "utf8"),
);
if (!/createFileRoute\("\/master\/routers\/\$routerId"\)/.test(masterRouterRoute)) {
  failures.push(
    "src/routes/master.routers.$routerId.tsx: the router screen must live under /master,\n" +
      "    so master.tsx's operator-only guard runs before it.",
  );
}

if (failures.length > 0) {
  console.error("FAIL: a console can render on the other console's hostname\n");
  for (const failure of failures) console.error(failure + "\n");
  process.exit(1);
}

console.log(`PASS: ${GUARDS.length} guards keep the two consoles on their own hostnames`);
