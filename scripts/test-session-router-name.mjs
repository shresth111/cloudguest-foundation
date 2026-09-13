#!/usr/bin/env node
// =====================================================================
// THE GUEST-SESSION LIST'S ROUTER COLUMN SHOWS A NAME, NOT A UUID
// =====================================================================
// `GuestSessionResponse` carried `router_id` (an opaque UUID) but no name,
// so the customer live-session list / Network Activity CSV had only the id
// to show for the "Router" column and rendered the raw UUID. For a TP-Link
// Omada venue that UUID is the SYNTHETIC fleet `Router` every one of the
// venue's sessions runs against -- doubly meaningless to a customer.
//
// The backend now denormalizes the router's display name onto
// `GuestSessionResponse.router_name` (resolved in one bulk lookup per page,
// the router-side twin of `device_mac`). The frontend must consume it: the
// `toGuestSession` mapper takes a resolved `routerName`, and every call site
// must pass `s.router_name ?? s.router_id` -- falling back to the id only
// when an older backend omits the name -- rather than always passing the
// bare `s.router_id`, which was the defect.
//
// WHAT THIS LOCKS DOWN: (1) the backend field is declared on the client's
// session type, and (2) no call site regresses to passing the bare
// router_id as the display name. It cannot see the backend (separate repo),
// so it guards the FE consumption contract only.
//
// Run: node scripts/test-session-router-name.mjs

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function check(name, ok, extra = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}${extra ? `\n       ${extra}` : ""}`);
}

const svc = readFileSync(join(ROOT, "src/services/guest.service.ts"), "utf8");

// --- (1) the backend field is declared ------------------------------------
check(
  "guest.service.ts: BackendGuestSession declares router_name",
  /router_name\?:\s*string\s*\|\s*null/.test(svc),
  "the client no longer parses the resolved router name off the response",
);

// --- (2) every toGuestSession call passes router_name ?? router_id --------
const callArgs = [...svc.matchAll(/toGuestSession\(([\s\S]*?)\)/g)].map((m) => m[1]);
check(
  "guest.service.ts: toGuestSession is still called (sanity)",
  callArgs.length >= 3,
  `found ${callArgs.length} call(s)`,
);

const bareRouterIdArg = callArgs.filter((args) => /,\s*s\.router_id\s*$/.test(args.trim()));
check(
  "guest.service.ts: no toGuestSession call passes the bare s.router_id as the name",
  bareRouterIdArg.length === 0,
  `${bareRouterIdArg.length} call(s) still pass s.router_id -- use s.router_name ?? s.router_id ` +
    "so the Router column/CSV shows the name, not the UUID",
);

const preferName = callArgs.filter((args) => /s\.router_name\s*\?\?\s*s\.router_id/.test(args));
check(
  "guest.service.ts: call sites prefer router_name with a router_id fallback",
  preferName.length >= 3,
  `only ${preferName.length} call(s) use s.router_name ?? s.router_id`,
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
