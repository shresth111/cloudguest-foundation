/**
 * Regression test for Master -> Invoices & Quotations
 * (src/routes/master.billing-documents.tsx).
 *
 * What it pins:
 *
 *   1. THE LIVE-PREVIEW MATH matches the backend. The form shows totals from
 *      src/lib/billing-document-math.ts while the operator types; the PDF
 *      prints the backend's figures (app/domains/billing_document/
 *      calculations.py). The worked examples below are the same ones the
 *      backend's tests/unit/test_billing_document.py asserts, so a drift
 *      shows up here as a wrong rupee amount, not on a customer's invoice.
 *   2. THE REQUEST SHAPE is the one the backend accepts. Its schemas are
 *      extra="forbid", so a renamed key would 422 -- but a key the backend
 *      ignores is worse, and this keeps the two in step.
 *   3. THE PERMISSION KEYS the page asks for are ones the backend seeds
 *      (a misspelt key silently hides a button forever).
 *   4. NOTHING IS SENT. The page is a generator: no email/send endpoint.
 *
 * Run: node scripts/test-billing-documents.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `got ${a}, expected ${e}`);
}

const outdir = mkdtempSync(join(tmpdir(), "billing-docs-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/billing-document-math.ts")}";
   export * from "${p("src/lib/billing-document-request.ts")}";
   export { BACKEND_PERMISSION_KEYS } from "${p("src/lib/backendPermissionKeys.generated.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": p("src") },
});
const m = await import(`file://${outfile}`);
const src = (rel) => readFileSync(join(ROOT, rel), "utf8");

// ---------------------------------------------------------------------------
console.log("\nmath -- same worked examples as the backend tests");

{
  const line = m.computeLine(
    { quantity: 1, rate: 1000, discountPercent: 0, taxRate: 18 },
    "cgst_sgst",
  );
  eq(
    "intra-state: equal CGST and SGST halves",
    [line.cgst, line.sgst, line.igst, line.total],
    [90, 90, 0, 1180],
  );
}
{
  const line = m.computeLine({ quantity: 1, rate: 1000, discountPercent: 0, taxRate: 18 }, "igst");
  eq("inter-state: the whole rate as IGST", [line.igst, line.total], [180, 1180]);
}
{
  const line = m.computeLine({ quantity: 2, rate: 500, discountPercent: 0, taxRate: 18 }, "none");
  eq(
    "no-tax mode ignores the line rate",
    [line.total, line.cgst + line.sgst + line.igst],
    [1000, 0],
  );
}
{
  const line = m.computeLine(
    { quantity: 1, rate: 23999, discountPercent: 10, taxRate: 18 },
    "igst",
  );
  eq(
    "discount comes off before tax",
    [line.gross, line.discount, line.taxable, line.igst],
    [23999, 2399.9, 21599.1, 3887.84],
  );
}
{
  const line = m.computeLine({ quantity: 1, rate: 0.25, discountPercent: 0, taxRate: 50 }, "igst");
  eq("rounding is half-up (0.125 -> 0.13), not banker's", line.igst, 0.13);
}
{
  const line = m.computeLine(
    { quantity: 2.5, rate: 999.99, discountPercent: 0, taxRate: 0 },
    "none",
  );
  eq("fractional quantity rounds to paise", line.gross, 2499.98);
}
{
  const lines = [
    m.computeLine({ quantity: 1, rate: 23999, discountPercent: 10, taxRate: 18 }, "igst"),
    m.computeLine({ quantity: 2, rate: 8500, discountPercent: 0, taxRate: 18 }, "igst"),
  ];
  const t = m.computeTotals(lines, true);
  eq(
    "document totals + round off to the rupee",
    [t.subtotal, t.discountTotal, t.taxableTotal, t.igstTotal, t.roundOff, t.grandTotal],
    [40999, 2399.9, 38599.1, 6947.84, 0.06, 45547],
  );
  const exact = m.computeTotals(lines, false);
  eq("without round off the total is exact", [exact.roundOff, exact.grandTotal], [0, 45546.94]);
}
{
  const t = m.computeTotals(
    [m.computeLine({ quantity: 1, rate: 100.4, discountPercent: 0, taxRate: 0 }, "none")],
    true,
  );
  eq("round off can be negative", [t.roundOff, t.grandTotal], [-0.4, 100]);
}
{
  // The HTTP-contract body in the backend test: 42850.35 taxable, IGST 7713.07.
  const lines = [
    m.computeLine({ quantity: 1, rate: 23999, discountPercent: 10, taxRate: 18 }, "igst"),
    m.computeLine({ quantity: 2.5, rate: 8500.5, discountPercent: 0, taxRate: 18 }, "igst"),
  ];
  const t = m.computeTotals(lines, true);
  eq(
    "matches the backend HTTP example",
    [t.taxableTotal, t.igstTotal, t.grandTotal],
    [42850.35, 7713.07, 50563],
  );
}

console.log("\ntax mode resolution -- same rule as resolve_tax_mode");
eq("same state, any case -> CGST+SGST", m.resolveTaxMode("auto", "Delhi", " delhi "), "cgst_sgst");
eq("other state -> IGST", m.resolveTaxMode("auto", "Delhi", "Karnataka"), "igst");
eq("outside India -> IGST", m.resolveTaxMode("auto", "Delhi", "Outside India"), "igst");
eq("no place of supply -> undecided", m.resolveTaxMode("auto", "Delhi", ""), null);
eq("no seller state -> undecided", m.resolveTaxMode("auto", "", "Goa"), null);
eq("an explicit mode is kept", m.resolveTaxMode("igst", "", ""), "igst");

// ---------------------------------------------------------------------------
console.log("\nrequest body -- the shape the backend's extra='forbid' schema takes");

const input = {
  documentType: "quotation",
  documentNumber: "  ",
  issueDate: "2026-11-14",
  validUntil: "2026-11-29",
  dueDate: "2026-11-30",
  organizationId: null,
  billTo: { name: " Magpie Cafe ", address: "12 MG Road", gstin: "", email: "a@b.in", phone: "" },
  placeOfSupply: "Karnataka",
  taxMode: "auto",
  roundTotal: true,
  currency: "INR",
  lines: [
    {
      description: "Licence",
      hsnSac: "",
      unit: "yr",
      quantity: 1,
      rate: 23999,
      discountPercent: 10,
      taxRate: 18,
    },
  ],
  notes: "",
  terms: "50% advance",
};
const body = m.toRequestBody(input);
eq("top-level keys (backend BillingDocumentCreateRequest)", Object.keys(body).sort(), [
  "bill_to",
  "currency",
  "document_number",
  "document_type",
  "due_date",
  "issue_date",
  "lines",
  "notes",
  "organization_id",
  "place_of_supply",
  "round_total",
  "tax_mode",
  "terms",
  "valid_until",
]);
eq("bill_to is nested with backend BillToInput keys", Object.keys(body.bill_to).sort(), [
  "address",
  "email",
  "gstin",
  "name",
  "phone",
]);
eq("line keys (backend LineItemInput)", Object.keys(body.lines[0]).sort(), [
  "description",
  "discount_percent",
  "hsn_sac",
  "quantity",
  "rate",
  "tax_rate",
  "unit",
]);
eq(
  "blank strings go as null, names are trimmed",
  [body.document_number, body.bill_to.gstin, body.notes, body.bill_to.name],
  [null, null, null, "Magpie Cafe"],
);
eq("a quotation never sends a due date", [body.valid_until, body.due_date], ["2026-11-29", null]);
const invoiceBody = m.toRequestBody({ ...input, documentType: "tax_invoice" });
eq(
  "an invoice never sends valid-until",
  [invoiceBody.valid_until, invoiceBody.due_date],
  [null, "2026-11-30"],
);
check(
  "update omits document_type (the update schema forbids it)",
  !("document_type" in m.toRequestBody(input, false)),
);

// ---------------------------------------------------------------------------
console.log("\npermissions and wiring");

const screen = src("src/routes/master.billing-documents.tsx");
const service = src("src/services/billing-document.service.ts");
const shell = src("src/components/master/MasterShell.tsx");
const apiSrc = src("src/services/api.ts");

const asked = [...screen.matchAll(/can\(\s*["']([^"']+)["']\s*\)/g)].map((x) => x[1]);
check("the page asks for billing_documents keys", asked.length >= 4, asked.join(", "));
for (const key of asked) {
  check(`  ${key} is seeded by the backend`, m.BACKEND_PERMISSION_KEYS.includes(key));
}
check(
  "the sidebar capability maps to billing_documents.read",
  /"billing-documents":\s*\["billing_documents\.read"\]/.test(shell),
);
check(
  "the nav item sits in the Growth group next to Subscriptions & Billing",
  /"\/master\/billing",\s*"\/master\/billing-documents"/.test(shell),
);
check(
  "the page is estate-wide, so the customer picker lists every organization",
  /path === "\/master\/billing-documents"/.test(apiSrc),
);
check(
  "the route is registered in routeTree.gen.ts",
  src("src/routeTree.gen.ts").includes("'/master/billing-documents'"),
);

console.log("\nnothing is sent");
check("the service never calls a send/email endpoint", !/\/(send|email|resend)\b/i.test(service));
check(
  "the page never mentions emailing the document",
  !/email(ed|ing)? (it|the pdf|to the client)/i.test(screen),
);

console.log(failures ? `\n${failures} check(s) FAILED\n` : "\nall checks passed\n");
process.exit(failures ? 1 : 0);
