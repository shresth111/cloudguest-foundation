/**
 * Trusted Devices' optional "valid until", and the retirement of "Allow a
 * Device" from Always Allowed.
 *
 * 1. The pure rules (lib/trusted-device-expiry.ts), run for real: empty is
 *    permanent, a time is temporary and sent as a UTC instant, a past time
 *    is refused, and a lapsed entry reads as expired.
 * 2. The Trusted Devices dialog is wired to those rules (one optional field,
 *    no "Always / Until a date" select) and the list shows an Expired badge.
 * 3. Always Allowed can no longer create a device rule, but still shows and
 *    removes any it wrote before -- the backend still honours them.
 *
 * Same harness as scripts/test-open-hours-draft.mjs.
 *
 * Run: node scripts/test-trusted-device-valid-until.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "trusted-device-valid-until-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/trusted-device-expiry.ts").replace(/\\/g, "/")}";`,
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
const lib = await import(`file://${outfile}`);

const NOW = Date.parse("2026-09-15T06:00:00Z");

console.log("\nthe field is optional");
check("empty is valid", lib.validUntilError("", NOW) === null);
check(
  "empty means permanent, with no expiry sent",
  JSON.stringify(lib.validUntilPayload("")) ===
    JSON.stringify({ authorizationType: "permanent", expiresAt: null }),
);

console.log("\na time makes the entry temporary, stored as UTC");
const future = "2099-01-01T10:30";
const payload = lib.validUntilPayload(future);
check("type is temporary", payload.authorizationType === "temporary");
check(
  "expiry is an ISO instant ending in Z",
  /Z$/.test(payload.expiresAt ?? ""),
  payload.expiresAt,
);
check(
  "...and is the same instant the browser read the local value as",
  Date.parse(payload.expiresAt) === new Date(future).getTime(),
);

console.log("\na past time is refused");
check(
  "two minutes ago, in the viewer's own zone, is refused",
  lib.validUntilError(lib.localDateTimeInputMin(NOW - 120_000), NOW) !== null,
);
check("a clearly past date is refused", lib.validUntilError("2001-01-01T00:00", NOW) !== null);
check("garbage is refused", lib.validUntilError("not-a-date", NOW) !== null);
check("a future date is accepted", lib.validUntilError(future, NOW) === null);

console.log("\nexpired reads as expired");
check("no expiry never lapses", !lib.isTrustExpired(null, NOW));
check("a past instant has lapsed", lib.isTrustExpired("2026-09-15T05:00:00Z", NOW));
check("the exact instant has lapsed", lib.isTrustExpired("2026-09-15T06:00:00Z", NOW));
check("a future instant has not", !lib.isTrustExpired("2026-09-15T07:00:00Z", NOW));

console.log("\nthe Valid until column");
check("no expiry says so", lib.validUntilLabel(null, "permanent") === "No end date");
check(
  "a legacy temporary row with no date is called out",
  lib.validUntilLabel(null, "temporary") === "Not set — never ends",
);
check(
  "an expiry is formatted by the injected (viewer-local) formatter",
  lib.validUntilLabel("2026-09-15T06:00:00Z", "temporary", (d) => d.toISOString()) ===
    "2026-09-15T06:00:00.000Z",
);
check(
  "the picker minimum has datetime-local shape",
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(lib.localDateTimeInputMin(NOW)),
);

console.log("\nthe Trusted Devices screen is wired to it");
const ops = readFileSync(join(ROOT, "src/components/features/OperationsFeatures.tsx"), "utf8");
const macView = ops.slice(
  ops.indexOf("export function MacAuthView"),
  ops.indexOf("/* ---------- Port Forwarding"),
);
check("the view was found", macView.length > 1000);
check("one optional Valid until field", /Valid until \(optional\)/.test(macView));
check(
  "the old Always / Until a date select is gone",
  !/Until a date/.test(macView) && !/Allow access/.test(macView),
);
check(
  "validation goes through the shared rule",
  /validUntilError\(form\.validUntil, Date\.now\(\)\)/.test(macView),
);
check(
  "the payload comes from the shared rule",
  /validUntilPayload\(form\.validUntil\)/.test(macView),
);
check(
  "the list shows an Expired badge",
  /isTrustExpired\(e\.expiresAt, Date\.now\(\)\)/.test(macView) &&
    /data-testid="trusted-device-expired"/.test(macView),
);

console.log("\nAlways Allowed no longer creates device rules");
const wl = readFileSync(join(ROOT, "src/components/features/WhiteList.tsx"), "utf8");
check("no Allow a Device tab", !/Allow a Device/.test(wl) && !/Allow Device/.test(wl));
check("no device kind is ever created here", !/kind: "device"/.test(wl) && !/macAddress:/.test(wl));
check("create always sends an identifier rule", /kind: "identifier"/.test(wl));
check("older device rows are still listed", /data-testid="whitelist-legacy-devices"/.test(wl));
check(
  "...and can still be removed as device rules",
  /removed\.tab === "device" \? "device" : "identifier"/.test(wl),
);
check("...with a pointer to Trusted Devices", /customerFeatureHref\("mac-auth"\)/.test(wl));

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
