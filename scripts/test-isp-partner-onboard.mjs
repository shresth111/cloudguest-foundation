/**
 * ONBOARD-1 one-page "Add subscriber": the pure helpers in
 * `src/lib/isp-partner/onboarding.ts` and the request shape of
 * `src/services/isp-partner/onboarding.ts`.
 *
 * Reference vectors come from the backend's own functions
 * (`gst.gstin_valid`, `compliance_logic.verhoeff_ok`); the Aadhaar numbers
 * are synthetic, random 12-digit strings, not anyone's number.
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: TZ=Asia/Kolkata node scripts/test-isp-partner-onboard.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-onboard-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" ? a : b;
     calls.push({ method, url, body: method === "get" ? undefined : a, cfg });
     return { data: {}, headers: {} };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), delete: rec("delete") };`,
);
const outfile = join(outdir, "onboard.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/onboarding";
               export { onboardingService } from "@/services/isp-partner/onboarding";
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

console.log("GSTIN checksum (vectors from gst.gstin_valid)");
for (const [g, want] of [
  ["27AAPFU0939F1ZV", true],
  ["27AAPFU0939F1ZW", false],
  ["29AAGCB7383J1Z4", true],
  ["07AAACI1681G1ZN", false],
  ["27aapfu0939f1zv", true],
  ["33AABCT1332L1ZZ", false],
  ["27AAPFU0939F1Z", false],
]) {
  eq(`${g} -> ${want}`, m.gstinValid(g), want);
}
eq("state code from GSTIN", m.stateCodeFromGstin("29AAGCB7383J1Z4"), "29");

console.log("Aadhaar (vectors from compliance_logic.verhoeff_ok)");
for (const n of ["718190937865", "997543231948", "960189555979"])
  eq(`${n} verhoeff ok`, m.verhoeffOk(n), true);
for (const n of ["726018159083", "216613186091", "590996030824"])
  eq(`${n} verhoeff bad`, m.verhoeffOk(n), false);
eq("full Aadhaar -> only last 4 sent", m.idNumberForApi("aadhaar", "7181 9093 7865"), {
  value: "7865",
});
eq("4-digit Aadhaar passes through", m.idNumberForApi("aadhaar", "7865"), { value: "7865" });
eq("bad Aadhaar refused", "error" in m.idNumberForApi("aadhaar", "726018159083"), true);
eq("Aadhaar starting 1 refused", "error" in m.idNumberForApi("aadhaar", "118190937865"), true);
eq("PAN shape", m.idNumberForApi("pan", "abcde1234f"), { value: "ABCDE1234F" });
eq("bad PAN refused", "error" in m.idNumberForApi("pan", "ABCD1234F"), true);
eq("voter id kept", m.idNumberForApi("voter_id", "ABC/1234567"), { value: "ABC/1234567" });
eq("blank id -> null", m.idNumberForApi("aadhaar", " "), { value: null });

console.log("MAC");
eq("colon form", m.normMac("aa:bb:cc:dd:ee:ff"), "AA:BB:CC:DD:EE:FF");
eq("dash form", m.normMac("AA-BB-CC-DD-EE-FF"), "AA:BB:CC:DD:EE:FF");
eq("bare hex", m.normMac("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
eq("short refused", m.normMac("aa:bb:cc"), null);
eq("garbage refused", m.normMac("zz:bb:cc:dd:ee:ff"), null);

console.log("buildOnboarding");
const all = {
  features: { pppoe: true, static_ip: true, kyc: true },
  can: { kyc: true, invoice: true, pay: true },
};
const base = {
  ...m.emptyOnboardForm(),
  isp_customer_id: "cust-1",
  package_id: "pkg-1",
  identifier: "9876500000",
  first_name: "Test",
};
const r0 = m.buildOnboarding(base, all);
eq("minimal form builds", "body" in r0, true);
eq(
  "minimal: subscriber core",
  [
    r0.body.subscriber.isp_customer_id,
    r0.body.subscriber.identifier,
    r0.body.subscriber.welcome_whatsapp,
  ],
  ["cust-1", "9876500000", true],
);
eq("minimal: invoice on by default, unpaid", r0.body.billing, {
  issue_invoice: true,
  paid_now: false,
  payment: null,
});
eq(
  "minimal: no pppoe/kyc/ips",
  [r0.body.pppoe, r0.body.kyc, r0.body.static_ips, r0.body.macs],
  [undefined, undefined, undefined, undefined],
);
const PROFILE_KEYS = [
  "activation_at",
  "after_due_action",
  "alt_email",
  "billing_anchor_day",
  "billing_city",
  "billing_pincode",
  "comments",
  "connection_type",
  "exclude_reminders",
  "install_address",
  "install_area",
  "install_building",
  "install_city",
  "install_pincode",
  "install_same_as_billing",
  "installed_at",
  "latitude",
  "longitude",
  "ont_serial",
  "override_price_paise",
  "user_type",
];
eq(
  "profile keys: ProfileBody minus gender and STB",
  Object.keys(r0.body.subscriber.profile).sort(),
  PROFILE_KEYS,
);
eq("STB never sent", "stb_serial" in r0.body.subscriber.profile, false);

const sec = (f, ctx = all) => {
  const r = m.buildOnboarding({ ...base, ...f }, ctx);
  return "section" in r ? r.section : "ok";
};
eq("no customer -> plan", sec({ isp_customer_id: "" }), "plan");
eq("short login -> plan", sec({ identifier: "ab" }), "plan");
eq("bad GSTIN -> contact", sec({ gstin: "27AAPFU0939F1ZW" }), "contact");
eq(
  "GSTIN fills state code",
  m.buildOnboarding({ ...base, gstin: "29AAGCB7383J1Z4" }, all).body.subscriber.state_code,
  "29",
);
eq(
  "GSTIN vs state mismatch -> contact",
  sec({ gstin: "29AAGCB7383J1Z4", state_code: "07" }),
  "contact",
);
eq("bad price -> billing_rules", sec({ override_price: "abc" }), "billing_rules");
eq(
  "bad install PIN -> installation",
  sec({ install_same_as_billing: false, install_pincode: "12" }),
  "installation",
);
eq("lat out of range -> installation", sec({ latitude: "95", longitude: "77" }), "installation");
eq(
  "override price -> paise",
  m.buildOnboarding({ ...base, override_price: "499.50" }, all).body.subscriber.profile
    .override_price_paise,
  49950,
);

const pp = m.buildOnboarding({ ...base, pppoe_on: true }, all);
eq("pppoe generate", pp.body.pppoe, { generate_password: true });
eq(
  "pppoe bad password -> pppoe",
  sec({ pppoe_on: true, pppoe_password_mode: "set", pppoe_password: "short" }),
  "pppoe",
);
eq(
  "pppoe hidden when feature off",
  m.buildOnboarding(
    { ...base, pppoe_on: true },
    { ...all, features: { ...all.features, pppoe: false } },
  ).body.pppoe,
  undefined,
);

const net = m.buildOnboarding(
  {
    ...base,
    static_ips: [
      { isp_location_id: "loc", pool_id: "p", ip: "", mac: "aabbccddeeff", static_queue: true },
      { isp_location_id: "loc", pool_id: "p", ip: "10.0.0.9", mac: "", static_queue: false },
    ],
    macs: "aa:bb:cc:dd:ee:01, AA-BB-CC-DD-EE-01\naabbccddee02",
  },
  all,
);
eq("static ips: next free + typed", net.body.static_ips, [
  { isp_location_id: "loc", pool_id: "p", ip: null, mac: "AA:BB:CC:DD:EE:FF", static_queue: true },
  { isp_location_id: "loc", pool_id: "p", ip: "10.0.0.9", mac: null, static_queue: false },
]);
eq("macs normalised + de-duplicated", net.body.macs, ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"]);
eq(
  "ip row without pool -> network",
  sec({
    static_ips: [{ isp_location_id: "loc", pool_id: "", ip: "", mac: "", static_queue: false }],
  }),
  "network",
);
eq(
  "duplicate typed ip -> network",
  sec({
    static_ips: [
      { isp_location_id: "l", pool_id: "p", ip: "10.0.0.9", mac: "", static_queue: false },
      { isp_location_id: "l", pool_id: "p", ip: "10.0.0.9", mac: "", static_queue: false },
    ],
  }),
  "network",
);
eq("bad mac -> network", sec({ macs: "not-a-mac" }), "network");

const k = m.buildOnboarding(
  {
    ...base,
    kyc_on: true,
    id_proof_type: "aadhaar",
    id_number: "7181 9093 7865",
    caf_mode: "auto",
  },
  all,
);
eq("kyc: Aadhaar sent as last 4 only", k.body.kyc.id_number, "7865");
eq(
  "kyc: full number appears nowhere in the body",
  JSON.stringify(k.body).includes("718190937865"),
  false,
);
eq("kyc: caf auto", k.body.caf, { mode: "auto" });
eq("kyc: number without type -> kyc", sec({ kyc_on: true, id_number: "ABC123" }), "kyc");
eq("kyc: address proof type needed", sec({ kyc_on: true, address_proof_same_as_id: false }), "kyc");
eq(
  "kyc: skipped without permission",
  m.buildOnboarding({ ...base, kyc_on: true }, { ...all, can: { ...all.can, kyc: false } }).body
    .kyc,
  undefined,
);
eq(
  "caf number",
  m.buildOnboarding({ ...base, kyc_on: true, caf_mode: "number", caf_number: "CAF/25-26/77" }, all)
    .body.caf,
  { mode: "number", number: "CAF/25-26/77" },
);

eq("upi paid needs reference -> invoice", sec({ paid_now: true, payment_mode: "upi" }), "invoice");
eq("paid now cash", m.buildOnboarding({ ...base, paid_now: true }, all).body.billing, {
  issue_invoice: true,
  paid_now: true,
  payment: { mode: "cash", reference: null },
});
eq(
  "no pay permission -> unpaid",
  m.buildOnboarding({ ...base, paid_now: true }, { ...all, can: { ...all.can, pay: false } }).body
    .billing.paid_now,
  false,
);
eq(
  "no invoice permission -> no billing",
  m.buildOnboarding(base, { ...all, can: { ...all.can, invoice: false } }).body.billing,
  undefined,
);

console.log("step 2 uploads");
const f = (kind, key) => ({ kind, key, file: { name: key } });
eq(
  "order + one photo/signature",
  m
    .uploadPlan([
      f("photo", "p1"),
      f("install_report", "r"),
      f("id_proof", "i1"),
      f("photo", "p2"),
      f("id_proof", "i2"),
      f("signature", "s"),
    ])
    .map((d) => d.key),
  ["i1", "i2", "p2", "s", "r"],
);
eq("pdf ok", m.documentProblem({ size: 1000, type: "application/pdf" }), null);
eq("gif refused", typeof m.documentProblem({ size: 1000, type: "image/gif" }), "string");
eq(
  "6 MB refused",
  typeof m.documentProblem({ size: 6 * 1024 * 1024, type: "image/png" }),
  "string",
);

console.log("misc");
eq(
  "expiry preview 30 days",
  m.expiryPreview("", 30, Date.parse("2026-11-01T00:00:00Z"))?.toISOString(),
  "2026-12-01T00:00:00.000Z",
);
eq("expiry none without validity", m.expiryPreview("", null), null);
eq("step label", m.stepLabel("caf"), "CAF number");

console.log("request shape");
await m.onboardingService.options();
eq("options path", m.calls.at(-1).url, "/isp/onboarding/options");
await m.onboardingService.create(r0.body);
eq(
  "create: POST /isp/onboarding (not JAZE-1's /subscribers/onboard)",
  [m.calls.at(-1).method, m.calls.at(-1).url],
  ["post", "/isp/onboarding"],
);

console.log("out-of-scope never offered in the page");
const page = readFileSync(
  join(ROOT, "src/components/isp-partner/onboarding/OnboardPage.tsx"),
  "utf8",
).toLowerCase();
for (const word of [
  "e-kyc",
  "ekyc",
  "esign",
  "iptv",
  "ott",
  "voip",
  "set-top",
  "stb",
  "sms",
  "verify on the gst portal",
]) {
  eq(
    `page does not offer "${word}"`,
    new RegExp(`\\b${word.replace(/[-/]/g, "\\$&")}\\b`).test(page),
    false,
  );
}

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
