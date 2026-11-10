/**
 * PROV-FIX guards (source checks): every partner-only behaviour in the shared
 * Master setup panel is behind `partnerSetup`, so Master is unchanged, and the
 * partner page only turns it on from the backend probe.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const panel = read("src/components/routers/RouterSetupScriptAdvanced.tsx");
const page = read("src/components/isp-partner/routers/RouterDetailPage.tsx");
const card = read("src/components/isp-partner/routers/PartnerMonitoringCard.tsx");

let failed = 0;
const check = (name, ok) => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failed += 1;
};

const asks = [...panel.matchAll(/askPartner\(\{/g)].length;
const gatedAsks = [...panel.matchAll(/partnerSetup\s*\?\s*\(await askPartner\(\{/g)].length;
check("two in-app partner choices exist", asks === 2);
check("every in-app choice is the partner side of a `partnerSetup ?` branch", gatedAsks === asks);
check(
  "Master keeps both window.confirm dialogs",
  [...panel.matchAll(/window\.confirm\(/g)].length >= 2,
);
check(
  "partner check-in twin is only called inside `if (partnerSetup)`",
  /if \(partnerSetup\) \{[\s\S]{0,600}`\/isp\/routers\/\$\{router\.id\}\/setup\/check-in`/.test(
    panel,
  ),
);
check(
  "Master still calls the original check-in",
  panel.includes('"/routers/provisioning/check-in"'),
);
check(
  "API access re-issue on a never-connected router is partner only",
  /mintApiSecret =\s*!router\.hasApiCredentials \|\| rotateApiSecret \|\| \(partnerSetup && neverConnected\)/.test(
    panel,
  ),
);
check(
  "version report is partner only",
  panel.includes("heartbeatReportsVersion: partnerSetup || undefined"),
);
check("partnerSetup defaults to false", /partnerSetup = false,/.test(panel));
check(
  "partner page turns it on only from the /isp/setup-fixes probe",
  page.includes("partnerSetup={!!fixes.data?.check_in_fallback}"),
);
const forbidden = /wireguard|tunnel|\bvpn\b/i;
const partnerCopy = [...panel.matchAll(/askPartner\(\{([\s\S]*?)\}\)\)/g)].map((m) => m[1]);
check("partner choice copy found", partnerCopy.length === 2);
check(
  "partner choice copy never names the tunnel technology",
  partnerCopy.every((t) => !forbidden.test(t)),
);
check("monitoring card copy never names the tunnel technology", !forbidden.test(card));

console.log("");
if (failed) {
  console.error(`FAIL: ${failed} check(s)`);
  process.exit(1);
}
console.log("isp-partner-provfix: all checks passed");
