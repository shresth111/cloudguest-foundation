/**
 * APPS-2 #5 integrations page FE: helpers in `src/lib/isp-partner/integrations.ts`,
 * the request of `src/services/isp-partner/integrations.ts` against
 * `integrations_router.py`, and static checks that the page invents no state.
 * `@/services/api` is replaced with a recorder; nothing goes on the network.
 *
 * Run: node scripts/test-isp-partner-integrations.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-integ-"));
const stub = join(outdir, "api-stub.mjs");
writeFileSync(
  stub,
  `export const calls = [];
   const rec = (method) => async (url, a, b) => {
     calls.push({ method, url, body: method === "get" ? undefined : a });
     return { data: { cards: {} } };
   };
   export default { get: rec("get"), post: rec("post"), put: rec("put"), patch: rec("patch"), delete: rec("delete") };`,
);
const outfile = join(outdir, "integ.mjs");
await build({
  stdin: {
    contents: `export * from "@/lib/isp-partner/integrations";
               export { integrationsService } from "@/services/isp-partner/integrations";
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

console.log("service");
await m.integrationsService.getStatus();
eq("one GET to the status endpoint", m.calls, [
  { method: "get", url: "/isp/integrations/status", body: undefined },
]);

console.log("helpers");
eq(
  "six cards, BE order",
  [...m.INTEGRATION_KEYS],
  ["whatsapp", "email", "telegram", "acs", "payment_gateway", "ipdr_archive"],
);
eq("configured", m.stateLabel("configured").label, "Configured");
eq("not configured", m.stateLabel("not_configured").label, "Not configured");
eq("not set up", m.stateLabel("not_set_up").label, "Not set up");
eq("coming soon", m.stateLabel("coming_soon").label, "Coming soon");
eq("unknown state is not shown as configured", m.stateLabel("whatever").label, "Not configured");
eq("nothing recorded -> null", m.lastOutcome(null, null), null);
eq("only a send", m.lastOutcome("2026-11-01T10:00:00Z", null), {
  kind: "sent",
  at: "2026-11-01T10:00:00Z",
});
eq("only a failure", m.lastOutcome(null, "2026-11-01T10:00:00Z")?.kind, "failed");
eq(
  "newer failure wins",
  m.lastOutcome("2026-11-01T09:00:00Z", "2026-11-01T10:00:00Z")?.kind,
  "failed",
);
eq("newer send wins", m.lastOutcome("2026-11-01T11:00:00Z", "2026-11-01T10:00:00Z")?.kind, "sent");
eq("payment gateway has no settings link", m.INTEGRATION_LINKS.payment_gateway, undefined);
eq("telegram links to the J14 automation tab", m.INTEGRATION_LINKS.telegram, {
  to: "/partner/finance",
  search: { tab: "automation" },
  perm: "isp_billing.read",
});
eq("ACS link needs the permission its card needs", m.INTEGRATION_LINKS.acs.perm, "tr069.manage");

console.log("static");
const page = readFileSync(
  join(ROOT, "src/components/isp-partner/settings/IntegrationsPage.tsx"),
  "utf8",
);
const low = page.toLowerCase();
for (const w of [
  "healthy",
  "connected",
  "online",
  "100%",
  "iptv",
  "voip",
  "ott",
  "quickbooks",
  "enach",
  "onesignal",
  "e-invoice",
  "razorpay",
  "ivr",
]) {
  eq(`page never says "${w}"`, new RegExp(`\\b${w.replace(/[-%]/g, "\\$&")}`).test(low), false);
}
eq(
  "no mutation on the page",
  /useMutation|\.post\(|\.put\(|\.patch\(|\.delete\(/.test(page),
  false,
);
eq(
  "payment card is hard-wired to coming_soon",
  /k="payment_gateway" state="coming_soon"/.test(page),
  true,
);
eq(
  "route registered",
  readFileSync(join(ROOT, "src/routeTree.gen.ts"), "utf8").includes(
    "/partner/settings/integrations",
  ),
  true,
);

console.log(`\n${checks - failures}/${checks} passed`);
if (failures) process.exit(1);
