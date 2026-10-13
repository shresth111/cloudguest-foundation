/**
 * Master "Traffic Lens" -> "Where traffic goes" (Geo Location): honesty,
 * wording and licence guards. Shapes are wyfy-specs/flow-visibility/API.md
 * ("Geo Location API"); the fixtures below exist ONLY in this file.
 *
 * What this pins, worst-first:
 *
 *   1. THE ATTRIBUTION IS ALWAYS THERE. The data is CC BY 4.0 and its
 *      publisher requires a link back on every page that shows results. The
 *      link renders in every state the server answered, falls back to the
 *      built-in one when the response's is missing, and is only ever https.
 *   2. FOUR ANSWERS, NEVER CONFUSED. Not measured; country data not
 *      available on the server; not recorded for this period; a real
 *      result. Only the last shows a number, whatever is in the payload.
 *      A measured zero still reads as a zero, not as "not measured".
 *   3. A NETWORK IS A NETWORK. No heading, label or note calls an AS name an
 *      app, an application, a service or a site (except to say it is not).
 *   4. THE SHARES ADD UP. "Other countries" and "Country not known" are
 *      their own rows; inside a country, "other" and "not known" networks
 *      are stated.
 *   5. NO MAP, NO FIXTURES. The Master block stays a Master file.
 *   6. THE CUSTOMER VIEW (Traffic Lens -> Countries) keeps the customer
 *      rules: the venue path only, no word about how traffic is gathered,
 *      nothing imported from an operator module, and networks withheld at a
 *      small venue are announced with how much they cover -- country totals
 *      are never withheld.
 *
 * Bundles the real modules with esbuild and executes them, and renders the
 * real component to static markup (this repo has no test runner -- see
 * scripts/test-traffic-flow.mjs).
 *
 * Run: node scripts/test-traffic-flow-geo.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { createRequire } from "node:module";

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
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const outdir = mkdtempSync(join(tmpdir(), "traffic-flow-geo-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/traffic-flow-geo.ts")}";
   export { flowGeoParams, flowSummaryParams }
     from "${p("src/services/traffic-flow.service.ts")}";
   export { TrafficFlowGeoBlock } from "${p("src/components/master/TrafficFlowGeoBlock.tsx")}";
   export { TrafficLensGeoTable } from "${p("src/components/traffic-lens/TrafficLensGeo.tsx")}";
   export { lensGeoParams, lensSummaryParams, trafficLensService }
     from "${p("src/services/traffic-lens.service.ts")}";
   export { LENS_VIEWS } from "${p("src/lib/traffic-lens-customer.ts")}";
   export { apiCalls } from "@/services/api";
   export { createElement } from "react";
   export { renderToStaticMarkup } from "react-dom/server";`,
);
const bundle = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  // The entry lives in the temp dir; react is resolved from the repo.
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  define: { "process.env.NODE_ENV": '"production"' },
  jsx: "automatic",
  alias: { "@": p("src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        // The service imports the axios client; only the pure param builder
        // is exercised here.
        b.onResolve({ filter: /^\.\/api$|^@\/services\/api$/ }, () => ({
          path: "api",
          namespace: "stub",
        }));
        b.onLoad({ filter: /^api$/, namespace: "stub" }, () => ({
          contents: `
            export const apiCalls = [];
            export const api = {
              get: async (url, config) => {
                apiCalls.push({ url, config });
                return { data: { measured: false } };
              },
            };
            export const requestErrorOf = () => null;
            export const requestErrorMessage = (_e, fallback) => fallback;
            export const resolveActiveOrganizationId = () => "o1";
            export default api;`,
          loader: "js",
        }));
        // The customer view's container asks through a react-query hook;
        // only the table it renders is exercised here.
        b.onResolve({ filter: /^@\/hooks\/useTrafficLens$/ }, () => ({
          path: "lens-hook",
          namespace: "stub",
        }));
        b.onLoad({ filter: /^lens-hook$/, namespace: "stub" }, () => ({
          contents: "export const useTrafficLensGeo = () => ({ isLoading: true });",
          loader: "js",
        }));
        // The Master table kit pulls in the whole shell; plain table parts
        // with the same names are enough to render the block.
        b.onResolve({ filter: /^@\/components\/master\/MasterKit$/ }, () => ({
          path: "kit",
          namespace: "stub",
        }));
        b.onLoad({ filter: /^kit$/, namespace: "stub" }, () => ({
          contents: `
            import { createElement as h } from "react";
            export const MTable = ({ head, children }) =>
              h("table", null, h("thead", null, h("tr", null, head)), h("tbody", null, children));
            export const MTh = ({ children }) => h("th", null, children);
            export const MTd = ({ children }) => h("td", null, children);
            export const MTr = ({ children }) => h("tr", null, children);`,
          loader: "js",
          resolveDir: ROOT,
        }));
      },
    },
  ],
});
const m = createRequire(import.meta.url)(bundle);
const render = (props) =>
  m.renderToStaticMarkup(
    m.createElement(m.TrafficFlowGeoBlock, { loading: false, error: null, ...props }),
  );
const textOf = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Fixtures (API.md's own example, trimmed; documentation names only)
// ---------------------------------------------------------------------------
const NOW = Date.parse("2026-10-12T14:10:00Z");
const ATTRIBUTION = {
  text: "IP Geolocation by DB-IP",
  url: "https://db-ip.com",
  license: "CC BY 4.0",
  license_url: "https://creativecommons.org/licenses/by/4.0/",
};
const geo = (over = {}) => ({
  feature_enabled: true,
  measured: true,
  geo_available: true,
  geo_measured: true,
  exact: true,
  since: "2026-10-12T13:10:00+00:00",
  until: "2026-10-12T14:10:00+00:00",
  window_seconds: 300,
  windows: 12,
  windows_measured: 12,
  data_oldest: "2026-10-12T09:40:00+00:00",
  data_newest: "2026-10-12T14:05:00+00:00",
  totals: { bytes_up: 52428800, bytes_down: 681574400, bytes: 734003200, flows: 18422 },
  countries: {
    items: [
      {
        country_code: "IN",
        bytes_up: 41943040,
        bytes_down: 545259520,
        bytes: 587202560,
        flows: 14100,
        share: 0.8,
        networks: {
          items: [
            {
              asn: 64500,
              network_name: "Example Mobile Ltd",
              bytes_up: 20971520,
              bytes_down: 419430400,
              bytes: 440401920,
              flows: 9000,
              share: 0.75,
            },
            {
              asn: 64501,
              network_name: null,
              bytes_up: 10485760,
              bytes_down: 62914560,
              bytes: 73400320,
              flows: 3100,
              share: 0.125,
            },
          ],
          other_bytes: 62914560,
          unknown_bytes: 10485760,
        },
      },
      {
        country_code: "US",
        bytes_up: 8388608,
        bytes_down: 96468992,
        bytes: 104857600,
        flows: 3200,
        share: 0.1429,
        networks: { items: [], other_bytes: 0, unknown_bytes: 0 },
      },
    ],
    other_bytes: 20971520,
    other_share: 0.0286,
  },
  unknown: {
    bytes_up: 2097152,
    bytes_down: 18874368,
    bytes: 20971520,
    flows: 1122,
    share: 0.0286,
  },
  attribution: ATTRIBUTION,
  source: {
    name: "DB-IP Lite",
    country_data_built: "2026-10-01",
    network_data_built: "2026-10-01",
  },
  ...over,
});
const EMPTY = {
  totals: null,
  unknown: null,
  countries: { items: [], other_bytes: 0, other_share: 0 },
};
const NOT_MEASURED = geo({
  measured: false,
  geo_measured: false,
  exact: false,
  windows: 0,
  windows_measured: 0,
  ...EMPTY,
});
const GEO_UNAVAILABLE = geo({
  geo_available: false,
  geo_measured: false,
  exact: false,
  windows_measured: 0,
  source: null,
  ...EMPTY,
});
const NOT_RECORDED = geo({ geo_measured: false, exact: false, windows_measured: 0, ...EMPTY });
const MEASURED_ZERO = geo({
  totals: { bytes_up: 0, bytes_down: 0, bytes: 0, flows: 0 },
  countries: { items: [], other_bytes: 0, other_share: 0 },
  unknown: { bytes_up: 0, bytes_down: 0, bytes: 0, flows: 0, share: 0 },
});
/** A payload that lies: flags say "nothing", numbers say otherwise. */
const lying = (base) => ({ ...base, totals: geo().totals, countries: geo().countries });

