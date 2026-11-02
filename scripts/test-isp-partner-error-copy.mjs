/**
 * ERROR-COPY guard: every error code the ISP partner backend can send has
 * partner-facing copy, the copy follows the wording rules, and the 422
 * `loc` -> form field mapping works.
 *
 * The code inventory is generated from the backend source by
 * `backend/scripts/isp_error_inventory.py` (AST walk of
 * app/domains/isp_partner + tr069) and committed here as
 * scripts/isp-error-codes.json (the backend keeps its own copy fresh with
 * tests/unit/test_isp_error_copy_unit.py).
 *
 *   node scripts/test-isp-partner-error-copy.mjs
 *   ISP_BE_DIR=~/cloud-guest-repo/backend node scripts/test-isp-partner-error-copy.mjs
 *       -> also regenerates the inventory from that backend and fails on drift
 *   ISP_BE_DIR=... node scripts/test-isp-partner-error-copy.mjs --sync
 *       -> rewrites scripts/isp-error-codes.json from that backend
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = join(ROOT, "scripts/isp-error-codes.json");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-error-copy-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export function requestErrorOf(v) {
     return v && typeof v === "object" && "status" in v && typeof v.message === "string" ? v : null;
   }`,
);
const stubUtils = join(outdir, "utils-stub.mjs");
writeFileSync(
  stubUtils,
  `export const copied = []; export async function copyToClipboard(t) { copied.push(t); return true; }`,
);
const outfile = join(outdir, "error-copy.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/errors";
               export * from "@/lib/isp-partner/error-copy";
               export * from "@/lib/isp-partner/form-errors";`,
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
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: stub }));
        b.onResolve({ filter: /^@\/lib\/utils$/ }, () => ({ path: stubUtils }));
      },
    },
  ],
});
const m = await import(outfile);

let failures = 0;
let checks = 0;
const check = (name, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  if (!ok || process.env.VERBOSE)
    console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` -- ${detail}`}`);
};
const eq = (name, got, want) =>
  check(
    name,
    JSON.stringify(got) === JSON.stringify(want),
    `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
  );

// -- 0. inventory: from the backend when it is here, else the snapshot -------
const beDir = process.env.ISP_BE_DIR;
let inventory = JSON.parse(readFileSync(SNAPSHOT, "utf8")).codes;
if (beDir && existsSync(join(beDir, "scripts/isp_error_inventory.py"))) {
  // stdlib-only AST walk; -I keeps the backend tree off the import path
  const fresh = execFileSync("python3", ["-I", join(beDir, "scripts/isp_error_inventory.py")], {
    encoding: "utf8",
  });
  if (process.argv.includes("--sync")) {
    writeFileSync(SNAPSHOT, fresh);
    console.log(`synced ${SNAPSHOT} from ${beDir}`);
  }
  const want = JSON.parse(fresh)
    .codes.map((r) => `${r.code}:${r.status}`)
    .sort();
  const have = inventory.map((r) => `${r.code}:${r.status}`).sort();
  const missing = want.filter((x) => !have.includes(x));
  const gone = have.filter((x) => !want.includes(x));
  check(
    "snapshot matches the backend source",
    process.argv.includes("--sync") || (missing.length === 0 && gone.length === 0),
    `missing ${missing.join(", ")} gone ${gone.join(", ")} (run with --sync)`,
  );
  inventory = JSON.parse(fresh).codes;
}
console.log(
  `inventory: ${inventory.length} codes (${inventory.filter((r) => r.kind === "reason").length} reasons)`,
);
check("inventory is not empty (sanity)", inventory.length > 150, String(inventory.length));

// -- 1. every backend code has copy ------------------------------------------
console.log("1. every backend code and reason has partner copy");
const unmapped = inventory.filter((r) => !m.hasCopy(`code.${r.code}`)).map((r) => r.code);
check(
  `all ${inventory.length} codes mapped`,
  unmapped.length === 0,
  `unmapped: ${unmapped.join(", ")}`,
);

// -- 2. wording rules over the whole copy module ------------------------------
console.log("2. wording rules");
const copy = m.ISP_ERROR_COPY_EN;
for (const [key, text] of Object.entries(copy)) {
  check(`${key}: no tunnel/VPN words`, !/\b(tunnel|wireguard|vpn|wg0)\b/i.test(text), text);
  const plain = text.replace(/\{\{\s*\w+\s*\}\}/g, "N");
  check(
    `${key}: no raw identifiers`,
    !/\b[a-z]+_[a-z0-9_]+\b|\b[A-Z]+_[A-Z0-9_]+\b|[{}<>]/.test(plain),
    text,
  );
  if (key.startsWith("code.") || key.startsWith("status."))
    check(`${key}: a full sentence`, /^[A-Z"]/.test(text) && /[.!]$/.test(text), text);
  if (key.startsWith("code.") && copy[key].length > 0) {
    // what to do next: most say so explicitly; a status note is allowed for 409/404 states
    check(`${key}: short enough for a toast`, text.length <= 200, `${text.length} chars`);
  }
}
const err = (status, data = {}, message = "x", extra = {}) => ({
  status,
  code: "c",
  message,
  data,
  ...extra,
});

// -- 3. a code's copy wins over the backend text; reasons win over codes ------
console.log("3. code / reason precedence");
const noBroad = inventory.filter((r) => r.kind === "code" && !["ISP_BAD_REQUEST"].includes(r.code));
let mismatched = 0;
for (const r of noBroad) {
  const info = m.describeIspError(
    err(r.status, { code: r.code }, "Request failed with status 422"),
  );
  if (info.message.includes("Request failed")) mismatched += 1;
}
check(
  "no code ever shows axios's 'Request failed with status'",
  mismatched === 0,
  String(mismatched),
);
eq(
  "reason copy beats the broad code",
  m.describeIspError(
    err(
      422,
      { code: "ISP_BAD_REQUEST", reason: "ISP_DATE_RANGE_TOO_LONG", max_days: 366 },
      "range is limited to 366 days",
    ),
  ).message,
  "Pick a range of 366 days or less.",
);
eq(
  "coupon used up (the brief's example)",
  m.describeIspError(
    err(
      422,
      { code: "ISP_DISCOUNT_INVALID", reason: "ISP_DISCOUNT_USED_UP" },
      "This discount code has been used up",
    ),
  ).message,
  "This coupon has been used up. Ask the subscriber for another code, or remove it.",
);
eq(
  "broad code shows a plain backend sentence",
  m.describeIspError(err(422, { code: "ISP_APPS_INVALID" }, "Say why the lead is dropped")).message,
  "Say why the lead is dropped",
);
eq(
  "broad code hides engineer-English",
  m.describeIspError(
    err(422, { code: "ISP_APPS_INVALID" }, "A in_progress ticket cannot move to closed"),
  ).message,
  copy["code.ISP_APPS_INVALID"],
);
eq(
  "specific code ignores the backend text",
  m.describeIspError(err(409, { code: "ISP_PPPOE_ROUTER_NOT_READY" }, "no management tunnel"))
    .message,
  copy["code.ISP_PPPOE_ROUTER_NOT_READY"],
);
eq(
  "missing interpolation var never prints {{}}",
  m.describeIspError(err(422, { code: "ISP_BAD_REQUEST", reason: "ISP_DATE_RANGE_TOO_LONG" }))
    .message,
  "Pick a range of … days or less.",
);

// -- 4. resilience: status classes ---------------------------------------------
console.log("4. status fallbacks");
const net = m.describeIspError({
  status: null,
  code: "network_error",
  message: "Unable to reach the server",
});
check(
  "network error -> retry",
  net.kind === "network" && net.retryable && /internet/.test(net.message),
  JSON.stringify(net),
);
const tmo = m.describeIspError({
  status: null,
  code: "network_error",
  message: "x",
  transportCode: "ECONNABORTED",
});
check("timeout -> retry", tmo.kind === "timeout" && tmo.retryable, JSON.stringify(tmo));
eq("401", m.describeIspError(err(401, {}, "Not authenticated")).message, copy["status.401"]);
const perm = m.describeIspError(
  err(
    403,
    { error_code: "permission_denied" },
    "Permission denied: 'isp_billing.manage' is required",
  ),
);
check("403 names the missing ability", perm.message.includes("manage billing"), perm.message);
eq("403 with no key", m.describeIspError(err(403, {}, "Forbidden")).message, copy["status.403"]);
const conflict = m.describeIspError(err(409, {}, "conflict"));
check(
  "409 -> refresh",
  conflict.refresh && conflict.message === copy["status.409"],
  JSON.stringify(conflict),
);
const s500 = err(500, {}, "Internal server error", { requestId: "req-abc" });
const i500 = m.describeIspError(s500);
check(
  "5xx -> reference + copy details + retry",
  i500.showReference && i500.retryable && i500.requestId === "req-abc",
  JSON.stringify(i500),
);
check(
  "5xx string message carries the reference",
  m.ispErrorMessage(s500).includes("req-abc"),
  m.ispErrorMessage(s500),
);
check(
  "5xx never says 'Internal server error'",
  !/internal server error/i.test(m.ispErrorMessage(s500)),
);
check(
  "caller fallback leads a 5xx",
  m.ispErrorMessage(s500, "Could not save the package.").startsWith("Could not save the package. "),
);
const details = m.ispErrorDetails(s500, new Date("2026-11-01T00:00:00Z"));
check(
  "copy details is plain text with the reference",
  details.includes("Reference: req-abc") && !/[{}]/.test(details),
  details,
);
eq("unknown 418", m.describeIspError(err(418, {}, "teapot")).message, copy["status.4xx"]);
eq(
  "not a request error -> caller fallback",
  m.ispErrorMessage(new TypeError("x"), "Could not load."),
  "Could not load.",
);
eq(
  "429 without code",
  m.describeIspError(err(429, {}, "Too many requests")).message,
  copy["status.429"],
);
eq(
  "pydantic 422 summary names the field",
  m.describeIspError(
    err(
      422,
      {
        errors: [{ loc: ["body", "price_paise"], type: "greater_than", msg: "x", ctx: { gt: 0 } }],
      },
      "Request validation failed",
    ),
  ).message,
  "Price: Must be more than 0.",
);

// -- 5. isPresentable ---------------------------------------------------------
console.log("5. presentable backend sentences");
for (const bad of [
  "Request failed with status 422",
  "date_to is before date_from",
  "{'detail': 'x'}",
  "Traceback (most recent call last)",
  "until is before since",
  "Not Found",
  "Couldn't reach the WireGuard hub",
  "ISP_BAD_REQUEST",
])
  check(`rejects ${JSON.stringify(bad)}`, !m.isPresentable(bad));
for (const good of [
  "Say why the lead is dropped",
  "Port 4 is already used by Splitter A",
  "PIN code is 6 digits",
])
  check(`accepts ${JSON.stringify(good)}`, m.isPresentable(good));

// -- 6. 422 loc -> form field ---------------------------------------------------
console.log("6. 422 loc -> form field");
const v422 = (errors) => err(422, { errors }, "Request validation failed");
eq("fieldNameFromLoc drops body", m.fieldNameFromLoc(["body", "kyc", "pin_code"]), "kyc.pin_code");
eq(
  "fieldNameFromLoc keeps list index",
  m.fieldNameFromLoc(["body", "lines", 0, "amount_paise"]),
  "lines.0.amount_paise",
);
eq("fieldNameFromLoc: body only -> null", m.fieldNameFromLoc(["body"]), null);
eq(
  "humanizeField",
  [
    m.humanizeField("credit_limit_paise"),
    m.humanizeField("isp_customer_id"),
    m.humanizeField("lines.0.amount_paise"),
  ],
  ["Credit limit", "Customer", "Amount"],
);
let r = m.ispFormErrors(
  v422([
    {
      loc: ["body", "kyc", "pin_code"],
      type: "string_too_short",
      msg: "x",
      ctx: { min_length: 6 },
    },
  ]),
);
eq("last segment by default", r.fields, { pin_code: "Enter at least 6 characters." });
eq(
  "form summary when every error has a field",
  r.form,
  "Fix the highlighted fields and try again.",
);
eq("first", r.first, "pin_code");
r = m.ispFormErrors(
  v422([{ loc: ["body", "price_paise"], type: "missing", msg: "Field required" }]),
  { fields: { price_paise: "price" } },
);
eq("mapped to the form's own key", r.fields, { price: "This is required." });
r = m.ispFormErrors(
  v422([{ loc: ["body", "kyc", "pin_code"], type: "missing", msg: "Field required" }]),
  { fields: { kyc: "kycSection" }, segment: "first" },
);
eq("segment first (sectioned bodies)", r.fields, { kycSection: "This is required." });
r = m.ispFormErrors(
  v422([
    { loc: ["body", "po_number"], type: "string_too_long", msg: "x", ctx: { max_length: 40 } },
  ]),
  { known: ["amount"], labels: { po_number: "PO number" } },
);
eq(
  "unknown field -> named in the form message",
  [r.fields, r.form],
  [{}, "PO number: Enter at most 40 characters."],
);
r = m.ispFormErrors(
  v422([{ loc: ["body", "mode"], type: "value_error", msg: "Value error, Pick cash or UPI" }]),
);
eq("value_error prefix stripped", r.fields, { mode: "Pick cash or UPI." });
r = m.ispFormErrors(
  v422([
    {
      loc: ["body", "credit_limit_paise"],
      type: "value_error",
      msg: "Value error, credit_limit_paise is required",
    },
  ]),
);
eq("engineer-English value_error -> generic", r.fields, {
  credit_limit_paise: "This value is not valid.",
});
r = m.ispFormErrors(
  v422([
    { loc: ["body", "email"], type: "value_error", msg: "Value error, not a valid email address" },
  ]),
);
eq("email value_error", r.fields, { email: "Enter a valid email address." });
r = m.ispFormErrors(
  v422([{ loc: ["body"], type: "model_attributes_type", msg: "Input should be an object" }]),
);
eq("no field -> form message only", [r.fields, r.form], [{}, "This value is not valid."]);
r = m.ispFormErrors(
  err(422, { code: "ISP_BUYER_GSTIN_INVALID", field: "buyer_gstin" }, "GSTIN is not valid"),
  { fields: { buyer_gstin: "gstin" } },
);
eq("ISP error data.field -> under the field", r.fields, {
  gstin: copy["code.ISP_BUYER_GSTIN_INVALID"],
});
r = m.ispFormErrors(err(409, { code: "ISP_PACKAGE_NEEDS_PRICE" }, "x"));
eq("non-field error -> form", [r.fields, r.form], [{}, copy["code.ISP_PACKAGE_NEEDS_PRICE"]]);
eq(
  "ispFieldErrors worded + data.field",
  m.ispFieldErrors(
    v422([{ loc: ["body", "quantity"], type: "greater_than_equal", msg: "x", ctx: { ge: 1 } }]),
  ),
  { quantity: "Must be 1 or more." },
);
eq(
  "ispFormMessage names the field",
  m.ispFormMessage(v422([{ loc: ["body", "amount_paise"], type: "int_parsing", msg: "x" }]), {
    amount_paise: "Amount received",
  }),
  "Amount received: Enter a whole number.",
);
eq(
  "ispFormMessage on a coded error",
  m.ispFormMessage(err(409, { code: "ISP_INVOICE_PAID" })),
  copy["code.ISP_INVOICE_PAID"],
);

// -- 7. i18n hook --------------------------------------------------------------
console.log("7. translator hook (Hindi later)");
m.setIspErrorTranslator((key) => (key === "status.409" ? "HI-409" : null));
eq("translator used when it answers", m.describeIspError(err(409, {}, "x")).message, "HI-409");
eq("English when it does not", m.describeIspError(err(404, {}, "x")).message, copy["status.404"]);
m.setIspErrorTranslator(null);

// -- 8. source scans: no raw error text / JSON on partner screens -------------
console.log("8. partner screens never print raw error text");
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|ts)$/.test(f)) files.push(p);
  }
};
walk(join(ROOT, "src/components/isp-partner"));
walk(join(ROOT, "src/hooks/isp-partner"));
check("scan found the partner files (sanity)", files.length > 100, String(files.length));
const rawJson = [];
const rawMsg = [];
for (const p of files) {
  const src = readFileSync(p, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (/JSON\.stringify\(\s*(e|err|error|e2|q\.error|\w+\.error)\b/.test(line))
      rawJson.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
    if (/requestErrorOf\([^)]*\)\??\.message(?!\s*\?\?\s*""\)\.toLowerCase)/.test(line))
      rawMsg.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
    if (/toast\.error\(\s*(e|err|error)\.message/.test(line))
      rawMsg.push(`${p.slice(ROOT.length + 1)}:${i + 1}`);
  });
}
check("no JSON.stringify of an error", rawJson.length === 0, rawJson.join(", "));
check("no raw request message on screen", rawMsg.length === 0, rawMsg.join(", "));
const kit = readFileSync(join(ROOT, "src/components/isp-partner/kit.tsx"), "utf8");
check(
  "ErrorBlock shows ErrorReference (5xx request id + Copy details)",
  /<ErrorReference error=\{error\}/.test(kit),
);
const toastSites = files.filter((p) =>
  /toast\.error\(\s*ispErrorMessage\(/.test(readFileSync(p, "utf8")),
);
check("failed actions toast through ispToastError", toastSites.length === 0, toastSites.join(", "));
for (const f of [
  "onboarding/OnboardPage.tsx",
  "plans/PackagesTab.tsx",
  "network/PackagePolicyDrawer.tsx",
  "plans/RechargeDialog.tsx",
  "subscribers/SubscriberActions.tsx",
  "settings/InvoiceSettingsCard.tsx",
  "compliance/caf/CafSubscriberPanel.tsx",
  "fiber/FiberNodeDialog.tsx",
  "zones/ZoneTreeCard.tsx",
  "settings/ZonesCard.tsx",
])
  check(
    `${f} uses the shared form-error helper`,
    /ispForm(Errors|Message)\(/.test(
      readFileSync(join(ROOT, "src/components/isp-partner", f), "utf8"),
    ),
  );

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
