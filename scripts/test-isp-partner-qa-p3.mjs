/**
 * QA pass-1 P3 fixes (PARITY-2): QA-013, QA-015, QA-017, QA-018.
 *
 * Run: node scripts/test-isp-partner-qa-p3.mjs
 */
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let checks = 0;
function check(name, ok, extra = "") {
  checks += 1;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");

// QA-018: duplicate customer names get a second field; unique ones do not.
mkdirSync(join(ROOT, "node_modules/.cache"), { recursive: true });
const outdir = mkdtempSync(join(ROOT, "node_modules/.cache/isp-qa-"));
const outfile = join(outdir, "label.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/isp-partner/customer-label.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { customerLabels } = await import(outfile);
const labels = customerLabels([
  { id: "a", name: "Cafe One", external_ref: "ACC-1", city: "Noida" },
  { id: "b", name: "cafe one", external_ref: null, city: "Delhi" },
  { id: "c", name: "Hotel Two" },
]);
check("unique name unchanged", labels.get("c") === "Hotel Two");
check("duplicate gets account number", labels.get("a") === "Cafe One · ACC-1");
check("duplicate falls back to city", labels.get("b") === "cafe one · Delhi");
check("labels differ", labels.get("a") !== labels.get("b"));
const kit = read("src/components/isp-partner/kit.tsx");
check("CustomerSelect uses the labels", /customerLabels\(customers \?\? \[\]\)/.test(kit));
check(
  "staff scope picker uses the labels",
  /customerLabels\(/.test(read("src/components/isp-partner/users/UsersPage.tsx")),
);

// QA-017: a page the role cannot see is not mounted (no 403 fetch).
const shell = read("src/components/isp-partner/PartnerShell.tsx");
check(
  "shell gates hidden pages before mounting",
  /const denied = PARTNER_NAV\.find/.test(shell) && /denied \? \(/.test(shell),
);
check("gate covers sub-routes", /pathname\.startsWith\(`\$\{n\.to\}\/`\)/.test(shell));

// QA-015: the one-minute sync is said where it shows.
check(
  "subscribers hint",
  /within about a minute/.test(read("src/components/isp-partner/plans/SubscribersTab.tsx")),
);
check(
  "invoices hint",
  /within about a minute/.test(read("src/components/isp-partner/invoices/InvoicesPage.tsx")),
);

// QA-013: router refusals are worded for an ISP; no raw UUIDs.
const b4 = read("src/components/isp-partner/security-ops/B4Pages.tsx");
check("credential wording replaced", /connection credentials\|management or public IP/.test(b4));
check("UUIDs replaced", /replace\(UUID_RE, "this router"\)/.test(b4));
check("category platform config explained", /Website categories are not available/.test(b4));
check("B4 pages render the friendly error", (b4.match(/<B4Error/g) || []).length >= 8);

// Billing on Guest Messaging: /guest-sessions refused locally, not audited.
const shimSrc = read("src/lib/isp-partner/api-shim.ts");
const msg = read("src/components/isp-partner/messaging/MessagingPages.tsx");
check("shim can refuse a venue path locally", /export function setShimLocallyDenied/.test(shimSrc));
check(
  "local refusal is a 403, not data",
  /status: 403/.test(shimSrc) && /ISP_ROLE_NOT_GRANTED/.test(shimSrc),
);
check(
  "Guest Messaging denies /guest-sessions without isp_access.read",
  /can\("isp_access\.read"\)/.test(msg) &&
    /setShimLocallyDenied\(\[\/\^\\\/guest-sessions/.test(msg),
);
check("and clears it on unmount", /return \(\) => setShimLocallyDenied\(\[\]\)/.test(msg));

if (failures > 0) {
  console.error(`\nFAIL: ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`\nPASS: all ${checks} checks passed`);