// ---------------------------------------------------------------------------
console.log("\nfour answers, never confused");
eq("a real result", m.geoState(geo()).kind, "ok");
eq("no window in the range", m.geoState(NOT_MEASURED).kind, "not_measured");
eq("measured, server has no country data", m.geoState(GEO_UNAVAILABLE).kind, "geo_unavailable");
eq("measured before country data existed", m.geoState(NOT_RECORDED).kind, "not_recorded");
eq("platform flag off", m.geoState(geo({ feature_enabled: false })).kind, "feature_off");
eq("no response at all is not measured", m.geoState(undefined).kind, "not_measured");
eq("null is not measured", m.geoState(null).kind, "not_measured");
eq("a measured zero is a result", m.geoState(MEASURED_ZERO).kind, "ok");
check("a measured zero is recognised as empty", m.geoMeasuredEmpty(MEASURED_ZERO) === true);
check("a real result is not empty", m.geoMeasuredEmpty(geo()) === false);
check("not measured is not 'empty'", m.geoMeasuredEmpty(NOT_MEASURED) === false);
check("geo unavailable is not 'empty'", m.geoMeasuredEmpty(GEO_UNAVAILABLE) === false);
check(
  "geo_measured without totals is not treated as a result",
  m.geoState(geo({ totals: null })).kind !== "ok",
);
for (const [name, payload] of [
  ["not measured", NOT_MEASURED],
  ["geo unavailable", GEO_UNAVAILABLE],
  ["not recorded", NOT_RECORDED],
  ["feature off", geo({ feature_enabled: false })],
]) {
  eq(
    `${name}: no country rows even if the payload carries some`,
    m.geoCountryRows(lying(payload)).length,
    0,
  );
  eq(`${name}: no other/unknown rows either`, m.geoTailRows(lying(payload)).length, 0);
  const s = m.geoState(payload);
  check(`${name}: has a title and a body`, s.title.length > 10 && s.body.length > 10);
  check(`${name}: never worded as zero traffic`, !/\b0 B\b|no traffic\.$/i.test(s.title));
}
check(
  "geo unavailable says the server lacks the data and nothing is guessed",
  /not available on this server/.test(m.geoState(GEO_UNAVAILABLE).title) &&
    /no country is guessed/.test(m.geoState(GEO_UNAVAILABLE).body) &&
    /not the same as no traffic/.test(m.geoState(GEO_UNAVAILABLE).body),
);
check(
  "not measured says it is not the same as no traffic",
  /not the same as no traffic/.test(m.geoState(NOT_MEASURED).body),
);
check(
  "not recorded does not blame the server's data",
  !/not available/.test(m.geoState(NOT_RECORDED).title),
);

