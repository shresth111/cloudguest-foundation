/**
 * `/isp/compliance/*` request shapes (lane JAZE-3). The JAZE-1 P0 was a
 * `date` query param fed a `toISOString()` (422 date_from_datetime_inexact),
 * so the param shape of every dated call is pinned against the BE router:
 *   - /agr, /agr/export.csv:            since/until `date`   -> YYYY-MM-DD
 *   - /session-dump.csv, /reports/{k}:  since/until datetime -> ISO with offset
 *   - /cgnat-lookup:                    at datetime (naive + tz), blanks dropped
 *   - /trai-pmr:                        period YYYY-MM
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-compliance.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-compliance-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" ? undefined : a });
     return { data: { reports: [] }, headers: {} };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), delete: rec("delete") };`,
);
const outfile = join(outdir, "compliance.mjs");
await build({
  stdin: {
    contents: `export { complianceService } from "@/services/isp-partner/compliance";
               export { calls } from "@/services/api";`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
  plugins: [
    {
      name: "api-stub",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: stub }));
      },
    },
  ],
});

const m = await import(outfile);
const svc = m.complianceService;
const calls = m.calls;

let failures = 0;
let checks = 0;
const ok = (name, cond, extra = "") => {
  checks += 1;
  if (!cond) failures += 1;
  console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${cond ? "" : ` -- ${extra}`}`);
};
const last = () => calls[calls.length - 1];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

await svc.agr("2026-04-01", "2026-10-31");
ok("agr: path", last().url === "/isp/compliance/agr");
ok("agr: since is a plain date", DATE.test(last().params.since), last().params.since);
ok("agr: until is a plain date", DATE.test(last().params.until), last().params.until);
await svc.agr(undefined, undefined);
ok("agr: blank range sends no params (BE defaults to FY start)", !("since" in last().params));
await svc.agrExport("2026-04-01", "2026-10-31");
ok("agr export: plain dates", DATE.test(last().params.since) && DATE.test(last().params.until));

await svc.sessionDump({ since: "2026-10-01T00:00:00+05:30", until: "2026-10-02T18:30:00.000Z" });
ok("session dump: path", last().url === "/isp/compliance/session-dump.csv");
ok("session dump: since has an offset", OFFSET_DT.test(last().params.since), last().params.since);
ok("session dump: no empty customer param", !("isp_customer_id" in last().params));

await svc.report(
  "subscriber_details_status",
  "2026-10-01T00:00:00+05:30",
  "2026-10-31T18:30:00.000Z",
);
ok("report: path has the key", last().url === "/isp/compliance/reports/subscriber_details_status");
ok("report: since has an offset", OFFSET_DT.test(last().params.since));

await svc.cgnatLookup({
  public_ip: "203.0.113.80",
  public_port: "",
  at: "2026-10-31T10:00:05",
  tz: "Asia/Kolkata",
  tolerance_seconds: "60",
  protocol: "",
  dst_ip: "",
  dst_port: "",
  isp_customer_id: "",
});
const p = last().params;
ok("cgnat: path", last().url === "/isp/compliance/cgnat-lookup");
ok(
  "cgnat: blanks dropped (int params would 422 on '')",
  !("public_port" in p) && !("protocol" in p) && !("dst_port" in p),
);
ok("cgnat: naive at + tz", p.at === "2026-10-31T10:00:05" && p.tz === "Asia/Kolkata");

await svc.traiPmr("2026-10");
ok("trai: period YYYY-MM", /^\d{4}-\d{2}$/.test(last().params.period));
await svc.traiExport("2026-10", "hotspots");
ok("trai export: report param", last().params.report === "hotspots");

await svc.assignCaf("sub-1");
ok("caf: empty body when no custom number", JSON.stringify(last().body) === "{}");
await svc.saveSchedule("agr", { day_of_month: 5, recipients: ["a@b.in"], enabled: true });
ok(
  "schedule: PUT /report-schedules/{key}",
  last().method === "put" && last().url.endsWith("/report-schedules/agr"),
);
await svc.catalogue();
ok("catalogue: GET /reports", last().url === "/isp/compliance/reports");

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
