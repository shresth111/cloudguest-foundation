/**
 * NetLogs per second (founder 2026-10-23): seconds survive formatting and the
 * exact-range round trip, the per-second call carries the NetLogs scope, and
 * the NetLogs view wires both in.
 * Run: node scripts/test-isp-partner-netlogs-seconds.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
process.env.TZ = "Asia/Kolkata";
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const dir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-netlogs-s-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
const entry = join(dir, "e.mjs");
writeFileSync(
  entry,
  `export * from "${p("src/lib/isp-partner/time-seconds.ts")}";
   export * from "${p("src/services/isp-partner/netlogs-rate.ts")}";
   export { api } from "${p("src/services/api.ts")}";`,
);
const outfile = join(dir, "b.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  external: ["axios"],
  nodePaths: [join(ROOT, "node_modules")],
  define: { "import.meta.env": JSON.stringify({ VITE_API_BASE_URL: "/api/v1" }) },
  plugins: [
    {
      name: "at",
      setup(b) {
        b.onResolve({ filter: /^@\// }, (a) =>
          b.resolve(`./src/${a.path.slice(2)}`, { resolveDir: ROOT, kind: a.kind }),
        );
      },
    },
  ],
  loader: { ".ts": "ts", ".tsx": "tsx" },
});
const m = await import(outfile);
let failures = 0;
let checks = 0;
const check = (name, ok, extra = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${!ok && extra ? ` -- ${extra}` : ""}`);
};

const iso = "2026-10-23T06:30:05.123Z"; // 12:00:05 IST
check(
  "table time shows seconds",
  /12:00:05/.test(m.formatDateTimeSeconds(iso)),
  m.formatDateTimeSeconds(iso),
);
check(
  "clock shows HH:MM:SS",
  m.formatClockSeconds(new Date(iso)) === "12:00:05",
  m.formatClockSeconds(new Date(iso)),
);
check("local input keeps seconds", m.toLocalInput(new Date(iso)) === "2026-10-23T12:00:05");
check(
  "local input round-trips to the second",
  m.fromLocalInput("2026-10-23T12:00:05") === "2026-10-23T06:30:05.000Z",
);
check(
  "an input without seconds means :00",
  m.fromLocalInput("2026-10-23T12:00") === "2026-10-23T06:30:00.000Z",
);
check("empty input is null", m.fromLocalInput("") === null);
check("cap is 3 hours", m.PER_SECOND_MAX_MS === 3 * 3600 * 1000);

const sent = [];
m.api.defaults.adapter = async (config) => {
  sent.push(config);
  return {
    data: { success: true, data: { counts: [] } },
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
};
const scope = {
  isp_customer_id: "c",
  since: "s",
  until: "u",
  severity: "error,warning",
  cursor: "x",
};
await m.fetchNetLogsPerSecond(scope, { kind: "preset", minutes: 15 });
const a = sent[0];
check("per-second call path", a.url === "/isp/logs/netlogs/per-second", a.url);
check(
  "preset sends minutes, drops the list window and cursor",
  a.params.minutes === "15" &&
    !a.params.since &&
    !a.params.cursor &&
    a.params.isp_customer_id === "c" &&
    a.params.severity === "error,warning",
  JSON.stringify(a.params),
);
sent.length = 0;
await m.fetchNetLogsPerSecond(scope, {
  kind: "custom",
  since: "2026-10-23T06:30:00.000Z",
  until: "2026-10-23T06:31:00.000Z",
});
check(
  "custom sends since/until to the second",
  sent[0].params.since === "2026-10-23T06:30:00.000Z" && !sent[0].params.minutes,
  JSON.stringify(sent[0].params),
);

const view = readFileSync(join(ROOT, "src/components/isp-partner/log-views/LogsView.tsx"), "utf8");
check(
  "NetLogs rows use the seconds formatter",
  /formatDateTimeSeconds\(e\.received_at\)/.test(view),
);
check("NetLogs view mounts the per-second chart", /<NetLogsPerSecond scope=\{params\}/.test(view));
check("NetLogs view has the exact range", /<ExactRange value=\{exact\}/.test(view));
check("exact range drives the list and export params", /exact \?\? rangeWindow/.test(view));
const range = readFileSync(
  join(ROOT, "src/components/isp-partner/log-views/ExactRange.tsx"),
  "utf8",
);
check("exact range inputs step by the second", (range.match(/step=\{1\}/g) ?? []).length === 2);

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