// ---------------------------------------------------------------------------
console.log("\ncountries, shares and bars");
const rows = m.geoCountryRows(geo());
eq(
  "order is the API's",
  rows.map((r) => r.code),
  ["IN", "US"],
);
eq(
  "country names come from the browser",
  rows.map((r) => r.name),
  ["India", "United States"],
);
eq("share label", rows[0].share, "80%");
eq("bar width", rows[0].barWidth, 80);
eq("small share keeps a decimal", rows[1].share, "14%");
eq("total", rows[0].bytes, "587 MB");
eq("download", rows[0].down, "545 MB");
eq("upload", rows[0].up, "41.9 MB");
eq("a code the browser has no name for is shown as the code", m.countryName("QM"), "QM");
eq("lower case is normalised", m.countryName("in"), "India");
eq("a non-code is not looked up", m.countryName("unknown"), "UNKNOWN");
eq("missing code is a dash", m.countryName(null), "—");
const tail = m.geoTailRows(geo());
eq(
  "other and unknown are their own rows",
  tail.map((r) => r.key),
  ["other", "unknown"],
);
eq("other label", tail[0].label, "Other countries");
eq("unknown label", tail[1].label, "Country not known");
eq("unknown share", tail[1].share, "2.9%");
check("unknown says it is not guessed", /Not guessed/.test(tail[1].hint));
eq(
  "a true zero other/unknown row is left out",
  m.geoTailRows(
    geo({ countries: { ...geo().countries, other_bytes: 0 }, unknown: MEASURED_ZERO.unknown }),
  ).length,
  0,
);
{
  const g = geo();
  const listed = g.countries.items.reduce((sum, c) => sum + c.bytes, 0);
  eq(
    "fixture: listed + other + unknown is the total",
    listed + g.countries.other_bytes + g.unknown.bytes,
    g.totals.bytes,
  );
}

// ---------------------------------------------------------------------------
console.log("\nnetworks inside a country");
const india = rows[0];
check("a country with networks can be opened", india.expandable === true);
check("a country with none cannot", rows[1].expandable === false);
eq("network name", india.networks[0].name, "Example Mobile Ltd");
eq("AS number beside it", india.networks[0].asn, "AS64500");
eq("a network with no name shows its AS number", india.networks[1].name, "AS64501");
eq("network share is of the country", india.networks[0].share, "75%");
eq("other networks are stated", india.networksOther, "62.9 MB");
eq("networks not known are stated", india.networksUnknown, "10.5 MB");
eq("none stated when zero", [rows[1].networksOther, rows[1].networksUnknown], [null, null]);
eq("asn 0 is not a network", m.asnLabel(0), "—");
eq("blank name falls back to the number", m.networkLabel(64500, "   "), "AS64500");
eq("the heading is Network", m.GEO_NETWORK_HEADING, "Network");

