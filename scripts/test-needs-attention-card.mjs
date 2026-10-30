/**
 * The dashboard's "Needs attention" card, rendered.
 *
 * Bundles the REAL `NeedsAttentionCard` + `useNeedsAttention` (permission
 * gating, severity sort, source bookkeeping, copy) and stubs only the hook
 * boundary underneath them: `useCustomerDashboard` / `useMyPermissions` /
 * `useIsDemo`, `useMyBillingDashboard`, `useAuth`, `useCustomerStore`, and the
 * card's own two React Query reads in `needsAttentionSources.ts`. Each case
 * sets `globalThis.__NA` and renders to static markup.
 *
 * What it pins down:
 *   - every source healthy -> the calm "All good" state, naming what it checked;
 *   - rows come out error > warning > info regardless of source order;
 *   - a source that failed to load -> "Couldn't check", and never "All good";
 *   - a 403 is "not yours to read" (skipped), not a failed check;
 *   - an action link is dropped when the user's permissions don't open that page.
 *
 * Run: node scripts/test-needs-attention-card.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "needs-attention-card-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const stub = (name, src) => {
  const f = join(outdir, name);
  writeFileSync(f, src);
  return f;
};

const S = "globalThis.__NA";
const dashStub = stub(
  "dash-stub.mjs",
  `export const useCustomerDashboard = () => ${S}.dash;
   export const useMyPermissions = () => ({ data: ${S}.permissions });
   export const useIsDemo = () => false;`,
);
const billingStub = stub(
  "billing-stub.mjs",
  `export const useMyBillingDashboard = () => ${S}.billing;`,
);
const authStub = stub("auth-stub.mjs", `export const useAuth = () => ({ roles: ${S}.roles });`);
const storeStub = stub(
  "store-stub.mjs",
  `export const useCustomerStore = (sel) => sel({
     activeLocation: { organizationId: "org-1", organizationName: "Cafe" },
   });`,
);
const sourcesStub = stub(
  "sources-stub.mjs",
  `export const useVenueOpenAlerts = (_l, enabled) => enabled ? ${S}.alerts : IDLE;
   export const useVenueMonitoredHardware = (_l, enabled) => enabled ? ${S}.devices : IDLE;
   const IDLE = { data: undefined, isLoading: false, isError: false, error: null };`,
);
const headerStub = stub(
  "header-stub.mjs",
  `export const DEMO_PLAN_RENEWAL_ISO = "2026-11-11T00:00:00.000Z";`,
);
const routerStub = stub(
  "router-stub.mjs",
  `import React from "react";
   export const Link = ({ to, children, ...rest }) => React.createElement("a", { href: to, ...rest }, children);`,
);

const entry = stub(
  "entry.mjs",
  `import React from "react";
   import { renderToStaticMarkup } from "react-dom/server";
   import { NeedsAttentionCard } from "${p("src/components/customer/dashboard/NeedsAttentionCard.tsx")}";
   export { React, renderToStaticMarkup, NeedsAttentionCard };`,
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
  alias: {
    "@/hooks/useCustomerDashboard": dashStub,
    "@/hooks/useBilling": billingStub,
    "@/context/AuthContext": authStub,
    "@/stores/customerStore": storeStub,
    "@/components/features/HeaderControls": headerStub,
    "@tanstack/react-router": routerStub,
  },
  plugins: [
    {
      name: "stub-needs-attention-sources",
      setup(b) {
        b.onResolve({ filter: /needsAttentionSources$/ }, () => ({ path: sourcesStub }));
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx", ".json": "json" },
  jsx: "automatic",
});

const m = createRequire(import.meta.url)(outfile);

// ── fixtures: the shapes the real hooks return ─────────────────────────────
const ready = (data) => ({ data, isLoading: false, isError: false, error: null });
const failed = (status) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error: { status },
});
const loading = () => ({ data: undefined, isLoading: true, isError: false, error: null });

const liveness = (state, online, total) => ({
  state,
  label: state,
  summary: "",
  nextStep: null,
  routers: [],
  routersOnline: online,
  routersTotal: total,
});
const dashboard = ({ lv = liveness("live", 1, 1), failedLogins = 0 } = {}) =>
  ready({ liveness: lv, kpis: { failedLogins }, recentAlerts: [] });
const device = (status, extra = {}) => ({
  id: Math.random().toString(36).slice(2),
  status,
  statusSource: "measured",
  observationIssue: null,
  ...extra,
});
const inDays = (n) => new Date(Date.now() + n * 86_400_000 - 3_600_000).toISOString();
const plan = (days, autoRenewal = true, status = "active") =>
  ready({ status, renewalDate: inDays(days), autoRenewal });

const OWNER = [{ roleSlug: "organization-owner", roleName: "Owner", scopeType: "organization" }];

function healthy() {
  return {
    dash: dashboard(),
    permissions: [], // [] = "don't know" -> fail open, same as the sidebar
    roles: OWNER,
    alerts: ready([]),
    devices: ready([device("up")]),
    billing: plan(90),
  };
}

function render(state) {
  globalThis.__NA = state;
  return m
    .renderToStaticMarkup(m.React.createElement(m.NeedsAttentionCard, { locationId: "loc-1" }))
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}
const severities = (html) => [...html.matchAll(/data-severity="(\w+)"/g)].map((x) => x[1]);
const actions = (html) => [...html.matchAll(/data-action="([\w-]+)"/g)].map((x) => x[1]);

console.log("NeedsAttentionCard");

// 1. Every source healthy -> the calm empty state, not a hidden card.
{
  const html = render(healthy());
  check("healthy: All good is shown", html.includes("All good — nothing needs your attention"));
  check("healthy: no rows", severities(html).length === 0);
  check("healthy: no couldn't-check banner", !html.includes("Couldn't check"));
  check(
    "healthy: says what it checked",
    html.includes("We checked: routers, staff sign-ins, alerts, devices, and your plan."),
    html.match(/We checked:[^<]*/)?.[0],
  );
}

