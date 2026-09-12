/**
 * "Fix a Problem" must not give a controller-managed venue MikroTik advice.
 *
 * THE DEFECT (observed live, 2026-09-12)
 * -------------------------------------
 * For a router whose `vendor` is `tplink_omada`, `/debugging` rendered:
 *
 *     "We lost contact with your router 1 day ago — and that usually means
 *      your internet is down."
 *     "We reach your router through your own internet connection, so when
 *      your line goes down we lose the router with it."
 *     "Check the lights on your provider's box and on your router."
 *
 * There is no router here and there are no lights. Meanwhile the SAME
 * session's Dashboard, reading the SAME row through `deriveRouterLiveness`,
 * correctly said there is no check-in to wait for. Two surfaces, opposite
 * answers, one router -- because `connection-verdicts.ts` had zero vendor
 * awareness (`grep -n "vendor\|controller"` returned nothing) and a module
 * docstring still asserting "the fleet is MikroTik hEX lite / RB750r2".
 *
 * WHY THE UNREACHABLE RUNG FIRED AT ALL, which is the subtle part: nothing
 * heartbeats a controller, but its row still carries a `last_seen_at` (the
 * row being written). `minutesSince` therefore returned a large number, the
 * page concluded "not reachable", and the loudest, most alarming rung on the
 * page fired on a venue where nothing was wrong. An absence of measurement
 * was being spent as evidence of failure.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. NEITHER UNREACHABLE RUNG MAY FIRE when liveness is not measured. This
 *      is the defect. Silence from a device that never speaks is not news.
 *   2. A RECORDED FAULT STILL OUTRANKS EVERYTHING. Vendor-awareness may
 *      suppress a claim we never measured; never one we were handed. A
 *      controller marked down must still be the loudest thing on the page,
 *      and must outrank a single guest's lookup.
 *   3. NO MIKROTIK VOCABULARY SURVIVES on a controller venue -- no "router",
 *      no "lights", no "setup script", no tunnel, and nothing about
 *      WireGuard/RADIUS/NAS, which is the product's hard constraint.
 *   4. THE ISP READING IS STILL REPORTED. Uplink health is a real measurement
 *      taken elsewhere; a controller venue whose line is down must still be
 *      told its line is down.
 *   5. EVERY EXISTING AGENT-MANAGED VERDICT IS BYTE-IDENTICAL. The signal
 *      defaults to "measured", so no pre-existing caller moves.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs` for the same note). The verdict
 * ladders are pure functions over normalized inputs, bundled and executed.
 *
 * Run: node scripts/test-controller-venue-verdicts.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
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

const outdir = mkdtempSync(join(tmpdir(), "controller-verdicts-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { venueVerdict, guestVerdict } from "${join(ROOT, "src/lib/connection-verdicts.ts").replace(/\\/g, "/")}";`,
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
const { venueVerdict, guestVerdict } = await import(`file://${outfile}`);

const NOW = Date.parse("2026-09-12T12:00:00.000Z");
const A_DAY_AGO = "2026-09-11T12:00:00.000Z";

const LINK_UP = {
  id: "l-1",
  providerName: "Airtel",
  isPrimary: true,
  status: "up",
  latencyMs: 20,
  packetLossPercent: 0,
  checkedAt: "2026-09-12T11:58:00.000Z",
};
const LINK_DOWN = { ...LINK_UP, status: "down" };

/** The production shape: a controller row with a stale timestamp that is not
 * a missed heartbeat, because there is no heartbeat. */
const controllerVenue = (over = {}) =>
  venueVerdict({
    hasRouter: true,
    links: [],
    routerLastSeenAt: A_DAY_AGO,
    // `null`, as the page now computes it: there is no heartbeat age to be
    // stale, so any boolean here would be an invented measurement.
    routerReachable: null,
    guestsOnline: 3,
    routerLivenessMeasured: false,
    controllerVendorLabel: "TP-Link Omada",
    now: NOW,
    ...over,
  });

/* ── 1. The defect ─────────────────────────────────────────────────────── */

console.log("\n1. Neither unreachable rung fires on a controller venue");

const plain = controllerVenue();
check(
  "status is not router-unreachable-internet-down",
  plain.status !== "router-unreachable-internet-down",
  plain.status,
);
check(
  "status is not router-unreachable-internet-ok",
  plain.status !== "router-unreachable-internet-ok",
  plain.status,
);
check("it lands on the controller-not-measured rung", plain.status === "controller-not-measured");
check("tone is neutral, not danger", plain.tone === "neutral", plain.tone);
check("nothing is reported as lost", !/lost contact/i.test(plain.headline), plain.headline);

