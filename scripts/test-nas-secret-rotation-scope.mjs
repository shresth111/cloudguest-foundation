#!/usr/bin/env node
// =====================================================================
// ROTATING A RADIUS SHARED SECRET IS A MASTER-CONSOLE OPERATION
// =====================================================================
// The defect (2026-09-02). `POST /radius/nas/{id}/regenerate-secret`
// rotated the shared secret in the platform database and never pushed it
// to the FreeRADIUS hub, so three places disagreed afterwards: the row had
// the new secret, the hub's `client{}` stanza had the old one, and the
// router had the old one. Every guest login at that venue Access-Rejected
// from that instant, with nothing in any log naming the cause, and the
// 5-minute reconciliation sweep did not repair it (it fires on address
// drift, not secret drift).
//
// The frontend's share of the fault was the audience. That endpoint was
// gated on organization-scoped `radius.execute`, which every venue owner
// holds, and this repo wired a "Regenerate secret" button to it in the
// venue owner's OWN dashboard -- one click, no confirmation, success
// toast, dead WiFi. Rotation cannot be completed from a dashboard at all:
// nothing in the platform can write a RADIUS client onto RouterOS, so the
// secret has to be pasted in over WinBox before the venue works again.
//
// The button is gone from the customer dashboard, and the backend route
// moved to `/platform/radius/nas/{id}/regenerate-secret` at
// ScopeType.GLOBAL -- the same posture `/platform/routers/{id}` already
// carries for the same bug class (PR #91).
//
// WIDENED THE SAME DAY, second pass. That fix moved one of the three
// `radius.execute` routes and left `activate` and `disable` behind, still
// wired to buttons on the venue owner's own NAS pages. `disable` was the
// sharp one: a pure database write on the backend -- no hub call, no device
// call -- and FreeRADIUS auth accepts only an `active` NAS, so one click
// stopped every guest login at that venue instantly, reported success, and
// left nothing the guest or the router could see to name the cause. It was
// reversible (Activate sat beside it), which is the one way it was gentler
// than a rotation; the reason it is gone anyway is that no product surface
// ever asked for a venue-owner kill switch. Those buttons existed because
// the backend's internal NasStatus graph had been mirrored into the
// customer UI. "Stop serving guests" is business hours / closed portal.
//
// So this file now checks the whole NAS *lifecycle* -- activate, disable,
// rotate -- rather than the one route it was written for.
//
// WHAT THIS CHECKS, AND WHAT IT CANNOT. This reads source files, so it can
// prove the button is absent and the path is the platform one. It cannot
// see the backend's RBAC scope -- the equivalent assertion lives there, in
// tests/unit/test_guest.py::TestNasSecretRotationIsPlatformOnly.
//
// Run: node scripts/test-nas-secret-rotation-scope.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

