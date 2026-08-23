/**
 * Regression test for the customer dashboard's location-liveness verdict.
 *
 * FAILURE MODE THIS LOCKS DOWN (reported 2026-08-23, provisioning a real
 * MikroTik at "sector 12"): the venue owner's dashboard said the location
 * was not live and said nothing else. Four materially different situations
 * shared that one word:
 *
 *   1. no router has been added to this location at all
 *   2. a router exists but has never checked in
 *   3. it checked in once and has since gone silent
 *   4. it is genuinely online
 *
 * and a fifth was silently folded into "offline" as well: the
 * `/locations/{id}/routers` read *failing*, because `listLocations()`
 * turned a rejected request into an empty array. Four different problems,
 * four different fixes, one red pill.
 *
 * The load-bearing assertions here are the directions the guards must
 * never drift in. In rough order of how badly a regression would hurt:
 *
 *   1. UNKNOWN MUST NEVER RENDER AS A DEFINITE STATE. A failed read, an
 *      unrecognised backend status, a missing or unparseable or
 *      future-dated `last_seen_at` -- every one of those must come out as
 *      `unknown`, never as `live` and never as `not-live`. This repo has
 *      already shipped one stat that answered a question it had not asked
 *      (`WireGuard: Reachable`, derived from the WAN heartbeat -- see
 *      `scripts/test-discovery-preflight.mjs`). The `is-not-live` and
 *      `is-not-not-live` pairs below exist so a second one cannot land.
 *
 *   2. THE FOUR STATES MUST STAY FOUR STATES. Distinct labels, distinct
 *      summaries, distinct next steps.
 *
 *   3. "NEVER SEEN" AND "LAST SEEN 3 HOURS AGO" MUST READ DIFFERENTLY --
 *      and a `provisioning` router's `last_seen_at` (which is the
 *      provisioning-token exchange, not a heartbeat) must never be
 *      reported as a check-in. That timestamp was the single most
 *      misleading fact available on the night this was reported: the
 *      router had "last seen 3 hours ago" and had never once checked in.
 *
 * Also asserts the source-level bindings, since a correct predicate wired
 * to nothing is the same bug wearing a disguise.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-portal-cna-storage-safety.mjs` for the same note). The
 * pure derivation is bundled with esbuild and executed for real; the
 * wiring is checked against the real component and service sources.
 *
 * Run: node scripts/test-location-liveness.mjs
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

// ---------------------------------------------------------------------------
// Bundle the real derivation.
// ---------------------------------------------------------------------------

const outdir = mkdtempSync(join(tmpdir(), "location-liveness-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export {
     deriveLocationLiveness,
     deriveRouterLiveness,
     lastContactLabel,
     locationLivenessIsReassuring,
     livenessTone,
     formatAgo,
     minutesSince,
     CHECKING_LIVENESS,
     UNKNOWN_LIVENESS,
     HEARTBEAT_LATE_AFTER_MINUTES,
     HEARTBEAT_SILENT_AFTER_MINUTES,
   } from "${join(ROOT, "src/lib/location-liveness.ts").replace(/\\/g, "/")}";`,
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

const {
  deriveLocationLiveness,
  deriveRouterLiveness,
  lastContactLabel,
  locationLivenessIsReassuring,
  livenessTone,
  formatAgo,
  minutesSince,
  CHECKING_LIVENESS,
  UNKNOWN_LIVENESS,
  HEARTBEAT_LATE_AFTER_MINUTES,
  HEARTBEAT_SILENT_AFTER_MINUTES,
} = await import(`file://${outfile}`);

const NOW = new Date("2026-08-23T12:00:00.000Z");
/** ISO timestamp `minutes` before NOW (negative == in the future). */
const ago = (minutes) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const at = (overrides) => ({ id: "r1", name: "Lobby router", ...overrides });

/** The exact row the live database held on the night this was reported. */
const SECTOR_12_ROUTER = at({ status: "provisioning", last_seen_at: ago(180) });

const loc = (routers) => deriveLocationLiveness(routers, NOW);

// ---------------------------------------------------------------------------
// 1. Unknown must never render as a definite state.
// ---------------------------------------------------------------------------

console.log("\nunknown is never a definite state");

check("failed-router-read-is-unknown", loc(null).state === "unknown", loc(null).state);
check("failed-router-read-is-not-live", loc(null).state !== "live");
check("failed-router-read-is-not-offline", loc(null).state !== "not-live");
check("failed-router-read-is-not-no-router", loc(null).state !== "no-router");
check(
  "failed-router-read-reports-no-counts",
  loc(null).routersOnline === null && loc(null).routersTotal === null,
  `${loc(null).routersOnline}/${loc(null).routersTotal}`,
);
check(
  "null-routers-and-empty-routers-are-different-answers",
  loc(null).state !== loc([]).state && loc(null).summary !== loc([]).summary,
);

