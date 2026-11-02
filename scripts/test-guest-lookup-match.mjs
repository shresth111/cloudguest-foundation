#!/usr/bin/env node
// Fix a Problem finds a guest by phone or email, and never answers with the wrong guest.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = mkdtempSync(join(tmpdir(), "guest-lookup-"));
const entry = join(outdir, "entry.ts");
writeFileSync(entry, `export * from "${join(ROOT, "src/lib/guest-lookup-match.ts")}";`);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const { findGuestByIdentifier: find, maskGuestIdentifier: mask } = await import(
  `file://${outfile}`
);

const phone = { identifier: "+919876543210", email: null };
const asha = { identifier: "asha@example.com", email: "asha@example.com" };
const ravi = { identifier: "ravi@example.com", email: null };
const emailOnRecord = { identifier: "+919000000001", email: "Meera@Example.com" };

assert.equal(find([asha, ravi], "ravi@example.com"), ravi, "email picks the exact guest");
assert.equal(find([asha, ravi], "  RAVI@example.com "), ravi, "email ignores case and spaces");
assert.equal(
  find([phone, emailOnRecord], "meera@example.com"),
  emailOnRecord,
  "matches guest.email",
);
assert.equal(find([asha, ravi], "nobody@example.com"), null, "no digit-less false match");
assert.equal(find([phone, asha], "98765 43210"), null, "partial digits stay ambiguous");
assert.equal(find([phone, asha], "+91 98765 43210"), phone, "phone still matches");
assert.equal(find([asha], "abc"), asha, "a single search result still answers");
assert.equal(find([asha, ravi], "abc"), null, "text without digits matches nobody");
assert.equal(mask("+919876543210").includes("•"), true, "phone is masked");
assert.notEqual(mask("asha@example.com"), "asha@example.com", "email is masked");

console.log("guest-lookup-match: all checks passed");
