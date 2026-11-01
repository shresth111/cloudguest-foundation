/**
 * COMMS-2b FE: sender-choice helpers (`src/lib/isp-partner/comms2b.ts`) and
 * the request shapes of `financeService.emailInvoice` / `emailSenders`
 * against `finance_router.py` / `comms2b_router.py`. `@/services/api` is
 * replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-comms2b.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-c2b-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a) => {
     calls.push({ method, url, body: method === "get" ? undefined : a });
     return { data: { queued: [], senders: [], choice_available: false } };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "c2b.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/comms2b";
               export { financeService } from "@/services/isp-partner/finance";
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

const one = { senders: [{ key: "platform", label: "Wyfy" }], choice_available: false };
const two = {
  senders: [
    { key: "platform", label: "Wyfy" },
    { key: "own", label: "Your SMTP" },
  ],
  choice_available: true,
};

console.log("choice");
eq("hidden with one sender", m.showSenderChoice(one), false);
eq("hidden while loading", m.showSenderChoice(undefined), false);
eq(
  "hidden if backend says no choice even with two",
  m.showSenderChoice({ ...two, choice_available: false }),
  false,
);
eq("shown with two", m.showSenderChoice(two), true);
eq("own falls back to platform without a choice", m.effectiveSender("own", one), "platform");
eq("own kept with a choice", m.effectiveSender("own", two), "own");

console.log("results");
eq("platform toast", m.emailResultMessage({ queued: ["a•••@x"] }), {
  ok: true,
  text: "Invoice emailed to a•••@x.",
});
eq(
  "own all sent",
  m.emailResultMessage({ queued: [], sent: ["a"], failed: [], sender: "own" }).ok,
  true,
);
eq(
  "own all failed",
  m.emailResultMessage({ queued: [], sent: [], failed: ["a"], sender: "own" }).ok,
  false,
);
eq(
  "own partial",
  m.emailResultMessage({ queued: [], sent: ["a"], failed: ["b"], sender: "own" }).text,
  "Sent to a; failed for b.",
);

console.log("requests");
await m.financeService.emailInvoice("INV", "primary", "", "platform");
await m.financeService.emailInvoice("INV", "both", "hi", "own");
await m.financeService.emailSenders();
eq("platform send omits sender (old body)", m.calls[0], {
  method: "post",
  url: "/isp/finance/invoices/INV/email",
  body: { send_to: "primary" },
});
eq("own send names it", m.calls[1].body, { send_to: "both", message: "hi", sender: "own" });
eq("senders GET", m.calls[2], {
  method: "get",
  url: "/isp/finance/email-senders",
  body: undefined,
});

console.log("static");
const dlg = readFileSync(
  join(ROOT, "src/components/isp-partner/finance/InvoiceFinanceActions.tsx"),
  "utf8",
);
eq("picker gated by showSenderChoice", /showSenderChoice\(senders\.data\) &&/.test(dlg), true);
const fin = readFileSync(join(ROOT, "src/components/isp-partner/finance/FinancePage.tsx"), "utf8");
eq(
  "automation tab lists overdue + welcome",
  /overdue: \{/.test(fin) && /welcome: \{/.test(fin),
  true,
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
