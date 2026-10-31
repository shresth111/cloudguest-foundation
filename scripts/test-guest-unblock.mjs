/**
 * Front-desk staff can unblock a guest from the guest's own row on Guests
 * (owner decision, 2026-10-31). Pins:
 *
 *   1. WHO is offered Unblock: a caller holding `guest_access.update` (the
 *      key the backend's deactivate routes check), fail-open on an unknown
 *      grant set like the nav, hidden for a real set without it (Helpdesk).
 *   2. WHICH rows: only a guest who is blocked HERE -- an active, unexpired
 *      `blocklist` rule at this venue or organization-wide, matched by phone,
 *      email (both possibly server-masked) or MAC. Allow rules, lifted or
 *      expired blocks, and blocks at another venue show nothing.
 *   3. An organization-wide ban is not offered to a venue-scoped caller (the
 *      backend refuses it); the row says who can lift it instead.
 *   4. The wiring: a venue-scoped caller sends its venue in X-Location-Id on
 *      both the listing and the deactivate, decided from real role
 *      assignments, never `cg_login_role`; the unblock calls the same
 *      deactivate endpoints the owner's Blocking page does.
 *
 * lib/guest-unblock.ts is bundled with esbuild and executed for real.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
let passed = 0;
function check(name, ok, extra = "") {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const outdir = mkdtempSync(join(tmpdir(), "guest-unblock-"));
const outfile = join(outdir, "lib.mjs");
await build({
  entryPoints: [join(ROOT, "src/lib/guest-unblock.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});
const {
  GUEST_UNBLOCK_PERMISSION,
  canOfferUnblock,
  blocksForGuest,
  unblockRefusal,
  phoneMatches,
  emailMatches,
} = await import(`file://${outfile}`);

const VENUE = "venue-a";
const OTHER = "venue-b";
const rule = (over) => ({
  id: over.id ?? "r",
  kind: "identifier",
  ruleType: "blocklist",
  isActive: true,
  locationId: VENUE,
  expiresAt: null,
  identifier: "+919876543210",
  ...over,
});
const guest = { phone: "+91 98765 43210", email: "john.doe83@gmail.com", mac: "AA:BB:CC:DD:EE:01" };

console.log("\nwho is offered Unblock");
check(
  "the key is the one the deactivate routes check",
  GUEST_UNBLOCK_PERMISSION === "guest_access.update",
);
check(
  "unknown grants (loading / failed / demo) fail open",
  [null, undefined, []].every((p) => canOfferUnblock(p)),
);
check(
  "a front-desk grant set with guest_access.update is offered it",
  canOfferUnblock(["dashboard.view", "guest_access.read", "guest_access.update"]),
);
check(
  "Helpdesk (guest_access.read only) is not",
  !canOfferUnblock(["dashboard.view", "guest_access.read", "guest_sessions.read"]),
);

console.log("\nwhich rows show it: only a guest blocked here");
check(
  "an active block at this venue matches by phone",
  blocksForGuest(guest, [rule({})], VENUE).length === 1,
);
check(
  "an organization-wide block matches too",
  blocksForGuest(guest, [rule({ locationId: null })], VENUE).length === 1,
);
check(
  "a block at another venue does not",
  blocksForGuest(guest, [rule({ locationId: OTHER })], VENUE).length === 0,
);
check(
  "a lifted block does not",
  blocksForGuest(guest, [rule({ isActive: false })], VENUE).length === 0,
);
check(
  "an expired block does not",
  blocksForGuest(
    guest,
    [rule({ expiresAt: "2026-01-01T00:00:00Z" })],
    VENUE,
    Date.parse("2026-10-31T00:00:00Z"),
  ).length === 0,
);
check(
  "allow rules (whitelist / vip / temporary) never show Unblock",
  ["whitelist", "vip", "temporary"].every(
    (t) => blocksForGuest(guest, [rule({ ruleType: t })], VENUE).length === 0,
  ),
);
check(
  "a different number does not match",
  blocksForGuest(guest, [rule({ identifier: "+919876543211" })], VENUE).length === 0,
);
check(
  "an email block matches the guest's email, case-insensitively",
  blocksForGuest(guest, [rule({ identifier: "John.Doe83@Gmail.com" })], VENUE).length === 1,
);
check(
  "a device block matches the guest's MAC in any notation",
  blocksForGuest(
    guest,
    [rule({ kind: "device", identifier: undefined, macAddress: "aa-bb-cc-dd-ee-01" })],
    VENUE,
  ).length === 1,
);
check(
  "a guest with an unknown MAC never matches a device block",
  blocksForGuest(
    { ...guest, mac: "Unknown" },
    [rule({ kind: "device", identifier: undefined, macAddress: "Unknown" })],
    VENUE,
  ).length === 0,
);

console.log("\nserver-masked identifiers (the usual front-desk account)");
check(
  "masked phone matches on length + last five digits",
  phoneMatches("XXXXXXX43210", "+919876543210"),
);
check(
  "masked phone with other last digits does not",
  !phoneMatches("XXXXXXX43211", "+919876543210"),
);
check("masked phone of a different length does not", !phoneMatches("XXXXXX43210", "+919876543210"));
check(
  "masked email matches first/last letter and domain",
  emailMatches("j****3@gmail.com", "john.doe83@gmail.com"),
);
check(
  "masked email on another domain does not",
  !emailMatches("j****3@yahoo.com", "john.doe83@gmail.com"),
);
check(
  "masked email with another last letter does not",
  !emailMatches("j****4@gmail.com", "john.doe83@gmail.com"),
);
check("a phone never matches an email rule", !phoneMatches("+919876543210", "a@b.com"));

console.log("\norganization-wide bans");
check(
  "a venue-scoped caller may not lift an org-wide ban",
  unblockRefusal({ locationId: null }, true) === "organization-wide",
);
check("...but may lift one at a venue", unblockRefusal({ locationId: VENUE }, true) === null);
check(
  "an org-scoped owner may lift either",
  [null, VENUE].every((l) => unblockRefusal({ locationId: l }, false) === null),
);

console.log("\nwiring");
const users = strip(read("src/routes/users.tsx"));
check(
  "Guests renders Unblock only for a matched, liftable block",
  /if \(!guestUnblock\.offered\) return null;/.test(users) &&
    /blocksForGuest\(\s*u,\s*guestUnblock\.rules,\s*locationId \|\| null,?\s*\)/.test(users) &&
    /if \(blocks\.length === 0\) return null;/.test(users) &&
    /unblockRefusal\(b, guestUnblock\.venueScoped\)/.test(users) &&
    /data-testid="guest-unblock"/.test(users) &&
    /data-testid="guest-blocked-everywhere"/.test(users),
);
check(
  "the button has a visible label and a per-guest accessible name, and does not open the row",
  /\{t\("unblock"\)\}/.test(users) &&
    /aria-label=\{t\("unblockGuest", \{ name: u\.name \}\)\}/.test(users) &&
    /e\.stopPropagation\(\);\s*handleUnblock\(/.test(users),
);
const hook = strip(read("src/hooks/useGuestUnblock.ts"));
check(
  "scope comes from real role assignments, not the login radio",
  /resolveMarketingScope\(roles, orgId, activeLocationId\)/.test(hook) &&
    !/cg_login_role|getCustomerLoginRole/.test(hook),
);
check(
  "a venue-scoped caller sends its venue on the listing and on both deactivates",
  /const venueHeader = venueScoped \? activeLocationId : null;/.test(hook) &&
    /listAccessRules\(orgId \?\? undefined, venueHeader\)/.test(hook) &&
    /deactivateDeviceRule\(rule\.id, orgId \?\? undefined, venueHeader\)/.test(hook) &&
    /deactivateAccessRule\(\s*"identifier",\s*rule\.id,\s*orgId \?\? undefined,\s*venueHeader,?\s*\)/.test(
      hook,
    ),
);
check(
  "the rules are not fetched for a caller who is not offered Unblock",
  /enabled: offered &&/.test(hook),
);
check(
  "nothing here creates or edits a rule",
  !/createAccessRule|deleteAccessRule|enforce/.test(hook),
);
const svc = strip(read("src/services/guest.service.ts"));
check(
  "the service adds X-Location-Id only when a venue is given",
  /if \(venueId\) headers\["X-Location-Id"\] = venueId;/.test(svc),
);
check(
  "unblock reuses the owner's deactivate endpoints (same device-release path)",
  /`\$\{path\}\/\$\{ruleId\}\/deactivate`/.test(svc) &&
    /`\/guest-access\/device-rules\/\$\{ruleId\}\/deactivate`/.test(svc),
);
for (const loc of ["en", "hi"]) {
  const g = JSON.parse(read(`src/lib/i18n/locales/${loc}/guests.json`));
  check(
    `${loc}: every Unblock string is translated`,
    [
      "unblock",
      "unblockGuest",
      "unblocked",
      "unblockFailed",
      "blockedEverywhere",
      "blockedEverywhereTitle",
    ].every((k) => typeof g[k] === "string" && g[k].length > 0),
  );
}

console.log(
  failures === 0
    ? `\n${passed} checks, all guest-unblock checks passed`
    : `\n${failures} check(s) FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