const weird = loc([at({ status: "quantum", last_seen_at: ago(1) })]);
check("unrecognized-router-status-is-not-live", weird.state !== "live", weird.state);
check("unrecognized-router-status-is-not-offline", weird.state !== "not-live", weird.state);
check("unrecognized-router-status-is-unknown", weird.state === "unknown", weird.state);
check(
  "unrecognized-router-status-quotes-what-it-saw",
  weird.routers[0].detail.includes("quantum"),
  weird.routers[0].detail,
);

const noStatus = loc([at({ status: null, last_seen_at: ago(1) })]);
check("missing-router-status-is-not-live", noStatus.state !== "live", noStatus.state);
check("missing-router-status-is-unknown", noStatus.state === "unknown", noStatus.state);

// `status: "online"` alone is NOT liveness: nothing in the backend ever
// writes the online->offline transition, so the column can be years stale.
const onlineNoStamp = loc([at({ status: "online", last_seen_at: null })]);
check(
  "online-without-a-timestamp-is-not-reported-as-live",
  onlineNoStamp.state === "unknown",
  onlineNoStamp.state,
);
const onlineBadStamp = loc([at({ status: "online", last_seen_at: "not-a-date" })]);
check(
  "online-with-an-unparseable-timestamp-is-not-reported-as-live",
  onlineBadStamp.state === "unknown",
  onlineBadStamp.state,
);
// A negative age would otherwise sail under every staleness threshold and
// render a long-dead router as freshly seen.
const onlineFuture = loc([at({ status: "online", last_seen_at: ago(-60) })]);
check(
  "future-timestamp-is-not-treated-as-a-fresh-heartbeat",
  onlineFuture.state === "unknown",
  onlineFuture.state,
);
check("future-timestamp-refuses-to-be-measured", minutesSince(ago(-60), NOW) === null);
check("small-clock-skew-is-still-measured", minutesSince(ago(-1), NOW) !== null);

// ---------------------------------------------------------------------------
// 2. Nothing unproven may be rendered as reassurance.
// ---------------------------------------------------------------------------

console.log("\nonly a proven live venue is reassuring");

check(
  "live-venue-is-reassuring",
  locationLivenessIsReassuring(loc([at({ status: "online", last_seen_at: ago(1) })])) === true,
);
check("unknown-venue-is-not-reassuring", locationLivenessIsReassuring(loc(null)) === false);
check("venue-with-no-router-is-not-reassuring", locationLivenessIsReassuring(loc([])) === false);
check(
  "not-live-venue-is-not-reassuring",
  locationLivenessIsReassuring(loc([SECTOR_12_ROUTER])) === false,
);
check(
  "partly-live-venue-is-not-reassuring",
  locationLivenessIsReassuring(
    loc([
      at({ id: "a", status: "online", last_seen_at: ago(1) }),
      at({ id: "b", ...SECTOR_12_ROUTER }),
    ]),
  ) === false,
);
check(
  "still-checking-is-not-reassuring",
  locationLivenessIsReassuring(CHECKING_LIVENESS) === false,
);
check("absent-liveness-is-not-reassuring", locationLivenessIsReassuring(null) === false);
check(
  "unknown-fallback-matches-the-derived-unknown",
  UNKNOWN_LIVENESS.state === "unknown" && UNKNOWN_LIVENESS.summary === loc(null).summary,
);

// "No router yet" and "can't tell" are not faults and must not wear the
// colour of one -- that colour IS the collapse being undone here.
check("unknown-does-not-borrow-the-offline-colour", livenessTone("unknown") === "neutral");
check("no-router-does-not-borrow-the-offline-colour", livenessTone("no-router") === "neutral");
check("not-live-is-the-only-down-tone", livenessTone("not-live") === "down");
check("live-is-the-only-live-tone", livenessTone("live") === "live");

// ---------------------------------------------------------------------------
// 3. The four situations are four different answers.
// ---------------------------------------------------------------------------

console.log("\nfour situations, four answers");

const noRouter = loc([]);
const neverCheckedIn = loc([SECTOR_12_ROUTER]);
const wentSilent = loc([at({ status: "online", last_seen_at: ago(180) })]);
const live = loc([at({ status: "online", last_seen_at: ago(1) })]);

