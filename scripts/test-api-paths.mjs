#!/usr/bin/env node
// =====================================================================
// FRONTEND API PATHS MUST CARRY THEIR BACKEND ROUTER'S PREFIX
// =====================================================================
// The Fleet Wizard's WAN Apply step never once reached the backend. It
// called `/routers/{id}/wan/basic/preview|apply`, but that route lives on
// `app/domains/network_config/router.py`, whose APIRouter is created with
// `prefix="/network-config"`. Both calls 404'd from the day they shipped.
//
// The interesting part is not the typo, it is why it survived. Nothing was
// consuming the endpoint, so the backend renderer behind it drifted four
// PRs behind the frontend's copy with nobody noticing -- and
// `docs/router_fleet/README.md` recorded the path WITHOUT the prefix too,
// so the docs and the frontend agreed with each other and disagreed with
// the code. Two of the three sources said the same wrong thing, which is
// exactly what makes a wrong thing read as right.
//
// WHAT THIS CHECKS, AND WHAT IT CANNOT. This reads the frontend's own
// service files and asserts that paths belonging to a prefixed backend
// router carry that prefix. It cannot see the backend -- the two repos are
// separate -- so the prefix table below is maintained by hand and is only
// as true as the last person to check it. That is a real limit and it is
// written down rather than implied: this catches a path REGRESSING, not a
// backend that moves a route somewhere new.
//
// A cross-repo contract test would catch both. It does not exist yet.

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

// Verified against the backend at app/domains/network_config/router.py:56
// on 2026-08-23: `APIRouter(prefix="/network-config", ...)`.
const PREFIXED = [
  {
    file: "src/services/router-fleet-wizard.service.ts",
    prefix: "/network-config",
    // The path fragments that belong to that router. Matched as a suffix,
    // so a template literal with an interpolated id still matches.
    paths: ["/wan/basic/preview", "/wan/basic/apply"],
    why: 'network_config\'s APIRouter is created with prefix="/network-config"',
  },
];

for (const entry of PREFIXED) {
  const src = readFileSync(join(ROOT, entry.file), "utf8");
  for (const p of entry.paths) {
    // Every occurrence of the fragment, and each one must sit inside a
    // path string that starts with the prefix. Counting occurrences rather
    // than testing "does the prefix appear somewhere in the file" is the
    // whole point: a single prefixed call would otherwise vouch for an
    // unprefixed one three lines below it. That "somewhere, not
    // everywhere" shape has now been found eight times in this codebase.
    const all = [...src.matchAll(new RegExp(`\`([^\`]*${p.replace(/\//g, "\\/")})\``, "g"))];
    check(
      `${entry.file}: ${p} appears at all`,
      all.length > 0,
      "the call was renamed or removed -- update this table rather than deleting the check",
    );
    const unprefixed = all.filter((m) => !m[1].startsWith(entry.prefix));
    check(
      `${entry.file}: every ${p} call carries ${entry.prefix}`,
      unprefixed.length === 0,
      `${unprefixed.length} call(s) without the prefix: ${unprefixed
        .map((m) => m[1])
        .join(", ")}\n       ${entry.why}. Without it the call 404s, and a 404 on an ` +
        `endpoint nothing else consumes is invisible.`,
    );
  }
}

// THE DOCS AGREED WITH THE BUG, so they are checked too. A path recorded
// in three places where two are wrong is not a documentation problem, it
// is how the wrong one gets confirmed.
check(
  "the frontend no longer contains a bare /routers/.../wan/basic path",
  !/`\/routers\/\$\{[^}]+\}\/wan\/basic\//.test(
    readFileSync(join(ROOT, "src/services/router-fleet-wizard.service.ts"), "utf8"),
  ),
  "this is the exact string that 404'd",
);

// =====================================================================
// NOTHING MAY POST TO THE PLATFORM-GENERATES-THE-KEYPAIR TUNNEL PATHS
// =====================================================================
// A different shape of the same failure as the /wan/basic one above: not a
// path that 404s, but a path that answers 201 and writes a tunnel which
// cannot exist.
//
// `POST /routers/{id}/wireguard-peer` and `POST
// /routers/{id}/wireguard-peer/rotate` make the keypair on the PLATFORM
// side. `ops/hub-agents/wg_agent.py` exposes only `POST /wg/peer` (which
// mints its own keypair and returns it) and `GET /wg/peers` -- there is no
// verb that accepts a public key the caller already holds. So a
// platform-generated key exists in exactly one place, this platform's
// database, while the hub goes on expecting the previous one, and the
// tunnel it describes can never handshake. The device pulls a private key
// that works and the only symptom is a tunnel that is silently down.
// Confirmed live on router 21e13913: three console "Generate" clicks each
// wrote a keypair no WireGuard implementation anywhere held.
//
// The backend now refuses both with `HubCannotLearnPlatformKeyError` (409),
// so today this is belt-and-braces. It stays because that guard "lifts
// automatically the moment the hub gains a registration verb" (see the
// exception's own docstring) -- and on that day the wrong call would start
// SUCCEEDING again silently, which is the state this whole incident was.
// The only correct path is `.../wireguard-peer/allocate-external`, where
// the hub mints the keypair and both sides therefore know it.
//
// GET and DELETE on `/routers/{id}/wireguard-peer` are perfectly fine --
// different handlers entirely -- so this checks the POST call sites, not
// the string.
{
  const files = ["src/services/router.service.ts", "src/hooks/useRouters.ts"];
  const forbidden = /api\.post[^\n]*`\/routers\/\$\{[^}]+\}\/wireguard-peer(\/rotate)?`/g;
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), "utf8");
    const hits = [...src.matchAll(forbidden)];
    check(
      `${file}: no POST to the platform-keypair tunnel paths`,
      hits.length === 0,
      `${hits.length} call(s): ${hits.map((m) => m[0]).join(", ")}\n       ` +
        "use /routers/{id}/wireguard-peer/allocate-external -- the hub agent has no " +
        "verb to be told a public key it did not generate itself.",
    );
  }
  // And the replacement must actually be there. A check that only forbids
  // is satisfied by deleting the feature.
  check(
    "src/services/router.service.ts: allocate-external is the path that IS called",
    /wireguard-peer\/allocate-external/.test(
      readFileSync(join(ROOT, "src/services/router.service.ts"), "utf8"),
    ),
    "the hub-bridge allocation call was renamed or removed",
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