// ---------------------------------------------------------------------------
console.log("\ncoverage and staleness");
eq("fully looked up: no coverage note", m.geoCoverageNote(geo()), null);
check(
  "partly looked up says how much",
  /Covers 7 of 12 five-minute periods/.test(
    m.geoCoverageNote(geo({ exact: false, windows_measured: 7 })),
  ),
);
eq("no coverage note without a result", m.geoCoverageNote(NOT_RECORDED), null);
eq("data present: no stale note", m.geoStaleNote(geo()), null);
check(
  "stored results shown while the data is gone are flagged",
  /no longer available/.test(m.geoStaleNote(geo({ geo_available: false, source: null }))),
);
eq("data date", m.geoDataDateNote(geo()), "Country data from 1 Oct 2026.");
eq("no data date when nothing is loaded", m.geoDataDateNote(GEO_UNAVAILABLE), null);
eq(
  "a malformed date is not printed",
  m.geoDataDateNote(
    geo({ source: { name: "x", country_data_built: "soon", network_data_built: null } }),
  ),
  null,
);

// ---------------------------------------------------------------------------
console.log("\nattribution (CC BY 4.0: a link back wherever results are shown)");
eq("from the response", m.geoAttribution(geo()), { text: ATTRIBUTION.text, url: ATTRIBUTION.url });
eq("missing -> built-in", m.geoAttribution(geo({ attribution: null })), {
  text: "IP Geolocation by DB-IP",
  url: "https://db-ip.com",
});
eq("no response -> built-in", m.geoAttribution(undefined), m.GEO_DEFAULT_ATTRIBUTION);
for (const url of [
  "javascript:alert(1)",
  "http://db-ip.com",
  "//db-ip.com",
  "data:text/html,x",
  "",
]) {
  eq(
    `unusable url ${JSON.stringify(url)} -> built-in`,
    m.geoAttribution(geo({ attribution: { text: "x", url } })).url,
    "https://db-ip.com",
  );
}
eq(
  "empty text -> built-in",
  m.geoAttribution(geo({ attribution: { text: " ", url: "https://db-ip.com" } })).text,
  "IP Geolocation by DB-IP",
);

// ---------------------------------------------------------------------------
console.log("\nthe rendered block");
const LINK = '<a href="https://db-ip.com" target="_blank" rel="noopener noreferrer"';
{
  const html = render({ geo: geo() });
  const text = textOf(html);
  check("ok: lists the countries", /India/.test(text) && /United States/.test(text));
  check("ok: shares are printed as numbers", /80%/.test(text) && /14%/.test(text));
  check(
    "ok: other and unknown rows",
    /Other countries/.test(text) && /Country not known/.test(text),
  );
  check("ok: attribution link", html.includes(LINK) && /IP Geolocation by DB-IP/.test(text));
  check("ok: data date beside it", /Country data from 1 Oct 2026\./.test(text));
  check("ok: says the country is an estimate", /estimate from the address/.test(text));
  check(
    "ok: an openable country is a button",
    /<button type="button" aria-expanded="false"/.test(html),
  );
  check("ok: networks are closed until opened", !/Example Mobile Ltd/.test(text));
  check("ok: no notice", !/Not measured|not available|not recorded/i.test(text));
}
for (const [name, payload, title] of [
  ["not measured", NOT_MEASURED, "Not measured for this period."],
  ["geo unavailable", GEO_UNAVAILABLE, "Country data is not available on this server."],
  ["not recorded", NOT_RECORDED, "Country was not recorded for this period."],
]) {
  const html = render({ geo: lying(payload) });
  const text = textOf(html);
  check(`${name}: says so`, text.includes(title));
  check(
    `${name}: no table, no country, no number`,
    !/<table/.test(html) && !/India|\d+ ?MB|\d%/.test(text),
  );
  check(`${name}: attribution link still rendered`, html.includes(LINK));
}
{
  const text = textOf(render({ geo: MEASURED_ZERO }));
  check(
    "measured zero: its own sentence, not 'not measured'",
    /No traffic to outside addresses in this period\./.test(text) && !/Not measured/.test(text),
  );
}
{
  const html = render({ geo: undefined, loading: true });
  check(
    "loading: a placeholder, no notice and no numbers",
    /animate-pulse/.test(html) && !/Not measured/.test(html),
  );
}
{
  const html = render({ geo: undefined, error: "The server did not answer." });
  const text = textOf(html);
  check(
    "failed request: a failure, not an empty list",
    /Couldn't load the country breakdown\./.test(text) &&
      /an error is not an empty list/.test(text),
  );
  check("failed request: not worded as not measured", !/Not measured|No traffic/.test(text));
}
{
  const text = textOf(render({ geo: geo({ exact: false, windows_measured: 7 }) }));
  check("partial coverage is printed", /Covers 7 of 12 five-minute periods/.test(text));
}
{
  const text = textOf(render({ geo: geo({ geo_available: false, source: null }) }));
  check(
    "stale data warning is printed with the figures",
    /no longer available/.test(text) && /India/.test(text),
  );
}

