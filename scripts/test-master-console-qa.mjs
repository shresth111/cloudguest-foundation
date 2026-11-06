#!/usr/bin/env node
// =====================================================================
// MASTER CONSOLE QA FIXES (2026-11-06)
// =====================================================================
// Pins the fixes from the code-level Master console QA pass:
//
//   H1  Billing > Reminders "Send" calls the real POST /billing/reminders/send
//       and reports success only when the backend says the email went out.
//   M1  The header org picker becomes a fixed "All organizations" badge on
//       pages whose backend ignores the organization header.
//   M2  A picker change invalidates the "master" query root and fires an
//       event that the mount-only list pages reload on.
//   M3  "View as this customer" is gated on users.impersonate.
//   M4  Suspend / Reactivate needs a confirmation that states the real effect.
//   M5  Untracked analytics figures are null ("—"), not a hard-coded 0.
//   M6  Location delete takes a typed name and lists attached routers.
//   L1  The router drawer opens the Device Console on that router.
//   L2  "Add Instant On site" is gated on routers.create.
//   L3  A failed list load shows an error row with Retry, not "No … yet".
//   (b) /settings no longer renders the in-memory mocked panels.
//
// Behaviour where it can be run in node (the real api.ts and
// billing.service.ts, bundled with esbuild, with axios's adapter swapped for
// a capture); source checks for the React wiring.
//
// Run: node scripts/test-master-console-qa.mjs

import { build } from "esbuild";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}
const src = (p) => readFileSync(join(ROOT, p), "utf8");

// ---------------------------------------------------------------------
// Bundle the real modules.
// ---------------------------------------------------------------------
const work = join(ROOT, "node_modules", ".master-console-qa-test");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
process.on("exit", () => rmSync(work, { recursive: true, force: true }));

writeFileSync(
  join(work, "entry.js"),
  `export {
     api,
     isEstateWideMasterPath,
     isOrgPickerInertMasterPath,
     setOrganizationScope,
     ORGANIZATION_SCOPE_CHANGED_EVENT,
     TOKEN_STORAGE_KEY,
     ROLES_STORAGE_KEY,
   } from "@/services/api";
   export { billingService } from "@/services/billing.service";`,
);

