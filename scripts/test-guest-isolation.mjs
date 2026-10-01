/**
 * "Guests can't see each other" (Security -> Firewall), and what the
 * dashboard says about it.
 *
 * The router can keep apart guests on DIFFERENT ports (different access
 * points) and on its own Wi-Fi. It cannot see two guests on the SAME
 * external access point -- that access point switches them itself. Pinned:
 *   - the card sits below "Limit connection floods";
 *   - the access-point line ("AP isolation" in each access point's own
 *     settings) is rendered whenever the backend says it is needed, and for
 *     a one-port guest network;
 *   - the switch cannot be turned ON when the backend says it would be
 *     refused, and can always be turned OFF;
 *   - every ISOLATION_* refusal has its own sentence, none claims a change;
 *   - the service maps the backend body (snake_case) faithfully;
 *   - en and hi carry every new key, and Hindi says मेहमान.
 *
 * Run: node scripts/test-guest-isolation.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

let failures = 0;
function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

async function load(rel) {
  const outdir = mkdtempSync(join(tmpdir(), "guest-isolation-"));
  const entry = join(outdir, "entry.mjs");
  writeFileSync(entry, `export * from ${JSON.stringify(join(ROOT, rel))};\n`);
  const bundle = join(outdir, "bundle.mjs");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundle,
    logLevel: "silent",
    alias: { "@": join(ROOT, "src") },
  });
  return import(bundle);
}

const { firewallPushErrorSentence, ISOLATION_ONE_PORT_SENTENCE } = await load(
  "src/lib/firewall-rules.ts",
);

console.log("\nrefusal sentences");
const codes = [
  "ISOLATION_NO_HOTSPOT",
  "ISOLATION_NOTHING_TO_ISOLATE",
  "ISOLATION_VLAN_BRIDGE",
  "ISOLATION_BRIDGE_CARRIES_WAN",
  "ISOLATION_HORIZON_IN_USE",
];
for (const code of codes) {
  const s = firewallPushErrorSentence({ status: 409, message: "x", data: { code } });
  check(`${code} has its own sentence`, s.code === code && s.sentence.length > 20, s.sentence);
  check(
    `${code} never claims the router was changed`,
    !/now kept apart|turned on|applied/i.test(s.sentence),
    s.sentence,
  );
}
check(
  "the one-port sentence points at the access point's own setting",
  /AP isolation/.test(ISOLATION_ONE_PORT_SENTENCE) &&
    /access point/.test(ISOLATION_ONE_PORT_SENTENCE),
);
check(
  "a port shared with other networks is a support case",
  firewallPushErrorSentence({ status: 409, message: "", data: { code: "ISOLATION_VLAN_BRIDGE" } })
    .needsSupport === true,
);
check(
  "an unknown ISOLATION_ code still says nothing changed",
  /Nothing was changed/.test(
    firewallPushErrorSentence({ status: 409, message: "", data: { code: "ISOLATION_NEW_THING" } })
      .sentence,
  ),
);

console.log("\nservice mapping");
const svc = readFileSync(join(ROOT, "src/services/firewall.service.ts"), "utf8");
check(
  "reads /guest-isolation",
  /\/firewall-rules\/routers\/\$\{routerId\}\/guest-isolation/.test(svc),
);
check("PUT sends { enabled }", /\{ enabled \},/.test(svc));
for (const [from, to] of [
  ["between_ports", "betweenPorts"],
  ["ap_ports", "apPorts"],
  ["ap_isolation_needed", "apIsolationNeeded"],
  ["routed_guard", "routedGuard"],
  ["radios_isolated", "radiosIsolated"],
]) {
  check(`${from} -> ${to}`, new RegExp(`${to}:[^\\n]*d\\.${from}`).test(svc));
}
check(
  "an older backend (404) is 'unknown', not an error",
  /getGuestIsolation[\s\S]{0,700}404/.test(svc),
);

console.log("\nwiring");
const fw = readFileSync(join(ROOT, "src/components/security/FirewallView.tsx"), "utf8");
const floodIdx = fw.indexOf("<FloodLimitCard");
const isoIdx = fw.indexOf("<GuestIsolationCard");
check("the isolation card is rendered", isoIdx > 0);
check("below the flood card", floodIdx > 0 && isoIdx > floodIdx);
check("its title", /"Guests can't see each other"/.test(fw));
check(
  "the access-point line is shown when the backend says so (or one port)",
  /\(state\.apIsolationNeeded \|\| onePort\) &&/.test(fw) && /guest-isolation-ap-note/.test(fw),
);
check(
  "the line names AP isolation and each access point's own settings",
  /“AP isolation”[^"]*each access point's own settings/.test(fw),
);
check(
  "ON is blocked by a refusal; OFF never is",
  /const blocksOn = !on && refusal !== null;/.test(fw) &&
    /disabled=\{set\.isPending \|\| blocksOn\}/.test(fw),
);
check(
  "one switch only",
  (fw.slice(fw.indexOf("function GuestIsolationCard")).match(/<Switch/g) || []).length >= 1,
);

const ov = readFileSync(join(ROOT, "src/components/security/SecurityOverviewView.tsx"), "utf8");
check(
  "Security Score links the capability to the firewall screen",
  /guest_client_isolation: \{\s*to: "\/firewall"/.test(ov),
);
check(
  "device blocking no longer says isolation is not offered",
  !/Keeping devices on the same network apart from each other is not offered yet/.test(ov),
);

const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en/nav.json"), "utf8"));
const hi = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/hi/nav.json"), "utf8"));
const keys = [
  "firewallPage.isoTitle",
  "firewallPage.isoBody",
  "firewallPage.isoBetweenYes",
  "firewallPage.isoBetweenNo",
  "firewallPage.isoPartial",
  "firewallPage.isoApNote",
  "firewallPage.isoOnePort",
  "firewallPage.isoBlip",
  "firewallPage.isoOnToast",
  "firewallPage.isoOffToast",
  "securityScore.link.guestIsolation",
  "securityScore.label.guest_client_isolation",
  "securityScore.copy.guest_client_isolation",
];
const get = (o, k) => k.split(".").reduce((a, p) => (a == null ? a : a[p]), o);
for (const k of keys) {
  check(
    `en and hi both carry ${k}`,
    typeof get(en, k) === "string" && typeof get(hi, k) === "string",
  );
}
check(
  "Hindi says मेहमान for guest",
  /मेहमान/.test(get(hi, "firewallPage.isoTitle")) &&
    /मेहमान/.test(get(hi, "firewallPage.isoApNote")),
);
check(
  "the en card copy matches the component's fallback",
  fw.includes(get(en, "firewallPage.isoApNote")) && fw.includes(get(en, "firewallPage.isoBody")),
);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