check("no-router-names-itself", noRouter.state === "no-router", noRouter.state);
check(
  "no-router-says-no-router-has-been-added",
  /no router has been added/i.test(noRouter.summary),
  noRouter.summary,
);
check(
  "no-router-next-step-is-to-add-one",
  /add a router/i.test(noRouter.nextStep ?? ""),
  String(noRouter.nextStep),
);

check("never-checked-in-is-not-live", neverCheckedIn.state === "not-live", neverCheckedIn.state);
check(
  "never-checked-in-says-never-checked-in",
  /never checked in/i.test(neverCheckedIn.summary),
  neverCheckedIn.summary,
);
check(
  "never-checked-in-badge-is-not-the-word-offline",
  neverCheckedIn.label === "Never checked in",
  neverCheckedIn.label,
);
// The whole point of the report: name the block AND the fix.
check(
  "never-checked-in-next-step-names-the-heartbeat-block",
  /heartbeat block/i.test(neverCheckedIn.nextStep ?? ""),
  String(neverCheckedIn.nextStep),
);
check(
  "never-checked-in-next-step-explains-the-single-line-paste",
  /single line/i.test(neverCheckedIn.nextStep ?? ""),
  String(neverCheckedIn.nextStep),
);

check("gone-quiet-is-not-live", wentSilent.state === "not-live", wentSilent.state);
check(
  "gone-quiet-says-when-it-was-last-heard-from",
  /3 hours ago/.test(wentSilent.summary),
  wentSilent.summary,
);
check(
  "gone-quiet-is-not-confused-with-never-checked-in",
  !/never checked in/i.test(wentSilent.summary),
  wentSilent.summary,
);

check("online-venue-is-live", live.state === "live", live.state);

const labels = new Set([noRouter.label, neverCheckedIn.label, wentSilent.label, live.label]);
check("the-four-states-have-four-distinct-labels", labels.size === 4, [...labels].join(" | "));
const summaries = new Set([
  noRouter.summary,
  neverCheckedIn.summary,
  wentSilent.summary,
  live.summary,
  loc(null).summary,
]);
check("the-five-outcomes-have-five-distinct-summaries", summaries.size === 5);

// ---------------------------------------------------------------------------
// 4. "Never seen" and "last seen 3 hours ago" must read differently -- and
//    an enrolment stamp must never be reported as a check-in.
// ---------------------------------------------------------------------------

console.log("\nlast contact");

const neverSeen = deriveRouterLiveness(at({ status: "pending_provisioning" }), NOW);
const seenThreeHoursAgo = deriveRouterLiveness(
  at({ status: "online", last_seen_at: ago(180) }),
  NOW,
);
check(
  "never-seen-and-last-seen-read-differently",
  lastContactLabel(neverSeen, NOW) !== lastContactLabel(seenThreeHoursAgo, NOW),
);
check(
  "never-seen-says-never",
  /never heard from/i.test(lastContactLabel(neverSeen, NOW)),
  lastContactLabel(neverSeen, NOW),
);
check(
  "last-seen-says-when",
  lastContactLabel(seenThreeHoursAgo, NOW) === "Last check-in 3 hours ago",
  lastContactLabel(seenThreeHoursAgo, NOW),
);

// The single most misleading fact available on the night this was
// reported. `check_in` (the provisioning-token exchange) stamps
// `last_seen_at`; only `heartbeat` means the agent is alive.
const enrolled = deriveRouterLiveness(SECTOR_12_ROUTER, NOW);
check(
  "enrolment-timestamp-is-not-labelled-a-check-in",
  !/last check-in/i.test(lastContactLabel(enrolled, NOW)),
  lastContactLabel(enrolled, NOW),
);
check(
  "enrolment-timestamp-says-what-it-actually-is",
  /setup started 3 hours ago/i.test(lastContactLabel(enrolled, NOW)),
  lastContactLabel(enrolled, NOW),
);
check("enrolment-timestamp-is-tagged-as-such", enrolled.lastContactKind === "enrolment");
check("heartbeat-timestamp-is-tagged-as-such", seenThreeHoursAgo.lastContactKind === "heartbeat");
check("no-contact-at-all-is-tagged-as-such", neverSeen.lastContactKind === "none");

check("formatAgo-renders-minutes", formatAgo(ago(3), NOW) === "3 minutes ago");
check("formatAgo-renders-hours", formatAgo(ago(180), NOW) === "3 hours ago");
check("formatAgo-renders-days", formatAgo(ago(60 * 24 * 2), NOW) === "2 days ago");
check("formatAgo-refuses-a-missing-timestamp", formatAgo(null, NOW) === null);
check("formatAgo-refuses-an-unparseable-timestamp", formatAgo("soon", NOW) === null);

