/**
 * The venue-insight demo fixtures (insights.demo.ts) reach the demo
 * workspace ONLY. A real session must see the backend's body or nothing.
 *
 * The real `useInsights.ts` is bundled with three seams stubbed:
 *   - `useIsDemo` (flipped per case),
 *   - `@/services/api` (records every request),
 *   - `resolveOrgId`.
 * Each case server-renders a probe that calls every insight hook and
 * serialises what they return. For the "real" case the React Query cache is
 * primed with a real-shaped body, so the check is not just "undefined is not
 * the fixture" but "the real body comes through untouched".
 *
 * Run: node scripts/test-insights-demo-gate.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = realpathSync(mkdtempSync(join(tmpdir(), "insights-demo-gate-")));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

const demoStub = join(outdir, "demo-stub.mjs");
writeFileSync(demoStub, `export const useIsDemo = () => globalThis.__DEMO === true;`);
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  `globalThis.__CALLS = [];
   export const api = { get: async (url) => { globalThis.__CALLS.push(url); return { data: {} }; } };
   export default api;`,
);
const custStub = join(outdir, "cust-stub.mjs");
writeFileSync(custStub, `export const resolveOrgId = async () => "org-1";`);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
   import * as hooks from "${p("src/components/customer/dashboard/insights/useInsights.ts")}";
   export { React, renderToStaticMarkup, QueryClient, QueryClientProvider, hooks };`,
);
const outfile = join(outdir, "bundle.cjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  alias: { "@": p("src") },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\/hooks\/useCustomerDashboard$/ }, () => ({ path: demoStub }));
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: apiStub }));
        b.onResolve({ filter: /^@\/services\/customer\.service$/ }, () => ({ path: custStub }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json" },
  jsx: "automatic",
});
const m = createRequire(import.meta.url)(outfile);
const h = m.React.createElement;
const LOC = "loc-1";
const DAYS = 28;

function probe(demo, prime) {
  globalThis.__DEMO = demo;
  globalThis.__CALLS.length = 0;
  const client = new m.QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (prime)
    for (const [kind, body] of Object.entries(prime)) {
      client.setQueryData(m.hooks.insightKeys.venue(kind, LOC, DAYS), body);
    }
  let out = null;
  function Probe() {
    out = {
      peak: m.hooks.usePeakHours(LOC, DAYS),
      mix: m.hooks.useGuestMix(LOC, DAYS),
      funnel: m.hooks.useLoginFunnel(LOC, DAYS),
      locations: m.hooks.useLocationComparison(DAYS),
    };
    return null;
  }
  m.renderToStaticMarkup(h(m.QueryClientProvider, { client }, h(Probe)));
  return out;
}

const REAL = {
  "peak-hours": {
    location_id: LOC,
    timezone: "UTC",
    window_start: "",
    window_end: "",
    total_sessions: 3,
    cells: [{ weekday: 1, hour: 9, sessions: 3, guests: 2 }],
  },
  "guest-mix": {
    location_id: LOC,
    timezone: "UTC",
    window_start: "",
    window_end: "",
    unique_guests: 5,
    new_guests: 4,
    returning_guests: 1,
    sessions: 6,
    multi_visit_guests: 1,
    repeat_visit_rate_percent: 20,
    history_starts_at: null,
    has_prior_history: false,
  },
};

console.log("\nreal session, nothing cached");
{
  const r = probe(false);
  for (const k of ["peak", "mix", "funnel", "locations"]) {
    check(
      `${k}: no data (never the fixture)`,
      r[k].data === undefined,
      JSON.stringify(r[k].data)?.slice(0, 80),
    );
    check(`${k}: not flagged demo`, r[k].isDemo === false);
  }
}

console.log("\nreal session, real bodies cached");
{
  const r = probe(false, REAL);
  check("peak-hours: the real body, untouched", r.peak.data === REAL["peak-hours"]);
  check("guest-mix: the real body, untouched", r.mix.data === REAL["guest-mix"]);
  check("funnel: still nothing (not cached)", r.funnel.data === undefined);
}

console.log("\ndemo session");
{
  const r = probe(true, REAL);
  check(
    "peak-hours: the demo fixture, not the cache",
    r.peak.data && r.peak.data !== REAL["peak-hours"] && r.peak.data.cells.length > 50,
  );
  check("guest-mix: the demo fixture", r.mix.data && r.mix.data.unique_guests === 1840);
  check(
    "funnel: the demo fixture",
    r.funnel.data && Array.isArray(r.funnel.data.methods) && r.funnel.data.methods.length > 0,
  );
  check(
    "venue cards are not shown as 'nothing in the demo'",
    !r.peak.isDemo && !r.mix.isDemo && !r.funnel.isDemo,
  );
  check(
    "location comparison unchanged in demo (no fixture, flagged demo)",
    r.locations.data === undefined && r.locations.isDemo === true,
  );
  check(
    "no request is made in the demo",
    globalThis.__CALLS.length === 0,
    globalThis.__CALLS.join(","),
  );
}

console.log("\nthe one gate");
for (const kind of ["peak-hours", "guest-mix", "login-funnel", "locations", "anything"]) {
  check(
    `demoInsightBody(${kind}, demo=false) is undefined`,
    m.hooks.demoInsightBody(kind, false, LOC, DAYS) === undefined,
  );
}

console.log(
  failures === 0 ? "\ninsights demo gate: all checks passed" : `\n${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
