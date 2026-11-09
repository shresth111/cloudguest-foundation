/**
 * "Mark as paid" must exist on Master and never on the customer billing page,
 * which mounts the same InvoiceManagement component.
 *
 * Run: node scripts/test-invoice-record-payment.mjs
 */
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
let failures = 0;
function check(name, ok) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures += 1;
}

const invoices = read("src/components/billing/InvoiceManagement.tsx");
const master = read("src/routes/master.billing.tsx");
const customer = read("src/routes/_authenticated/billing.index.tsx");
const payments = read("src/components/billing/PaymentTable.tsx");

check("the prop defaults to off", invoices.includes("canRecordPayment = false"));
check("the button is gated on the prop", invoices.includes("{canRecordPayment &&"));
check("only unpaid tax invoices offer it", invoices.includes('i.status === "pending"'));
check("Master turns it on", master.includes("canRecordPayment"));
check("the customer page does not", !customer.includes("canRecordPayment"));
check("a repeat submit is ignored", invoices.includes("recordPayment.isPending) return;"));
check(
  "a manual payment cannot start a gateway refund",
  payments.includes('p.gateway === "manual"'),
);

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