// ---------------------------------------------------------------------------
// 5. Staleness, at the backend's own thresholds.
// ---------------------------------------------------------------------------

console.log("\nheartbeat staleness");

check("thresholds-mirror-the-backend", HEARTBEAT_LATE_AFTER_MINUTES === 5);
check("silent-threshold-mirrors-the-backend", HEARTBEAT_SILENT_AFTER_MINUTES === 15);

const fresh = deriveRouterLiveness(at({ status: "online", last_seen_at: ago(1) }), NOW);
const late = deriveRouterLiveness(
  at({ status: "online", last_seen_at: ago(HEARTBEAT_LATE_AFTER_MINUTES + 1) }),
  NOW,
);
const silent = deriveRouterLiveness(
  at({ status: "online", last_seen_at: ago(HEARTBEAT_SILENT_AFTER_MINUTES) }),
  NOW,
);
check("fresh-heartbeat-is-online", fresh.state === "online", fresh.state);
check("late-heartbeat-is-still-alive", late.status === "pass", late.status);
check("late-heartbeat-says-it-is-late", late.state === "heartbeat-late", late.state);
check(
  "late-heartbeat-still-explains-itself",
  /later than the 5-minute schedule/.test(late.detail),
  late.detail,
);
check("stale-heartbeat-is-not-alive", silent.status === "fail", silent.status);
check("silent-threshold-is-inclusive", silent.state === "went-silent", silent.state);
check(
  "a-venue-whose-only-router-is-stale-is-not-live",
  loc([at({ status: "online", last_seen_at: ago(HEARTBEAT_SILENT_AFTER_MINUTES + 1) })]).state ===
    "not-live",
);

// ---------------------------------------------------------------------------
// 6. Aggregating several routers.
// ---------------------------------------------------------------------------

console.log("\naggregation");

const twoOneDown = loc([
  at({ id: "a", name: "Ground floor", status: "online", last_seen_at: ago(1) }),
  at({ id: "b", name: "First floor", status: "online", last_seen_at: ago(120) }),
]);
check(
  "one-of-two-checking-in-is-partly-live",
  twoOneDown.state === "partly-live",
  twoOneDown.state,
);
check(
  "partly-live-names-the-router-that-is-not",
  twoOneDown.summary.includes("First floor"),
  twoOneDown.summary,
);
check(
  "partly-live-counts-honestly",
  twoOneDown.routersOnline === 1 && twoOneDown.routersTotal === 2,
);

// An unrecognised router alongside no live one must block a definite
// verdict: we do not know that nothing here is up.
const unknownAndDown = loc([
  at({ id: "a", status: "quantum" }),
  at({ id: "b", ...SECTOR_12_ROUTER }),
]);
check(
  "an-unverifiable-router-blocks-a-not-live-verdict",
  unknownAndDown.state === "unknown",
  unknownAndDown.state,
);
check(
  "an-unverifiable-router-blocked-verdict-reports-no-online-count",
  unknownAndDown.routersOnline === null,
);
// ...but it must NOT block a verdict we can actually support.
const unknownAndUp = loc([
  at({ id: "a", status: "quantum" }),
  at({ id: "b", status: "online", last_seen_at: ago(1) }),
]);
check(
  "an-unverifiable-router-does-not-hide-a-router-we-know-is-up",
  unknownAndUp.state === "partly-live",
  unknownAndUp.state,
);

const threeDown = loc([
  at({ id: "a", name: "A", status: "offline", last_seen_at: ago(400) }),
  at({ id: "b", name: "B", ...SECTOR_12_ROUTER }),
  at({ id: "c", name: "C", status: "suspended" }),
]);
check(
  "multi-router-summary-counts-the-others",
  /2 other routers here are also not checking in/.test(threeDown.summary),
  threeDown.summary,
);
check(
  "multi-router-summary-leads-with-the-most-actionable",
  threeDown.label === "Never checked in",
  threeDown.label,
);
const threeDownReordered = loc([
  at({ id: "c", name: "C", status: "suspended" }),
  at({ id: "b", name: "B", ...SECTOR_12_ROUTER }),
  at({ id: "a", name: "A", status: "offline", last_seen_at: ago(400) }),
]);
check(
  "the-spokesperson-does-not-depend-on-api-ordering",
  threeDown.label === threeDownReordered.label && threeDown.summary === threeDownReordered.summary,
);

