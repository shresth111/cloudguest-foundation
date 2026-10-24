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
  campaigns: [{ file: "src/components/features/CampaignsPage.tsx" }],
  vouchers: [{ file: "src/components/features/VouchersPage.tsx" }],
  reports: [{ file: "src/components/features/UserReports.tsx" }],
  // Every real report type of UserReports, one by one (ReportPanel's run():
  // report id -> real* function), plus the Business Unit list. A report type
  // that grows an untwinned call fails here by name.
  ...Object.fromEntries(
    [
      ["user-data", "realUserData"],
      ["user-sessions", "realUserSessions"],
      ["user-presence", "realUserPresence"],
      ["top-users", "realTopUsers"],
      ["daywise-data", "realDaywiseData"],
      ["daywise-unique", "realDaywiseUnique"],
      ["guest-session-log", "realGuestSessionLog"],
      ["login-access-log", "realLoginAccessLog"],
      ["voucher-usage", "realVoucherRedemptionLog"],
      ["voucher-batch", "realVoucherBatchRate"],
      ["top-vouchers", "realTopRedeemedVouchers"],
      ["campaign-performance", "realCampaignPerformance"],
      ["top-campaigns", "realTopCampaigns"],
      ["data-consumption", "realDataConsumption"],
      ["data-by-location", "realDataByLocation"],
      ["otp-delivery", "realOtpRequests"],
    ].map(([id, fn]) => [
      `reports:${id}`,
      [{ file: "src/components/features/UserReports.tsx", exportName: fn }],
    ]),
  ),
  "reports:business-unit-list": [
    { file: "src/hooks/useCustomerDashboard.ts", exportName: "useCustomerLocations" },
  ],
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

const { collect, paramShapes } = makeCollector(ROOT);
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

// QA-010 / QA-011 / QA-012: the REAL param shapes. Every call is sent again
// with the query-param keys its caller passes in axios `params` (collected
// from the source), with scope-alias values filled in; no scope-alias name may
// reach the twin (it would move the RBAC check onto the customer org -> 403),
// and a page's "current organization" (the ISP) must become the customer.
{
  const ALIASES = ["location_id", "router_id", "organization_id", "customer_id"];
  const VALUE = { location_id: LOC, router_id: UUID, organization_id: ISP, customer_id: CUST };
  let shapes = 0;
  for (const [key, keys] of paramShapes) {
    const [verb, path] = key.split(" ");
    if (!path.startsWith("/") || NOT_FROM_THESE_PAGES.has(key) || keys.size === 0) continue;
    const params = Object.fromEntries([...keys].map((k) => [k, VALUE[k] ?? "1"]));
    sent.length = 0;
    await api.request({ method: verb, url: path, params, data: verb === "get" ? undefined : {} });
    const cfg = sent[0];
    if (!cfg?.url?.startsWith("/isp/venue/")) continue; // not a venue call (checked above)
    shapes += 1;
    const sentKeys = Object.keys(cfg.params ?? {});
    const leaked = sentKeys.filter((k) => ALIASES.includes(k));
    check(
      `params ${key.replaceAll(UUID, "{id}")} {${[...keys].join(",")}} -> no scope alias`,
      leaked.length === 0,
      `leaked ${leaked.join(",")}`,
    );
  }
  check("param shapes were found in the pages", shapes >= 10, String(shapes));
  for (const sub of ["", "/locations"]) {
    sent.length = 0;
    await api.request({
      method: "get",
      url: `/organizations/${ISP}${sub}`,
      params: { page_size: 50 },
    });
    check(
      `/organizations/<ISP org>${sub} means the pinned customer`,
      sent[0]?.url === `/isp/venue/organizations/${CUST}${sub}`,
      sent[0]?.url,
    );
  }
  sent.length = 0;
  await api.request({
    method: "get",
    url: "/captive-portal/resolve",
    params: { organization_id: CUST, location_id: LOC },
  });
  check(
    "Open Hours resolve sends no organization_id/location_id",
    !Object.keys(sent[0]?.params ?? {}).some((k) => ALIASES.includes(k)),
    JSON.stringify(sent[0]?.params),
  );
}

// QA-026: a customer service's own X-Location-Id / X-Router-Id never reaches
// /isp (400 ISP_SCOPE_HEADERS_NOT_ALLOWED); the location travels as the
// Business Unit parameter instead.
{
  const OTHER = "55555555-5555-5555-5555-555555555555";
  sent.length = 0;
  await api.request({
    method: "get",
    url: "/guest-sessions",
    params: { page: 1 },
    headers: { "X-Organization-Id": CUST, "X-Location-Id": OTHER, "X-Router-Id": UUID },
  });
  const cfg = sent[0];
  const h = cfg?.headers;
  const hv = (n) => (typeof h?.get === "function" ? h.get(n) : h?.[n]);
  check("X-Location-Id is not sent to a venue twin", !hv("X-Location-Id"));
  check("X-Router-Id is not sent to a venue twin", !hv("X-Router-Id"));
  check(
    "the page's location travels as isp_location_id",
    cfg?.params?.isp_location_id === OTHER,
    JSON.stringify(cfg?.params),
  );
  sent.length = 0;
  await api.request({
    method: "get",
    url: `/locations/${OTHER}/routers`,
    headers: { "X-Location-Id": OTHER },
  });
  const h2 = sent[0]?.headers;
  const hv2 = (n) => (typeof h2?.get === "function" ? h2.get(n) : h2?.[n]);
  check(
    "another location of the customer by path keeps its path",
    sent[0]?.url === `/isp/venue/locations/${OTHER}/routers` && !hv2("X-Location-Id"),
    sent[0]?.url,
  );
  sent.length = 0;
  await api.request({
    method: "get",
    url: "/guest-sessions",
    params: { location_id: LOC },
    headers: { "X-Location-Id": OTHER },
  });
  check(
    "an explicit location param wins over the header",
    sent[0]?.params?.isp_location_id === LOC,
  );
}

// The dispatcher must not name a report id this test does not cover.
{
  const src = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
  const dispatched = [...src.matchAll(/reportType === "([a-z-]+)"\)/g)].map((m) => m[1]);
  const covered = new Set(
    Object.keys(PAGES)
      .filter((k) => k.startsWith("reports:"))
      .map((k) => k.slice(8)),
  );
  check("the dispatcher names report types", dispatched.length >= 15, String(dispatched.length));
  for (const id of new Set(dispatched)) {
    check(`report type ${id} is covered by its own entry`, covered.has(id), "add it to PAGES");
  }
}

// The Business Unit's location reaches the twin under its isp_ name.
{
  const BU = "44444444-4444-4444-4444-444444444444";
  sent.length = 0;
  await api.request({ method: "get", url: `/guest-sessions?location_id=${BU}&page=1` });
  const url = sent[0]?.url ?? "";
  check(
    "Business Unit location_id is sent as isp_location_id",
    url.includes(`isp_location_id=${BU}`) && !/[?&]location_id=/.test(url),
    url,
  );
}

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