// 2. Rows sorted by severity, whatever order the sources are read in.
{
  const html = render({
    ...healthy(),
    dash: dashboard({ lv: liveness("no-router", 0, 0), failedLogins: 3 }),
    alerts: ready([
      { id: "a", status: "triggered", severity: "warning", location_id: "loc-1" },
      { id: "b", status: "triggered", severity: "critical", location_id: "loc-1" },
      { id: "c", status: "acknowledged", severity: "critical", location_id: null },
    ]),
    devices: ready([device("down"), device("up")]),
    billing: plan(3, false),
  });
  const sev = severities(html);
  check(
    "sorted: error > warning > info",
    JSON.stringify(sev) ===
      JSON.stringify(["error", "warning", "warning", "warning", "warning", "info"]),
    JSON.stringify(sev),
  );
  check(
    "sorted: critical alerts first",
    html.indexOf("2 critical alerts are open") < html.indexOf("1 warning is open"),
  );
  check(
    "sorted: no-router note last",
    html.lastIndexOf("data-severity") === html.indexOf('data-severity="info"'),
  );
  check("rows: failed sign-ins counted", html.includes("3 failed staff sign-ins today"));
  check("rows: devices down counted", html.includes("1 device is down"));
  check("rows: plan ending without auto-renew", html.includes("Your plan ends in 3 days"));
  check("rows: no All good while rows exist", !html.includes("All good"));
}

