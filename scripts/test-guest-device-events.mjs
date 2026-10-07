/**
 * Guest Connection Records -> "Device events": the honesty + privacy guards.
 *
 * FAILURE MODES THIS LOCKS DOWN
 *
 *   1. UNKNOWN READ AS "NOTHING HAPPENED". A router that doesn't send device
 *      logs (or didn't yet, during this session) must not render "No events
 *      for this session" -- that sentence is reserved for `covered`.
 *   2. A HELD-BACK EVENT GOING MISSING SILENTLY. Events that matched another
 *      guest's session too are not shown; the count must be said.
 *   3. THE REQUEST WIDENING SCOPE. Only the session id goes in the URL; the
 *      org goes in the scope header, exactly like /guest-sessions.
 *   4. THE DRAWER SHOWING MORE THAN IT SHOULD. No raw router line, no host
 *      name, no user name: the component must not render a `message`,
 *      `hostname` or `username` field, and the CSV must stay one row per
 *      session (the session id is not a column).
 *   5. A HELPER WIRED TO NOTHING. The report must actually open the drawer.
 *
 * Bundles the real module with esbuild and executes it (this repo has no
 * test runner -- see scripts/test-device-logs-presentation.mjs).
 *
 * Run: node scripts/test-guest-device-events.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
let failures = 0;
function check(name, ok, extra = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name}${extra ? ` -- ${extra}` : ""}`);
  }
}

const outdir = mkdtempSync(join(tmpdir(), "guest-device-events-"));
const entry = join(outdir, "entry.mjs");
const p = (rel) => join(ROOT, rel).replace(/\\/g, "/");
writeFileSync(
  entry,
  `export * from "${p("src/lib/guest-device-events-presentation.ts")}";
   export { guestDeviceEventsRequest } from "${p("src/services/guestDeviceEvents.service.ts")}";`,
);
const outfile = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
  alias: { "@": p("src") },
  plugins: [
    {
      name: "stub-api",
      setup(b) {
        b.onResolve({ filter: /^@\/services\/api$/ }, () => ({ path: "api", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
      },
    },
  ],
});
const m = await import(`file://${outfile}`);

const base = {
  session_id: "s1",
  coverage: "covered",
  logging_since: "2026-10-01T00:00:00Z",
  linkable: true,
  window_start: "2026-10-07T07:50:00Z",
  window_end: "2026-10-07T08:40:00Z",
  events: [],
  ambiguous_count: 0,
};
const NO_EVENTS = "No events for this session";

console.log("\nunknown is never 'nothing happened'");
const notSending = m.coverageState({ ...base, coverage: "not_sending", logging_since: null });
check("not_sending is unavailable, not empty", notSending.kind === "unavailable");
check("not_sending names the router", /doesn't send device logs/.test(notSending.title));
check("not_sending never says no events", !notSending.title.includes(NO_EVENTS));
const late = m.coverageState({ ...base, coverage: "not_sending_during_session" });
check("late start is unavailable", late.kind === "unavailable");
check("late start says during this session", /during this session/.test(late.title));
check("late start never says no events", !late.title.includes(NO_EVENTS));
const lateNoDate = m.coverageState({
  ...base,
  coverage: "not_sending_during_session",
  logging_since: "garbage",
});
check("an unparseable date is not printed", !/garbage|Invalid/.test(lateNoDate.description));
const unknown = m.coverageState({ ...base, coverage: "something_new" });
check("an unknown coverage is not treated as covered", unknown.kind === "unavailable");
const unlinkable = m.coverageState({ ...base, linkable: false });
check("no MAC/IP on record is its own state", unlinkable.kind === "unavailable");
check("no MAC/IP says why", /MAC or IP/.test(unlinkable.description));
const empty = m.coverageState(base);
check("covered + empty says no events", empty.kind === "empty" && empty.title === NO_EVENTS);
const withEvents = m.coverageState({
  ...base,
  events: [
    {
      occurred_at: "2026-10-07T07:55:00Z",
      device_time: null,
      kind: "ip_assigned",
      ip_address: "10.5.50.12",
      mac_address: "AA:BB:CC:DD:EE:FF",
      detail: null,
    },
  ],
});
check("covered + events renders the list", withEvents.kind === "events");
const fourStates = [notSending, late, unlinkable, empty].map((s) => s.title);
check("four distinct messages", new Set(fourStates).size === 4, fourStates.join(" | "));

console.log("\nlabels");
check("ip_assigned", m.deviceEventLabel({ kind: "ip_assigned", detail: null }) === "IP assigned");
check("ip_released", m.deviceEventLabel({ kind: "ip_released", detail: null }) === "IP released");
check(
  "router_sign_in",
  m.deviceEventLabel({ kind: "router_sign_in", detail: null }) === "Signed in at the router",
);
check(
  "router_sign_out with reason",
  m.deviceEventLabel({ kind: "router_sign_out", detail: "keepalive timeout" }) ===
    "Signed out at the router (keepalive timeout)",
);
check(
  "a reason is only appended to sign-out",
  m.deviceEventLabel({ kind: "ip_assigned", detail: "x" }) === "IP assigned",
);
check(
  "an unknown kind is not relabelled as a known one",
  m.deviceEventLabel({ kind: "firewall", detail: null }) === "Other router event",
);
check("exactly four known kinds", Object.keys(m.DEVICE_EVENT_LABEL).length === 4);

console.log("\nheld-back events are counted, not hidden");
check("none -> no note", m.heldBackNote(0) === null);
check("one", /^1 router event .* isn't shown/.test(m.heldBackNote(1) ?? ""));
check("several", /^3 router events .* aren't shown/.test(m.heldBackNote(3) ?? ""));
check("footnote says it can be incomplete", /lost/.test(m.DEVICE_EVENTS_FOOTNOTE));
check(
  "footnote makes no compliance claim",
  !/complian|CERT-In|IPDR|legal/i.test(m.DEVICE_EVENTS_FOOTNOTE),
);

console.log("\nrequest");
const req = m.guestDeviceEventsRequest("a/b", "org-1");
check("session id is URL-encoded", req.url === "/guest-sessions/a%2Fb/device-events");
check("org goes in the scope header", req.headers["X-Organization-Id"] === "org-1");
check("no other header", Object.keys(req.headers).length === 1);
check("no query string", !req.url.includes("?"));

console.log("\nwiring + what the drawer may render");
const drawer = readFileSync(
  join(ROOT, "src/components/features/GuestSessionDeviceEventsDrawer.tsx"),
  "utf8",
);
check("drawer uses coverageState", drawer.includes("coverageState(data)"));
check("drawer shows the held-back note", drawer.includes("heldBackNote("));
check("drawer has a failed-read state", /Couldn't load device events/.test(drawer));
check("drawer renders no raw message", !/\.message\b/.test(drawer));
check("drawer renders no host or user name", !/hostname|username|\.user\b/.test(drawer));
check("drawer masks MACs when masked", /masked \? maskMac\(/.test(drawer));
const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
check("report imports the drawer", reports.includes("GuestSessionDeviceEventsDrawer"));
check("rows carry the session id", /sessionId: s\.id \?\? null/.test(reports));
check(
  "only the guest session log gets the action",
  /showDeviceEvents = reportType === "guest-session-log"/.test(reports),
);
const gslCols = reports.slice(
  reports.indexOf('"guest-session-log": ['),
  reports.indexOf('"login-access-log": ['),
);
check("session id is not a column (CSV unchanged)", !gslCols.includes("sessionId"));
check("no device-event column added to the export", !/device.?event/i.test(gslCols));

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nGuest device events: all checks passed");
