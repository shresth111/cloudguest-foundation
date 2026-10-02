/**
 * Aruba Instant On (AP21 / AP-503): vendor gating, customer guardrails, the
 * Master setup contract and the guest portal's login submit -- the pure
 * halves. The Master panel itself is rendered in Chromium by
 * `scripts/test-aruba-setup-panel.mjs`.
 *
 * Spec: ~/wyfy-ops/aruba-ap21/PM_SPEC.md §0 (Wave 1) and §3/§4 (the
 * per-screen truth table and copy IDs), API_CONTRACT.md (the backend shapes).
 *
 * WHAT THIS GUARDS, in order of how badly a regression would hurt:
 *
 *   1. MIKROTIK AND OMADA ARE UNCHANGED (PM_SPEC AC1-8). Asserted positively,
 *      first: every helper that grew an Aruba branch still returns the Omada
 *      sentence byte-for-byte, and a MikroTik venue's controls are all live.
 *   2. NO CONTROL IS SILENTLY LIVE AT AN ARUBA VENUE (AC1-7). Speed, per-guest
 *      disconnect / device block / speed and the network/security screens are
 *      `unavailable` with the spec's copy (U0/U1/U2/U6/U7/U8), never a
 *      controller sentence that says "we could not reach it".
 *   3. NO "OFFLINE" FOR AN ARUBA ROW (§0.4 item 5). `no_controller_api` is
 *      "Set up in Instant On", tone neutral, never a fault -- with or without
 *      the backend's `controller_state`.
 *   4. THE PORTAL NEVER POSTS A GUEST IDENTIFIER TO AN UNTRUSTED HOST (AC1-6).
 *      `switchip` comes off a query string anyone can type.
 *   5. THE SETUP CONTRACT IS READ AS THE BACKEND WRITES IT, and the secret is
 *      never on the status read.
 *
 * Run: node scripts/test-aruba-instant-on.mjs
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
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// Bundled into the repo's own node_modules so `zod` and
// `@tanstack/react-router` resolve to the installed copies.
const work = join(ROOT, "node_modules", ".cache", "aruba-instant-on");
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

const RV = await bundle("src/lib/router-vendors.ts", "router-vendors.mjs");
const CC = await bundle("src/lib/omada-client-controls.ts", "client-controls.mjs");
const LL = await bundle("src/lib/location-liveness.ts", "location-liveness.mjs");
const SETUP = await bundle("src/lib/aruba-instant-on-setup.ts", "setup.mjs");
const LOGIN = await bundle("src/lib/portal-aruba-login.ts", "login.mjs");
const SEARCH = await bundle("src/lib/portal-search.ts", "portal-search.mjs");
const VENUE = await bundle("src/lib/aruba-venue.ts", "aruba-venue.mjs");
const VERDICTS = await bundle("src/lib/connection-verdicts.ts", "connection-verdicts.mjs");

const ARUBA = "aruba_instant_on";
const OMADA = "tplink_omada";
const src = (p) => readFileSync(join(ROOT, p), "utf8");

// U-copy, verbatim from PM_SPEC §4.
const U0 =
  "Your WiFi runs on Aruba Instant On access points. This is set up in the Instant On app, not here.";
const U1 =
  "Speed limits for Aruba Instant On are set in the Instant On app, on the guest network. Wyfy can't change them.";
const U2 =
  "Wyfy can't disconnect a device from Aruba Instant On access points. The guest stays online until their session time runs out.";
const U2_BLOCK =
  "Blocking stops this person signing in again. If they're online right now, they stay online until their session ends.";
const U6 =
  "Traffic charts need a Wyfy-managed router. Your Aruba access points report guest sign-ins, not traffic.";
const U7 =
  "Websites guests can open before signing in are set in the Instant On app, under Guest portal > Allowed domains.";
const U8 =
  "Aruba Instant On can't let devices skip the sign-in page, so trusted devices aren't available here.";

// ---------------------------------------------------------------------------
console.log("\n1. Omada and MikroTik are unchanged (AC1-8)");
// ---------------------------------------------------------------------------
eq(
  "Omada's gated-screen reason is the same sentence",
  RV.controllerVenueFeatureReason(OMADA),
  RV.controllerVenueFeatureReason("TPLINK_OMADA"),
);
check(
  "Omada's gated-screen reason still names its controller",
  /a TP-Link Omada controller/.test(RV.controllerVenueFeatureReason(OMADA)) &&
    !/Instant On|Aruba/.test(RV.controllerVenueFeatureReason(OMADA)),
);
eq(
  "Omada's headline is the old constant",
  RV.controllerUnsupportedHeadline(OMADA, "vlans"),
  RV.CONTROLLER_UNSUPPORTED_HEADLINE,
);
eq(
  "Omada's panel body is the same with or without the vendor argument",
  RV.controllerUnsupportedCopy("vlans", "Seaside", OMADA),
  RV.controllerUnsupportedCopy("vlans", "Seaside"),
);
eq(
  "Omada has no copy for whitelist/mac-auth (they are live there)",
  RV.controllerUnsupportedCopy("whitelist", "Seaside", OMADA),
  null,
);
for (const id of ["whitelist", "mac-auth", "reports", "network-activity", "isp-details"]) {
  check(
    `Omada venue keeps "${id}"`,
    RV.featureAppliesToControllerVenue(id, OMADA) === true &&
      RV.featureAppliesToControllerVenue(id) === true,
  );
}
for (const id of RV.CONTROLLER_UNSUPPORTED_FEATURE_IDS) {
  check(`Omada venue still loses "${id}"`, RV.featureAppliesToControllerVenue(id, OMADA) === false);
}
eq(
  "Omada's identity sentence is unchanged",
  RV.controllerIdentitySentence("Lobby", OMADA),
  "Lobby is a TP-Link Omada controller.",
);
check(
  "one excluded Omada row keeps the Omada sentence",
  /TP-Link Omada controller/.test(RV.excludedControllerRoutersNote([{ vendor: OMADA }])),
);
check(
  "a mixed Omada + Aruba list keeps the Omada sentence",
  /TP-Link Omada/.test(RV.excludedControllerRoutersNote([{ vendor: OMADA }, { vendor: ARUBA }])),
);
check(
  "Omada device-metrics reason unchanged",
  /TP-Link Omada controller/.test(RV.controllerDeviceMetricsReason(OMADA)),
);
eq("mikrotik is not controller-managed", RV.isControllerManaged("mikrotik"), false);
eq("omada is not NAS-only", RV.isNasOnlyVendor(OMADA), false);
eq("mikrotik is not NAS-only", RV.isNasOnlyVendor("mikrotik"), false);
eq("the `aruba` stub is NOT Instant On", RV.isNasOnlyVendor("aruba"), false);
eq("the `aruba` stub is not controller-managed", RV.isControllerManaged("aruba"), false);
for (const s of ["not_registered", "credentials_rejected", "unreachable"]) {
  eq(`"${s}" is still a fault`, RV.controllerStateIsFault(s), true);
}
eq('"reachable" is still not a fault', RV.controllerStateIsFault("reachable"), false);

const MIKROTIK_VENUE = { controllerManaged: false, vendor: null, capabilities: null };
for (const c of CC.CLIENT_CONTROL_IDS) {
  const v = CC.clientControlVerdict(c, MIKROTIK_VENUE);
  check(`MikroTik ${c}: available, no reason`, v.availability === "available" && v.reason === null);
}
for (const a of ["block", "unblock", "speed", "speed-clear"]) {
  eq(
    `MikroTik device ${a}: available`,
    CC.deviceActionVerdict(a, MIKROTIK_VENUE).availability,
    "available",
  );
}
// An Omada venue we could not ask: the ladder's own "we could not ask" answer,
// never the Aruba sentences.
const OMADA_UNKNOWN = { controllerManaged: true, vendor: OMADA, capabilities: null };
for (const c of CC.CLIENT_CONTROL_IDS) {
  const v = CC.clientControlVerdict(c, OMADA_UNKNOWN);
  check(
    `Omada ${c} never borrows Aruba copy`,
    !/Instant On|Aruba/.test(v.reason ?? ""),
    v.reason ?? "",
  );
}

// ---------------------------------------------------------------------------
console.log("\n2. Aruba Instant On is a controller-managed, NAS-only vendor");
// ---------------------------------------------------------------------------
eq("vendor string", RV.ARUBA_INSTANT_ON_VENDOR, ARUBA);
eq("controller-managed", RV.isControllerManaged(ARUBA), true);
eq("NAS-only", RV.isNasOnlyVendor(ARUBA), true);
eq(
  "NAS-only is case-insensitive like isControllerManaged",
  RV.isNasOnlyVendor("Aruba_Instant_On"),
  true,
);
eq("not agent-managed", RV.isAgentManaged(ARUBA), false);
eq("label", RV.routerVendorLabel(ARUBA), "Aruba Instant On");
check(
  "Master can select it (SUPPORTED_ROUTER_VENDORS twin)",
  RV.SELECTABLE_DEVICE_VENDORS.some((v) => v.value === ARUBA && v.label === "Aruba Instant On"),
);
check(
  "selectable vendors are exactly mikrotik, omada, aruba_instant_on",
  JSON.stringify(RV.SELECTABLE_DEVICE_VENDORS.map((v) => v.value)) ===
    JSON.stringify(["mikrotik", OMADA, ARUBA]),
  JSON.stringify(RV.SELECTABLE_DEVICE_VENDORS),
);
eq(
  'identity sentence: "uses ... access points", never "is a Aruba"',
  RV.controllerIdentitySentence("Lobby", ARUBA),
  "Lobby uses Aruba Instant On access points.",
);

// ---------------------------------------------------------------------------
console.log("\n3. Customer screens greyed with the spec's copy (AC1-7)");
// ---------------------------------------------------------------------------
eq("U0 / U9: generic gated-screen reason", RV.controllerVenueFeatureReason(ARUBA), U0);
for (const id of [...RV.CONTROLLER_UNSUPPORTED_FEATURE_IDS, "whitelist", "mac-auth"]) {
  eq(`"${id}" is greyed at an Aruba venue`, RV.featureAppliesToControllerVenue(id, ARUBA), false);
}
for (const id of ["reports", "network-activity", "isp-details", "vouchers", "portal", "users"]) {
  eq(`"${id}" stays live at an Aruba venue`, RV.featureAppliesToControllerVenue(id, ARUBA), true);
}
check(
  "the six network/security panels open with U0 verbatim",
  RV.CONTROLLER_UNSUPPORTED_FEATURE_IDS.every((id) =>
    (RV.controllerUnsupportedCopy(id, "Office", ARUBA) ?? "").startsWith(U0),
  ),
);
check(
  "and never say Omada or controller",
  RV.CONTROLLER_UNSUPPORTED_FEATURE_IDS.every(
    (id) => !/Omada|controller/i.test(RV.controllerUnsupportedCopy(id, "Office", ARUBA) ?? ""),
  ),
);
eq("U7: Guest Allow-list", RV.controllerUnsupportedCopy("whitelist", "Office", ARUBA), U7);
eq("U8: Trusted Devices", RV.controllerUnsupportedCopy("mac-auth", "Office", ARUBA), U8);
eq(
  "Trusted Devices headline does not say 'set up in the app' (Instant On has no MAC auth)",
  RV.controllerUnsupportedHeadline(ARUBA, "mac-auth"),
  "Not available with Aruba Instant On.",
);
eq(
  "other headlines name the app",
  RV.controllerUnsupportedHeadline(ARUBA, "vlans"),
  "Set up in the Instant On app, not here.",
);
eq("U6: traffic charts", RV.controllerDeviceMetricsReason(ARUBA), U6);
check(
  "device-write reason names the app, not a controller",
  /Instant On app/.test(RV.controllerRouterDeviceWriteReason(ARUBA)) &&
    !/controller/.test(RV.controllerRouterDeviceWriteReason(ARUBA)),
);
check(
  "excluded-routers note for an Aruba-only venue",
  /Aruba Instant On access point/.test(RV.excludedControllerRoutersNote([{ vendor: ARUBA }])),
);
check(
  "no customer copy says RADIUS, NAS, tunnel, WireGuard or secret",
  [
    U0,
    RV.controllerUnsupportedCopy("vlans", "Office", ARUBA),
    RV.controllerDeviceMetricsReason(ARUBA),
    RV.controllerRouterDeviceWriteReason(ARUBA),
    RV.CONTROLLER_STATE_COPY.no_controller_api.sentence,
    RV.CONTROLLER_STATE_NEXT_STEP.no_controller_api,
    CC.NAS_ONLY_SPEED,
    CC.NAS_ONLY_DISCONNECT,
    CC.NAS_ONLY_BLOCK_SIGNIN,
    CC.NAS_ONLY_SESSION_TIMEOUT,
  ].every((s) => !/RADIUS|\bNAS\b|tunnel|WireGuard|secret/i.test(s)),
);

const ARUBA_VENUE = {
  controllerManaged: true,
  vendor: ARUBA,
  capabilities: null,
  controller: null,
};
const v = (c) => CC.clientControlVerdict(c, ARUBA_VENUE);
eq("Bandwidth (speed-limit): unavailable", v("speed-limit").availability, "unavailable");
eq("Bandwidth reason is U1", v("speed-limit").reason, U1);
eq("Access-tier speed: unavailable, U1", v("speed-profile").reason, U1);
eq("Disconnect: unavailable", v("disconnect").availability, "unavailable");
eq("Disconnect reason is U2", v("disconnect").reason, U2);
eq("Block on the network: unavailable, U2", v("block-device").reason, U2);
eq("Block sign-in: qualified (our own record)", v("block-signin").availability, "qualified");
eq("Block sign-in reason is U2's block sentence", v("block-signin").reason, U2_BLOCK);
eq("Session timeout: qualified until V1", v("session-timeout").availability, "qualified");
check(
  "session-timeout caveat says the AP drop is unconfirmed",
  /hasn't been confirmed/.test(v("session-timeout").reason ?? ""),
);
check(
  "no control at an Aruba venue is plain `available`",
  CC.CLIENT_CONTROL_IDS.every((c) => v(c).availability !== "available" && !!v(c).reason),
);
check(
  "the verdict does not depend on a capabilities read (none is ever made)",
  CC.CLIENT_CONTROL_IDS.every(
    (c) =>
      JSON.stringify(CC.clientControlVerdict(c, { ...ARUBA_VENUE, capabilities: undefined })) ===
      JSON.stringify(v(c)),
  ),
);
for (const a of ["block", "unblock", "speed", "speed-clear"]) {
  const d = CC.deviceActionVerdict(a, ARUBA_VENUE);
  check(
    `per-device ${a}: unavailable with ${a.startsWith("speed") ? "U1" : "U2"}`,
    d.availability === "unavailable" && d.reason === (a.startsWith("speed") ? U1 : U2),
    JSON.stringify(d),
  );
}

// ---------------------------------------------------------------------------
console.log("\n4. Never Offline: the `no_controller_api` state (§0.4 item 5, §2.3)");
// ---------------------------------------------------------------------------
const NOW = new Date("2026-10-02T10:00:00Z");
const copy = RV.CONTROLLER_STATE_COPY.no_controller_api;
eq("label", copy.label, "Set up in Instant On");
eq("tone", copy.tone, "neutral");
eq(
  "sentence",
  copy.sentence,
  "This venue's access points are managed in Aruba's Instant On app. Wyfy doesn't see their status directly. It sees guests signing in.",
);
eq(
  "next step",
  RV.CONTROLLER_STATE_NEXT_STEP.no_controller_api,
  "Nothing to do here. To change the WiFi name, password or speed, use the Instant On app.",
);
eq("not a fault", RV.controllerStateIsFault("no_controller_api"), false);
eq("a recognised controller state", RV.isControllerState("no_controller_api"), true);

const row = (over) => ({
  id: "r-aruba",
  name: "Aruba AP21 VNV5M1K1M6",
  status: "pending_provisioning",
  last_seen_at: null,
  vendor: ARUBA,
  ...over,
});
for (const [what, raw] of [
  ["declared by the backend", row({ controller_state: "no_controller_api" })],
  ["not declared (older backend)", row({})],
  ["status offline, never seen", row({ status: "offline" })],
]) {
  const r = LL.deriveRouterLiveness(raw, NOW);
  check(
    `${what}: "Set up in Instant On", not-applicable, never a fail`,
    r.shortLabel === "Set up in Instant On" && r.state === "not-applicable" && r.status !== "fail",
    JSON.stringify({ s: r.shortLabel, st: r.state, status: r.status }),
  );
  check(
    `${what}: no Offline / Never checked in / Last seen: never`,
    !/offline|never checked in|last seen: never/i.test(
      `${r.shortLabel} ${r.detail} ${r.nextStep ?? ""}`,
    ),
    r.detail,
  );
  check(
    `${what}: "uses Aruba Instant On access points", not "is a Aruba"`,
    r.detail.includes("uses Aruba Instant On access points") && !/is a Aruba/.test(r.detail),
    r.detail,
  );
}
const venue = LL.deriveLocationLiveness([row({ controller_state: "no_controller_api" })], NOW);
eq("an Aruba-only venue is controller-managed", LL.locationIsControllerManaged(venue), true);
eq("and its vendor is read back for copy", LL.locationControllerVendor(venue), ARUBA);
check(
  "the venue label is not Offline",
  !/offline/i.test(`${venue.label} ${venue.summary}`),
  `${venue.label} / ${venue.summary}`,
);
const omadaRow = LL.deriveRouterLiveness(
  { id: "o", name: "OC200", status: "pending_provisioning", last_seen_at: null, vendor: OMADA },
  NOW,
);
check(
  "an Omada row with no state still points at its integration (unchanged)",
  /is a TP-Link Omada controller/.test(omadaRow.detail) && omadaRow.shortLabel !== copy.label,
  omadaRow.detail,
);
const evidence = LL.deriveRouterLiveness(
  row({ last_seen_at: "2026-10-02T09:59:00Z", routeros_version: "7.15", status: "online" }),
  NOW,
);
check(
  "evidence beats the label: an Aruba-labelled row with agent heartbeats is judged as an agent",
  evidence.state !== "not-applicable",
  evidence.state,
);

// ---------------------------------------------------------------------------
console.log("\n5. Master setup contract (API_CONTRACT §2-§4)");
// ---------------------------------------------------------------------------
const PORTAL = {
  url: "https://auth.wyfyguest.com/portal?organizationId=o&locationId=l&routerId=r&netProvider=aruba_instant_on&portalMode=radius",
  server_host: "auth.wyfyguest.com",
  server_url_path:
    "/portal?organizationId=o&locationId=l&routerId=r&netProvider=aruba_instant_on&portalMode=radius",
  server_port: 443,
  use_https: true,
};
const READY = {
  router_id: "r",
  vendor: ARUBA,
  vendor_label: "Aruba Instant On",
  serial_number: "VNV5M1K1M6",
  mac_address: "54:F0:B1:C8:A9:0A",
  registered: true,
  nas_id: "nas-1",
  nas_identifier: "cg-aruba-1a2b3c4d",
  nas_ip: "203.0.113.10",
  nas_status: "active",
  secret_fingerprint: "82fca06b91e3",
  secret_length: 32,
  hub_confirmed: true,
  radius_server: { host: "198.51.100.7", auth_port: 1812, accounting_port: 1813 },
  allowed_domains: ["auth.wyfyguest.com", "api.wyfyguest.com"],
  portal_url: PORTAL,
  gaps: [],
};
const s = SETUP.toArubaSetupStatus(READY);
eq("nas id", s.nasId, "nas-1");
eq("identifier", s.nasIdentifier, "cg-aruba-1a2b3c4d");
eq("fingerprint", s.secretFingerprint, "82fca06b91e3");
eq("secret length", s.secretLength, 32);
eq("radius host", s.radiusServer?.host, "198.51.100.7");
eq("acct port", s.radiusServer?.accountingPort, 1813);
eq("portal host box", s.portalUrl?.serverHost, "auth.wyfyguest.com");
eq("portal path box keeps the query", s.portalUrl?.serverUrlPath, PORTAL.server_url_path);
eq("portal port box", s.portalUrl?.serverPort, 443);
eq(
  "allowed domains from the backend",
  s.allowedDomains.join(","),
  "auth.wyfyguest.com,api.wyfyguest.com",
);
check("the status shape has no secret field", !("sharedSecret" in s) && !("shared_secret" in s));
eq("ready", SETUP.arubaSetupIsReady(s), true);
eq(
  "not ready with a gap, even if a URL leaked onto the response",
  SETUP.arubaSetupIsReady(SETUP.toArubaSetupStatus({ ...READY, gaps: ["hub_not_confirmed"] })),
  false,
);
eq(
  "not ready without a portal URL",
  SETUP.arubaSetupIsReady(SETUP.toArubaSetupStatus({ ...READY, portal_url: null })),
  false,
);
eq(
  "not ready when not registered",
  SETUP.arubaSetupIsReady(SETUP.toArubaSetupStatus({ ...READY, registered: false })),
  false,
);
eq(
  "not ready without the hub's RADIUS address",
  SETUP.arubaSetupIsReady(SETUP.toArubaSetupStatus({ ...READY, radius_server: null })),
  false,
);
for (const code of [
  "not_nas_only_vendor",
  "no_location",
  "nas_not_registered",
  "hub_not_confirmed",
  "radius_server_address_not_configured",
]) {
  check(`gap "${code}" has ops wording`, SETUP.describeArubaSetupGap(code) !== code);
}
eq(
  "an unknown gap is shown as itself, not dropped",
  SETUP.describeArubaSetupGap("new_gap"),
  "new_gap",
);

const reg = SETUP.toArubaRegistration({
  router_id: "r",
  nas_id: "nas-1",
  vendor: ARUBA,
  nas_identifier: "cg-aruba-1a2b3c4d",
  nas_ip: "203.0.113.10",
  shared_secret: "A".repeat(32),
  secret_fingerprint: "abcdef012345",
  secret_length: 32,
  hub_confirmed: true,
  rotated: false,
  portal_url: PORTAL,
});
eq("register: secret read once", reg.sharedSecret, "A".repeat(32));
eq("register: not a rotation", reg.rotated, false);
const rot = SETUP.toArubaRegistration({
  id: "nas-1",
  nas_identifier: "cg-aruba-1a2b3c4d",
  ip_address: "203.0.113.10",
  shared_secret: "B".repeat(32),
  device_action_required: true,
  device_action:
    "Guest WiFi at this venue is DOWN until this secret is entered in the Instant On app.",
});
eq("rotate: nas id from the NAS row's `id`", rot.nasId, "nas-1");
eq("rotate: ip from `ip_address`", rot.nasIp, "203.0.113.10");
eq("rotate: flagged as a rotation", rot.rotated, true);
check(
  "rotate: the backend's own device-action sentence",
  /DOWN until/.test(rot.deviceAction ?? ""),
);
eq("rotate: length falls back to the secret's", rot.secretLength, 32);

for (const [ip, want] of [
  ["", "empty"],
  ["10.0.0.5", "private"],
  ["192.168.1.135", "private"],
  ["172.16.0.1", "private"],
  ["100.64.0.1", "private"],
  ["100.127.255.254", "private"],
  ["127.0.0.1", "private"],
  ["169.254.1.1", "private"],
  ["224.0.0.1", "private"],
  ["auth.wyfyguest.com", "not-ipv4"],
  ["203.0.113.300", "not-ipv4"],
  ["203.0.113.10/32", "not-ipv4"],
  ["103.227.71.205", null],
  [" 13.201.253.36 ", null],
  ["100.128.0.1", null],
]) {
  eq(`venue IP ${JSON.stringify(ip)}`, SETUP.checkVenuePublicIp(ip), want);
}
eq(
  "the private-IP sentence is PM_SPEC §4's",
  SETUP.PUBLIC_IP_PROBLEM_COPY.private,
  "That's a private address. Use the venue's public IP, measured from a phone on the venue WiFi.",
);
eq("the Instant On RADIUS profile name", SETUP.ARUBA_RADIUS_PROFILE_NAME, "Wyfy Guest");

// ---------------------------------------------------------------------------
console.log("\n6. Portal: the Aruba login submit (UNVERIFIED contract, RECON §3/§7)");
// ---------------------------------------------------------------------------
eq("provider string matches the vendor", LOGIN.ARUBA_INSTANT_ON_PROVIDER, ARUBA);
eq("netProvider=aruba_instant_on is Aruba", LOGIN.isArubaInstantOnProvider(ARUBA), true);
for (const p of ["omada", undefined, null, "", "aruba", "ARUBA_INSTANT_ON"]) {
  eq(`netProvider ${JSON.stringify(p)} is not Aruba`, LOGIN.isArubaInstantOnProvider(p), false);
}
for (const host of [
  "securelogin.arubanetworks.com",
  "captiveportal-login.arubainstanton.com",
  "captive-2022.aio.cloudauth.net",
  "captive-2019.aio.cloudauth.net",
  "SECURELOGIN.ARUBANETWORKS.COM.",
]) {
  const t = LOGIN.arubaLoginTarget(host);
  check(
    `trusted ${host} -> https://<host>${LOGIN.ARUBA_LOGIN_PATH}`,
    "url" in t &&
      t.url === `https://${host.toLowerCase().replace(/\.$/, "")}${LOGIN.ARUBA_LOGIN_PATH}`,
    JSON.stringify(t),
  );
}
const viaUrl = LOGIN.arubaLoginTarget("https://captive-2022.aio.cloudauth.net/swarm.cgi?x=1");
check(
  "a URL-shaped switchip keeps only its hostname; path and scheme are ours",
  "url" in viaUrl &&
    viaUrl.url === `https://captive-2022.aio.cloudauth.net${LOGIN.ARUBA_LOGIN_PATH}`,
  JSON.stringify(viaUrl),
);
for (const [bad, why] of [
  [undefined, "no-switchip"],
  ["", "no-switchip"],
  ["   ", "no-switchip"],
  ["evil.example.com", "untrusted-host"],
  ["securelogin.arubanetworks.com.evil.example.com", "untrusted-host"],
  ["captive-20xx.aio.cloudauth.net", "untrusted-host"],
  ["192.168.1.135", "untrusted-host"],
  ["13.201.253.36", "untrusted-host"],
  ["securelogin.arubanetworks.com:8443", "untrusted-host"],
  ["securelogin.arubanetworks.com/../x", "untrusted-host"],
  ["user@securelogin.arubanetworks.com", "untrusted-host"],
  ["https://evil.example.com/securelogin.arubanetworks.com", "untrusted-host"],
  ["javascript:alert(1)", "untrusted-host"],
  [12345, "untrusted-host"],
]) {
  const t = LOGIN.arubaLoginTarget(bad);
  check(
    `refused ${JSON.stringify(bad)} (${why}) -- nothing to POST to`,
    "refused" in t && t.refused === why && !("url" in t),
    JSON.stringify(t),
  );
}
const fields = LOGIN.buildArubaLoginFields({
  identifier: "+919876543210",
  password: "welcome123",
  destination: "https://example.com/",
});
eq(
  "login fields: cmd=authenticate, user, password, url -- in that order",
  JSON.stringify(fields),
  JSON.stringify([
    ["cmd", "authenticate"],
    ["user", "+919876543210"],
    ["password", "welcome123"],
    ["url", "https://example.com/"],
  ]),
);
const sw = LOGIN.splitSwallowedQuery("aruba_instant_on?cmd=login");
eq("a second `?` swallowed into netProvider is split back out", sw.value, ARUBA);
eq("and the swallowed key is recovered", sw.recovered.cmd, "login");
for (const plain of ["omada", ARUBA, undefined]) {
  const r = LOGIN.splitSwallowedQuery(plain);
  check(
    `no \`?\` -> identity (${JSON.stringify(plain)})`,
    r.value === plain && Object.keys(r.recovered).length === 0,
  );
}
const cap = LOGIN.captureArubaRedirect(
  { cmd: "login", essid: 5, switchip: "captive-2022.aio.cloudauth.net", url: "http://x/" },
  { cmd: "ignored", apname: "AP21-office" },
);
eq("parsed value wins over a recovered one", cap.cmd, "login");
eq("a recovered value fills a gap", cap.apname, "AP21-office");
eq("a numeric SSID survives as a number", cap.essid, 5);
eq("and renders back to text", LOGIN.arubaText(cap.essid), "5");
check("unknown keys are not captured", !("foo" in LOGIN.captureArubaRedirect({ foo: "bar" })));

// The real search schema: what TanStack hands it after JSON-parsing values.
const parsed = SEARCH.portalSearchSchema.parse({
  organizationId: "11111111-1111-1111-1111-111111111111",
  locationId: "22222222-2222-2222-2222-222222222222",
  routerId: "33333333-3333-3333-3333-333333333333",
  netProvider: ARUBA,
  portalMode: "radius",
  cmd: "login",
  mac: "60:f4:45:0b:28:66",
  essid: "Wyfy-AP21-Test",
  ip: "192.168.1.50",
  apname: "AP21-office",
  apmac: "54:f0:b1:c8:a9:0a",
  vcname: "inhouse-office",
  switchip: "captive-2022.aio.cloudauth.net",
  url: "http://neverssl.com/",
});
for (const k of [
  "cmd",
  "essid",
  "apname",
  "apmac",
  "vcname",
  "switchip",
  "url",
  "netProvider",
  "portalMode",
]) {
  check(`schema keeps Aruba's \`${k}\``, parsed[k] !== undefined, JSON.stringify(parsed));
}
eq("client MAC flows through the existing `mac` key", parsed.mac, "60:f4:45:0b:28:66");
eq("client IP flows through the existing `ip` key", parsed.ip, "192.168.1.50");
check(
  "Aruba's keys are retained across /portal hops (derived from the schema)",
  ["cmd", "essid", "apname", "apmac", "vcname", "switchip", "url"].every((k) =>
    SEARCH.PORTAL_SEARCH_KEYS.includes(k),
  ),
);
const numericSsid = SEARCH.portalSearchSchema.parse({ netProvider: ARUBA, essid: 5, switchip: 7 });
check("a numeric essid does not throw the whole redirect away", numericSsid.essid === 5);
const junk = SEARCH.portalSearchSchema.parse({
  netProvider: ARUBA,
  essid: { a: 1 },
  switchip: "s",
});
check("a junk value drops that one key only", junk.essid === undefined && junk.switchip === "s");
check(
  "Aruba's lower-case `apmac` is a different key from Omada's `apMac`",
  SEARCH.PORTAL_SEARCH_KEYS.includes("apMac") && SEARCH.PORTAL_SEARCH_KEYS.includes("apmac"),
);

// ---------------------------------------------------------------------------
console.log("\n7. Wiring (greps): the screens read the gates, secrets stay in Master");
// ---------------------------------------------------------------------------
const success = src("src/routes/portal.success.tsx");
const arubaAt = success.indexOf("if (isArubaInstantOnProvider(netProvider))");
const omadaAt = success.indexOf('if (netProvider === "omada")');
const routerOsAt = success.indexOf("THE ROUTER'S OWN ANSWER");
check(
  "portal.success: the Aruba branch sits after Omada's and above the RouterOS guards",
  omadaAt > 0 && arubaAt > omadaAt && routerOsAt > arubaAt,
  JSON.stringify({ omadaAt, arubaAt, routerOsAt }),
);
const submitFn = success.slice(
  success.indexOf("function submitArubaLogin()"),
  success.indexOf("function failRadius("),
);
check(
  "a refused switchip ends on the failure screen before any submit",
  /if \("refused" in target\) \{\s*failRadius\("not-authorized"\);\s*return;/.test(submitFn) &&
    submitFn.indexOf('"refused" in target') < submitFn.indexOf("submitTopLevelForm("),
);
check(
  "a lost identifier ends on the failure screen, not the spinner",
  /if \(!guestIdentifier\) \{\s*failRadius\("rejected"\);\s*return;/.test(submitFn),
);
check(
  "the submit is a top-level form POST (never fetch / XHR / iframe)",
  submitFn.includes("submitTopLevelForm(") && !/fetch\(|XMLHttpRequest|iframe/.test(submitFn),
);
check(
  "the target comes only from the allowlist helper",
  submitFn.includes("arubaLoginTarget(arubaRedirect?.switchip)") && submitFn.includes("target.url"),
);
const loginLib = src("src/lib/portal-aruba-login.ts");
check(
  "portal-aruba-login.ts says plainly that the contract is unmeasured",
  /NOT YET MEASURED ON HARDWARE/.test(loginLib),
);

const hook = src("src/hooks/useClientControls.ts");
check(
  "useClientControls never asks the capabilities route for a NAS-only venue (§0.4 item 4)",
  /enabled:[\s\S]{0,200}!isNasOnlyVendor\(vendor\)/.test(hook),
);
const users = src("src/routes/users.tsx");
check(
  "Guests: Disconnect is greyed only for a NAS-only vendor",
  /const disconnectUnsupported = isNasOnlyVendor\(clientControls\.vendor\)/.test(users) &&
    /hidden=\{disconnectUnsupported\}/.test(users),
);
const featurePage = src("src/components/customer/CustomerFeaturePage.tsx");
check(
  "Allow-list and Trusted Devices are not mounted when gated",
  /feature === "whitelist" && !controllerGated/.test(featurePage) &&
    /feature === "mac-auth" && !controllerGated/.test(featurePage),
);
check(
  "the feature page passes the vendor to the gate",
  /featureAppliesToControllerVenue\(\s*feature,\s*locationControllerVendor/.test(featurePage),
);
const sidebar = src("src/components/customer/CustomerSidebar.tsx");
check(
  "the sidebar passes the vendor to the gate",
  (sidebar.match(/featureAppliesToControllerVenue\(item\.id, controllerVendor\)/g) ?? []).length ===
    2,
);

// The Master-only modules may only be imported from Master surfaces.
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(join(ROOT, "src")).filter((p) => /\.(ts|tsx)$/.test(p));
const importersOf = (needle) =>
  files
    .filter((p) => src(relative(ROOT, p)).includes(needle))
    .map((p) => relative(ROOT, p).replace(/\\/g, "/"));
const serviceUsers = importersOf("@/services/aruba-instant-on.service");
eq(
  "the Aruba Master service is imported only by the setup panel",
  JSON.stringify(serviceUsers),
  JSON.stringify(["src/components/routers/ArubaInstantOnSetupPanel.tsx"]),
);
const panelUsers = importersOf("@/components/routers/ArubaInstantOnSetupPanel");
eq(
  "the setup panel is mounted only by the Master setup drilldown",
  JSON.stringify(panelUsers),
  JSON.stringify(["src/components/routers/RouterSetupScriptAdvanced.tsx"]),
);
const setupUsers = importersOf("@/lib/aruba-instant-on-setup");
check(
  "no customer screen imports the RADIUS setup module",
  setupUsers.every((p) => !/components\/customer\/|routes\/(customer|users|portal)/.test(p)),
  JSON.stringify(setupUsers),
);
const panel = src("src/components/routers/ArubaInstantOnSetupPanel.tsx");
const service = src("src/services/aruba-instant-on.service.ts");
check(
  "the secret never touches browser storage or the query cache",
  !/localStorage|sessionStorage|setQueryData/.test(panel + service),
);
check(
  "the register request carries only nas_ip (no secret field, ever)",
  /register-public\/\$\{routerId\}`, \{\s*nas_ip: nasIp,\s*\}/.test(service) &&
    !/shared_secret\s*:/.test(service),
);
check(
  "the Master routes are the GLOBAL /platform ones from the contract",
  service.includes("/platform/radius/nas/public/") &&
    service.includes("/platform/radius/nas/register-public/") &&
    service.includes("/regenerate-secret"),
);
check(
  "the panel does not claim to open the hub firewall",
  panel.includes("This panel does not do it."),
);
check(
  "Register is gated on a public IP AND the static-IP confirmation",
  /disabled=\{!!ipProblem \|\| !staticConfirmed \|\| busy\}/.test(panel),
);
check(
  "Register warns that RADIUS restarts on the hub",
  panel.includes("This restarts RADIUS on the hub for 1 to 2 seconds"),
);
const drill = src("src/components/routers/RouterSetupScriptAdvanced.tsx");
check(
  "the drilldown dispatches MikroTik -> script, Omada -> Omada panel, Aruba -> Aruba panel",
  /vendor === "mikrotik" \?[\s\S]*RouterSetupScriptPanel[\s\S]*vendor === "tplink_omada" \?[\s\S]*OmadaGuidedSetupPanel[\s\S]*vendor === ARUBA_INSTANT_ON_VENDOR \?[\s\S]*ArubaInstantOnSetupPanel/.test(
    drill,
  ),
);
const fleet = src("src/routes/master.routers.tsx");
check(
  "Router Fleet's drawer links an Aruba row to its setup (NAS-only only)",
  /isNasOnlyVendor\(sel\.vendor\) && \([\s\S]{0,300}goToAdvanced\(sel\.id\)[\s\S]{0,120}Instant On setup/.test(
    fleet,
  ),
);

// ---------------------------------------------------------------------------
console.log("\n8. Customer venue view: our own records only, never Offline, never a stand-in 0");
// ---------------------------------------------------------------------------
{
  const arubaVenue = LL.deriveLocationLiveness(
    [row({ controller_state: "no_controller_api" })],
    NOW,
  );
  eq(
    "an Aruba-only venue's badge reads Set up in Instant On",
    arubaVenue.label,
    "Set up in Instant On",
  );
  eq("its state stays `unknown` (grey), never not-live", arubaVenue.state, "unknown");
  eq("its summary is the §2.3 sentence", arubaVenue.summary, copy.sentence);
  eq("locationIsNasOnly: yes", LL.locationIsNasOnly(arubaVenue), true);
  const omadaVenue = LL.deriveLocationLiveness(
    [
      {
        id: "o",
        name: "OC200",
        status: "pending_provisioning",
        vendor: OMADA,
        controller_state: "reachable",
      },
    ],
    NOW,
  );
  eq("an Omada venue keeps its old label", omadaVenue.label, "Can't tell");
  eq("locationIsNasOnly: not Omada", LL.locationIsNasOnly(omadaVenue), false);
  const mixed = LL.deriveLocationLiveness(
    [
      row({ controller_state: "no_controller_api" }),
      {
        id: "o",
        name: "OC200",
        status: "pending_provisioning",
        vendor: OMADA,
        controller_state: "reachable",
      },
    ],
    NOW,
  );
  check(
    "a mixed Aruba + Omada venue is not NAS-only and keeps the old label",
    !LL.locationIsNasOnly(mixed) && mixed.label === "Can't tell",
  );
  eq("no routers: not NAS-only", LL.locationIsNasOnly(LL.deriveLocationLiveness([], NOW)), false);
  eq(
    "unreadable routers: not NAS-only",
    LL.locationIsNasOnly(LL.deriveLocationLiveness(null, NOW)),
    false,
  );

  const dash = (over = {}) => ({
    kpis: { onlineUsers: 3, todayGuests: 11, ...over },
    recentUsers: [{ time: "4 min ago" }, { time: "2 hr ago" }],
  });
  const st = VENUE.arubaVenueStats(dash(), false);
  check(
    "real counts are shown as read",
    st.online === "3" && st.today === "11",
    JSON.stringify(st),
  );
  eq("last sign-in is the newest session", st.lastSignIn, "4 min ago");
  const none = VENUE.arubaVenueStats(
    { kpis: { onlineUsers: 0, todayGuests: 0 }, recentUsers: [] },
    false,
  );
  check(
    "a quiet venue: real zeros, and 'None in the last 24 hours'",
    none.online === "0" && none.today === "0" && none.lastSignIn === "None in the last 24 hours",
  );
  const failedRead = VENUE.arubaVenueStats(dash({ sessionsReadFailed: true }), false);
  check(
    "a failed sessions read shows —, never a stand-in 0",
    failedRead.online === "—" && failedRead.today === "—" && failedRead.lastSignIn === "—",
  );
  check("a failed query shows —", VENUE.arubaVenueStats(dash(), true).online === "—");
  check("no data yet shows —", VENUE.arubaVenueStats(undefined, false).online === "—");
  check(
    "the 'managed in Instant On' list names speed, allowed domains and AP status",
    VENUE.ARUBA_VENUE_IN_INSTANT_ON.some((x) => /Speed/.test(x)) &&
      VENUE.ARUBA_VENUE_IN_INSTANT_ON.some((x) => /Allowed domains/.test(x)) &&
      VENUE.ARUBA_VENUE_IN_INSTANT_ON.some((x) => /Access point status/.test(x)),
  );
  check(
    "venue copy never says RADIUS, NAS, tunnel, secret, controller or Offline",
    [...VENUE.ARUBA_VENUE_IN_WYFY, ...VENUE.ARUBA_VENUE_IN_INSTANT_ON].every(
      (x) => !/RADIUS|\bNAS\b|tunnel|secret|controller|offline/i.test(x),
    ),
  );
  eq(
    "U5 for unreported session data",
    RV.NAS_ONLY_DATA_USAGE_UNREPORTED,
    "Data usage isn't reported for this venue yet.",
  );

  // Fix a Problem's verdict, through the real engine.
  const verdict = (label) =>
    VERDICTS.venueVerdict({
      hasRouter: true,
      links: [],
      routerLastSeenAt: null,
      routerReachable: null,
      routerLivenessMeasured: false,
      controllerReportedDown: false,
      controllerVendorLabel: label,
      guestsOnline: 2,
    });
  let aV;
  let oV;
  try {
    aV = verdict("Aruba Instant On");
    oV = verdict("TP-Link Omada");
  } catch (e) {
    check("venueVerdict accepts the signals shape", false, String(e));
  }
  if (aV && oV) {
    check(
      "Fix a Problem at Aruba: access points + Instant On app, no controller",
      aV.status === "controller-not-measured" &&
        /Aruba Instant On access points/.test(aV.headline) &&
        /Instant On app/.test(aV.action ?? "") &&
        !/controller/i.test(`${aV.headline} ${aV.meaning} ${aV.action}`),
      JSON.stringify(aV),
    );
    check(
      "Fix a Problem at Omada: unchanged controller wording",
      oV.status === "controller-not-measured" && /TP-Link Omada controller/.test(oV.meaning ?? ""),
      JSON.stringify(oV),
    );
  }

  const dashPage = src("src/components/customer/CustomerDashboardPage.tsx");
  check(
    "dashboard: the venue card replaces the hardware card only at a NAS-only venue",
    /nasOnlyVenue \? \(\s*<ArubaInstantOnVenueCard locationId=\{locationId\} \/>\s*\) : \(\s*<DeviceStatusCard/.test(
      dashPage,
    ),
  );
  check(
    "dashboard: bandwidth gives way to U6 only at a NAS-only venue",
    /nasOnlyVenue \? \([\s\S]{0,300}controllerDeviceMetricsReason\("aruba_instant_on"\)[\s\S]{0,200}\) : \(\s*<BandwidthUtilizationCard/.test(
      dashPage,
    ),
  );
  check(
    "dashboard: the gate is locationIsNasOnly",
    /const nasOnlyVenue = locationIsNasOnly\(liveness\)/.test(dashPage),
  );
  const hw = src("src/components/customer/BasicFeatureViews.tsx");
  check(
    "Devices: no controller-inventory request at a NAS-only venue",
    /useControllerDevices\(nasOnlyVenue \? undefined : locationId\)/.test(hw),
  );
  check(
    "Devices: the Aruba card stands where Omada's access-point list would",
    /nasOnlyVenue && locationId \? \([\s\S]{0,120}<ArubaInstantOnVenueCard[\s\S]{0,120}\) : \(\s*<ControllerDevicesCard/.test(
      hw,
    ),
  );
  const card = src("src/components/customer/ArubaInstantOnVenueCard.tsx");
  check(
    "the venue card reads only the existing dashboard query (no new endpoint, no Instant On call)",
    /useCustomerDashboard\(locationId\)/.test(card) &&
      !/api\.|fetch\(|network-integrations|instant-on\.hpe|arubainstanton\.com/i.test(card),
  );
  check("the venue card has no Offline/Online wording", !/\b(Offline|Online)\b(?! now)/.test(card));
  const usersSrc = src("src/routes/users.tsx");
  check(
    "Guests: '0 MB' becomes — with U5 only at a NAS-only venue",
    /disconnectUnsupported && download === "0 MB"/.test(usersSrc) &&
      (usersSrc.match(/sessionDataCell\(/g) ?? []).length >= 2,
  );
}

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba instant on: all checks passed"
    : `aruba instant on: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
