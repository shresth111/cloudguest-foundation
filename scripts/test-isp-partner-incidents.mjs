/**
 * INCIDENTS-1 FE (`src/lib/isp-partner/incidents.ts`) + wiring: helpers,
 * every backend route reached and nothing else, the broadcast is only ever
 * a backend call (no client-side sending), grace needs both keys and a dry
 * run first, the nav gate, the flag-off state, and the outage/restored
 * triggers are mappable in Finance automation.
 *
 * Run: node scripts/test-isp-partner-incidents.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-inc-"));
const outfile = join(outdir, "inc.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/incidents.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const m = await import(outfile);
let failures = 0;
let checks = 0;
const eq = (name, got, want) => {
  checks += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`,
  );
};

eq("next from investigating", m.nextStatuses("investigating"), ["identified", "resolved"]);
eq("next from identified", m.nextStatuses("identified"), ["resolved"]);
eq("next from resolved", m.nextStatuses("resolved"), []);
eq("minutes", m.formatMinutes(45), "45 min");
eq("hours", m.formatMinutes(125), "2 h 05 min");
eq("days", m.formatMinutes(60 * 28), "1 d 4 h");
eq("null minutes", m.formatMinutes(null), "–");
eq("health good", m.healthTone(99.5), "success");
eq("health watch", m.healthTone(96), "warning");
eq("health bad", m.healthTone(80), "danger");
eq("health not measured", m.healthTone(null), "default");
eq("grace 1 ok", m.graceHoursError(1), null);
eq("grace 168 ok", m.graceHoursError(168), null);
eq("grace 0 refused", typeof m.graceHoursError(0), "string");
eq("grace 169 refused", typeof m.graceHoursError(169), "string");
eq("grace 1.5 refused", typeof m.graceHoursError(1.5), "string");
eq("status tone resolved", m.statusTone("resolved"), "resolved");
eq("rfo list = JAZE-5 list", m.RFO_REASONS, [
  "fiber_cut",
  "power_olt",
  "cpe_fault",
  "upstream",
  "other",
]);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const svc = read("src/services/isp-partner/incidents.ts");
const BE_ROUTES = [
  "`${BASE}/health`",
  "`${BASE}/preview`",
  "`${BASE}/${id}`",
  "`${BASE}/${id}/status`",
  "`${BASE}/${id}/notes`",
  "`${BASE}/${id}/refresh`",
  "`${BASE}/${id}/grace`",
  "`${BASE}/${id}/broadcast`",
  "`${BASE}/${id}/affected.csv`",
];
for (const r of BE_ROUTES) eq(`service reaches ${r}`, svc.includes(r), true);
eq("list + create on BASE", (svc.match(/api\.(get|post)<[^>]+>\(BASE[,)]/g) ?? []).length, 2);
eq('base is "/isp/incidents"', svc.includes('const BASE = "/isp/incidents";'), true);
const used = new Set(svc.match(/`\$\{BASE\}[^`]*`/g) ?? []);
eq(
  "no route outside the backend list",
  [...used].filter((u) => !BE_ROUTES.includes(u)),
  [],
);
eq("no direct WhatsApp/graph call", /graph\.facebook|send_waba|messages\b/.test(svc), false);

const drawer = read("src/components/isp-partner/incidents/IncidentDrawer.tsx");
eq(
  "broadcast checks first (dry run)",
  drawer.includes("run.mutate(true, { onSuccess: setRes })"),
  true,
);
eq("send only offered in whatsapp mode", drawer.includes('res.mode === "whatsapp"'), true);
eq("share mode says nothing is sent", drawer.includes("Nothing is sent from here"), true);
eq(
  "grace needs execute + subscriber update + resolved",
  drawer.includes(
    'can("isp_incidents.execute") && can("isp_subscribers.update") && d.status === "resolved"',
  ) ||
    /can\("isp_incidents\.execute"\) &&\s*can\("isp_subscribers\.update"\) &&\s*d\.status === "resolved"/.test(
      drawer,
    ),
  true,
);
eq("grace apply only after a dry run", drawer.includes("res?.dry_run &&"), true);
eq("resolve needs an RFO", drawer.includes('const needRfo = to === "resolved" && !rfo;'), true);

const page = read("src/components/isp-partner/incidents/IncidentsPage.tsx");
eq("flag off says not switched on", page.includes("Incidents are not switched on"), true);
eq("health shows not measured", page.includes('"Not measured"'), true);

const shell = read("src/components/isp-partner/PartnerShell.tsx");
eq(
  "nav item gated by isp_incidents.read",
  /to: "\/partner\/incidents",[\s\S]{0,120}anyOf: \["isp_incidents\.read"\]/.test(shell),
  true,
);
eq("route registered", read("src/routeTree.gen.ts").includes("'/partner/incidents'"), true);
const fin = read("src/components/isp-partner/finance/FinancePage.tsx");
eq("outage template mappable", /\n  outage: \{/.test(fin) && /\n  restored: \{/.test(fin), true);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
