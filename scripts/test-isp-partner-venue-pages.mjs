/**
 * Every customer page the partner console mounts UNCHANGED must only reach
 * calls that the request shim rewrites to a mounted `/isp/venue/...` twin.
 *
 * Pages (and their partner nav ids) are listed in PAGES. For each one the
 * static collector (`scripts/lib/isp-page-calls.mjs`) lists every API call the
 * page can reach; each is sent through the REAL shim with a venue pinned and
 * must land on a path in `scripts/lib/isp-venue-twins.txt` (generated from
 * the backend's `twins_all.ALL_TWINS`), with the venue + ISP headers. A call
 * the collector finds but the page cannot actually make goes in
 * NOT_FROM_THESE_PAGES with the reason, so the list stays honest.
 *
 * Run: node scripts/test-isp-partner-venue-pages.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { makeCollector, UUID } from "./lib/isp-page-calls.mjs";
import { loadShim } from "./lib/isp-shim-bundle.mjs";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const OPS = "src/components/features/OperationsFeatures.tsx";
/** nav id -> the customer page the partner slot mounts. */
const PAGES = {
  portal: [{ file: "src/components/features/PortalPage.tsx" }],
  policies: [{ file: "src/components/features/PoliciesHub.tsx" }],
  whitelist: [{ file: "src/components/features/WhiteList.tsx" }],
  teams: [{ file: "src/components/features/ManageTeamsPage.tsx" }],
  "business-hours": [{ file: OPS, exportName: "OpenHoursView" }],
  "mac-auth": [{ file: OPS, exportName: "MacAuthView" }],
  "isp-details": [{ file: OPS, exportName: "IspDetailsView" }],
};

/** Reached by the static walk, not by these pages at runtime. Keep reasons. */
const NOT_FROM_THESE_PAGES = new Map([
  [
    "get /organizations",
    "no-org fallback branches (fetchOrgNameMap / fetchAllOrganizations); the pages pass the resolved org id",
  ],
  [
    "get /guest-sessions",
    "customer.service#listLocations helper fan-out; the venue pages read sessions through other views",
  ],
  [
    `get ${UUID}/capabilities`,
    "omada-client-controls: Omada client actions inside the guest drawer, Omada venues only (not twinned)",
  ],
  // customerService.getFeatureData switches on its feature argument; MacAuthView
  // passes "mac-auth", whose case calls /mac-authorization/entries only.
  [
    "get /admin-logs/dashboard-logins",
    "getFeatureData 'admin-logs' case; MacAuthView passes 'mac-auth'",
  ],
  [
    "get /admin-logs/router-events",
    "getFeatureData 'admin-logs' case; MacAuthView passes 'mac-auth'",
  ],
  ["get /audit/entries", "getFeatureData 'admin-logs' case; MacAuthView passes 'mac-auth'"],
]);

/** Calls built from a variable base, expanded to every concrete path. */
const DYNAMIC = new Map([
  [
    `delete ${UUID}/${UUID}`,
    // guestService.deleteAccessRule: `${kind === "identifier" ? rules : device-rules}/${id}`
    [`delete /guest-access/rules/${UUID}`, `delete /guest-access/device-rules/${UUID}`],
  ],
]);

const twins = new Set(
  readFileSync(join(ROOT, "scripts/lib/isp-venue-twins.txt"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#")),
);
check("twin list loaded", twins.size > 50, String(twins.size));

const { collect } = makeCollector(ROOT);
const { api, sent, setShimIspOrganization, setShimVenue } = await loadShim(ROOT);
const ISP = "11111111-1111-1111-1111-111111111111";
const CUST = "22222222-2222-2222-2222-222222222222";
const LOC = "33333333-3333-3333-3333-333333333333";
setShimIspOrganization(ISP);
setShimVenue(CUST, LOC);

for (const [nav, entries] of Object.entries(PAGES)) {
  const calls = collect(entries);
  console.log(`${nav}: ${calls.size} reachable calls`);
  check(`${nav}: the collector found calls`, calls.size > 0);
  const expanded = new Map();
  for (const [key, from] of calls) {
    for (const k of DYNAMIC.get(key) ?? [key]) expanded.set(k, from);
  }
  for (const [key, from] of expanded) {
    const [verb, path] = key.split(" ");
    const shown = key.replaceAll(UUID, "{id}");
    if (NOT_FROM_THESE_PAGES.has(key)) {
      check(`${nav}: ${shown} documented: ${NOT_FROM_THESE_PAGES.get(key)}`, true);
      continue;
    }
    if (!path.startsWith("/")) {
      check(
        `${nav}: ${shown} has a literal path`,
        false,
        `dynamic base in ${from}; extend the collector`,
      );
      continue;
    }
    sent.length = 0;
    await api.request({ method: verb, url: path, data: verb === "get" ? undefined : {} });
    const cfg = sent[0];
    const got = (cfg?.url ?? "").split("?")[0].replaceAll(UUID, "{id}");
    const twin = `${verb.toUpperCase()} ${got}`;
    const h = cfg?.headers;
    const hv = (n) => (typeof h?.get === "function" ? h.get(n) : h?.[n]);
    check(
      `${nav}: ${shown} -> ${got}`,
      twins.has(twin) && hv("X-Isp-Customer-Id") === CUST && hv("X-Organization-Id") === ISP,
      `not a mounted twin (${twin}) <- ${from}`,
    );
  }
}

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
