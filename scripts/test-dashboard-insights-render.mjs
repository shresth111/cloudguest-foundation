/**
 * Render test for the customer dashboard's venue-insight widgets
 * (src/components/customer/dashboard/insights/).
 *
 * Each widget is server-rendered (`renderToStaticMarkup`) with its data hook
 * stubbed -- `useInsights.ts` is the widgets' only seam to the network, so the
 * stub replaces that one module and every widget state is driven from here:
 * loading, error, empty, demo, and real data.
 *
 * What it checks, beyond "it mounts":
 *   - every state renders its own copy, and an error is never rendered as
 *     zeros;
 *   - the numbers on screen are the numbers the hook returned (nothing
 *     invented, nothing sample);
 *   - the funnel surfaces the verified-but-not-signed-in gap, and says the
 *     two unrecorded stages are not tracked rather than showing a figure;
 *   - the location comparison renders nothing for a single-venue org or the
 *     demo.
 *
 * It proves nothing about hover behaviour or layout -- look at it in a
 * browser for that. Same pattern as test-network-integration-render.mjs: this
 * repo has no component test runner.
 *
 * Run: node scripts/test-dashboard-insights-render.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

// realpath: on macOS tmpdir() is a /var symlink to /private/var, and the
// stub must resolve to ONE module for setState to reach the widgets.
const outdir = realpathSync(mkdtempSync(join(tmpdir(), "dashboard-insights-render-")));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const norm = (abs) => abs.replace(/\\/g, "/");

const hooksStub = join(outdir, "insights-hooks-stub.mjs");
writeFileSync(
  hooksStub,
  `const state = { peak: {}, mix: {}, funnel: {}, locations: {} };
   export function setState(kind, s) { state[kind] = s; }
   const q = (s) => ({
     data: s.data, isLoading: !!s.isLoading, isError: !!s.isError,
     isDemo: !!s.isDemo, refetch: () => {},
   });
   export const usePeakHours = () => q(state.peak);
   export const useGuestMix = () => q(state.mix);
   export const useLoginFunnel = () => q(state.funnel);
   export const useLocationComparison = () => q(state.locations);
   export const insightKeys = {};`,
);

const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import {
     PeakHoursHeatmapCard, GuestMixCard, LoginFunnelCard, LocationComparisonCard,
   } from "${p("src/components/customer/dashboard/insights/index.ts")}";
   import { setState } from "${norm(hooksStub)}";
   export { React, renderToStaticMarkup, PeakHoursHeatmapCard, GuestMixCard,
     LoginFunnelCard, LocationComparisonCard, setState };`,
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
      name: "stub-insight-hooks",
      setup(b) {
        b.onResolve({ filter: /\/useInsights$/ }, () => ({ path: hooksStub }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);
const h = m.React.createElement;
const render = (el) => m.renderToStaticMarkup(el);
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

const LOC = "loc-1";

function commonStates(name, kind, el) {
  m.setState(kind, { isLoading: true });
  check(`${name}: loading renders a skeleton`, render(el).includes('data-state="loading"'));

  m.setState(kind, { isError: true });
  const err = render(el);
  check(
    `${name}: error renders an alert with retry`,
    err.includes('role="alert"') && text(err).includes("Retry"),
  );
  check(`${name}: error shows no figures`, !/\d+%/.test(text(err)));

  m.setState(kind, { isDemo: true });
  check(`${name}: demo says it has no real data`, render(el).includes('data-state="demo"'));
}

// ── Peak hours ──────────────────────────────────────────────────────────
console.log("PeakHoursHeatmapCard");
{
  const el = h(m.PeakHoursHeatmapCard, { locationId: LOC });
  commonStates("peak", "peak", el);

  m.setState("peak", {
    data: {
      location_id: LOC,
      timezone: "Asia/Kolkata",
      window_start: "",
      window_end: "",
      total_sessions: 3,
      cells: [{ weekday: 1, hour: 9, sessions: 3, guests: 2 }],
    },
  });
  check("peak: under 10 sessions is 'not enough data'", render(el).includes('data-state="empty"'));

  m.setState("peak", {
    data: {
      location_id: LOC,
      timezone: "Asia/Kolkata",
      window_start: "",
      window_end: "",
      total_sessions: 57,
      cells: [
        { weekday: 6, hour: 19, sessions: 40, guests: 31 },
        { weekday: 1, hour: 9, sessions: 10, guests: 9 },
        { weekday: 3, hour: 0, sessions: 7, guests: 7 },
      ],
    },
  });
  const html = render(el);
  const t = text(html);
  check("peak: names the busiest slot", t.includes("Busiest: Sat 7 pm–8 pm"), t.slice(0, 200));
  check("peak: 168 cells", (html.match(/data-step="/g) ?? []).length === 168);
  check(
    "peak: busiest cell is the darkest step",
    html.includes('data-step="5" title="Sat 7 pm–8 pm: 40 connections, 31 guests"'),
  );
  check("peak: empty cells are step 0", (html.match(/data-step="0"/g) ?? []).length === 165);
  check("peak: timezone is stated", t.includes("Times shown in Asia/Kolkata."));
}

// ── Guest mix ───────────────────────────────────────────────────────────
console.log("GuestMixCard");
{
  const el = h(m.GuestMixCard, { locationId: LOC });
  commonStates("mix", "mix", el);

  const base = {
    location_id: LOC,
    timezone: "Asia/Kolkata",
    window_start: "2026-10-01T00:00:00+00:00",
    window_end: "",
    sessions: 0,
    multi_visit_guests: 0,
    repeat_visit_rate_percent: null,
    history_starts_at: null,
    has_prior_history: false,
  };
  m.setState("mix", { data: { ...base, unique_guests: 0, new_guests: 0, returning_guests: 0 } });
  check("mix: zero guests is the empty state", render(el).includes('data-state="empty"'));

  m.setState("mix", {
    data: {
      ...base,
      unique_guests: 120,
      new_guests: 90,
      returning_guests: 30,
      sessions: 300,
      multi_visit_guests: 18,
      repeat_visit_rate_percent: 15,
      history_starts_at: "2026-06-01T10:00:00+00:00",
      has_prior_history: true,
    },
  });
  const t = text(render(el));
  check("mix: totals", t.includes("120 guests"));
  check("mix: new 90 / 75%", /New 90 75%/.test(t), t);
  check("mix: returning 30 / 25%", /Returning 30 25%/.test(t));
  check("mix: repeat rate", t.includes("Came back on another day 15%"));
  check(
    "mix: no history note hidden when history exists",
    !t.includes("Our records for this venue start"),
  );

  m.setState("mix", {
    data: {
      ...base,
      unique_guests: 5,
      new_guests: 5,
      returning_guests: 0,
      history_starts_at: "2026-10-10T00:00:00+00:00",
    },
  });
  check(
    "mix: says everyone is new because history is short",
    text(render(el)).includes("Our records for this venue start on 10 Oct 2026"),
  );
}

// ── Login funnel ────────────────────────────────────────────────────────
console.log("LoginFunnelCard");
{
  const el = h(m.LoginFunnelCard, { locationId: LOC });
  commonStates("funnel", "funnel", el);
  const una = { available: false, message: "x" };
  const base = {
    location_id: LOC,
    window_start: "",
    window_end: "",
    portal_opened: una,
    internet_confirmed: una,
  };

  m.setState("funnel", {
    data: {
      ...base,
      otp_codes_sent: 0,
      otp_requested_guests: 0,
      otp_verified_guests: 0,
      otp_signed_in_guests: 0,
      methods: [],
    },
  });
  check("funnel: nothing recorded is the empty state", render(el).includes('data-state="empty"'));

  m.setState("funnel", {
    data: {
      ...base,
      otp_codes_sent: 260,
      otp_requested_guests: 200,
      otp_verified_guests: 150,
      otp_signed_in_guests: 140,
      methods: [
        { auth_method: "otp_sms", successful_logins: 140, failed_logins: 50, guests: 140 },
        { auth_method: "voucher", successful_logins: 60, failed_logins: 0, guests: 40 },
      ],
    },
  });
  const t = text(render(el));
  check("funnel: requested 200 100%", t.includes("Asked for an OTP 200 100%"));
  check("funnel: verified 150 75%", t.includes("Entered the right OTP 150 75%"));
  check("funnel: signed in 140 70%", t.includes("Signed in 140 70%"));
  check(
    "funnel: verified-not-signed-in gap is called out",
    t.includes("10 guests entered the right OTP but no login was recorded"),
  );
  check("funnel: resends disclosed", t.includes("260 codes sent, including resends."));
  check(
    "funnel: method split",
    t.includes("SMS OTP 140 70%") && t.includes("Voucher 60 30%") && t.includes("50 failed"),
  );
  check(
    "funnel: unrecorded stages say so",
    t.includes("Not tracked yet: how many guests opened the login page"),
  );

  m.setState("funnel", {
    data: {
      ...base,
      otp_codes_sent: 5,
      otp_requested_guests: 5,
      otp_verified_guests: 5,
      otp_signed_in_guests: 5,
      methods: [],
    },
  });
  check(
    "funnel: no gap banner when there is no gap",
    !render(el).includes('data-testid="funnel-gap"'),
  );
}

// ── Location comparison ─────────────────────────────────────────────────
console.log("LocationComparisonCard");
{
  const el = h(m.LocationComparisonCard, {});
  m.setState("locations", { isLoading: true });
  check("locations: loading renders a skeleton", render(el).includes('data-state="loading"'));
  m.setState("locations", { isError: true });
  check("locations: error renders an alert", render(el).includes('role="alert"'));
  m.setState("locations", { isDemo: true });
  check("locations: hidden in the demo", render(el) === "");

  const row = (id, name, guests, sessions, total, online) => ({
    location_id: id,
    location_name: name,
    guests,
    sessions,
    routers_total: total,
    routers_online: online,
    last_router_seen_at: null,
  });
  const wrap = (locations) => ({
    data: { organization_id: "o", window_start: "", window_end: "", liveness_note: "", locations },
  });

  m.setState("locations", wrap([row("a", "Andheri", 10, 20, 1, 1)]));
  check("locations: hidden for a single-venue org", render(el) === "");

  m.setState(
    "locations",
    wrap([
      row("a", "Andheri", 120, 300, 2, 2),
      row("b", "Bandra", 40, 55, 2, 1),
      row("c", "Colaba", 0, 0, 1, 0),
      row("d", "Dadar", 0, 0, 0, 0),
    ]),
  );
  const html = render(el);
  const t = text(html);
  check(
    "locations: one row per venue",
    (html.match(/data-testid="location-row-/g) ?? []).length === 4,
  );
  check(
    "locations: liveness text, not colour alone",
    t.includes("Online 2/2") &&
      t.includes("Partly online 1/2") &&
      t.includes("Offline 0/1") &&
      t.includes("No router"),
  );
  check("locations: numbers as given", t.includes("Andheri 120 300"));
  check(
    "locations: says router state is 'now', not uptime",
    t.includes("not uptime over the period"),
  );
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\ndashboard insights: all checks passed");
process.exit(failures ? 1 : 0);
