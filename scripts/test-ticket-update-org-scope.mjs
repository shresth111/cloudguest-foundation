#!/usr/bin/env node
// =====================================================================
// A CUSTOMER RESOLVING THEIR OWN TICKET MUST SEND X-Organization-Id
// =====================================================================
// WHAT WENT WRONG. `TicketsPage`'s "Mark resolved" button called
// `ticketService.update(id, { status: "resolved" })` with no options, and
// `update()` sent NO `X-Organization-Id` header. The backend
// `PATCH /support-tickets/{id}` is gated on `support_tickets.manage` (which
// the Organization Owner/Admin roles do hold), but the shared
// `CurrentOrganization` scope resolver (`app/domains/rbac/dependencies.py`)
// rejects a tenant caller who names no organization at all
// (`MissingScopeContextError`) -- a header-or-nothing rule. So a real
// customer's resolve button failed on every click, while the identical
// no-header shape is exactly what the Master (super-admin) console
// (`master.tickets.tsx`) needs for its cross-tenant view.
//
// THE FIX. `update()` grows an `asCustomer` option, mirroring `listReplies`
// / `addReply`: `asCustomer: true` attaches `X-Organization-Id`; omitted
// keeps the Master console's no-header call. `TicketsPage.markResolved`
// passes `{ asCustomer: true }`.
//
// WHAT THIS CHECKS. It bundles the REAL `ticket.service.ts` against a
// stubbed api/org-id and asserts the header is present iff `asCustomer` is
// set, and absent for the default (Master) call. It also pins that
// `TicketsPage`'s markResolved passes `asCustomer: true`. Mirrors the
// bundle-the-real-code design of scripts/test-campaign-results.mjs.

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

// ---------------------------------------------------------------------------
// Bundle the real service against stubbed api + org-id resolver.
// ---------------------------------------------------------------------------
const outdir = mkdtempSync(join(tmpdir(), "ticket-update-scope-"));
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");

const stubModule = `
globalThis.__stub ??= { calls: [] };
export const TOKEN_STORAGE_KEY = "cloudguest_token";
export const api = {
  get: async () => ({ data: { items: [] } }),
  post: async (url, body, config) => { globalThis.__stub.calls.push({ m: "post", url, config }); return { data: {} }; },
  patch: async (url, body, config) => { globalThis.__stub.calls.push({ m: "patch", url, body, config }); return { data: { id: "t-1", status: "resolved" } }; },
  delete: async () => ({ data: null }),
};
export function toAppError(e) { return { message: String(e), status: null, data: null }; }
`;
writeFileSync(join(outdir, "api-stub.mjs"), stubModule);

const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export { ticketService } from "${p("src/services/ticket.service.ts")}";`);

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
      name: "stubs",
      setup(b) {
        b.onResolve({ filter: /services\/api$/ }, () => ({ path: join(outdir, "api-stub.mjs") }));
        // ticket.service.ts resolves the org id via services/organization-id.
        b.onResolve({ filter: /organization-id$/ }, () => ({ path: "orgid", namespace: "stub" }));
        b.onResolve({ filter: /customer\.service$/ }, () => ({ path: "cust", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: `export async function resolveOrganizationId() { return "org-1"; }
export async function resolveOrgId() { return "org-1"; }`,
          loader: "js",
        }));
      },
    },
  ],
});

const { ticketService } = await import(`file://${outfile}`);
const state = globalThis.__stub;
const headerOf = (call) => call?.config?.headers?.["X-Organization-Id"];

// --- 1. asCustomer:true attaches the org header ----------------------------
state.calls.length = 0;
await ticketService.update("t-1", { status: "resolved" }, { asCustomer: true });
{
  const call = state.calls.at(-1);
  check("customer update patches the ticket path", call?.url === "/support-tickets/t-1");
  check(
    "customer update sends X-Organization-Id",
    headerOf(call) === "org-1",
    `got ${headerOf(call)}`,
  );
}

// --- 2. default (Master console) sends NO org header -----------------------
state.calls.length = 0;
await ticketService.update("t-1", { status: "resolved" });
{
  const call = state.calls.at(-1);
  check(
    "default update omits X-Organization-Id (Master console shape)",
    headerOf(call) === undefined,
    `got ${headerOf(call)}`,
  );
}

// --- 3. TicketsPage.markResolved passes asCustomer:true --------------------
const page = readFileSync(join(ROOT, "src/components/features/TicketsPage.tsx"), "utf8");
check(
  "TicketsPage.markResolved calls update(... , { asCustomer: true })",
  /ticketService\.update\([^)]*asCustomer:\s*true/s.test(page),
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
