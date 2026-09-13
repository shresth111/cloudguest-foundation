#!/usr/bin/env node
// =====================================================================
// THE LOGIN/ACCESS ATTEMPT LOG IS WIRED TO A REAL, SHIPPED ENDPOINT
// =====================================================================
// The Network Activity Log's "Login/Access Attempt Log" tab calls
// `GET /guest-login-history`. An earlier premise (docs/ipdr-logs-syslog-
// spec.md §7, and comments in UserReports.tsx) recorded that endpoint as
// "confirmed missing from the real backend" -- a BE engineer was said to be
// adding it in parallel. That premise is now STALE: the endpoint shipped
// (app/domains/guest/router.py admin_router, permission guest_sessions.read,
// covered by backend tests/unit/test_guest_network_activity_log_router.py),
// with exactly the documented contract, and it is vendor-agnostic --
// GuestLoginHistory rows are written by every auth path (OTP/voucher/
// password/pin), so the log is populated for a TP-Link Omada venue exactly
// as for a MikroTik/RADIUS one.
//
// WHAT THIS LOCKS DOWN: (1) the frontend keeps calling the real endpoint
// with the documented params and is dispatched for the login-access-log
// report type, and (2) the misleading "confirmed missing" claim does not
// creep back into the source or the spec. A comment that lies about a
// working feature is how a shipped endpoint gets "re-implemented" or ripped
// out by the next reader who believes the comment. It cannot reach the
// backend (separate repo), so it guards the FE contract and the honesty of
// the prose next to it.
//
// Run: node scripts/test-login-history-wired.mjs

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

const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
const spec = readFileSync(join(ROOT, "docs/ipdr-logs-syslog-spec.md"), "utf8");

// --- (1) the endpoint is really called, with the documented contract -----
check(
  "UserReports.tsx: fetchRealLoginHistory calls GET /guest-login-history",
  /"\/guest-login-history"/.test(reports),
  "the real endpoint call was renamed or removed",
);

for (const param of ["location_id", "start_date", "end_date", "page", "page_size"]) {
  check(
    `UserReports.tsx: /guest-login-history request still passes ${param}`,
    new RegExp(`${param}\\b`).test(reports),
    "the documented query contract changed -- confirm against the backend route",
  );
}

check(
  'UserReports.tsx: "login-access-log" is a REAL (not unavailable) report type',
  /REAL_REPORT_TYPES\s*=\s*new Set\(\[[\s\S]*?"login-access-log"[\s\S]*?\]\)/.test(reports),
  "login-access-log fell out of REAL_REPORT_TYPES -- it would render as 'unavailable'",
);

check(
  "UserReports.tsx: the login-access-log branch dispatches realLoginAccessLog",
  /reportType === "login-access-log"[\s\S]{0,120}realLoginAccessLog\(/.test(reports),
  "the fetch dispatch for login-access-log was disconnected",
);

// --- (2) the stale "confirmed missing" premise must not come back ---------
check(
  'UserReports.tsx: no stale "confirmed missing" claim about guest-login-history',
  !/confirmed missing/i.test(reports),
  'the endpoint is shipped -- a "confirmed missing" comment is a lie that invites its removal',
);

check(
  'docs/ipdr-logs-syslog-spec.md: §7 no longer says the endpoint is "confirmed missing"',
  !/confirmed missing/i.test(spec),
  "the spec still records a premise that is now false",
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
