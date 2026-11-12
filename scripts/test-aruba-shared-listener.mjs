/**
 * Aruba Instant On, shared RADIUS listener (ports 1912/1913): the Master
 * panel's read of the IP-independent alternative.
 *
 * WHAT THIS GUARDS:
 *   1. AN OLDER BACKEND (no `shared_listener`) RENDERS NOTHING NEW: the
 *      mapping is null and the panel section is conditional on it.
 *   2. THE SECRET IS NEVER ON A STATUS READ: only the rotate response
 *      carries `sharedSecret`.
 *   3. HONEST COPY: every gap code has a sentence; the rotate confirm says it
 *      is platform-wide and that port-1812 venues are unaffected.
 *   4. WIRING: four service calls on the right routes; no customer or portal
 *      surface imports any of it.
 *   5. RECORDING THE AP MAC: the normaliser accepts colon, dash and bare-hex
 *      forms and refuses malformed input and every placeholder MAC the
 *      backend treats as "no AP MAC"; a 409 duplicate says another device
 *      holds it; the panel offers the field on `no_ap_mac`, behind
 *      routers.update, and sends only `mac_address`.
 *
 * Run: node scripts/test-aruba-shared-listener.mjs
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
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const eq = (name, a, b) =>
  check(
    name,
    JSON.stringify(a) === JSON.stringify(b),
    `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`,
  );

const work = join(ROOT, "node_modules", ".cache", "aruba-shared-listener");
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
const SL = await bundle("src/lib/aruba-shared-listener.ts", "shared.mjs");
const SETUP = await bundle("src/lib/aruba-instant-on-setup.ts", "setup.mjs");

console.log("1. older backend");
eq("no field -> null", SL.toArubaSharedListener(undefined), null);
eq(
  "setup without shared_listener -> null",
  SETUP.toArubaSetupStatus({ gaps: [] }).sharedListener,
  null,
);

console.log("2. mapping");
const raw = {
  available: true,
  radius_server: { host: "13.207.123.212", auth_port: 1912, accounting_port: 1913 },
  auth_port: 1912,
  accounting_port: 1913,
  nas_identifier: "cg-aruba-9e6069de",
  ap_mac: "54:F0:B1:C8:A9:0A",
  secret_configured: true,
  secret_fingerprint: "64e065037cf0",
  secret_length: 32,
  secret_rotated_at: "2026-10-03T08:00:00+00:00",
  hub_confirmed: true,
  gaps: [],
};
const m = SETUP.toArubaSetupStatus({ gaps: [], shared_listener: raw }).sharedListener;
eq("mapped", m, {
  available: true,
  radiusServer: { host: "13.207.123.212", authPort: 1912, accountingPort: 1913 },
  authPort: 1912,
  accountingPort: 1913,
  nasIdentifier: "cg-aruba-9e6069de",
  apMac: "54:F0:B1:C8:A9:0A",
  apMacPlaceholder: false,
  secretConfigured: true,
  secretFingerprint: "64e065037cf0",
  secretLength: 32,
  secretRotatedAt: "2026-10-03T08:00:00+00:00",
  hubConfirmed: true,
  gaps: [],
});
check("no secret on the listener view", !("sharedSecret" in m));
const st = SL.toArubaSharedSecretStatus({ listener_installed: true, secret_configured: false });
check("no secret on the status read", !("sharedSecret" in st));
eq("status defaults ports", [st.authPort, st.accountingPort], [1912, 1913]);
const rot = SL.toArubaSharedSecretRotated({
  ...raw,
  listener_installed: true,
  shared_secret: "S".repeat(32),
  device_action: "retype it",
});
eq("rotate carries the secret once", rot.sharedSecret, "S".repeat(32));
eq("rotate carries the device action", rot.deviceAction, "retype it");
eq(
  "junk gaps dropped",
  SL.toArubaSharedListener({ nas_identifier: "x", gaps: ["a", 3, null] }).gaps,
  ["a"],
);

console.log("3. copy");
for (const code of [
  "listener_not_installed",
  "shared_secret_not_set",
  "hub_not_confirmed",
  "nas_not_registered",
  "nas_identifier_not_accepted",
  "no_ap_mac",
  "radius_server_address_not_configured",
]) {
  check(`gap ${code} has a sentence`, SL.describeSharedListenerGap(code) !== code);
}
check("rotate confirm: platform-wide", /EVERY Instant On site/.test(SL.SHARED_ROTATE_CONFIRM));
check(
  "rotate confirm: 1812 venues unaffected",
  /port 1812\) are not affected/.test(SL.SHARED_ROTATE_CONFIRM),
);
check("rotate confirm: shown once", /shown once/.test(SL.SHARED_ROTATE_CONFIRM));

console.log("4. wiring");
const svc = readFileSync(join(ROOT, "src/services/aruba-instant-on.service.ts"), "utf8");
check("register-shared route", svc.includes("/platform/radius/nas/register-shared/${routerId}"));
check("shared secret read route", svc.includes('"/platform/radius/aruba-shared"'));
check("shared secret rotate route", svc.includes('"/platform/radius/aruba-shared/rotate"'));
check(
  "AP MAC write: PUT /routers/{id} with mac_address only",
  svc.includes("await api.put(`/routers/${routerId}`, { mac_address: mac });"),
);
const panel = readFileSync(
  join(ROOT, "src/components/routers/ArubaInstantOnSetupPanel.tsx"),
  "utf8",
);
check(
  "panel renders the section only when the backend sent it",
  panel.includes("{s.sharedListener && ("),
);
check("panel confirms before rotating", panel.includes("window.confirm(SHARED_ROTATE_CONFIRM"));
check(
  "values withheld until ready",
  panel.includes("const server = ready ? shared.radiusServer : null"),
);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const leaks = walk(join(ROOT, "src/components/customer"))
  .concat(walk(join(ROOT, "src/components/portal-runtime")))
  .filter((p) => {
    const t = readFileSync(p, "utf8");
    return t.includes("aruba-shared-listener") || t.includes("rotateSharedSecret");
  });
eq(
  "no customer or portal surface imports it",
  leaks.map((p) => relative(ROOT, p)),
  [],
);

console.log("5. recording the AP MAC");
eq(
  "placeholder flag mapped",
  SL.toArubaSharedListener({ nas_identifier: "x", ap_mac: null, ap_mac_placeholder: true })
    .apMacPlaceholder,
  true,
);
eq(
  "placeholder flag absent on an older backend -> false",
  SL.toArubaSharedListener({ nas_identifier: "x" }).apMacPlaceholder,
  false,
);
for (const [input, want] of [
  ["54:F0:B1:C8:A9:0A", "54:F0:B1:C8:A9:0A"],
  ["54:f0:b1:c8:a9:0a", "54:F0:B1:C8:A9:0A"],
  ["54-f0-b1-c8-a9-0a", "54:F0:B1:C8:A9:0A"],
  ["54f0b1c8a90a", "54:F0:B1:C8:A9:0A"],
  ["  54F0B1C8A90A  ", "54:F0:B1:C8:A9:0A"],
]) {
  eq(`accepts ${JSON.stringify(input)}`, SL.normaliseApMac(input), { ok: true, mac: want });
}
for (const [input, problem] of [
  ["", "empty"],
  ["   ", "empty"],
  ["54:F0:B1:C8:A9", "malformed"],
  ["54:F0:B1:C8:A9:0A:11", "malformed"],
  ["54:F0-B1:C8:A9:0A", "malformed"],
  ["54:F0:B1:C8:A9:0G", "malformed"],
  ["54F0B1C8A90", "malformed"],
  ["54f0.b1c8.a90a", "malformed"],
  ["00:00:00:00:00:00", "placeholder"],
  ["FF:FF:FF:FF:FF:FF", "placeholder"],
  // Locally administered (bit 1): what the backend mints for a site added
  // without its AP's MAC. Saving it would leave the gap where it was.
  ["02:5A:11:22:33:44", "placeholder"],
  ["DA:11:22:33:44:55", "placeholder"],
  // Multicast (bit 0).
  ["01:00:5E:00:00:01", "placeholder"],
]) {
  eq(`refuses ${JSON.stringify(input)} (${problem})`, SL.normaliseApMac(input), {
    ok: false,
    problem,
  });
}
for (const problem of ["empty", "malformed", "placeholder"]) {
  check(`problem ${problem} has a sentence`, (SL.AP_MAC_PROBLEM_COPY[problem] ?? "").length > 20);
}
check(
  "the label warning is the exact sentence",
  SL.AP_MAC_LABEL_WARNING ===
    "Copy it from the label on the access point. One wrong character and every guest sign-in is rejected.",
);
const dup = {
  status: 409,
  message: "A router with MAC address '54:F0:B1:C8:A9:0A' already exists",
  data: {},
};
eq(
  "409 duplicate -> another device",
  SL.apMacSaveErrorMessage(dup),
  "This MAC is already on another device.",
);
eq(
  "409 duplicate with a holder name -> named",
  SL.apMacSaveErrorMessage({ ...dup, data: { router_name: "Lobby AP" } }),
  "This MAC is already on another device: Lobby AP.",
);
eq(
  "409 decommissioned -> the backend's words",
  SL.apMacSaveErrorMessage({
    status: 409,
    message: "Router r is decommissioned and cannot be modified",
  }),
  "Router r is decommissioned and cannot be modified",
);
check(
  "403 names the permission",
  /routers\.update/.test(SL.apMacSaveErrorMessage({ status: 403 })),
);
eq(
  "422 -> verbatim",
  SL.apMacSaveErrorMessage({ status: 422, message: "String should have at least 17 characters" }),
  "String should have at least 17 characters",
);
check(
  "no error object -> fallback",
  SL.apMacSaveErrorMessage(null).includes("Nothing was changed"),
);
check(
  "the gap sentence points at the field",
  SL.describeSharedListenerGap("no_ap_mac").includes("record it below"),
);
check(
  "panel: the field is open by default on no_ap_mac",
  panel.includes('const missing = shared.gaps.includes("no_ap_mac");') &&
    panel.includes("if (!missing && !open) {"),
);
check("panel: gated on routers.update", panel.includes('if (!can("routers.update")) {'));
check(
  "panel: save sends the normalised MAC, then refetches the status read",
  panel.includes("arubaInstantOnService.setApMac(routerId, parsed.mac)") &&
    panel.includes("qc.invalidateQueries({ queryKey: arubaSetupQueryKey(routerId) })"),
);
check("panel: the label warning is rendered", panel.includes("{AP_MAC_LABEL_WARNING}"));

console.log(`\n${ran} checks ran`);
console.log(
  failures === 0
    ? "aruba shared listener: all checks passed"
    : `aruba shared listener: ${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
