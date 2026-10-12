/**
 * Aruba Instant On on a dynamic public IP: the guest portal's egress hint
 * (src/lib/portal-nas-egress-hint.ts) and the Master panel's read of the
 * auto-learned addresses (src/lib/aruba-instant-on-setup.ts).
 *
 * WHAT THIS GUARDS:
 *   1. MIKROTIK AND OMADA SEND NOTHING. No hint body for any other provider,
 *      and none without the AP's own redirect params (a bookmark / QR load).
 *   2. THE HINT CARRIES NOTHING ABOUT THE GUEST: exactly router_id, nas_id,
 *      ap_mac, net_provider -- never mac / ip / url.
 *   3. `nas-id` IS READ OFF THE RAW URL, including when Aruba joins its
 *      params with a second `?`.
 *   4. ONCE PER DOCUMENT, NEVER THROWS.
 *   5. AN OLDER BACKEND (no learned_addresses) READS AS "OFF, NONE".
 *   6. WIRING: portal.tsx calls it; no customer surface imports the Master
 *      service's removeLearnedAddress.
 *
 * Run: node scripts/test-aruba-egress-hint.mjs
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
let ran = 0;
function check(name, ok, extra = "") {
  ran += 1;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

const work = join(ROOT, "node_modules", ".cache", "aruba-egress-hint");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
async function bundle(entry, name) {
  const outfile = join(work, name);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    packages: "external",
    logLevel: "silent",
    alias: { "@": join(ROOT, "src") },
  });
  return import(pathToFileURL(outfile).href);
}

const HINT = await bundle("src/lib/portal-nas-egress-hint.ts", "hint.mjs");
const SETUP = await bundle("src/lib/aruba-instant-on-setup.ts", "setup.mjs");

const RID = "9e6069de-f7a7-409f-8e4e-68d1cba75687";
const CONFIGURED =
  "https://staging.wyfyguest.com/portal?organizationId=11111111-1111-1111-1111-111111111111" +
  "&locationId=22222222-2222-2222-2222-222222222222" +
  `&routerId=${RID}&netProvider=aruba_instant_on&portalMode=radius`;
// Measured on the AP21 (Instant On 3.4.2), 2026-10-03.
const APPENDED =
  "cmd=login&mac=aa:bb:cc:dd:ee:01&network=WYFY_ARUBA&ip=192.168.1.37" +
  "&apmac=54:f0:b1:c8:a9:0a&site=inhouse-office&post=captive-2022.aio.cloudauth.net" +
  "&url=http%3A%2F%2Fexample.com%2F&nas-id=cg-aruba-9e6069de";

console.log("1. MikroTik / Omada / no AP redirect: nothing to send");
for (const provider of [undefined, "", "mikrotik", "omada", "tplink_omada"]) {
  eq(
    `provider ${JSON.stringify(provider)} -> null`,
    HINT.buildNasEgressHint({
      routerId: RID,
      netProvider: provider,
      href: `${CONFIGURED}&${APPENDED}`,
    }),
    null,
  );
}
eq(
  "Aruba without apmac/nas-id (bookmark, QR) -> null",
  HINT.buildNasEgressHint({ routerId: RID, netProvider: "aruba_instant_on", href: CONFIGURED }),
  null,
);
eq(
  "Aruba with a non-uuid routerId -> null",
  HINT.buildNasEgressHint({
    routerId: "not-a-uuid",
    netProvider: "aruba_instant_on",
    href: `${CONFIGURED}&${APPENDED}`,
  }),
  null,
);

console.log("2. the body carries nothing about the guest");
const body = HINT.buildNasEgressHint({
  routerId: RID,
  netProvider: "aruba_instant_on",
  href: `${CONFIGURED}&${APPENDED}`,
});
eq("exact body", body, {
  router_id: RID,
  nas_id: "cg-aruba-9e6069de",
  ap_mac: "54:f0:b1:c8:a9:0a",
  net_provider: "aruba_instant_on",
});
check(
  "no guest mac / ip / url in the body",
  !JSON.stringify(body).includes("aa:bb:cc") &&
    !JSON.stringify(body).includes("192.168.1.37") &&
    !JSON.stringify(body).includes("example.com"),
);

console.log("3. raw-URL parsing");
eq("joined with a second ?", HINT.readArubaEgressParams(`${CONFIGURED}?${APPENDED}`), {
  apMac: "54:f0:b1:c8:a9:0a",
  nasId: "cg-aruba-9e6069de",
});
eq("hash ignored", HINT.readArubaEgressParams(`${CONFIGURED}&${APPENDED}#frag&nas-id=evil`), {
  apMac: "54:f0:b1:c8:a9:0a",
  nasId: "cg-aruba-9e6069de",
});
eq("no query", HINT.readArubaEgressParams("https://x/portal"), {});
check(
  "over-long values are clipped",
  HINT.buildNasEgressHint({
    routerId: RID,
    netProvider: "aruba_instant_on",
    href: `${CONFIGURED}&apmac=${"a".repeat(500)}&nas-id=${"n".repeat(500)}`,
  }).nas_id.length === 255,
);

console.log("4. once per document, never throws");
HINT.__resetNasEgressHintForTests();
const posts = [];
const post = async (path, b) => {
  posts.push([path, b]);
};
eq("first send", await HINT.sendNasEgressHintOnce(body, post), true);
eq("second send suppressed", await HINT.sendNasEgressHintOnce(body, post), false);
eq("posted once to the hint route", posts, [["/guest/portal/nas-egress-hint", body]]);
eq("null body sends nothing", await HINT.sendNasEgressHintOnce(null, post), false);
HINT.__resetNasEgressHintForTests();
let threw = false;
try {
  eq(
    "a failing POST resolves false",
    await HINT.sendNasEgressHintOnce(body, async () => {
      throw new Error("502");
    }),
    false,
  );
} catch {
  threw = true;
}
check("and does not throw", !threw);

console.log("5. Master panel reads learned addresses");
const older = SETUP.toArubaSetupStatus({ router_id: RID, registered: true, gaps: [] });
eq("older backend: learning off", older.egressLearningEnabled, false);
eq("older backend: none learned", older.learnedAddresses, []);
const newer = SETUP.toArubaSetupStatus({
  router_id: RID,
  registered: true,
  gaps: [],
  egress_learning_enabled: true,
  learned_addresses: [
    {
      ip_address: "111.223.3.241",
      source: "portal_hint",
      first_seen_at: "2026-10-03T05:00:00Z",
      last_seen_at: "2026-10-03T06:00:00Z",
      hit_count: 4,
      hub_confirmed: true,
    },
    { nonsense: true },
  ],
});
eq("learning on", newer.egressLearningEnabled, true);
eq("learned row mapped, junk dropped", newer.learnedAddresses, [
  {
    ipAddress: "111.223.3.241",
    source: "portal_hint",
    firstSeenAt: "2026-10-03T05:00:00Z",
    lastSeenAt: "2026-10-03T06:00:00Z",
    hitCount: 4,
    hubConfirmed: true,
  },
]);

console.log("6. wiring");
const portal = readFileSync(join(ROOT, "src/routes/portal.tsx"), "utf8");
check("portal.tsx builds the hint", portal.includes("buildNasEgressHint("));
check("portal.tsx sends it once", portal.includes("sendNasEgressHintOnce("));
const panel = readFileSync(
  join(ROOT, "src/components/routers/ArubaInstantOnSetupPanel.tsx"),
  "utf8",
);
check("Master panel renders learned addresses", panel.includes("aruba-learned-addresses"));
check("Master panel can remove one", panel.includes("removeLearnedAddress("));
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const customer = walk(join(ROOT, "src/components/customer"))
  .concat(walk(join(ROOT, "src/components/portal-runtime")))
  .filter((p) => readFileSync(p, "utf8").includes("removeLearnedAddress"));
eq(
  "no customer or portal surface calls removeLearnedAddress",
  customer.map((p) => relative(ROOT, p)),
  [],
);

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba egress hint: all checks passed"
    : `aruba egress hint: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
