/**
 * cloud-guest #444 (per-location TR-069 credentials) in the partner console:
 * the location card shows the location credential, the save message says
 * what "off" now does, the types carry the new fields, and the CPE inventory
 * badges every blocked reason. Static checks over the source.
 * Run: node scripts/test-isp-partner-tr069-location.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
let failures = 0;
let checks = 0;
const check = (name, ok) => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
};

const card = read("src/components/isp-partner/tr069/Tr069LocationCard.tsx");
check("card shows the ACS URL", /CopyField label="ACS URL" value=\{q\.data\.acs_url\}/.test(card));
check(
  "card shows the username",
  /CopyField label="Username" value=\{q\.data\.username\}/.test(card),
);
check(
  "card shows the password as a secret (reveal/copy)",
  /CopyField label="Password" value=\{q\.data\.password\} secret/.test(card),
);
check("credential only while enabled", /q\.data\.enabled && q\.data\.acs_url/.test(card));
check(
  "save message names the ACS refusal and the re-paste",
  card.includes("refuses this location's devices at the ACS on their next check-in") &&
    card.includes("paste the TR-069 script again so they use the location credential"),
);
check(
  "PUT body stays {enabled, periodic_inform_interval_s}",
  /mutateAsync\(\{ enabled, periodic_inform_interval_s: n \}\)/.test(card),
);

const types = read("src/services/isp-partner/types.ts");
const loc = /interface Tr069LocationSettings \{([\s\S]*?)\n\}/.exec(types)?.[1] ?? "";
for (const f of ["acs_url", "username", "password", "notes"]) {
  check(`Tr069LocationSettings has optional ${f}`, new RegExp(`${f}\\?:`).test(loc));
}
check(
  "Tr069BlockedReason is isp_off | customer_off | location_off",
  /Tr069BlockedReason = "isp_off" \| "customer_off" \| "location_off"/.test(types),
);
check(
  "Tr069Device has management_blocked_reason",
  /management_blocked_reason\?: Tr069BlockedReason \| null/.test(types),
);

const table = read("src/components/isp-partner/tr069/Tr069DevicesTable.tsx");
for (const r of ["isp_off", "customer_off", "location_off"]) {
  check(`inventory badge for ${r}`, new RegExp(`${r}: "`).test(table));
}
check("inventory renders the badge", /BLOCKED_LABEL\[d\.management_blocked_reason\]/.test(table));

console.log(
  failures
    ? `\nFAIL: ${failures} of ${checks} checks failed`
    : `\nPASS: all ${checks} checks passed`,
);
process.exit(failures ? 1 : 0);
