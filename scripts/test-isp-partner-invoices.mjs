/**
 * Partner invoice helpers (`src/lib/isp-partner/invoices.ts`, ADDENDUM_03):
 * the Indian FY (1 April - 31 March) used in invoice numbers, the date
 * presets, the back-dating rule, and the WhatsApp share link (opened by
 * staff; no API).
 *
 * Run: node scripts/test-isp-partner-invoices.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-invoices-"));
const outfile = join(outdir, "invoices.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/invoices.ts")],
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
  const ok = Object.is(got, want);
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- got ${got}, want ${want}`}`);
};

eq("31 Mar 2026 is FY 25-26", m.indianFy(new Date(2026, 2, 31, 23, 59)).label, "25-26");
eq("1 Apr 2026 is FY 26-27", m.indianFy(new Date(2026, 3, 1)).label, "26-27");
eq("Jan 2027 is FY 26-27", m.indianFy(new Date(2027, 0, 15)).label, "26-27");
eq("FY 99-00 wraps", m.indianFy(new Date(2099, 5, 1)).label, "99-00");
const now = new Date(2026, 9, 22);
eq("this month", m.presetRange("this_month", now).join(" "), "2026-10-01 2026-10-22");
eq("last month", m.presetRange("last_month", now).join(" "), "2026-09-01 2026-09-30");
eq("this FY", m.presetRange("this_fy", now).join(" "), "2026-04-01 2026-10-22");
eq(
  "Jan: last month is December",
  m.presetRange("last_month", new Date(2027, 0, 10)).join(" "),
  "2026-12-01 2026-12-31",
);
eq("today ok", m.invoiceDateProblem("2026-10-22", now), null);
eq("7 days back ok", m.invoiceDateProblem("2026-10-15", now), null);
eq("8 days back refused", m.invoiceDateProblem("2026-10-14", now) !== null, true);
eq("future refused", m.invoiceDateProblem("2026-10-23", now) !== null, true);
eq(
  "previous FY refused even within 7 days",
  m.invoiceDateProblem("2026-03-30", new Date(2026, 3, 2)) !== null,
  true,
);
eq("10-digit mobile gets 91", m.waNumber("98100 00001"), "919810000001");
eq("+91 kept", m.waNumber("+91 98100 00001"), "919810000001");
eq("junk gives empty", m.waNumber("12345"), "");
const url = m.whatsappShareUrl({
  phone: "9810000001",
  name: "Test",
  invoiceNumber: "NETX/25-26/7",
  totalPaise: 18500,
  balancePaise: 18500,
  ispName: "Demo ISP",
});
eq("wa.me with number", url.startsWith("https://wa.me/919810000001?text="), true);
eq(
  "message carries number and amount",
  decodeURIComponent(url.split("text=")[1]).includes("NETX/25-26/7 for ₹185.00 has ₹185.00 due"),
  true,
);
eq(
  "no phone -> contact picker",
  m
    .whatsappShareUrl({
      phone: null,
      name: null,
      invoiceNumber: "X",
      totalPaise: 1,
      balancePaise: 0,
      ispName: "I",
    })
    .startsWith("https://wa.me/?text="),
  true,
);
eq(
  "bill-to name from subscriber",
  m.billToName({ subscriber: { first_name: "A", last_name: "B" }, customer: null }),
  "A B",
);
eq(
  "bill-to name from customer",
  m.billToName({ subscriber: null, customer: { name: "Cafe" } }),
  "Cafe",
);

if (failures) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
