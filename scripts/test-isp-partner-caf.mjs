/**
 * CAF-2 workbench FE: helpers in `src/lib/isp-partner/caf.ts` and request
 * shapes of `src/services/isp-partner/caf.ts` against `caf_router.py`.
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-caf.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-caf-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     const cfg = method === "get" || method === "delete" ? a : b;
     calls.push({ method, url, params: cfg?.params ?? {}, body: method === "get" || method === "delete" ? undefined : a, cfg });
     return { data: {}, headers: { "content-disposition": 'attachment; filename="caf-export-x.zip"' } };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), delete: rec("delete") };`,
);
const outfile = join(outdir, "caf.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/caf";
               export { cafService } from "@/services/isp-partner/caf";
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
const last = () => m.calls.at(-1);

console.log("extras");
const d = {
  ...m.extrasDraft(null),
  applicant_category: "pvt_ltd",
  plot_no: " 14B ",
  district: "D",
};
eq("body: trimmed, other cleared", m.extrasBody(d).body, {
  applicant_category: "pvt_ltd",
  applicant_category_other: null,
  father_or_spouse_name: null,
  plot_no: "14B",
  locality: null,
  district: "D",
});
eq(
  "other needs a description",
  "error" in m.extrasBody({ ...d, applicant_category: "other" }),
  true,
);
eq(
  "other kept when chosen",
  m.extrasBody({ ...d, applicant_category: "other", applicant_category_other: "Trust" }).body
    .applicant_category_other,
  "Trust",
);
eq("plot no too long", "error" in m.extrasBody({ ...d, plot_no: "x".repeat(61) }), true);
eq("draft defaults individual", m.extrasDraft(undefined).applicant_category, "individual");

console.log("numbers / export");
eq("custom number required", typeof m.customNumberError(" "), "string");
eq("custom number 40 max", typeof m.customNumberError("x".repeat(41)), "string");
eq("custom number ok", m.customNumberError("PAPER-17"), null);
eq("export picked", m.exportBody("picked", ["a", "b"], "", "", 200).body, {
  subscriber_ids: ["a", "b"],
});
eq("export picked empty", "error" in m.exportBody("picked", [], "", "", 200), true);
eq("export picked over max", "error" in m.exportBody("picked", ["a", "b", "c"], "", "", 2), true);
eq("export range: plain dates", m.exportBody("range", [], "2026-10-01", "2026-10-31", 200).body, {
  since: "2026-10-01",
  until: "2026-10-31",
});
eq(
  "export range reversed",
  "error" in m.exportBody("range", [], "2026-10-31", "2026-10-01", 200),
  true,
);
eq(
  "export range > 366 days",
  "error" in m.exportBody("range", [], "2025-01-01", "2026-10-31", 200),
  true,
);
eq(
  "export range not ISO datetime",
  "error" in m.exportBody("range", [], "2026-10-01T00:00:00Z", "2026-10-31", 200),
  true,
);
eq(
  "pdf blocked only without KYC",
  [m.pdfBlocked(["kyc"]), m.pdfBlocked(["photo", "signature"])],
  [true, false],
);

console.log("no 12-digit run on screen");
eq("masks a full Aadhaar", m.maskTwelveDigits("ID 718190937865"), "ID XXXX XXXX 7865");
eq("masks a spaced one", m.maskTwelveDigits("7181 9093 7865"), "XXXX XXXX 7865");
eq("keeps a mobile", m.maskTwelveDigits("9876500001"), "9876500001");
eq("keeps 13 digits", m.maskTwelveDigits("1234567890123"), "1234567890123");
eq("already masked unchanged", m.maskTwelveDigits("XXXX XXXX 7865"), "XXXX XXXX 7865");

console.log("request shapes (caf_router.py)");
const s = m.cafService;
await s.options();
eq("options", last().url, "/isp/caf/options");
await s.search("ab", "lead");
eq("search params", [last().url, last().params], ["/isp/caf/search", { q: "ab", source: "lead" }]);
await s.saveSubscriberExtras("s1", { applicant_category: "proprietor" });
eq("extras PUT", [last().method, last().url], ["put", "/isp/caf/subscribers/s1/extras"]);
await s.assignNumber("s1", { mode: "custom", number: "X1" });
eq(
  "number POST",
  [last().url, last().body],
  ["/isp/caf/subscribers/s1/number", { mode: "custom", number: "X1" }],
);
await s.pdf("s1");
eq(
  "pdf GET blob",
  [last().url, last().cfg.responseType],
  ["/isp/caf/subscribers/s1/caf.pdf", "blob"],
);
await s.convertLead("l1", { identifier: null, package_id: "p", isp_customer_id: null });
eq("convert POST", [last().url, last().body.package_id], ["/isp/caf/leads/l1/convert", "p"]);
const z = await s.exportZip({ since: "2026-10-01", until: "2026-10-31" });
eq(
  "export POST blob + filename",
  [last().url, last().cfg.responseType, z.filename],
  ["/isp/caf/export", "blob", "caf-export-x.zip"],
);
await s.removeStamp();
eq("stamp DELETE", [last().method, last().url], ["delete", "/isp/caf/profile/stamp"]);

console.log("out of scope / Aadhaar entry never offered in the workbench");
const dir = join(ROOT, "src/components/isp-partner/compliance/caf");
const src = readdirSync(dir)
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n")
  .toLowerCase();
for (const w of ["e-kyc", "ekyc", "esign", "verify on the gst portal", "iptv", "sms"]) {
  eq(`no "${w}"`, new RegExp(`\\b${w.replace(/[-/]/g, "\\$&")}\\b`).test(src), false);
}
eq("no field takes a full Aadhaar number", /aadhaar number"|label="aadhaar/.test(src), false);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