// 3. A failed source says so, and never reads as All good.
{
  const html = render({ ...healthy(), alerts: failed(500) });
  check("failed alerts: no All good", !html.includes("All good"));
  check("failed alerts: couldn't check names alerts", html.includes("Couldn't check: alerts."));
  check(
    "failed alerts: explains why it won't say fine",
    html.includes("So we can't say everything is fine"),
  );
}
{
  const html = render({ ...healthy(), dash: failed(500) });
  check(
    "failed dashboard: routers + staff sign-ins unchecked",
    html.includes("Couldn't check: routers and staff sign-ins."),
    html.match(/Couldn't check:[^<]*/)?.[0],
  );
  check("failed dashboard: no All good", !html.includes("All good"));
}
{
  // Unknown liveness (routers unreadable) is a failed check, not "fine".
  const html = render({ ...healthy(), dash: dashboard({ lv: liveness("unknown", null, null) }) });
  check("unknown liveness: routers unchecked", html.includes("Couldn't check: routers."));
}
{
  // 403 = not this user's to read: skipped, not a failure.
  const html = render({ ...healthy(), devices: failed(403) });
  check("403 devices: still All good", html.includes("All good"));
  check("403 devices: not listed as checked", !/We checked:[^<]*devices/.test(html));
}
{
  // Rows still show next to a failed source.
  const html = render({
    ...healthy(),
    devices: failed(502),
    dash: dashboard({ lv: liveness("not-live", 0, 2) }),
  });
  check("mixed: offline row shown", html.includes("Your WiFi network is offline"));
  check("mixed: devices unchecked", html.includes("Couldn't check: devices."));
}
{
  const html = render({
    ...healthy(),
    alerts: loading(),
    devices: loading(),
    billing: loading(),
    dash: loading(),
  });
  check(
    "all loading: skeleton, no verdict",
    html.includes('aria-busy="true"') && !html.includes("All good"),
  );
}

// 4. The action is dropped when the user can't open the page.
{
  const base = {
    ...healthy(),
    dash: dashboard({ lv: liveness("partly-live", 1, 3), failedLogins: 2 }),
    alerts: ready([{ id: "x", status: "triggered", severity: "critical", location_id: "loc-1" }]),
  };
  const all = render(base);
  check(
    "permissions unknown: every action offered",
    JSON.stringify(actions(all).sort()) === JSON.stringify(["admin-logs", "alerts", "debugging"]),
    JSON.stringify(actions(all)),
  );
  check(
    "action is a real link",
    all.includes('href="/admin-logs"') && all.includes('href="/debugging"'),
  );

  const narrow = render({
    ...base,
    // Holds alerts + devices, but not audit_logs.read / guest_sessions.read.
    permissions: ["dashboard.view", "alerts.read", "monitored_hardware.read"],
  });
  check(
    "narrow perms: rows still shown",
    narrow.includes("2 failed staff sign-ins today") &&
      narrow.includes("2 of 3 routers aren't checking in"),
  );
  check(
    "narrow perms: only the alerts action remains",
    JSON.stringify(actions(narrow)) === JSON.stringify(["alerts"]),
    JSON.stringify(actions(narrow)),
  );
  check("narrow perms: no staff-activity link", !narrow.includes('href="/admin-logs"'));
}
{
  // Without devices permission the source isn't read at all.
  const html = render({
    ...healthy(),
    permissions: ["dashboard.view", "alerts.read"],
    devices: failed(500),
  });
  check("no devices perm: devices not asked, not unchecked", !html.includes("Couldn't check"));
}

// 5. Plan rules.
{
  check(
    "auto-renewing plan: nothing to do",
    render({ ...healthy(), billing: plan(2, true) }).includes("All good"),
  );
  check(
    "expired plan: error row",
    render({ ...healthy(), billing: plan(-2, true) }).includes("Your plan has expired"),
  );
  check(
    "past-due plan: error row",
    render({ ...healthy(), billing: plan(20, true, "past_due") }).includes(
      "Your plan payment is overdue",
    ),
  );
  check(
    "no plan on file (404): skipped",
    render({ ...healthy(), billing: failed(404) }).includes("All good"),
  );
}

// 6. Nothing internal leaks onto the customer card.
{
  const html = render({
    ...healthy(),
    dash: dashboard({ lv: liveness("not-live", 0, 1), failedLogins: 1 }),
    alerts: ready([
      {
        id: "x",
        status: "triggered",
        severity: "critical",
        location_id: "loc-1",
        message: "WireGuard tunnel down",
      },
    ]),
  });
  check("no WireGuard/tunnel/RADIUS wording", !/wireguard|tunnel|radius|certificate/i.test(html));
}

console.log(failures === 0 ? "\nneeds attention card: all checks passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
