/**
 * Regression test for the "Fix a Problem" verdict ladders
 * (`src/lib/connection-verdicts.ts`) and for the page that renders them.
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * This page exists to answer a venue owner standing in front of an unhappy
 * guest. Every failure mode below is a way of telling that person
 * something untrue, ordered by how much damage it does:
 *
 *   1. TELLING A VENUE WHOSE LINE IS DOWN THAT THEIR INTERNET LOOKS FINE.
 *      The management tunnel rides the venue's own WAN, so losing the
 *      router is what an outage LOOKS like from here. There are two
 *      unreachable states and conflating them puts the reassuring copy on
 *      the screen at the worst possible moment. This is checked first.
 *   2. A GREEN TICK OVER A BROKEN VENUE. When everything measurable is
 *      healthy the honest answer is that the problem is in the wireless,
 *      which this hardware cannot see -- the fleet is a wired five-port
 *      MikroTik with no radio. That result must not read as "all good".
 *   3. AN UNCHECKED RUNG READING AS A CLEAN BILL OF HEALTH. The login
 *      history and OTP rungs are not reachable yet; their absence has to
 *      be visible on screen, not silently skipped.
 *   4. INVENTING A MEASUREMENT. No composite score, no signal strength,
 *      no dBm -- there is no radio to ask, and an unexplainable number
 *      costs more trust than it buys.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * pure ladders are bundled with esbuild and executed for real; the wiring
 * is checked against the real component and config sources, because a
 * correct ladder nobody renders is the same bug wearing a disguise.
 *
 * Run: node scripts/test-connection-verdicts.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "connection-verdicts-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export * from "${join(ROOT, "src/lib/connection-verdicts.ts").replace(/\\/g, "/")}";`,
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
const { venueVerdict, guestVerdict, siteVerdict, STALE_AFTER_MS } = await import(
  `file://${outfile}`
);

const NOW = new Date("2026-09-05T20:00:00.000Z").getTime();
const ago = (mins) => new Date(NOW - mins * 60_000).toISOString();

const link = (over = {}) => ({
  id: "l1",
  providerName: "Airtel",
  isPrimary: true,
  status: "up",
  latencyMs: 20,
  packetLossPercent: 0,
  checkedAt: ago(0.2),
  ...over,
});

const venue = (over = {}) =>
  venueVerdict({
    hasRouter: true,
    links: [link()],
    routerLastSeenAt: ago(0.5),
    routerReachable: true,
    guestsOnline: 22,
    now: NOW,
    ...over,
  });

// ---------------------------------------------------------------------------
// 1. The two unreachable states, which must never be confused.
// ---------------------------------------------------------------------------

console.log("\nlosing the router is not the same as the internet being fine");

const darkVenue = venue({
  routerReachable: false,
  routerLastSeenAt: ago(18),
  links: [link({ status: "down", latencyMs: null, packetLossPercent: null })],
});
eq(
  "router silent and no link carrying traffic reads as an outage",
  darkVenue.status,
  "router-unreachable-internet-down",
);
check(
  "...and never tells them their internet looks fine",
  !/looks fine/i.test(`${darkVenue.headline} ${darkVenue.meaning}`),
  darkVenue.headline,
);
check("...and says why we lost the router", /through your own internet/i.test(darkVenue.meaning));
check("...and is coloured as a failure", darkVenue.tone === "danger");
check("...and names how long ago", /18 minutes/.test(darkVenue.headline), darkVenue.headline);
check(
  "...and does not tell them to do nothing",
  !!darkVenue.action && /check/i.test(darkVenue.action),
);

const tunnelOnly = venue({ routerReachable: false, links: [link({ status: "up" })] });
eq(
  "router silent while a link is up reads as our problem, not theirs",
  tunnelOnly.status,
  "router-unreachable-internet-ok",
);
check("...and says the internet looks fine", /looks fine/i.test(tunnelOnly.headline));
check(
  "the two unreachable states are genuinely different verdicts",
  darkVenue.status !== tunnelOnly.status && darkVenue.headline !== tunnelOnly.headline,
);

check(
  "not knowing whether the router is in contact is not a failure",
  venue({ routerReachable: null }).status === "internet-up",
);

// ---------------------------------------------------------------------------
// 2. The rest of the standing answer.
// ---------------------------------------------------------------------------

console.log("\nthe standing answer");

eq(
  "every link down is an outage",
  venue({ routerReachable: true, links: [link({ status: "down" })] }).status,
  "internet-down",
);
const backup = venue({
  links: [link({ status: "down" }), link({ id: "l2", isPrimary: false, status: "up" })],
});
eq("primary down with a backup up is not an outage", backup.status, "on-backup");
check("...and says guests are still online", /still|online|backup/i.test(backup.headline));

eq(
  "a degraded link counts as struggling even with no numbers",
  venue({ links: [link({ status: "degraded", latencyMs: null, packetLossPercent: null })] }).status,
  "internet-slow",
);
eq(
  "high latency counts as struggling",
  venue({ links: [link({ latencyMs: 340 })] }).status,
  "internet-slow",
);
eq(
  "packet loss counts as struggling",
  venue({ links: [link({ packetLossPercent: 4 })] }).status,
  "internet-slow",
);
const slow = venue({ links: [link({ latencyMs: 340, packetLossPercent: 4 })] });
check(
  "...and the measurement survives into the copy",
  /340 ms/.test(slow.meaning) && /4%/.test(slow.meaning),
  slow.meaning,
);

eq("a healthy line just says so", venue().status, "internet-up");
check("...with nothing for the reader to do", venue().action === null);

eq("a location with no router is not an outage", venue({ hasRouter: false }).status, "no-router");
check("...and is not coloured as a failure", venue({ hasRouter: false }).tone !== "danger");

eq(
  "no readings at all is 'we don't know', not 'up' and not 'down'",
  venue({ links: [], routerReachable: true }).status,
  "unknown",
);

// ---------------------------------------------------------------------------
// 3. Freshness -- a swept value is never presented as current.
// ---------------------------------------------------------------------------

console.log("\nfreshness is stated, not assumed");

check("a reading from seconds ago is not stale", venue().stale === false);
check(
  "a reading older than the staleness line is stale",
  venue({ links: [link({ checkedAt: new Date(NOW - STALE_AFTER_MS - 1000).toISOString() })] })
    .stale === true,
);
check(
  "a link that has never been checked is stale",
  venue({ links: [link({ checkedAt: null })] }).stale === true,
);
eq(
  "checkedAt reports the freshest reading, not the first",
  venue({ links: [link({ checkedAt: ago(9) }), link({ id: "l2", checkedAt: ago(1) })] }).checkedAt,
  ago(1),
);

// ---------------------------------------------------------------------------
// 4. No invented measurements anywhere in the copy.
// ---------------------------------------------------------------------------

console.log("\nnothing is invented");

const everyVenueCopy = [
  venue(),
  darkVenue,
  tunnelOnly,
  backup,
  slow,
  venue({ hasRouter: false }),
  venue({ links: [], routerReachable: true }),
]
  .map((v) => `${v.headline} ${v.meaning ?? ""} ${v.action ?? ""}`)
  .join(" ");
check("no dBm anywhere", !/dBm/i.test(everyVenueCopy));
check("no signal strength claim", !/signal strength/i.test(everyVenueCopy));
check("no composite health score", !/health score|out of 10|\/10\b/i.test(everyVenueCopy));
check("no SSID is ever named", !/ssid/i.test(everyVenueCopy));

// ---------------------------------------------------------------------------
// 5. The guest ladder.
// ---------------------------------------------------------------------------

console.log("\nwhy is this one guest having trouble");

const guest = (over = {}) => ({
  identifier: "+91 98765 43210",
  isBlocked: false,
  blockedReason: null,
  lastSeenAt: ago(2),
  ...over,
});
const session = (over = {}) => ({
  startedAt: ago(30),
  lastActivityAt: ago(1),
  bytesDownloaded: 100_000_000,
  dataLimitMb: null,
  ...over,
});
const gv = (over = {}) =>
  guestVerdict({ guest: guest(), session: session(), venue: "internet-up", now: NOW, ...over });

eq(
  "an outage outranks anything about one guest",
  gv({ venue: "internet-down", guest: guest({ isBlocked: true }) }).finding,
  "venue-outage",
);
check(
  "...and says it is not their phone",
  /not just them|nothing wrong with this guest/i.test(
    `${gv({ venue: "internet-down" }).headline} ${gv({ venue: "internet-down" }).meaning}`,
  ),
);
eq(
  "losing the router during an outage outranks it too",
  gv({ venue: "router-unreachable-internet-down" }).finding,
  "venue-outage",
);

const blocked = gv({ guest: guest({ isBlocked: true, blockedReason: "abuse — manager" }) });
eq("a blocked guest is reported as blocked", blocked.finding, "blocked");
eq("...with certainty", blocked.confidence, "certain");
check("...quoting the recorded reason", /abuse — manager/.test(blocked.meaning));
check(
  "a blocked guest with no recorded reason gets no invented one",
  /no reason was recorded/i.test(gv({ guest: guest({ isBlocked: true }) }).meaning),
);

const unknown = gv({ guest: null, session: null });
eq("an unknown number is not rounded up to a fault", unknown.finding, "never-seen");
check("...and points at joining the network", /WiFi settings|join/i.test(unknown.action));
check("...and admits it could not read login history", unknown.notChecked.length > 0);

const capped = gv({ session: session({ bytesDownloaded: 2_100_000_000, dataLimitMb: 2000 }) });
eq("a guest over their allowance is reported as such", capped.finding, "over-allowance");
eq("...with certainty", capped.confidence, "certain");

const quiet = gv({ session: session({ lastActivityAt: ago(40) }) });
eq("a guest gone quiet is reported as such", quiet.finding, "gone-quiet");
eq("...but only with medium confidence", quiet.confidence, "medium");

const notOn = gv({ session: null });
eq("a known guest with no session is not called blocked", notOn.finding, "not-signed-in");
check("...and admits the two rungs it could not reach", notOn.notChecked.length >= 2);

// The one that matters most after the outage case.
const healthy = gv();
eq(
  "everything measurable healthy lands on the wireless boundary",
  healthy.finding,
  "wireless-boundary",
);
check(
  "...and is NOT presented as a clean green tick",
  healthy.tone !== "success",
  `tone was ${healthy.tone}`,
);
check(
  "...and says plainly that we cannot see the wireless",
  /can't measure|cannot see|don't report back/i.test(healthy.meaning),
);
check(
  "...and still gives the venue something to do",
  /access point|WiFi off and on/i.test(healthy.action),
);
check("...and lists what it could not check", healthy.notChecked.length >= 3);
check(
  "...and never invents a signal reading",
  !/dBm|signal strength of|good\/fair\/poor/i.test(`${healthy.meaning} ${healthy.action}`),
);

const everyGuestVerdict = [
  gv({ venue: "internet-down" }),
  blocked,
  unknown,
  capped,
  quiet,
  notOn,
  healthy,
];
check(
  "every guest verdict gives an action",
  everyGuestVerdict.every((v) => typeof v.action === "string" && v.action.length > 0),
);
check(
  "every guest verdict says what it did check",
  everyGuestVerdict.every((v) => Array.isArray(v.checked)),
);

// ---------------------------------------------------------------------------
// 6. The site ladder -- including the DNS distinction that was free all along.
// ---------------------------------------------------------------------------

console.log("\ncan a guest open this one site");

const site = (over = {}) =>
  siteVerdict({
    host: "instagram.com",
    blockedByRule: null,
    reachedControlIp: null,
    reachedHostname: null,
    ...over,
  });

const ruled = site({ blockedByRule: { name: "Social media — evenings", confirmedOnRouter: true } });
eq("a matching rule is reported as blocked", ruled.finding, "blocked-by-rule");
check("...naming the rule", /Social media — evenings/.test(ruled.meaning));
check(
  "...and admitting a VPN walks straight past it",
  /VPN|private-DNS/i.test(ruled.meaning),
  ruled.meaning,
);
const unconfirmed = site({ blockedByRule: { name: "Social", confirmedOnRouter: false } });
eq("an unpushed rule is not stated as device truth", unconfirmed.confidence, "medium");
check(
  "...and says we have not confirmed it reached the router",
  /haven't confirmed/i.test(unconfirmed.meaning),
);

const dns = site({ reachedControlIp: true, reachedHostname: false });
eq("reaching by number but not by name is a DNS fault", dns.finding, "dns-fault");
check("...and says it is not an outage", /not an outage/i.test(dns.meaning));

eq(
  "failing the control probe is an outage, not a site problem",
  site({ reachedControlIp: false }).finding,
  "router-cannot-reach",
);
check(
  "...and says so without blaming the site",
  /isn't about instagram\.com/i.test(site({ reachedControlIp: false }).meaning),
);

const fine = site({ reachedControlIp: true, reachedHostname: true });
eq(
  "a reachable, unblocked site points at the guest's device",
  fine.finding,
  "reachable-so-its-the-device",
);
check("...naming the usual culprits", /VPN|private-DNS|app/i.test(fine.meaning));

const cannotTest = site();
eq("no evidence either way is inconclusive", cannotTest.finding, "inconclusive");
check(
  "...and does not claim the site is fine",
  !/isn't blocked by you, and your router can reach it/i.test(cannotTest.headline),
);

// ---------------------------------------------------------------------------
// 7. Wiring -- the page must actually render these, and must not ask for an IP.
// ---------------------------------------------------------------------------

console.log("\nthe page renders the ladders, and asks the right question");

const page = readFileSync(join(ROOT, "src/components/customer/FixAProblem.tsx"), "utf8");
const nav = readFileSync(join(ROOT, "src/lib/customerNav.ts"), "utf8");
const catalog = readFileSync(join(ROOT, "src/config/customerFeatureCatalog.ts"), "utf8");
const perms = readFileSync(join(ROOT, "src/lib/customerNavPermissions.ts"), "utf8");

check(
  "the page calls all three ladders",
  /venueVerdict\(/.test(page) && /guestVerdict\(/.test(page) && /siteVerdict\(/.test(page),
);
check("no screen asks a venue owner for an IP address", !/User IP address/.test(page));
check(
  "...it asks for a phone number instead",
  /phone number/i.test(page) && /98765 43210/.test(page),
);
check(
  "resetting a guest goes through a confirmation",
  /ConfirmDialog/.test(page) && /Reset this guest's session\?/.test(page),
);
check(
  "the hop table sits behind a disclosure",
  /Show the technical detail/.test(page) && /Disclosure/.test(page),
);
check("the router's heartbeat, not a probe, decides contact", /minutesSince\(/.test(page));
check("what could not be checked is rendered", /notChecked/.test(page));

check('the nav is renamed to "Fix a Problem"', /label: "Fix a Problem"/.test(nav));
check("...in the catalog too", /label: "Fix a Problem"/.test(catalog));
check(
  "front-desk staff are offered the page",
  /id: "debugging"[^}]*roles: \["owner", "agent"\]/.test(nav),
);
check(
  "...and the permission gate accepts the key they actually hold",
  /debugging: \["guest_sessions\.read", "network_diagnostics\.read"\]/.test(perms),
);

console.log(
  failures === 0
    ? `\nall connection verdict checks passed\n`
    : `\n${failures} connection verdict check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
