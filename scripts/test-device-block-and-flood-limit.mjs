/**
 * Two router-side features, and what the dashboard says about them.
 *
 * 1. BLOCK A DEVICE (Security -> Block Websites -> Guests & devices, Device
 *    mode). A MAC block is now written to each MikroTik router as a
 *    `type=blocked` hotspot binding (cloud-guest device-block PR) and the
 *    answer comes back per router in `router_blocks`. Pinned:
 *      - the sentences claim only what a router reported, and say "1 of 2"
 *        rather than rounding up;
 *      - empty `routerBlocks` (older backend, controller venue) says nothing;
 *      - the one plain sentence about private Wi-Fi addresses is on screen;
 *      - unblock and delete go to the DEVICE table for a device row (they
 *        used to go to the identifier table for every row);
 *      - the Device mode is not offered at a controller venue.
 *
 * 2. LIMIT CONNECTION FLOODS (Security -> Firewall). A per-router switch with
 *    three presets, read off the router. Pinned:
 *      - the card sits below "Keep guests off your private networks";
 *      - its copy says strict limits can break busy apps;
 *      - the flood refusal codes have their own sentences;
 *      - en and hi carry every new key.
 *
 * Run: node scripts/test-device-block-and-flood-limit.mjs
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
  const outdir = mkdtempSync(join(tmpdir(), "devblock-flood-"));
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

const { routerBlockSentences, unblockRouterMessage, DEVICE_MAC_RANDOMISATION_NOTE } = await load(
  "src/lib/block-outcome.ts",
);
const { firewallPushErrorSentence } = await load("src/lib/firewall-rules.ts");

const rb = (status, over = {}) => ({
  id: Math.random().toString(36).slice(2),
  routerId: "r1",
  locationId: "loc",
  macAddress: "02:00:00:00:00:99",
  status,
  errorMessage: null,
  sessionsEnded: 0,
  blockedAt: null,
  clearedAt: null,
  releaseError: null,
  ...over,
});
const deviceRule = (routerBlocks) => ({ kind: "device", routerBlocks });

console.log("\nrouterBlockSentences");
{
  const one = routerBlockSentences([deviceRule([rb("enforced", { sessionsEnded: 1 })])]);
  check(
    "one router, enforced: cut off now and on reconnect, and the session count",
    one.length === 1 &&
      /now/.test(one[0]) &&
      /reconnects/.test(one[0]) &&
      /1 live session was ended/.test(one[0]),
    JSON.stringify(one),
  );
  const split = routerBlockSentences([
    deviceRule([rb("enforced"), rb("failed", { errorMessage: "router unreachable." })]),
  ]);
  check(
    "one of two: says 1 of 2 and the failure with its reason, never rounded up",
    split.length === 2 && /1 of 2 routers/.test(split[0]) && /router unreachable/.test(split[1]),
    JSON.stringify(split),
  );
  check("a failure still says the device cannot sign in", /cannot sign in/.test(split[1]));
  check(
    "empty routerBlocks (older backend or controller venue) says nothing",
    routerBlockSentences([deviceRule([])]).length === 0,
  );
  check(
    "a router with no hotspot is not counted as a block",
    routerBlockSentences([deviceRule([rb("not_applicable")])]).length === 0,
  );
  check(
    "identifier rules contribute nothing",
    routerBlockSentences([{ kind: "identifier", controllerBlocks: [] }]).length === 0,
  );
}

console.log("\nunblockRouterMessage");
check(
  "released everywhere: plain",
  unblockRouterMessage({ routerBlocks: [rb("enforced", { clearedAt: "x" })] }) ===
    "Unblocked — the device can connect again.",
);
check(
  "a router that did not confirm removal is named, with the retry",
  /did not confirm/.test(
    unblockRouterMessage({ routerBlocks: [rb("enforced", { releaseError: "timeout" })] }),
  ),
);
check("unknown body: plain sentence, no claim", unblockRouterMessage(null).startsWith("Unblocked"));

console.log("\nMAC randomisation sentence");
check(
  "one plain sentence about private Wi-Fi addresses",
  /private Wi-Fi address/.test(DEVICE_MAC_RANDOMISATION_NOTE) &&
    /new device/.test(DEVICE_MAC_RANDOMISATION_NOTE) &&
    DEVICE_MAC_RANDOMISATION_NOTE.split(". ").length === 1,
);

console.log("\nflood refusal sentences");
const s1 = firewallPushErrorSentence({
  status: 409,
  message: "x",
  data: { code: "ACCESS_RULES_FLOOD_NO_GUEST_NETWORK" },
});
check("no guest network has its own sentence", /no guest network/.test(s1.sentence));
const s2 = firewallPushErrorSentence({
  status: 409,
  message: "x",
  data: { code: "ACCESS_RULES_FLOOD_OUTSIDE_BAND" },
});
check("a moved flood row is a support case", s2.needsSupport === true);

console.log("\nwiring");
const fw = readFileSync(join(ROOT, "src/components/security/FirewallView.tsx"), "utf8");
const privIdx = fw.indexOf("<PrivateNetworksSwitch");
const floodIdx = fw.indexOf("<FloodLimitCard");
check("the flood card is rendered", floodIdx > 0);
check("below the private-networks switch", privIdx > 0 && floodIdx > privIdx);
check(
  "its copy says strict limits can break busy apps",
  /Strict limits can break busy apps/.test(fw),
);
check(
  "turning it ON needs the band; turning it OFF never does",
  /disabled=\{set\.isPending \|\| \(!on && bandBlocksOn\)\}/.test(fw),
);

const bu = readFileSync(join(ROOT, "src/components/features/BlockUsers.tsx"), "utf8");
check("Device mode creates a device rule", /kind: "device",\s*organizationId: orgId,/.test(bu));
check(
  "delete goes to the row's own table",
  /deleteAccessRule\(kind, id/.test(bu) && !/deleteAccessRule\("identifier", id/.test(bu),
);
check("unblocking a device row uses the device route", /deactivateDeviceRule\(id/.test(bu));
check(
  "the Device tab is not offered at a controller venue",
  /!clientControls\.controllerManaged && \(\s*<button/.test(bu),
);
check(
  "the MAC sentence is rendered in Device mode",
  /block-device-mac-note/.test(bu) && /DEVICE_MAC_RANDOMISATION_NOTE/.test(bu),
);

const en = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/en/nav.json"), "utf8"));
const hi = JSON.parse(readFileSync(join(ROOT, "src/lib/i18n/locales/hi/nav.json"), "utf8"));
const keys = [
  "firewallPage.floodTitle",
  "firewallPage.floodBody",
  "firewallPage.floodCap",
  "firewallPage.flood_relaxed",
  "firewallPage.flood_normal",
  "firewallPage.flood_strict",
  "securityScore.link.floodLimit",
  "blockGuests.deviceTab",
  "blockGuests.deviceMacNote",
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
  /मेहमान/.test(get(hi, "firewallPage.floodBody")) &&
    /मेहमान/.test(get(hi, "blockGuests.deviceMacNote")),
);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
