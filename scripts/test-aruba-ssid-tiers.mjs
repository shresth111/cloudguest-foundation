/**
 * Speed tiers by WiFi network (SSID) at Aruba Instant On venues.
 *
 * Run: node scripts/test-aruba-ssid-tiers.mjs
 *
 * Backend half: cloud-guest `tests/unit/test_ssid_speed_tiers.py` (SSID parse,
 * entitlement matrix, RADIUS gate, MikroTik/Omada untouched).
 *
 *   1. PURE. `lib/ssid-tiers.ts`: wire mapping both ways, the draft
 *      validation, speed wording, and the portal verdict (needs-pass only for
 *      a mapped paid network without a pass; any missing answer proceeds).
 *   2. CAPTURE. Instant On sends the SSID as `network` (never `essid`):
 *      `captureArubaRedirect` fills `essid` from it, the URL value wins, and
 *      the portal search schema declares it.
 *   3. WIRING. Source checks: the success page asks before the Aruba POST and
 *      only on the Aruba branch; Access Rules mounts the section only at a
 *      NAS-only venue; the copy never promises a per-guest speed.
 */
import { build } from "esbuild";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");

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

const work = join(ROOT, "node_modules", ".cache", "aruba-ssid-tiers");
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

const T = await bundle("src/lib/ssid-tiers.ts", "ssid-tiers.mjs");
const LOGIN = await bundle("src/lib/portal-aruba-login.ts", "login.mjs");
const SEARCH = await bundle("src/lib/portal-search.ts", "portal-search.mjs");

// ---------------------------------------------------------------------------
console.log("\n1. pure: wire mapping");
{
  const view = T.toSsidTiersView({
    items: [
      {
        ssid: "WYFY_FREE",
        tier_name: "Free",
        requires_entitlement: false,
        policy_id: null,
        voucher_plan_ids: [],
        download_mbps: 5,
        upload_mbps: 2,
      },
      {
        ssid: "WYFY_PREMIUM",
        tier_name: "Premium",
        requires_entitlement: true,
        policy_id: "p-1",
        voucher_plan_ids: ["v-1", 7],
        download_mbps: 50,
        upload_mbps: null,
      },
    ],
    note: "n",
    instant_on_manual_steps: ["step 1", 2],
    instant_on_push_enabled: false,
  });
  eq("two rows", view.items.length, 2);
  eq("free row", view.items[0], {
    ssid: "WYFY_FREE",
    tierName: "Free",
    paidOnly: false,
    policyId: null,
    voucherPlanIds: [],
    downloadMbps: 5,
    uploadMbps: 2,
  });
  eq("paid row keeps tier + string plan ids only", view.items[1].voucherPlanIds, ["v-1"]);
  check("paid row is paidOnly", view.items[1].paidOnly === true);
  eq("manual steps: strings only", view.manualSteps, ["step 1"]);
  eq("push flag off", view.pushEnabled, false);
  const empty = T.toSsidTiersView(null);
  eq("null view is empty", empty.items, []);
  eq("null view keeps the honest note", empty.note, T.ONE_SPEED_PER_NETWORK);

  const body = T.toSsidTiersBody([
    { ...view.items[0], ssid: " WYFY_FREE ", policyId: "stale", voucherPlanIds: ["x"] },
    view.items[1],
  ]);
  eq("body: open row never carries a tier or plans", body.items[0], {
    ssid: "WYFY_FREE",
    tier_name: "Free",
    requires_entitlement: false,
    policy_id: null,
    voucher_plan_ids: [],
    download_mbps: 5,
    upload_mbps: 2,
  });
  eq("body: paid row carries its tier", body.items[1].policy_id, "p-1");
  eq("body: paid flag", body.items[1].requires_entitlement, true);
}

console.log("\n1b. pure: validation and wording");
{
  const row = (o = {}) => ({ ...T.emptySsidTier(), ssid: "A", tierName: "t", ...o });
  eq("clean", T.ssidTiersProblem([row()]), null);
  check("no name", /needs a WiFi network name/.test(T.ssidTiersProblem([row({ ssid: " " })])));
  check("too long", /32 characters/.test(T.ssidTiersProblem([row({ ssid: "x".repeat(33) })])));
  check("duplicate any case", /listed twice/.test(T.ssidTiersProblem([row(), row({ ssid: "a" })])));
  check("no tier name", /Give the tier/.test(T.ssidTiersProblem([row({ tierName: "" })])));
  check("0 Mbps", /whole number/.test(T.ssidTiersProblem([row({ downloadMbps: 0 })])));
  check("1001 Mbps", /whole number/.test(T.ssidTiersProblem([row({ uploadMbps: 1001 })])));
  check("NaN Mbps", /whole number/.test(T.ssidTiersProblem([row({ downloadMbps: NaN })])));
  check("2.5 Mbps", /whole number/.test(T.ssidTiersProblem([row({ downloadMbps: 2.5 })])));
  eq("1..1000 ok", T.ssidTiersProblem([row({ downloadMbps: 1, uploadMbps: 1000 })]), null);
  check(
    "max rows",
    /At most 8/.test(
      T.ssidTiersProblem(Array.from({ length: 9 }, (_, i) => row({ ssid: `S${i}` }))),
    ),
  );
  eq("speed both", T.formatTierSpeed(5, 2), "5 Mbps down / 2 Mbps up");
  eq("speed none", T.formatTierSpeed(null, null), "No speed cap");
  eq("speed down only", T.formatTierSpeed(50, null), "50 Mbps down");
  check("one speed per network copy", /one speed for all its guests/.test(T.ONE_SPEED_PER_NETWORK));
}

