/**
 * Daily SMS Delivery report -- the honesty rules of lib/sms-delivery-report.ts,
 * executed for real (bundled with esbuild, same pattern as
 * test-device-health.mjs; this repo has no test runner).
 *
 *   1. "Delivered" ONLY from a provider delivery report. With delivery
 *      reports off, Delivered / Undelivered / No-report-yet are null and the
 *      rate is blank -- never sent - failed.
 *   2. The notice says "Delivery reports not enabled" when they are off, and
 *      says so differently when they are on but nothing arrived yet.
 *   3. The chart never draws delivered/undelivered segments without DLRs.
 *   4. The demo fixture is shaped like the real response and adds up.
 *
 * Run: node scripts/test-sms-delivery-report.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "sms-delivery-report-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/sms-delivery-report.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const lib = await import(outfile);

const day = (date, c) => ({
  date,
  attempted: 0,
  sent: 0,
  failed: 0,
  delivered: 0,
  undelivered: 0,
  awaiting_dlr: 0,
  ...c,
});
function report({ enabled, received = 0, days }) {
  const totals = days.reduce(
    (a, d) => {
      for (const k of Object.keys(a)) a[k] += d[k];
      return a;
    },
    { attempted: 0, sent: 0, failed: 0, delivered: 0, undelivered: 0, awaiting_dlr: 0 },
  );
  return {
    days,
    totals,
    delivery_reports: {
      enabled,
      mechanisms: enabled ? ["poll"] : [],
      received_in_range: received,
    },
  };
}

console.log("\nwithout delivery reports, nothing is called delivered");
{
  const r = report({
    enabled: false,
    days: [day("2026-10-24", { attempted: 10, sent: 9, failed: 1, awaiting_dlr: 9 })],
  });
  const [row] = lib.smsDaywiseRows(r);
  check("sent and failed are real", row.sent === 9 && row.failed === 1 && row.attempted === 10);
  check("delivered is null, not sent - failed", row.delivered === null);
  check("undelivered / awaiting are null", row.undelivered === null && row.awaiting === null);
  check("rate is blank", row.rate === null);
  const notice = lib.deliveryReportsNotice(r);
  check(
    "notice says delivery reports not enabled",
    notice?.title === "Delivery reports not enabled",
  );
  const keys = lib.smsChartSeries(r).map((s) => s.key);
  check(
    "chart draws only sent + failed",
    JSON.stringify(keys) === '["sent","failed"]',
    keys.join(),
  );
}

console.log("\nwith delivery reports, counts come straight from the report");
{
  const r = report({
    enabled: true,
    received: 9,
    days: [
      day("2026-10-24", { attempted: 10, sent: 9, failed: 1, delivered: 8, undelivered: 1 }),
      day("2026-10-25", { attempted: 4, sent: 4, awaiting_dlr: 4 }),
      day("2026-10-26", {}),
    ],
  });
  const [a, b, c] = lib.smsDaywiseRows(r);
  check("delivered / undelivered passed through", a.delivered === 8 && a.undelivered === 1);
  check("rate is delivered / sent", a.rate === "88.9%", a.rate);
  check("a day with no reports yet has no rate", b.rate === null && b.awaiting === 4);
  check("an empty day is a real zero with no rate", c.attempted === 0 && c.rate === null);
  check("no notice once reports are arriving", lib.deliveryReportsNotice(r) === null);
  const keys = lib.smsChartSeries(r).map((s) => s.key);
  check(
    "chart stack order matches the validated palette order",
    JSON.stringify(keys) === '["delivered","awaiting_dlr","failed","undelivered"]',
    keys.join(),
  );
}

console.log("\nenabled but nothing received yet is said plainly");
{
  const r = report({
    enabled: true,
    received: 0,
    days: [day("2026-10-25", { attempted: 3, sent: 3, awaiting_dlr: 3 })],
  });
  check(
    "notice explains no reports received yet",
    /No delivery reports received yet/.test(lib.deliveryReportsNotice(r)?.title ?? ""),
  );
}

console.log("\nevery outcome colour ships with a label");
for (const s of [...lib.SMS_OUTCOMES, ...lib.SMS_OUTCOMES_NO_DLR]) {
  check(`${s.key} has a label and both mode colours`, Boolean(s.label && s.light && s.dark));
}

console.log("\ndemo fixture is shaped like the real response and adds up");
{
  const r = lib.demoSmsDeliveryReport("2026-10-01", "2026-10-07");
  check("one entry per day", r.days.length === 7, String(r.days.length));
  check(
    "each day: attempted = sent + failed, sent = delivered + undelivered + awaiting",
    r.days.every(
      (d) =>
        d.attempted === d.sent + d.failed &&
        d.sent === d.delivered + d.undelivered + d.awaiting_dlr &&
        d.delivered >= 0,
    ),
  );
  check(
    "deterministic",
    JSON.stringify(r) === JSON.stringify(lib.demoSmsDeliveryReport("2026-10-01", "2026-10-07")),
  );
}

console.log(
  failures === 0
    ? `\nall sms-delivery-report checks passed\n`
    : `\n${failures} sms-delivery-report check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
