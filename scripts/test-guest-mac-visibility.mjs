/**
 * Regression test for the reported defect "when a guest logs in with a
 * voucher, the MAC address doesn't appear -- not in Reports and not in
 * Users".
 *
 * WHAT THE DEFECT ACTUALLY WAS. Not voucher-specific, and not missing
 * data. The backend created and linked the device on every login path,
 * voucher included. Three screens each had a blank cell for a different
 * reason:
 *
 *   1. Users     -- the customer screen guessed which device belonged to a
 *                   session using a time-window heuristic over
 *                   /connected-devices, because /guest-sessions carried
 *                   only an opaque device_id. A guest with no matching
 *                   ConnectedDevice row rendered "Unknown".
 *   2. Reports   -- realGuestSessionLog read `s.mac_address`, a field the
 *                   backend has never sent. It was always undefined, so the
 *                   Device MAC column rendered "—" on every row for every
 *                   auth method.
 *   3. Vouchers  -- nothing linked a voucher to the device that redeemed
 *                   it at all.
 *
 * AND IT WAS NEVER MASKED. `maskMac` is a documented no-op mirroring the
 * backend's `mask_mac` ("MAC addresses are shown unmasked platform-wide by
 * explicit product decision"). A blank MAC cell was always a missing
 * value, never a hidden one, so the unmask flow would never have revealed
 * it. That distinction decided the whole triage and is pinned below.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. THE MAC IS READ FROM THE FIELD THE BACKEND ACTUALLY SENDS. Reading
 *      a field name nobody serves is indistinguishable from missing data
 *      at runtime, which is exactly how this shipped and stayed shipped.
 *   2. AN EXACT KEY BEATS A HEURISTIC. The session's own resolved MAC must
 *      win over the time-window guess, which only ever existed because
 *      there was no per-session key.
 *   3. MISSING IS NOT MASKED. maskMac must be identity, so no future
 *      reader re-diagnoses an empty cell as a privacy feature.
 *   4. NOTHING IS FABRICATED. No MAC may be invented from a device_id
 *      UUID, and an unresolved value stays honestly empty.
 *
 * Run: node scripts/test-guest-mac-visibility.mjs
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
const eq = (name, actual, expected) =>
  check(
    name,
    actual === expected,
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );

// The real production values from the voucher login that triggered the
// report, kept verbatim so a reader can tie this file to the incident.
const REAL_MAC = "DE:FD:67:99:02:29";
const REAL_IP = "10.5.50.246";

// ---------------------------------------------------------------------------
// 1. maskMac is identity -- the triage question.
// ---------------------------------------------------------------------------

console.log("\na MAC is never masked, so a blank cell is missing data");

const outdir = mkdtempSync(join(tmpdir(), "mac-visibility-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { maskMac, maskPhone } from "${join(ROOT, "src/lib/masking.ts").replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const { maskMac, maskPhone } = await import(`file://${outfile}`);

eq("a MAC passes through maskMac unchanged", maskMac(REAL_MAC), REAL_MAC);
eq("a lowercase MAC is also untouched", maskMac("de:fd:67:99:02:29"), "de:fd:67:99:02:29");
// The control: masking genuinely works on the fields it applies to, which
// is why an unmasked MAC beside a masked phone number is a deliberate
// product decision rather than the bug being reported.
check(
  "a phone number by contrast really is masked",
  maskPhone("+919876598647") !== "+919876598647",
);

// ---------------------------------------------------------------------------
// 2. The Reports row builder reads the field the backend serves.
// ---------------------------------------------------------------------------

console.log("\nReports reads device_mac, the field the backend actually sends");

const userReports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");

check(
  "the Guest Session Log maps its mac column from s.device_mac",
  /mac:\s*s\.device_mac\s*\?\?\s*null/.test(userReports),
);
// Comment lines are stripped first: the doc comment above realGuestSessionLog
// deliberately names the old `s.mac_address` when explaining why the column
// was blank, and that history is worth keeping. Only live code is checked.
const userReportsCode = userReports
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join("\n");
check(
  "no row builder still reads the s.mac_address the backend never sent",
  !/s\.mac_address/.test(userReportsCode),
  "a field name nobody serves reads as missing data at runtime",
);
check(
  "the session type declares device_mac",
  /device_mac\?:\s*string\s*\|\s*null/.test(userReports),
);

// ---------------------------------------------------------------------------
// 3. The Users screen prefers the exact key over the heuristic.
// ---------------------------------------------------------------------------

console.log("\nUsers prefers the session's own device over the time-window guess");

const customerService = readFileSync(join(ROOT, "src/services/customer.service.ts"), "utf8");

check(
  "the mac cell reads s.device_mac first",
  /mac:\s*s\.device_mac\s*\|\|\s*matched\?\.mac_address\s*\|\|\s*"Unknown"/.test(customerService),
  "the exact per-session key must win over matchDeviceForSession's inference",
);
check(
  "the heuristic is kept only as a fallback, not deleted",
  /function matchDeviceForSession/.test(customerService),
  "sessions the backend cannot resolve still need a best-effort answer",
);
check(
  "the session's own ip is preferred once the MAC no longer comes from the matched device",
  /ip:\s*s\.ip_address\s*\|\|\s*matched\?\.ip_address\s*\|\|\s*""/.test(customerService),
  "taking IP from a guessed device while MAC comes from the real one would describe two devices in one row",
);
check(
  "RawGuestSession declares device_mac",
  /device_mac\?:\s*string\s*\|\s*null/.test(customerService),
);

// ---------------------------------------------------------------------------
// 4. Nothing is fabricated from a device_id UUID.
// ---------------------------------------------------------------------------

console.log("\nan unresolved MAC stays honestly empty");

check(
  'the Users screen still falls back to "Unknown", not to a device_id',
  /\|\|\s*"Unknown"/.test(customerService) && !/mac:\s*s\.device_id/.test(customerService),
);

// The customer Users screen: an unresolved MAC must not render in the mono
// face the real addresses use, or it reads as a value rather than an absence.
const usersRoute = readFileSync(join(ROOT, "src/routes/users.tsx"), "utf8");
check(
  "the Users screen renders an unresolved MAC as prose, not as a mono value",
  /u\.mac === "Unknown"/.test(usersRoute) && /No device on record/.test(usersRoute),
  "the founder reported this as 'not showing'; the cell must say why it is empty",
);

const guestListTable = readFileSync(join(ROOT, "src/components/guests/GuestListTable.tsx"), "utf8");
check(
  "the guest list says 'No device on record' rather than rendering an empty cell",
  /No device on record/.test(guestListTable),
  "an empty-looking cell is exactly how this got reported as 'not showing'",
);
check(
  "the guest list shows the newest MAC with a +N for the rest",
  /macAddresses\[0\]/.test(guestListTable) && /deviceCount > 1/.test(guestListTable),
  "a guest may own several devices; silently picking one hides the others",
);

// ---------------------------------------------------------------------------
// 5. Vouchers: observed facts are kept apart from self-reported ones.
// ---------------------------------------------------------------------------

console.log("\nVouchers separates observed device facts from self-reported text");

const voucherService = readFileSync(join(ROOT, "src/services/voucher.service.ts"), "utf8");
const vouchersPage = readFileSync(join(ROOT, "src/components/features/VouchersPage.tsx"), "utf8");

check(
  "the redemption resolver calls the guest-domain endpoint",
  /"\/voucher-redemptions"/.test(voucherService),
  "the voucher domain holds no FK to a device; guest_sessions.voucher_id is the only link",
);
check(
  "redemptions are batched, never one request per voucher row",
  /const CHUNK = 100/.test(voucherService) && /voucherIds\.slice\(/.test(voucherService),
);
check(
  "a failed chunk leaves cells unresolved rather than failing the dialog",
  /catch \{/.test(voucherService),
);
check(
  "the voucher dialog renders Device MAC and IP columns",
  /Device MAC/.test(vouchersPage) && /IP Address/.test(vouchersPage),
);
check(
  "an unused voucher says 'Not redeemed' rather than showing the same blank as an unresolved one",
  /Not redeemed/.test(vouchersPage),
);
check(
  "a multi-use voucher shows how many other sessions it had",
  /sessionCount > 1/.test(vouchersPage),
  "otherwise one device reads as THE redeemer of a code used many times",
);
check(
  "the dialog states that these are network-recorded, not guest-typed",
  /self-reported/.test(vouchersPage),
  "the one thing worse than a missing MAC is a made-up one shown as verified",
);
check(
  "redeemed_identifier is not rendered beside the observed facts as an equal",
  !/redeemedIdentifier/.test(vouchersPage),
);

// ---------------------------------------------------------------------------

console.log(
  failures === 0
    ? "\nAll guest MAC visibility checks passed.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