await build({
  entryPoints: [join(work, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: join(work, "bundle.mjs"),
  logLevel: "error",
  nodePaths: [resolve(ROOT, "node_modules")],
  external: ["axios"],
  loader: { ".css": "empty" },
  define: {
    "process.env.NODE_ENV": '"production"',
    "import.meta.env.VITE_API_BASE_URL": '"/api/v1"',
  },
  plugins: [
    {
      name: "src-alias",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (args) => {
          const base = join(ROOT, "src", args.path.slice(2));
          const probes = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
          for (const p of probes) {
            if (existsSync(p) && extname(p)) return { path: p };
          }
          return { errors: [{ text: `cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});

const store = new Map();
const events = [];
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  location: { pathname: "/master/billing", origin: "http://localhost", hostname: "localhost" },
  dispatchEvent: (e) => {
    events.push(e.type);
    return true;
  },
};
globalThis.localStorage = globalThis.window.localStorage;

const mod = await import(pathToFileURL(join(work, "bundle.mjs")).href);
const {
  api,
  isEstateWideMasterPath,
  isOrgPickerInertMasterPath,
  setOrganizationScope,
  ORGANIZATION_SCOPE_CHANGED_EVENT,
  TOKEN_STORAGE_KEY,
  ROLES_STORAGE_KEY,
  billingService,
} = mod;

// ---------------------------------------------------------------------
// M1. Which pages get the badge instead of the picker.
// ---------------------------------------------------------------------
console.log("M1 org picker on pages whose backend ignores it");
for (const p of [
  "/master",
  "/master/",
  "/master/analytics",
  "/master/integrations",
  "/master/traffic-flow",
  "/master/device-logs",
]) {
  check(`${p} is picker-inert`, isOrgPickerInertMasterPath(p) === true);
}
for (const p of [
  "/master/billing",
  "/master/locations",
  "/master/customers",
  "/master/notification-channels",
  "/master/tickets",
  "/master-login",
]) {
  check(`${p} keeps the picker`, isOrgPickerInertMasterPath(p) === false);
}
check(
  "the estate-wide list (which also changes headers) is unchanged",
  isEstateWideMasterPath("/master/nas") &&
    isEstateWideMasterPath("/master/routers/abc") &&
    isEstateWideMasterPath("/master/audit") &&
    !isEstateWideMasterPath("/master/analytics") &&
    !isEstateWideMasterPath("/master"),
);

// ---------------------------------------------------------------------
// M2. A scope change is announced.
// ---------------------------------------------------------------------
console.log("M2 picker change reaches non-React-Query pages");
events.length = 0;
setOrganizationScope({ kind: "organization", organizationId: "org-1" });
setOrganizationScope({ kind: "all" });
check(
  "setOrganizationScope fires the scope-changed event each time",
  events.filter((t) => t === ORGANIZATION_SCOPE_CHANGED_EVENT).length === 2,
  `events: ${JSON.stringify(events)}`,
);
const picker = src("src/components/master/OrganizationScopePicker.tsx");
check(
  'the picker invalidates the "master" query root (Alert Channels)',
  /SCOPE_DEPENDENT_QUERY_ROOTS = \[[\s\S]*?"master",[\s\S]*?\] as const/.test(picker),
);
for (const page of [
  "locations",
  "customers",
  "tickets",
  "quotations",
  "demo-requests",
  "channel-partners",
]) {
  const s = src(`src/routes/master.${page}.tsx`);
  check(
    `master.${page} reloads on scope change`,
    /const scopeVersion = useOrganizationScopeVersion\(\);/.test(s) &&
      /refetch\(\);\s*\}, \[scopeVersion\]\);/.test(s),
  );
  // L3 on the same pages.
  check(
    `master.${page} renders a load error with retry, not the empty row`,
    /setLoadError\(message\);/.test(s) &&
      /\{!loading && loadError && <MLoadErrorRow message=\{loadError\} onRetry=\{refetch\} \/>\}/.test(
        s,
      ) &&
      /!loading && !loadError && (rows|filtered)\.length === 0/.test(s),
  );
}
check(
  "the device console reloads on scope change too",
  /\}, \[scopeVersion, requestedRouterId\]\);/.test(src("src/routes/master.console.tsx")),
);

// ---------------------------------------------------------------------
// H1. sendReminder is a real request with the real outcome.
// ---------------------------------------------------------------------
console.log("H1 billing reminder send");
const EXP = Math.floor(Date.now() / 1000) + 86_400;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
store.set(TOKEN_STORAGE_KEY, `${b64({ alg: "none" })}.${b64({ exp: EXP })}.x`);
store.set(ROLES_STORAGE_KEY, JSON.stringify([{ scopeType: "global", roleSlug: "super-admin" }]));
const sent = [];
let reply = {
  email_sent: false,
  email_recipient: "o@x.in",
  email_error: "No real email delivery provider is configured on this server.",
};
api.defaults.adapter = async (config) => {
  sent.push({ method: config.method, url: config.url, body: JSON.parse(config.data ?? "{}") });
  return {
    data: { success: true, message: "", data: reply },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
const notSent = await billingService.sendReminder({ organizationId: "org-9", kind: "invoice_due" });
check(
  "POSTs /billing/reminders/send with only the organization and kind",
  sent.length === 1 &&
    sent[0].method === "post" &&
    sent[0].url === "/billing/reminders/send" &&
    JSON.stringify(sent[0].body) ===
      JSON.stringify({ organization_id: "org-9", kind: "invoice_due" }),
  JSON.stringify(sent),
);
check(
  "an unconfigured mailer comes back as not sent, with the reason",
  notSent.emailSent === false && /No real email delivery provider/.test(notSent.emailError ?? ""),
  JSON.stringify(notSent),
);
reply = { email_sent: true, email_recipient: "o@x.in", email_error: null };
const ok = await billingService.sendReminder({ organizationId: "org-9", kind: "expiry" });
check("a real send comes back as sent", ok.emailSent === true && ok.emailRecipient === "o@x.in");

const panel = src("src/components/billing/RemindersPanel.tsx");
check(
  "the panel toasts success only when emailSent is true",
  /if \(result\.emailSent\) \{\s*toast\.success/.test(panel) && /Reminder not sent:/.test(panel),
);
check(
  "the panel has no delay()-backed mock left",
  !/delay\(/.test(
    src("src/services/billing.service.ts").slice(
      src("src/services/billing.service.ts").indexOf("async sendReminder"),
      src("src/services/billing.service.ts").indexOf("async sendReminder") + 900,
    ),
  ),
);
check(
  "Send is opt-in (canSend) and the Master billing page passes the billing.manage cap",
  /canSend = false/.test(panel) &&
    /canSend=\{caps\.has\("billing\.remind"\)\}/.test(src("src/routes/master.billing.tsx")) &&
    /"billing\.remind": \["billing\.manage"\]/.test(src("src/components/master/MasterShell.tsx")),
);

// ---------------------------------------------------------------------
// M3 / L2. Capabilities match the backend's permission keys.
// ---------------------------------------------------------------------
console.log("M3 / L2 capability gates");
const shell = src("src/components/master/MasterShell.tsx");
check("impersonate is users.impersonate", /impersonate: \["users\.impersonate"\]/.test(shell));
check(
  "the stale 'no impersonation feature exists' comment is gone",
  !/no impersonation feature exists/.test(shell),
);
const routers = src("src/routes/master.routers.tsx");
check(
  'Add Instant On site needs caps.has("routers.create")',
  /!demo && !advancedId && caps\.has\("routers\.create"\)/.test(routers) &&
    /"routers\.create": \["routers\.create"\]/.test(shell),
);

// ---------------------------------------------------------------------
// L1. The drawer passes the router; the console accepts it.
// ---------------------------------------------------------------------
console.log("L1 console deep link");
check(
  "router drawer links to the console with routerId",
  /to="\/master\/console"\s*search=\{\{ routerId: sel\.id \}\}/.test(routers),
);
check(
  "the console route validates ?routerId=",
  /validateSearch: \(search: Record<string, unknown>\): \{ routerId\?: string \}/.test(
    src("src/routes/master.console.tsx"),
  ),
);

// ---------------------------------------------------------------------
// M4. Suspension confirmation states the real effect.
// ---------------------------------------------------------------------
console.log("M4 suspend confirmation");
const customers = src("src/routes/master.customers.tsx");
check(
  "the drawer button opens a confirmation instead of acting",
  /onClick=\{\(\) => setStatusConfirm\(selected\)\}/.test(customers) &&
    !/onClick=\{\(\) => handleToggleStatus\(selected\)\}/.test(customers),
);
check(
  "the copy says what suspension does and does not do",
  /cannot add new locations/.test(customers) &&
    /It does not stop guest WiFi, router access, logins to the dashboard or billing\./.test(
      customers,
    ),
);

// ---------------------------------------------------------------------
// M5. Not tracked is null, not 0.
// ---------------------------------------------------------------------
console.log("M5 untracked analytics figures");
const analytics = src("src/services/analytics.service.ts");
check(
  "avgSessionDuration and per-org revenue/growth are null on real data",
  /avgSessionDuration: null,/.test(analytics) &&
    !/avgSessionDuration: 0,/.test(analytics) &&
    (analytics.match(/revenue: null,/g) ?? []).length === 2 &&
    !/revenue: 0,\s*monthlyGrowth: 0,/.test(analytics),
);
check(
  "the KPI grid and org panel render — for null",
  /data\.avgSessionDuration == null \? "—"/.test(
    src("src/components/analytics/AnalyticsKpiGrid.tsx"),
  ) &&
    /row\.revenue == null \?/.test(src("src/components/analytics/OrganizationAnalyticsPanel.tsx")),
);

// ---------------------------------------------------------------------
// M6. Location delete.
// ---------------------------------------------------------------------
console.log("M6 location delete");
const locations = src("src/routes/master.locations.tsx");
const dialog = src("src/components/master/LocationDeleteDialog.tsx");
check("no window.confirm left on Locations", !/window\.confirm/.test(locations));
check(
  "the trash button opens LocationDeleteDialog",
  /onClick=\{\(\) => setDeleteTarget\(l\)\}/.test(locations) &&
    /<LocationDeleteDialog/.test(locations),
);
check(
  "Delete needs the typed name, a finished attachment check and no routers",
  /const canDelete = nameOk && !!attached && !hasRouters && !deleting;/.test(dialog) &&
    /routerService\.listForLocation\(location\.id, location\.organizationId\)/.test(dialog),
);

// ---------------------------------------------------------------------
// (b) /settings no longer fakes saves.
// ---------------------------------------------------------------------
console.log("(b) /settings mocked panels");
const settings = src("src/routes/_authenticated/settings.index.tsx");
check(
  "the settings route renders none of the in-memory panels",
  !/from "@\/components\/settings\/panels\//.test(settings) && !/useSettings\(/.test(settings),
);

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
