/**
 * COMMS-2 FE (`src/lib/isp-partner/comms.ts`) + wiring. Pins: plain dates
 * only; "Delivered"/"Read" are display labels for backend receipts (the FE
 * never derives them); WhatsApp names are template names, not free text;
 * the JAZE-4 log stays as the fallback while the hub is off.
 *
 * Run: node scripts/test-isp-partner-comms.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-comms-"));
const outfile = join(outdir, "comms.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/comms.ts")],
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
eq("plain dates ok", m.filterErrors({ date_from: "2026-10-01", date_to: "2026-10-31" }), null);
eq(
  "ISO datetime refused",
  typeof m.filterErrors({ date_from: "2026-09-30T18:30:00.000Z" }),
  "string",
);
eq(
  "reversed range refused",
  typeof m.filterErrors({ date_from: "2026-11-02", date_to: "2026-11-01" }),
  "string",
);
eq("phone digits", m.filterErrors({ phone: "+91 98765 43210" }), null);
eq("phone junk", typeof m.filterErrors({ phone: "abc" }), "string");
eq(
  "unknown vars",
  m.unknownVariables("Hi {{ name }} {{iban}} {{pay_link}}", ["name", "pay_link"]),
  ["iban"],
);
eq("wa name ok", m.validWaName("due_soon_v2"), true);
eq("wa free text refused", m.validWaName("Hello {{1}}, pay now"), false);
eq("statuses", Object.keys(m.STATUS_LABEL).sort(), [
  "delivered",
  "failed",
  "queued",
  "read",
  "sent",
  "skipped",
]);

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const hub = read("src/components/isp-partner/finance/CommsHub.tsx");
eq("never derives delivered client-side", /status\s*=\s*["']delivered["']/.test(hub), false);
eq("no innerHTML", hub.includes("dangerouslySetInnerHTML"), false);
eq(
  "approved-only copy present",
  hub.includes("approved in your own WhatsApp Business account"),
  true,
);
const fin = read("src/components/isp-partner/finance/FinancePage.tsx");
eq("JAZE-4 log kept as fallback", fin.includes("<CommsHub fallback={<MessagesTab />} />"), true);
const svc = read("src/services/isp-partner/comms.ts");
eq("no new pay-link scheme in FE", svc.includes("/pay/"), false);

console.log(`\n${checks - failures}/${checks} passed`);
process.exit(failures ? 1 : 0);
