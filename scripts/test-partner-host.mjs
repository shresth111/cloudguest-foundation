/**
 * Guard test: the ISP partner console (network.wyfyguest.com) is a third
 * hostname of this SPA, and it must neither leak into the other two consoles
 * nor let them leak into it. It must also be completely inert while the build
 * flag `VITE_ISP_PARTNER_ENABLED` is unset (founder rule: zero impact on
 * existing customers). TASKS FS-3 / API_CONTRACT §0 + §7.
 *
 * Same technique as scripts/test-consoles-never-mix.mjs: this repo has no
 * unit test runner, and each guard's decision is a property of its own
 * source, so it is checked there (comments stripped, so a comment cannot
 * satisfy a check).
 *
 * Checks:
 *   1. network-host.ts: both hostnames listed; isNetworkHost() returns false
 *      before anything else when the flag is unset.
 *   2. routes/index.tsx (F1): the bare root decides by isNetworkHost(),
 *      sends a signed-in visitor to /partner, renders PartnerLoginPage for an
 *      anonymous one, and never renders the customer dashboard on that host.
 *   3. routes/partner.tsx: not-found while the flag is unset; bounces any
 *      non-network host (app./master.) to the network host.
 *   4. The request shim is installed only behind isNetworkHost(), and maps
 *      every backend path RouterSetupScriptAdvanced.tsx calls (or names it as
 *      a deliberate passthrough). A new generator call fails this test.
 *   5. No route imports a __fixtures__ mock.
 *   6. The Master page + nav item are flag-gated.
 *   7. Partner-app chrome never says "WireGuard".
 *
 * Run: node scripts/test-partner-host.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
let passes = 0;

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
}
function read(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  return readFileSync(p, "utf8");
}
function check(name, ok, detail = "") {
  if (ok) {
    passes += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? `\n       ${detail}` : ""}`);
  }
}
function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------- 1
console.log("network-host.ts");
{
  const src = read("src/lib/isp-partner/network-host.ts");
  check("exists", !!src);
  const code = stripComments(src ?? "");
  check(
    "lists network.wyfyguest.com and network-staging.wyfyguest.com",
    /"network\.wyfyguest\.com"/.test(code) && /"network-staging\.wyfyguest\.com"/.test(code),
  );
  check(
    'the flag reads VITE_ISP_PARTNER_ENABLED === "true"',
    /import\.meta\.env\.VITE_ISP_PARTNER_ENABLED\s*===\s*"true"/.test(code),
  );
  const body = /export function isNetworkHost\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
  const firstStatement = body.trim().split("\n")[0] ?? "";
  check(
    "isNetworkHost() returns false first when the flag is off",
    /^if\s*\(\s*!isIspPartnerFeEnabled\(\)\s*\)\s*return false;/.test(firstStatement.trim()),
    `first statement was: ${firstStatement.trim()}`,
  );
  check(
    "localhost override needs VITE_FORCE_NETWORK_HOST",
    /VITE_FORCE_NETWORK_HOST/.test(body) && !/return true;\s*$/.test(body.trim()),
  );
}

// ---------------------------------------------------------------- 2
console.log("routes/index.tsx (F1)");
{
  const code = stripComments(read("src/routes/index.tsx") ?? "");
  check(
    "imports isNetworkHost from @/lib/isp-partner/network-host",
    /import\s*\{\s*isNetworkHost\s*\}\s*from\s*"@\/lib\/isp-partner\/network-host"/.test(code),
  );
  check(
    "decides isNetwork from the hostname",
    /const isNetwork\s*=\s*hostname\s*!==\s*null\s*&&\s*isNetworkHost\(hostname\)/.test(code),
  );
  check(
    "signed-in visitor on the network host goes to /partner",
    /if\s*\(\s*isNetwork\s*\)\s*\{\s*navigate\(\{\s*to:\s*"\/partner",\s*replace:\s*true\s*\}\);\s*return;\s*\}/.test(
      code,
    ),
  );
  check(
    "anonymous visitor on the network host gets PartnerLoginPage",
    /if\s*\(\s*isNetwork\s*\)\s*return\s*<PartnerLoginPage\s*\/>/.test(code),
  );
  check(
    "customer dashboard never renders on the network host",
    /!isMaster\s*&&\s*!isNetwork\s*&&\s*activeLocationId/.test(code),
  );
  // the master branch the existing test pins must still be there, unchanged
  check(
    "master.wyfyguest.com branch still present",
    /hostname\s*===\s*"master\.wyfyguest\.com"/.test(code),
  );
}

// ---------------------------------------------------------------- 3
console.log("routes/partner.tsx");
{
  const src = read("src/routes/partner.tsx");
  check("exists (FE-1)", !!src);
  const code = stripComments(src ?? "");
  check(
    "not-found while the flag is unset",
    /if\s*\(\s*!isIspPartnerFeEnabled\(\)\s*\)\s*throw notFound\(\)/.test(code),
  );
  check("asks isNetworkHost() before rendering", /isNetworkHost\(/.test(code));
  check(
    "bounces a non-network host (app./master.) to the network host",
    /!isNetworkHost\([^)]*\)/.test(code) &&
      /(NETWORK_HOST_URL|network-staging\.wyfyguest\.com|NETWORK_HOSTNAMES)/.test(code) &&
      /window\.location\.(href|replace|assign)/.test(code),
  );
}

// ---------------------------------------------------------------- 4
console.log("request shim (API_CONTRACT §7)");
{
  const shim = stripComments(read("src/lib/isp-partner/api-shim.ts") ?? "");
  check("api-shim.ts exists (FE-5)", shim.length > 0);
  const installers = walk("src")
    .filter((f) => !f.endsWith("api-shim.ts"))
    .map((f) => [f, stripComments(read(f) ?? "")])
    .filter(([, c]) =>
      /installIspShim|installIspApiShim|installPartnerShim|from\s*"@\/lib\/isp-partner\/api-shim"/.test(
        c,
      ),
    );
  check("the shim is installed somewhere", installers.length > 0);
  for (const [f, c] of installers) {
    check(`${f} guards the shim with isNetworkHost()`, /isNetworkHost\(/.test(c));
  }
  for (const [f, c] of installers) {
    check(
      `${f} is not a customer or master surface`,
      !/^src\/(routes\/(_authenticated|master)|components\/(customer|master))/.test(f),
      f,
    );
  }

  // Every backend path the generator calls must be twinned or a named passthrough.
  const MAPPED = {
    "POST /routers/:id/provisioning-token": "/provisioning-token",
    "POST /routers/:id/agent-credential/regenerate": "/agent-credential/regenerate",
    "POST /routers/:id/wireguard-peer/allocate-external": "/wireguard-peer/allocate-external",
    "POST /radius/nas/register-external/:id": "/radius-nas/register-external",
    "PUT /platform/routers/:id/management-access": "/management-access",
    "GET /routers/:id": "/as-router-device",
  };
  // Token-authenticated, called unchanged (API_CONTRACT §4.6).
  const PASSTHROUGH = new Set(["POST /routers/provisioning/check-in"]);
  for (const target of Object.values(MAPPED)) {
    check(
      `shim maps to /isp/routers/{id}${target}`,
      shim.includes(`/isp/routers/\${m[1]}${target}`),
    );
  }
  const gen = stripComments(read("src/components/routers/RouterSetupScriptAdvanced.tsx") ?? "");
  check("RouterSetupScriptAdvanced.tsx exists", gen.length > 0);
  const callRe = /api\.(get|post|put|patch|delete)\s*(?:<[\s\S]*?>)?\s*\(\s*([`"'])([^`"']+)\2/g;
  const calls = new Set();
  for (const m of gen.matchAll(callRe)) {
    const path = m[3].replace(/\$\{[^}]+\}/g, ":id").replace(/\?.*$/, "");
    calls.add(`${m[1].toUpperCase()} ${path}`);
  }
  check("found the generator's direct api calls", calls.size >= 5, [...calls].join(", "));
  for (const c of calls) {
    check(
      `generator call "${c}" is twinned or a named passthrough`,
      c in MAPPED || PASSTHROUGH.has(c),
      "add a twin (API_CONTRACT §4.6) or move it out of P1 (PM)",
    );
  }
}

// ---------------------------------------------------------------- 5
console.log("fixtures");
{
  const offenders = walk("src/routes").filter((f) =>
    /__fixtures__/.test(stripComments(read(f) ?? "")),
  );
  check(
    "no route imports src/services/isp-partner/__fixtures__",
    offenders.length === 0,
    offenders.join(", "),
  );
}

// ---------------------------------------------------------------- 6
console.log("Master page");
{
  const page = stripComments(read("src/routes/master.isp-partners.tsx") ?? "");
  check("master.isp-partners.tsx exists", page.length > 0);
  check(
    "not-found while the flag is unset",
    /if\s*\(\s*!isIspPartnerFeEnabled\(\)\s*\)\s*throw notFound\(\)/.test(page),
  );
  const shell = stripComments(read("src/components/master/MasterShell.tsx") ?? "");
  check(
    'sidebar item exists only when VITE_ISP_PARTNER_ENABLED === "true"',
    /import\.meta\.env\.VITE_ISP_PARTNER_ENABLED\s*===\s*"true"\s*\?\s*\[\s*\{\s*to:\s*"\/master\/isp-partners"/.test(
      shell,
    ),
  );
  const svc = stripComments(read("src/services/isp-partner/platform.ts") ?? "");
  check(
    "platform service states the platform scope on its calls",
    /crossOrganizationHeaders\(\)/.test(svc),
  );
}

// ---------------------------------------------------------------- 7
console.log("partner chrome wording");
{
  const files = [
    ...walk("src/components/isp-partner"),
    ...walk("src/routes").filter((f) => /\/partner[.\w$-]*\.tsx$/.test(f)),
  ];
  const hits = files.filter((f) => /WireGuard/i.test(stripComments(read(f) ?? "")));
  check(
    '"WireGuard" appears nowhere in partner-app chrome',
    hits.length === 0,
    hits.map((f) => relative(ROOT, join(ROOT, f))).join(", "),
  );
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