// Even when the page DOES hand it a false -- belt and braces, because the
// gate must live in the ladder rather than only in the caller.
const forced = controllerVenue({ routerReachable: false });
check(
  "a routerReachable:false is still not spent as an outage",
  forced.status === "controller-not-measured",
  forced.status,
);

/* ── 2. A recorded fault still wins ────────────────────────────────────── */

console.log("\n2. A controller recorded as down is still the loudest thing");

const down = controllerVenue({ controllerReportedDown: true });
check("status is controller-down", down.status === "controller-down", down.status);
check("tone is danger", down.tone === "danger");
check("it names the brand", /TP-Link Omada/.test(down.headline), down.headline);

// Even with the venue's own line demonstrably carrying traffic: guests still
// cannot get on, so "your internet is working" would answer the wrong
// question at the worst moment.
const downButLineUp = controllerVenue({ controllerReportedDown: true, links: [LINK_UP] });
check(
  "outranks a healthy uplink",
  downButLineUp.status === "controller-down",
  downButLineUp.status,
);

// ...and it outranks a single guest's lookup.
const g = guestVerdict({
  guest: null,
  session: null,
  venue: "controller-down",
  now: NOW,
});
check("a guest lookup defers to it", g.finding === "venue-outage", g.finding);
check(
  "but does not claim the internet line is down",
  !/your internet is down/i.test(g.headline),
  g.headline,
);

/* ── 3. No MikroTik vocabulary, and no tunnel internals ────────────────── */

console.log("\n3. No agent vocabulary and no tunnel internals reach the owner");

const allText = (v) => `${v.headline} ${v.meaning ?? ""} ${v.action ?? ""}`;
for (const [label, v] of [
  ["not measured", plain],
  ["reported down", down],
]) {
  const text = allText(v);
  check(`${label}: no "lights on your provider's box"`, !/lights/i.test(text), text);
  check(`${label}: no setup script`, !/setup script/i.test(text));
  check(
    `${label}: nothing about WireGuard / RADIUS / NAS / tunnels`,
    !/wireguard|radius|\bnas\b|tunnel/i.test(text),
    text,
  );
  check(
    `${label}: does not say we reach "your router" through your line`,
    !/we reach your router/i.test(text),
    text,
  );
}
check(
  "the not-measured copy says nothing has gone wrong",
  /nothing here has gone wrong/i.test(allText(plain)),
  allText(plain),
);
check(
  "and points at what still works",
  /guest sign-ins|sessions|lookup/i.test(allText(plain)),
  allText(plain),
);

/* ── 4. Real uplink measurements still reported ────────────────────────── */

console.log("\n4. The venue's own uplink reading survives");

const lineDown = controllerVenue({ links: [LINK_DOWN] });
check("an all-down line is still reported", lineDown.status === "internet-down", lineDown.status);
const lineUp = controllerVenue({ links: [LINK_UP] });
check("a healthy line is still reported", lineUp.status === "internet-up", lineUp.status);

/* ── 5. Agent-managed venues are untouched ─────────────────────────────── */

console.log("\n5. Every pre-existing agent-managed verdict is unchanged");

const agentSignals = {
  hasRouter: true,
  links: [],
  routerLastSeenAt: A_DAY_AGO,
  routerReachable: false,
  guestsOnline: 3,
  now: NOW,
};
// No `routerLivenessMeasured` at all -- the field is optional and undefined
// must mean "measured", or every existing caller silently changes behaviour.
const agent = venueVerdict(agentSignals);
check(
  "an omitted routerLivenessMeasured still means measured",
  agent.status === "router-unreachable-internet-down",
  agent.status,
);
check("and still gives the MikroTik advice it should", /lights/i.test(allText(agent)));
check(
  "explicitly true behaves identically",
  venueVerdict({ ...agentSignals, routerLivenessMeasured: true }).status ===
    "router-unreachable-internet-down",
);
check(
  "the unreachable-but-line-up rung still works",
  venueVerdict({ ...agentSignals, links: [LINK_UP] }).status === "router-unreachable-internet-ok",
);
check(
  "a venue with no router is unchanged",
  venueVerdict({ ...agentSignals, hasRouter: false }).status === "no-router",
);
check(
  "the generic unknown still exists for an agent-managed venue",
  venueVerdict({ ...agentSignals, routerReachable: null }).status === "unknown",
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