// Every remaining backend status still gets a real sentence rather than
// falling into the unknown bucket, so `unknown` keeps meaning "we could
// not tell" rather than "we did not write this branch".
for (const status of [
  "pending_provisioning",
  "provisioning",
  "online",
  "offline",
  "suspended",
  "decommissioned",
]) {
  const r = deriveRouterLiveness(at({ status, last_seen_at: ago(1) }), NOW);
  check(`known-backend-status-is-handled: ${status}`, r.state !== "unknown", r.state);
}

// ---------------------------------------------------------------------------
// 7. The wiring. A correct verdict bound to nothing is still the bug.
// ---------------------------------------------------------------------------

console.log("\nwiring");

const service = readFileSync(join(ROOT, "src/services/customer.service.ts"), "utf8");

// The original defect: a rejected routers request became `[]`, which then
// rendered as the confident, wrong word "Offline".
check(
  "listLocations-treats-a-failed-routers-read-as-unknown",
  /routersR\.status === "fulfilled" \? \(routersR\.value\.data\?\.items \?\? \[\]\) : null/.test(
    service,
  ),
);
check(
  "getDashboard-treats-a-failed-routers-read-as-unknown",
  /rR\.status === "fulfilled" \? \(rR\.value\.data\?\.items \?\? \[\]\) : null/.test(service),
);
check(
  "no-call-site-still-swallows-a-failed-routers-read-into-an-empty-array",
  // The lookbehind matters: without it `rR` also matches inside
  // `routerR` (the admin-logs router-events fetch), whose `: []` is
  // correct and unrelated.
  !/(?<![A-Za-z])(routersR|rR)\.value\.data\?\.items \?\? \[\]\) : \[\]/.test(service),
);
check(
  "the-three-way-status-collapse-is-gone-from-the-service",
  !/onR === 0 && tR > 0 \? "offline"/.test(service),
);
check(
  "both-service-paths-derive-liveness",
  (service.match(/deriveLocationLiveness\(/g) ?? []).length >= 3,
);
check(
  "router-count-strings-refuse-to-invent-a-zero",
  service.includes('systemHealth: "Unknown", routersOnline: "Unknown"'),
);

const picker = readFileSync(join(ROOT, "src/routes/switch-location.tsx"), "utf8");
check("venue-cards-render-the-shared-badge", picker.includes("<LocationLivenessBadge"));
check(
  "venue-cards-no-longer-hand-roll-the-three-way-collapse",
  !/loc\.status === "online"\s*\?\s*"Online"/.test(picker),
);
check("venue-cards-show-the-reason", picker.includes("{loc.liveness.summary}"));
check(
  "venue-health-percentage-is-omitted-when-there-is-none",
  picker.includes("loc.routerHealth !== null &&"),
);

const dash = readFileSync(join(ROOT, "src/components/customer/CustomerDashboardPage.tsx"), "utf8");
// The header's old else-branch painted "still loading" and "could not be
// read" the same red as a genuinely dead venue.
check(
  "dashboard-header-no-longer-falls-through-to-a-red-dot",
  !/activeLocation\?\.status === "online"[\s\S]{0,200}bg-rose-400/.test(dash),
);
check("dashboard-header-renders-the-shared-badge", dash.includes("<LocationLivenessBadge"));
check("dashboard-header-has-a-loading-state-of-its-own", dash.includes("CHECKING_LIVENESS"));
check(
  "dashboard-header-survives-a-summary-persisted-before-liveness-existed",
  dash.includes("UNKNOWN_LIVENESS"),
);
// The strip that reassured unconditionally: a green tick beside "0/1".
check(
  "core-systems-icons-are-not-unconditionally-green",
  !/className="h-3\.5 w-3\.5 text-emerald-500"/.test(dash),
);
check("core-systems-icons-follow-the-verdict", dash.includes("CORE_ICON[livenessTone("));
check("dashboard-explains-why-it-is-not-live", dash.includes("<LocationLivenessExplainer"));
// The ISP pill is not an ISP signal (see getDashboard()); it must not wear
// a status icon that implies it is one.
check(
  "the-isp-pill-does-not-claim-a-status-it-never-measured",
  /<Activity aria-hidden className="h-3\.5 w-3\.5 text-muted-foreground" \/>/.test(dash),
);

const feature = readFileSync(join(ROOT, "src/components/customer/CustomerFeaturePage.tsx"), "utf8");
check(
  "the-other-page-rendering-the-same-payload-explains-itself-too",
  feature.includes("<LocationLivenessExplainer"),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