// ---------------------------------------------------------------------------
console.log("\nrequest");
const scope = { window: "24h", locationId: "l1", routerId: "" };
const params = m.flowGeoParams(scope, NOW);
const summaryParams = m.flowSummaryParams(scope, NOW);
eq(
  "same pinned range as the summary",
  [params.since, params.until],
  [summaryParams.since, summaryParams.until],
);
eq("venue is sent", params.location_id, "l1");
check("no empty router_id", !("router_id" in params));
eq("list sizes", [params.limit, params.networks], ["10", "5"]);
const both = m.flowGeoParams({ window: "1h", locationId: "l1", routerId: "r1" }, NOW);
check("router and venue may be combined", both.router_id === "r1" && both.location_id === "l1");

// ---------------------------------------------------------------------------
console.log("\nwording, wiring, no map, no customer surface");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const f = join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(f);
  }
  return out;
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const block = read("src/components/master/TrafficFlowGeoBlock.tsx");
const lib = read("src/lib/traffic-flow-geo.ts");
const venue = read("src/components/master/TrafficFlowVenueView.tsx");
const service = read("src/services/traffic-flow.service.ts");
const hook = read("src/hooks/useTrafficFlow.ts");
const uiCode = strip(block) + strip(lib);
check(
  "a network is never called an application (except to say it is not one)",
  !/application/i.test(uiCode.replace(/not an application/g, "")),
);
check(
  "nor an app, a service or a site (except to say it is not one)",
  !/\bapps?\b/i.test(uiCode) &&
    !/\bsites?\b/i.test(uiCode.replace(/not a site/g, "").replace(/one of its sites/g, "")),
);
check(
  "the note says a network is not an application",
  /It is not an application and not a site/.test(lib),
);
check("the network column is headed by the constant", /\{GEO_NETWORK_HEADING\}/.test(block));
check("no module name hard-coded in the block", !/Traffic (Flow|Lens)/.test(uiCode));
check(
  "the attribution link is rendered from geoAttribution",
  /geoAttribution\(geo\)/.test(block) && /href=\{attribution\.url\}/.test(block),
);
check(
  "the link opens safely",
  /target="_blank"/.test(block) && /rel="noopener noreferrer"/.test(block),
);
check("no raw HTML from the response", !/dangerouslySetInnerHTML/.test(block + lib));
check(
  "the block decides by geoState, not by counting rows",
  /state\.kind !== "ok"/.test(block) && /geoMeasuredEmpty\(geo\)/.test(block),
);
check(
  "expanding is a real button with aria-expanded",
  /aria-expanded=\{open\.has\(row\.key\)\}/.test(block) && /type="button"/.test(block),
);
check(
  "no map and no chart library in the block",
  !/recharts|leaflet|mapbox|<svg|<path/i.test(block),
);
check(
  "the block is presentational: it imports neither the hook nor the service",
  !/hooks\/useTrafficFlow|traffic-flow\.service/.test(block),
);
check(
  "the venue view owns the request, for the same scope and pinned range",
  /useFlowGeo\(scope, at, s\?\.measured === true\)/.test(venue) &&
    /<TrafficFlowGeoBlock/.test(venue),
);
check(
  "a failed geo request is passed as an error, not as empty data",
  /geoQ\.isError/.test(venue) && /error=\{/.test(venue),
);
check(
  "the request is not sent until the range is measured and a scope is picked",
  /enabled: enabled && !!\(scope\.locationId \|\| scope\.routerId\)/.test(hook),
);
check("the service calls the platform route", /`\$\{BASE\}\/geo`/.test(service));
const sources = walk(join(ROOT, "src")).map((f) => [relative(ROOT, f), readFileSync(f, "utf8")]);
const users = (re, self) =>
  sources
    .filter(([f, src]) => f !== self && re.test(src))
    .map(([f]) => f)
    .sort();
eq(
  "only the Master venue view renders the block",
  users(/TrafficFlowGeoBlock/, "src/components/master/TrafficFlowGeoBlock.tsx"),
  ["src/components/master/TrafficFlowVenueView.tsx"],
);
eq(
  "only the two geo views read the geo wording module",
  users(/lib\/traffic-flow-geo/, "src/lib/traffic-flow-geo.ts"),
  [
    "src/components/master/TrafficFlowGeoBlock.tsx",
    "src/components/traffic-lens/TrafficLensGeo.tsx",
  ],
);
eq(
  "only the hook asks for geo",
  users(/trafficFlowService\.geo\(|flowGeoParams/, "src/services/traffic-flow.service.ts"),
  ["src/hooks/useTrafficFlow.ts"],
);
check(
  "no fixture data in the app",
  !/192\.168\.|10\.20\.0\.|Example Mobile|AS64500|64500/.test(block + lib + service + hook),
);
check(
  "no country list shipped in the app (names come from Intl.DisplayNames)",
  /new Intl\.DisplayNames\(\["en"\], \{ type: "region" \}\)/.test(lib) &&
    !/"India"|"United States"/.test(lib),
);

// ---------------------------------------------------------------------------
console.log("\ncustomer dashboard: the Countries view");
const renderLens = (props) =>
  m.renderToStaticMarkup(
    m.createElement(m.TrafficLensGeoTable, { loading: false, error: null, ...props }),
  );
/** The customer shape: no platform switch, the venue, and the rule fields. */
const lensGeo = (over = {}) => {
  const { feature_enabled: _omit, ...rest } = geo();
  return {
    ...rest,
    location_id: "l1",
    networks_min_devices: 5,
    networks_withheld_windows: 0,
    ...over,
  };
};
/** India: 400 MB of its networks' traffic was in small periods. */
const withheldCountries = (() => {
  const base = geo().countries;
  const [india, usa] = base.items;
  return {
    ...base,
    items: [
      {
        ...india,
        networks: { ...india.networks, items: [india.networks.items[0]], withheld_bytes: 73400320 },
      },
      {
        ...usa,
        networks: { items: [], other_bytes: 0, unknown_bytes: 0, withheld_bytes: usa.bytes },
      },
    ],
  };
})();
const LENS_WITHHELD = lensGeo({ networks_withheld_windows: 3, countries: withheldCountries });

eq(
  "the customer shape without the platform switch is a result",
  m.geoState(lensGeo(), "customer").kind,
  "ok",
);
eq(
  "customer: geo unavailable is still its own answer",
  m.geoState({ ...GEO_UNAVAILABLE, feature_enabled: undefined }, "customer").kind,
  "geo_unavailable",
);
{
  const s = m.geoState(GEO_UNAVAILABLE, "customer");
  check(
    "customer: unavailable says no country is guessed, and not 'no traffic'",
    /no country is guessed/.test(s.body) && /not the same as no traffic/.test(s.body),
  );
  check(
    "customer: no talk of servers or data files",
    !/server|data file|installed/i.test(
      s.title +
        s.body +
        m.geoState(NOT_RECORDED, "customer").body +
        m.geoStaleNote(geo({ geo_available: false, source: null }), "customer"),
    ),
  );
}
eq(
  "the views end with Countries",
  m.LENS_VIEWS.map((v) => v.id),
  ["overview", "destinations", "geo"],
);
eq("the view's label", m.LENS_VIEWS.find((v) => v.id === "geo").label, "Countries");

console.log("\ncustomer dashboard: the sentence Countries opens on");
{
  const lead = m.geoLead(lensGeo());
  eq("lead: kind", lead.kind, "top");
  eq(
    "lead: says 'about' and 'placed in', never that traffic went to a country",
    lead.headline,
    "About 80% of the traffic went to addresses placed in India.",
  );
  eq("lead: the figure is that share", lead.figure, "80%");
  check("lead: amounts carry units", /^\d.* MB of \d.* MB/.test(lead.detail), lead.detail);
  eq("lead: nothing from no response", m.geoLead(undefined), null);
  eq("lead: nothing from an unmeasured period", m.geoLead(lensGeo({ measured: false })), null);
  eq("lead: nothing when no country data exists", m.geoLead(GEO_UNAVAILABLE), null);
  eq("lead: nothing when country was not recorded", m.geoLead(NOT_RECORDED), null);
  eq("lead: nothing from a measured zero", m.geoLead(lensGeo(MEASURED_ZERO)), null);
  const [india, usa] = geo().countries.items;
  const level = m.geoLead(
    lensGeo({
      countries: {
        items: [
          { ...india, bytes: 500, share: 0.4 },
          { ...usa, bytes: 500, share: 0.4 },
        ],
        other_bytes: 250,
        other_share: 0.2,
      },
    }),
  );
  check(
    "lead: a tie names both and gives neither the top",
    level.kind === "tie" &&
      level.figure === null &&
      /^India and United States are level: about 40% of the traffic was placed in each\.$/.test(
        level.headline,
      ),
    level.headline,
  );
  const unnamed = m.geoLead(lensGeo({ countries: { items: [], other_bytes: 0, other_share: 0 } }));
  check(
    "lead: traffic with no listed country names none",
    unnamed.kind === "none" && unnamed.figure === null && !/India/.test(unnamed.headline),
  );
  const part = m.geoLead(lensGeo({ exact: false, windows_measured: 9 }));
  check(
    "lead: a partly looked-up range says how much was",
    /Of the 9 of 12 five-minute periods that were looked up\./.test(part.detail),
    part.detail,
  );
  check(
    "lead: the reason for withheld networks blames no one and promises whole totals",
    /could point at one person/.test(m.GEO_WITHHELD_WHY) &&
      /Nothing is missing from the country totals/.test(m.GEO_WITHHELD_WHY),
  );
  const text = textOf(renderLens({ geo: LENS_WITHHELD }));
  check(
    "lead: the view prints the sentence, 'estimate', and the reason beside the count",
    /About 80% of the traffic went to addresses placed in India\./.test(text) &&
      /Read this as an estimate/.test(text) &&
      /could point at one person/.test(text),
  );
}

console.log("\ncustomer dashboard: networks at a small venue");
eq("nothing withheld: no note", m.geoWithheldNote(lensGeo()), null);
eq("Master response: no note", m.geoWithheldNote(geo()), null);
check(
  "some periods withheld: says how many, and that totals are whole",
  /fewer than 5 devices are connected: that was 3 of 12 five-minute periods/.test(
    m.geoWithheldNote(LENS_WITHHELD),
  ) && /in each country's total and under no network/.test(m.geoWithheldNote(LENS_WITHHELD)),
);
check(
  "every period withheld: one sentence for the block",
  /whole period\. Country totals are complete\./.test(
    m.geoWithheldNote(lensGeo({ networks_withheld_windows: 12 })),
  ),
);
eq(
  "no note without a result",
  m.geoWithheldNote({ ...NOT_MEASURED, networks_min_devices: 5, networks_withheld_windows: 4 }),
  null,
);
eq(
  "the threshold in the sentence is the API's",
  m.geoNetworksWithheldSentence(8),
  "Networks are not shown while fewer than 8 devices are connected",
);
{
  const lensRows = m.geoCountryRows(LENS_WITHHELD);
  eq(
    "country totals are untouched by the rule",
    lensRows.map((r) => r.bytes),
    ["587 MB", "105 MB"],
  );
  eq("a country's withheld amount is stated", lensRows[0].networksWithheld, "73.4 MB");
  eq(
    "only the shown networks are listed",
    lensRows[0].networks.map((n) => n.name),
    ["Example Mobile Ltd"],
  );
  check(
    "a country with every network withheld still opens, to say why",
    lensRows[1].networks.length === 0 && lensRows[1].expandable === true,
  );
  eq(
    "the Master rows carry no withheld amount",
    m.geoCountryRows(geo()).map((r) => r.networksWithheld),
    [null, null],
  );
}

console.log("\ncustomer dashboard: the rendered view");
{
  const html = renderLens({ geo: LENS_WITHHELD });
  const text = textOf(html);
  check("ok: lists the countries with shares", /India/.test(text) && /80%/.test(text));
  check(
    "ok: other and unknown rows",
    /Other countries/.test(text) && /Country not known/.test(text),
  );
  check("ok: attribution link", html.includes(LINK) && /IP Geolocation by DB-IP/.test(text));
  check("ok: the withheld note is printed", /that was 3 of 12 five-minute periods/.test(text));
  check("ok: says the country is an estimate", /estimate from the address/.test(text));
  check(
    "ok: countries open with a real button",
    /<button type="button" aria-expanded="false"/.test(html),
  );
  check("ok: networks are closed until opened", !/Example Mobile Ltd/.test(text));
}
for (const [name, payload, title] of [
  ["not measured", NOT_MEASURED, "Not measured for this period."],
  ["geo unavailable", GEO_UNAVAILABLE, "Country information is not available yet."],
  ["not recorded", NOT_RECORDED, "Country was not recorded for this period."],
]) {
  const html = renderLens({ geo: lying(payload) });
  const text = textOf(html);
  check(`customer ${name}: says so`, text.includes(title));
  check(
    `customer ${name}: no table, no country, no number`,
    !/<table/.test(html) && !/India|\d+ ?MB|\d%/.test(text),
  );
  check(`customer ${name}: attribution link still rendered`, html.includes(LINK));
}
{
  const text = textOf(renderLens({ geo: lensGeo(MEASURED_ZERO) }));
  check(
    "customer measured zero: its own sentence",
    /No traffic to outside addresses in this period\./.test(text) && !/Not measured/.test(text),
  );
}
{
  const text = textOf(renderLens({ geo: undefined, error: "The country breakdown did not load." }));
  check(
    "customer failed request: a failure, not an empty list",
    /Couldn't load countries for this period\./.test(text) &&
      /an error is not an empty list/.test(text),
  );
}
check(
  "customer loading: a placeholder only",
  /animate-pulse/.test(renderLens({ geo: undefined, loading: true })),
);

console.log("\ncustomer dashboard: request and surface rules");
{
  const preset = { kind: "preset", window: "24h" };
  const gp = m.lensGeoParams(preset, NOW);
  const sp = m.lensSummaryParams(preset, NOW);
  eq("same bounds as the customer summary", [gp.since, gp.until], [sp.since, sp.until]);
  eq("list sizes; the venue is not a parameter", Object.keys(gp).sort(), [
    "limit",
    "networks",
    "since",
    "until",
  ]);
  const custom = {
    kind: "custom",
    since: "2026-10-11T10:00:00.000Z",
    until: "2026-10-11T12:30:00.000Z",
  };
  eq(
    "a custom period is sent as given",
    [m.lensGeoParams(custom, NOW).since, m.lensGeoParams(custom, NOW).until],
    [custom.since, custom.until],
  );
  m.apiCalls.length = 0;
  await m.trafficLensService.geo("l 1", gp);
  check(
    "the customer service uses the venue path",
    m.apiCalls[0].url === "/traffic-flow/locations/l%201/geo" && m.apiCalls[0].config.params === gp,
    JSON.stringify(m.apiCalls[0]),
  );
  const masterCustom = m.flowGeoParams(
    {
      window: "1h",
      locationId: "l1",
      routerId: "",
      custom: { since: custom.since, until: custom.until },
    },
    NOW,
  );
  eq(
    "Master: a custom period is sent as given",
    [masterCustom.since, masterCustom.until],
    [custom.since, custom.until],
  );
}
const lensGeoView = read("src/components/traffic-lens/TrafficLensGeo.tsx");
const lensPage = read("src/components/traffic-lens/TrafficLensView.tsx");
const lensService = read("src/services/traffic-lens.service.ts");
const lensHook = read("src/hooks/useTrafficLens.ts");
for (const f of [
  "src/components/traffic-lens/TrafficLensGeo.tsx",
  // Shared with the Master console, so held to the customer rules too.
  "src/lib/traffic-flow-geo.ts",
  "src/types/traffic-flow-geo.ts",
]) {
  const src = strip(read(f));
  const hit = src.match(
    /wireguard|tunnel|exporter|collector|netflow|ipfix|routeros|mikrotik|read-back/i,
  );
  check(`${f}: no word about how it is gathered`, !hit, hit ? hit[0] : "");
  check(
    `${f}: imports nothing operator-only`,
    !/lib\/traffic-flow"|traffic-flow\.service|hooks\/useTrafficFlow|components\/master\/|\/platform\//.test(
      src,
    ),
  );
  check(
    `${f}: imports nothing about devices, guests or sessions`,
    !/from "[^"]*(guest|session|device|connected|mac-)[^"]*"/i.test(src),
  );
}
check(
  "the customer view reads as a customer",
  /geoState\(geo, "customer"\)/.test(lensGeoView) &&
    /geoStaleNote\(geo, "customer"\)/.test(lensGeoView),
);
check(
  "the customer view never calls a network anything else",
  !/application/i.test(strip(lensGeoView)) && /\{GEO_NETWORK_HEADING\}/.test(lensGeoView),
);
check(
  "the customer view renders the attribution link safely",
  /geoAttribution\(geo\)/.test(lensGeoView) &&
    /href=\{attribution\.url\}/.test(lensGeoView) &&
    /rel="noopener noreferrer"/.test(lensGeoView) &&
    !/dangerouslySetInnerHTML/.test(lensGeoView),
);
check(
  "withheld networks are announced per country and for the block",
  /row\.networksWithheld/.test(lensGeoView) && /geoWithheldNote\(geo\)/.test(lensGeoView),
);
check(
  "the customer view has no control and no map",
  !/<Switch|<svg|<path|recharts/.test(lensGeoView),
);
check(
  "the page shows it as a view, with the page's own period",
  /view === "geo" && \(\s*<TrafficLensGeo/.test(lensPage) &&
    /range=\{range\}\s*at=\{at\}/.test(lensPage),
);
check("the customer service only reads", !/api\.(post|put|patch|delete)/.test(lensService));
check(
  "the request waits for its view and a venue, and a refusal is not retried",
  /queryKey: trafficLensKeys\.geo\(resolveActiveOrganizationId\(\), locationId, range, at\)/.test(
    lensHook,
  ) && /enabled: enabled && !!locationId,\s*retry: retryUnlessRefused/.test(lensHook),
);
eq(
  "only the customer page renders the customer view",
  users(/<TrafficLensGeo\b/, "src/components/traffic-lens/TrafficLensGeo.tsx"),
  ["src/components/traffic-lens/TrafficLensView.tsx"],
);
check(
  "no fixture data in the customer files",
  !/192\.168\.|10\.20\.0\.|Example Mobile|64500/.test(lensGeoView + lensService + lensHook),
);

console.log(
  failures === 0
    ? `\nall traffic flow geo checks passed\n`
    : `\n${failures} traffic flow geo check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