// Comments in this codebase quote the paths they are warning about, so a
// naive scan finds the old path in the very doc comment explaining why it
// is gone. Strip comments before matching anything path-shaped.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------
// 1. The path is the platform one, everywhere it appears.
// ---------------------------------------------------------------------
{
  const svc = stripComments(read("src/services/nas.service.ts"));
  const calls = [...svc.matchAll(/`([^`]*regenerate-secret)`/g)].map((m) => m[1]);
  check(
    "nas.service.ts: the rotate call still exists",
    calls.length > 0,
    "a check that only forbids is satisfied by deleting the feature",
  );
  for (const path of calls) {
    check(
      `nas.service.ts: ${path} is platform-scoped`,
      path.startsWith("/platform/"),
      "/radius/nas/{id}/regenerate-secret is gated on organization-scoped " +
        "radius.execute, which every venue owner holds. Use " +
        "/platform/radius/nas/{id}/regenerate-secret.",
    );
  }
}

// ---------------------------------------------------------------------
// 2. Nothing under the customer dashboard can rotate a secret.
// ---------------------------------------------------------------------
//
// Checked over the whole `_authenticated` route tree rather than the one
// file the button used to live in: putting it back on a sibling page is
// exactly as bad, and naming only the old location would not notice.
{
  const customerRoutes = walk(join(ROOT, "src/routes/_authenticated"));
  check(
    "the customer route tree was found at all",
    customerRoutes.length > 0,
    "src/routes/_authenticated moved -- update this path rather than deleting the check",
  );
  const offenders = customerRoutes.filter((f) =>
    /regenerateSecret|useRegenerateNasSecret|regenerate-secret/.test(
      stripComments(readFileSync(f, "utf8")),
    ),
  );
  check(
    "no customer-dashboard route can rotate a NAS shared secret",
    offenders.length === 0,
    `${offenders.length} file(s): ${offenders.map((f) => f.slice(ROOT.length + 1)).join(", ")}\n` +
      "       A successful rotate takes the venue's own guest WiFi down until an " +
      "engineer re-pastes the RADIUS chunk in WinBox. This belongs in the Master console.",
  );
}

// ---------------------------------------------------------------------
// 3. No customer-facing hook wraps it either.
// ---------------------------------------------------------------------
check(
  "useNas.ts exposes no rotate hook",
  !/export function useRegenerateNasSecret/.test(stripComments(read("src/hooks/useNas.ts"))),
  "the hooks in useNas.ts back the customer dashboard; a rotate hook there is " +
    "an invitation to put the button back",
);

// ---------------------------------------------------------------------
// 4. The Master console's confirmation names the consequence.
// ---------------------------------------------------------------------
//
// Keeping the button there is only defensible if the operator is told what
// it does. The wording it replaced -- "the router's RADIUS config must be
// updated immediately" -- described taking a venue offline as routine
// follow-up work, which is how it got clicked.
{
  const master = read("src/routes/master.nas.tsx");
  const confirm = master.slice(
    master.indexOf("async function handleRegenerate"),
    master.indexOf("async function handleDelete"),
  );
  check(
    "master.nas.tsx: handleRegenerate was found",
    confirm.length > 0,
    "the handler was renamed -- update this check rather than deleting it",
  );
  check(
    "master.nas.tsx: the confirmation says the venue goes down",
    /DOWN/.test(confirm) && /window\.confirm/.test(confirm),
    "the operator must be told that a successful rotate stops every guest login " +
      "until someone reaches the router",
  );
  check(
    "master.nas.tsx: the confirmation says the platform cannot do the router half",
    /cannot do/.test(confirm) && /WinBox/.test(confirm),
    "the irreversible-for-the-device half is the whole reason this is a site action",
  );
  check(
    "master.nas.tsx: a rotate is not reported as a plain success",
    !/toast\.success\(/.test(confirm),
    "the hub half succeeding is not the venue working -- say so",
  );
  check(
    "master.nas.tsx: the reveal renders the backend's device instruction",
    /deviceAction/.test(master),
    "the backend states the router half as data (device_action_required / " +
      "device_action) precisely so a client cannot fail to show it",
  );
}

// ---------------------------------------------------------------------
// 5. The other two lifecycle routes, same rule.
// ---------------------------------------------------------------------
//
// Written as a loop over the operation names rather than as two more
// copies of section 1-3, so that adding a fourth `radius.execute`
// operation is one line here -- the frontend counterpart of the backend's
// TestNasSecretRotationIsPlatformOnly::test_no_radius_execute_route_is_org_scoped,
// which asserts the rule for the permission key rather than for today's
// three paths.
const LIFECYCLE_OPS = [
  { op: "activate", hook: "useActivateNas", method: "activate" },
  { op: "disable", hook: "useDisableNas", method: "disable" },
];

{
  const svc = stripComments(read("src/services/nas.service.ts"));
  const customerRoutes = walk(join(ROOT, "src/routes/_authenticated"));

  for (const { op, hook } of LIFECYCLE_OPS) {
    const calls = [...svc.matchAll(new RegExp("`([^`]*/" + op + ")`", "g"))].map((m) => m[1]);
    check(
      `nas.service.ts: the ${op} call still exists`,
      calls.length > 0,
      "a check that only forbids is satisfied by deleting the feature -- the " +
        "Master console still needs this operation",
    );
    for (const path of calls) {
      check(
        `nas.service.ts: ${path} is platform-scoped`,
        path.startsWith("/platform/"),
        `/radius/nas/{id}/${op} is gated on organization-scoped radius.execute, ` +
          "which every venue owner holds. Use " +
          `/platform/radius/nas/{id}/${op}.`,
      );
    }

    const offenders = customerRoutes.filter((f) =>
      new RegExp(`${hook}|/${op}\``).test(stripComments(readFileSync(f, "utf8"))),
    );
    check(
      `no customer-dashboard route can ${op} a NAS`,
      offenders.length === 0,
      `${offenders.length} file(s): ${offenders.map((f) => f.slice(ROOT.length + 1)).join(", ")}\n` +
        "       NAS lifecycle is a Master console operation; disable in particular " +
        "stops every guest login at that venue the moment it returns.",
    );

    check(
      `useNas.ts exposes no ${op} hook`,
      !new RegExp(`export function ${hook}`).test(stripComments(read("src/hooks/useNas.ts"))),
      "the hooks in useNas.ts back the customer dashboard; a lifecycle hook there " +
        "is an invitation to put the button back",
    );
  }
}

// ---------------------------------------------------------------------
// 6. The Master console's DISABLE confirmation names the consequence too.
// ---------------------------------------------------------------------
//
// This is now the only surface that can disable a NAS at all, so the
// operator is acting on somebody else's venue. The previous wording
// ("Guests will stop authenticating through it") was true but read as a
// technical detail rather than as "this venue's WiFi stops now".
{
  const master = read("src/routes/master.nas.tsx");
  const confirm = master.slice(
    master.indexOf("async function handleDisable"),
    master.indexOf("async function handleRegenerate"),
  );
  check(
    "master.nas.tsx: handleDisable was found",
    confirm.length > 0,
    "the handler was renamed -- update this check rather than deleting it",
  );
  check(
    "master.nas.tsx: disabling is confirmed at all",
    /window\.confirm/.test(confirm),
    "one unlabelled click must not stop a venue's guest WiFi",
  );
  check(
    "master.nas.tsx: the confirmation says guest WiFi stops immediately",
    /immediately/.test(confirm) && /guest/i.test(confirm),
    "the operator must be told that this takes effect on the next Access-Request, " +
      "not at some later sync",
  );
  check(
    "master.nas.tsx: the confirmation says it is reversible",
    /Activate/.test(confirm),
    "unlike a rotation this one CAN be undone from here -- saying so is part of " +
      "being accurate rather than merely alarming",
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
