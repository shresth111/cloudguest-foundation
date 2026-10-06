#!/usr/bin/env node
/**
 * A VOUCHER'S "DEVICES PER VOUCHER" REACHES THE BACKEND, AND COMES BACK.
 *
 * QA on staging, 2026-10-06: "With voucher also only 1 device is allowed to
 * connect". The create screens offered "Max Uses", which the backend counted
 * as SIGN-INS (default 1), so a second phone found the code used up -- and
 * the venue's "Devices per user" refused it even earlier. The backend now
 * enforces `max_devices_per_voucher` (distinct devices; a device that
 * already signed in may sign in again) and the screens ask for exactly that.
 *
 * What this pins, against the real `voucherService` bundled with a stub
 * `api` (no network):
 *   1. createBatch sends `max_devices_per_voucher`, and the legacy
 *      `max_uses_per_voucher` with the SAME number, so an older backend
 *      still admits as many devices as the venue typed.
 *   2. A batch read back maps `max_devices_per_voucher`, and falls back to
 *      `max_uses_per_voucher` for a backend that predates the column.
 *   3. Neither create screen still says "Max Uses", and both ask for
 *      "Devices per voucher".
 *
 * Run: node scripts/test-voucher-devices-per-code.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "voucher-devices-"));
const apiStub = join(outdir, "api-stub.mjs");
writeFileSync(
  apiStub,
  // State lives on globalThis so it is one object however many times the
  // bundler inlines this module.
  `const state = (globalThis.__voucherApiStub ??= { calls: [], next: null });
export const calls = state.calls;
export function setNextResponse(r) { state.next = r; }
export const api = {
  async post(url, body, config) { state.calls.push({ method: "post", url, body, config }); return { data: state.next }; },
  async get(url, config) { state.calls.push({ method: "get", url, config }); return { data: state.next }; },
};
export const getAllItems = async () => [];`,
);
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { voucherService } from "${join(ROOT, "src/services/voucher.service.ts").replace(/\\/g, "/")}";
export { calls, setNextResponse } from "${apiStub.replace(/\\/g, "/")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/(api|list-all-pages)$/ }, () => ({
          path: apiStub,
        }));
        b.onResolve({ filter: /^@\// }, (args) => ({
          path: join(ROOT, "src", args.path.slice(2)) + ".ts",
        }));
      },
    },
  ],
});
const { voucherService, calls, setNextResponse } = await import(`file://${outfile}`);

function backendBatch(overrides = {}) {
  return {
    id: "b1",
    name: "Front desk",
    organization_id: "org-1",
    location_id: "loc-1",
    plan_id: null,
    series_id: null,
    quantity: 10,
    code_length: 8,
    code_prefix: "VCH",
    validity_minutes: 60,
    batch_expires_at: null,
    max_uses_per_voucher: 2,
    max_devices_per_voucher: 2,
    data_limit_mb: null,
    status: "active",
    notes: null,
    created_at: "2026-10-06T00:00:00Z",
    updated_at: "2026-10-06T00:00:00Z",
    ...overrides,
  };
}

console.log("\ncreateBatch sends the device allowance");
setNextResponse(backendBatch());
const created = await voucherService.createBatch({
  name: "Front desk",
  organizationId: "org-1",
  locationId: "loc-1",
  quantity: 10,
  codeLength: 8,
  codePrefix: "VCH",
  validityMinutes: 60,
  maxDevicesPerVoucher: 2,
  dataLimitMb: null,
});
const body = calls.at(-1)?.body ?? {};
eq("posts to /voucher-batches", calls.at(-1)?.url, "/voucher-batches");
eq("max_devices_per_voucher is the number typed", body.max_devices_per_voucher, 2);
eq(
  "max_uses_per_voucher carries the same number for an older backend",
  body.max_uses_per_voucher,
  2,
);
eq("the created batch reads back its allowance", created.maxDevicesPerVoucher, 2);

console.log("\na batch read back maps the allowance");
setNextResponse(backendBatch({ max_devices_per_voucher: 5, max_uses_per_voucher: 5 }));
const five = await voucherService.createBatch({
  name: "x",
  organizationId: "org-1",
  quantity: 1,
  codeLength: 8,
  validityMinutes: 60,
  maxDevicesPerVoucher: 5,
});
eq("max_devices_per_voucher -> maxDevicesPerVoucher", five.maxDevicesPerVoucher, 5);
const legacy = backendBatch({ max_uses_per_voucher: 3 });
delete legacy.max_devices_per_voucher;
setNextResponse(legacy);
const old = await voucherService.createBatch({
  name: "x",
  organizationId: "org-1",
  quantity: 1,
  codeLength: 8,
  validityMinutes: 60,
  maxDevicesPerVoucher: 3,
});
eq("a backend without the column falls back to max_uses_per_voucher", old.maxDevicesPerVoucher, 3);

console.log("\nthe create screens ask for devices, not uses");
for (const file of [
  "src/components/features/VouchersPage.tsx",
  "src/components/vouchers/VoucherManagement.tsx",
]) {
  const src = readFileSync(join(ROOT, file), "utf8");
  check(`${file} asks for "Devices per voucher"`, src.includes("Devices per voucher"));
  check(`${file} no longer says "Max Uses"`, !/Max uses/i.test(src));
  check(`${file} sends maxDevicesPerVoucher`, src.includes("maxDevicesPerVoucher"));
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