console.log("\n1c. pure: portal verdict");
{
  const access = (o = {}) =>
    T.toGuestSsidAccess({
      ssid: "WYFY_PREMIUM",
      mapped: true,
      requires_entitlement: true,
      entitled: false,
      tier_name: "Premium",
      download_mbps: 50,
      upgrade_networks: [],
      paid_networks: [{ ssid: "WYFY_PREMIUM", tier_name: "Premium", download_mbps: 50 }],
      ...o,
    });
  const v = T.portalSsidVerdict(access());
  eq("free guest on premium -> needs-pass", v.kind, "needs-pass");
  eq("needs-pass names the network", v.network.ssid, "WYFY_PREMIUM");
  check("title names the tier", T.needsPassTitle(v.network).includes("Premium"));
  check(
    "body offers the voucher and the free network",
    /voucher/.test(T.needsPassBody(v.network)) && /free WiFi/.test(T.needsPassBody(v.network)),
  );
  check("body states the speed", T.needsPassBody(v.network).includes("50 Mbps"));
  eq(
    "entitled on premium -> proceed",
    T.portalSsidVerdict(access({ entitled: true })).kind,
    "proceed",
  );
  eq(
    "open network -> proceed",
    T.portalSsidVerdict(access({ requires_entitlement: false })).kind,
    "proceed",
  );
  eq("unmapped -> proceed", T.portalSsidVerdict(access({ mapped: false })).kind, "proceed");
  eq("no answer -> proceed", T.portalSsidVerdict(null).kind, "proceed");
  eq("garbage answer -> null", T.toGuestSsidAccess("nope"), null);
  eq(
    "missing `entitled` fails open",
    T.portalSsidVerdict(access({ entitled: undefined })).kind,
    "proceed",
  );
  const up = T.portalSsidVerdict(
    access({
      ssid: "WYFY_FREE",
      requires_entitlement: false,
      entitled: true,
      upgrade_networks: [{ ssid: "WYFY_PREMIUM", tier_name: "Premium", download_mbps: 50 }],
    }),
  );
  eq("voucher holder on free -> proceed with upgrade", up.upgrade.length, 1);
  check(
    "upgrade hint says join WYFY_PREMIUM",
    /join “WYFY_PREMIUM”/.test(T.upgradeHint(up.upgrade)) &&
      T.upgradeHint(up.upgrade).includes("50 Mbps"),
  );
  eq("no upgrade -> no hint", T.upgradeHint([]), null);
}

// ---------------------------------------------------------------------------
console.log("\n2. capture: Instant On's `network`");
{
  const cap = LOGIN.captureArubaRedirect({
    network: "WYFY_PREMIUM",
    post: "captive-2022.aio.cloudauth.net",
  });
  eq("network -> essid", cap.essid, "WYFY_PREMIUM");
  eq("post -> switchip still", cap.switchip, "captive-2022.aio.cloudauth.net");
  eq("an explicit essid wins", LOGIN.captureArubaRedirect({ essid: "A", network: "B" }).essid, "A");
  eq(
    "swallowed network recovered",
    LOGIN.captureArubaRedirect({}, { network: "WYFY_FREE" }).essid,
    "WYFY_FREE",
  );
  eq("no network -> no essid", LOGIN.captureArubaRedirect({}).essid, undefined);
  check(
    "portal search schema declares `network`",
    SEARCH.portalSearchSchema && "network" in SEARCH.portalSearchSchema.shape,
  );
}

// ---------------------------------------------------------------------------
console.log("\n3. wiring");
{
  const success = src("src/routes/portal.success.tsx");
  const fn = success.slice(success.indexOf("function submitArubaLogin()"));
  const body = fn.slice(0, fn.indexOf("\n  }\n"));
  const ask = body.indexOf("fetchGuestSsidAccess(");
  const post = body.indexOf("submitTopLevelForm(");
  check("the Aruba branch asks", ask > 0);
  check("it asks BEFORE the login POST", ask > 0 && post > ask);
  check("it asks once per session", /ssidChecked\.current !== sessionId/.test(body));
  check("only the Aruba branch asks", success.split("fetchGuestSsidAccess(").length === 2);
  check("needs-pass screen rendered", /<SsidNeedsPassScreen/.test(success));
  check("upgrade hint rendered", /<SsidUpgradeHintScreen/.test(success));

  const screens = src("src/components/portal-runtime/SsidTierScreens.tsx");
  check(
    "needs-pass screen offers the voucher route",
    /params=\{\{ method: "voucher" \}\}/.test(screens),
  );

  const svc = src("src/services/ssid-tiers.service.ts");
  check("portal call fails open (returns null on error)", /catch \{\s*return null;/.test(svc));
  check(
    "portal call uses the guest API, not the staff API",
    /guestPortalApi\.post\(\s*"\/guest\/ssid-access"/.test(svc),
  );

  const hub = src("src/components/features/PoliciesHub.tsx");
  check(
    "Access Rules mounts the section only at a NAS-only venue",
    /isNasOnlyVendor\(vendor\) && tiersLocationId/.test(hub),
  );

  const ui = src("src/components/features/SsidSpeedTiers.tsx");
  check("UI states one speed per network", /ONE_SPEED_PER_NETWORK/.test(ui));
  check("UI lists manual Instant On steps", /Set these speeds in the Instant On app/.test(ui));
  check(
    "push buttons only for a platform session",
    /isPlatform && data && data\.items\.length > 0/.test(ui),
  );
  check(
    "apply disabled while the flag is off",
    /disabled=\{push\.isPending \|\| !data\.pushEnabled\}/.test(ui),
  );
  const lib = src("src/lib/ssid-tiers.ts");
  check(
    "no copy promises a per-guest speed",
    !/(set|give) (each|a) guest('s)? (own )?speed/i.test(ui + lib),
  );
}

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba ssid tiers: all checks passed"
    : `aruba ssid tiers: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
