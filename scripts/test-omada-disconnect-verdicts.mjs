/**
 * The three booleans, and the errors that must not be collapsed into
 * "something went wrong".
 *
 * WHY THIS SUITE EXISTS
 * ---------------------
 * `POST /network-integrations/{id}/clients/disconnect` (cloud-guest #214)
 * answers with three separate facts:
 *
 *   disconnected              the device stopped forwarding traffic
 *   had_active_authorization  there was a live grant to remove
 *   guest_session_ended       our own GuestSession row was closed
 *
 * Every previous attempt at this feature collapsed them. The two that cost
 * the most, and that this file pins:
 *
 *   1. `disconnected: true, had_active_authorization: false` IS A SUCCESS.
 *      The guest's grant had already lapsed; the end state the operator
 *      asked for now holds. Rendering it as a warning teaches operators to
 *      press the button twice and then call support.
 *
 *   2. A 502/504 MEANS NOTHING CHANGED. The backend calls the controller
 *      before it writes any row and raises on failure, so the venue is
 *      provably untouched. An operator who thinks a half-action occurred
 *      does something worse next -- resets the AP, deletes the guest.
 *
 * And one correction that is pinned so it cannot be re-introduced:
 *
 *   3. A 501 IS A MISSING CREDENTIAL, NOT A MISSING CAPABILITY.
 *      `~/wyfy-omada/CHANGE-REQUESTS.md` CR-006 told the frontend that
 *      Omada can only do this in `openapi` mode and that `legacy` should be
 *      disabled with copy saying so. That is backwards -- disproved on an
 *      Omada Software Controller 5.15.24.19 on 2026-09-11; the disconnect
 *      rides the hotspot *operator* session and `legacy` is the mode this
 *      fleet runs. So the copy must name the missing operator account, must
 *      never say Omada cannot do this, and nothing in the module may branch
 *      on the auth mode at all.
 *
 * Pure module, so every combination is driven directly -- including the
 * ones a browser would make you click through.
 *
 * Run: node scripts/test-omada-disconnect-verdicts.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const outdir = mkdtempSync(join(tmpdir(), "omada-disconnect-verdicts-"));
const outfile = join(outdir, "bundle.cjs");
const SOURCE_PATH = join(ROOT, "src/lib/omada-disconnect.ts");

await build({
  entryPoints: [SOURCE_PATH],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile,
  logLevel: "silent",
  absWorkingDir: ROOT,
  nodePaths: [join(ROOT, "node_modules")],
  loader: { ".ts": "ts" },
});

const m = createRequire(import.meta.url)(outfile);
const { describeDisconnectResult, describeDisconnectFailure, pickIntegrationForLocation } = m;

/** A 200 body with every field present, so each test varies exactly one. */
function result(over = {}) {
  return {
    disconnected: true,
    provider: "omada",
    clientMac: "AA:BB:CC:DD:EE:77",
    hadActiveAuthorization: true,
    deauthorizedAt: "2026-09-11T09:20:00Z",
    guestSessionId: "11111111-1111-1111-1111-111111111111",
    guestSessionEnded: true,
    ...over,
  };
}

const all = (v) => `${v.title} ${v.lines.join(" ")}`.toLowerCase();

console.log("\n-- the plain success --");
{
  const v = describeDisconnectResult(result());
  check("a live grant removed is a success", v.tone === "success", `tone=${v.tone}`);
  check("it reports the device is off the network", v.accessEnded === true);
  check("it says the grant was live and has been removed", all(v).includes("live grant"));
  check("it does not promise nothing changed", v.nothingChanged === false);
}

console.log("\n-- the lapsed-grant success (the one that gets rendered wrong) --");
{
  const v = describeDisconnectResult(result({ hadActiveAuthorization: false }));
  check(
    "disconnected:true + had_active_authorization:false is a SUCCESS, not a warning",
    v.tone === "success",
    `tone=${v.tone}`,
  );
  check(
    "accessEnded still true -- had_active_authorization must not weaken it",
    v.accessEnded === true,
  );
  check("it explains the grant had already lapsed", all(v).includes("already lapsed"));
  check("it states the end state holds anyway", all(v).includes("not on the network now"));
  const words = all(v);
  check(
    "no failure vocabulary reaches the operator",
    !words.includes("failed") &&
      !words.includes("error") &&
      !words.includes("could not") &&
      !words.includes("problem"),
    words,
  );
}

console.log("\n-- guest_session_ended is its own fact --");
{
  const ended = describeDisconnectResult(result({ guestSessionEnded: true }));
  check("session closed is stated", all(ended).includes("session was closed"));

  const already = describeDisconnectResult(
    result({ guestSessionEnded: false, guestSessionId: "abc" }),
  );
  check(
    "a session that was already over reads as already closed",
    all(already).includes("already closed"),
  );
  check("and is still a success", already.tone === "success" && already.accessEnded === true);

  const none = describeDisconnectResult(result({ guestSessionEnded: false, guestSessionId: null }));
  check("no linked session says exactly that", all(none).includes("no open wyfy session"));
  check("and is still a success", none.tone === "success" && none.accessEnded === true);
}

console.log("\n-- it is not a ban, and never says it is --");
{
  for (const over of [{}, { hadActiveAuthorization: false }, { guestSessionEnded: false }]) {
    const v = describeDisconnectResult(result(over));
    check(
      `every success says it is not a ban (${JSON.stringify(over)})`,
      all(v).includes("not a ban") && all(v).includes("sign in again"),
    );
  }
  const words = all(describeDisconnectResult(result()));
  check(
    "no success implies a permanent block",
    !words.includes("blocked") && !words.includes("banned") && !words.includes("permanently"),
    words,
  );
}

console.log("\n-- an unconfirmed disconnect is never a green tick --");
{
  const v = describeDisconnectResult(result({ disconnected: false }));
  check("disconnected:false is not a success", v.tone !== "success", `tone=${v.tone}`);
  check("accessEnded follows `disconnected` and nothing else", v.accessEnded === false);
  check(
    "it tells the operator to assume the guest is still online",
    all(v).includes("still online"),
  );
}

console.log("\n-- 501: a missing credential, not a missing capability --");
{
  const v = describeDisconnectFailure({ status: 501, message: "OMADA_API_UNSUPPORTED" });
  const words = all(v);
  check("501 is an error", v.tone === "error");
  check("it names the missing hotspot operator credentials", words.includes("hotspot operator"));
  check(
    "it tells the operator what to do next",
    words.includes("add hotspot operator credentials"),
  );
  check("it promises nothing changed", v.nothingChanged === true);
  check(
    "it never claims Omada/the controller cannot do this at all",
    !words.includes("cannot do this at all") &&
      !words.includes("does not support") &&
      !words.includes("not supported"),
    words,
  );
  // CR-006's exact, wrong, prescription.
  check(
    "it never repeats CR-006's Open API claim",
    !words.includes("open api") && !words.includes("openapi"),
    words,
  );
  check("it never blames the legacy auth mode", !words.includes("legacy"), words);
  check("it is not the generic failure", words !== all(describeDisconnectFailure({ status: 500 })));
}

console.log("\n-- 502/504: nothing changed, and it says so --");
{
  for (const status of [502, 504]) {
    const v = describeDisconnectFailure({ status });
    const words = all(v);
    check(`${status} promises the venue is untouched`, v.nothingChanged === true);
    check(`${status} says "nothing was changed" in words`, words.includes("nothing was changed"));
    check(`${status} says the access is as it was`, words.includes("exactly as it was"));
    check(`${status} does not claim the guest was disconnected`, v.accessEnded === false);
    check(
      `${status} never implies a partial action`,
      !words.includes("may have") && !words.includes("might have") && !words.includes("partially"),
      words,
    );
  }
}

console.log("\n-- the other errors stay distinguishable --");
{
  const cases = [
    [409, "finish", "site"],
    [422, "mac address", null],
    [403, "access", null],
    [404, "no longer exists", null],
    [null, "couldn't reach wyfy", null],
  ];
  for (const [status, needle, second] of cases) {
    const v = describeDisconnectFailure({ status, message: "x" });
    const words = all(v);
    check(`${status} has its own copy (${needle})`, words.includes(needle), words);
    if (second) check(`${status} mentions ${second}`, words.includes(second), words);
    check(`${status} promises nothing changed`, v.nothingChanged === true);
  }

  const titles = new Set(
    [501, 502, 504, 409, 422, 403, 404, null, 500].map(
      (status) => describeDisconnectFailure({ status, message: "x" }).title,
    ),
  );
  // 502 and 504 legitimately share one title; everything else is distinct.
  check("each failure class has its own title", titles.size === 8, `${titles.size} distinct`);
}

console.log("\n-- an unknown failure does not invent a guarantee --");
{
  const v = describeDisconnectFailure({ status: 500, message: "Internal Server Error" });
  check("a 500 does NOT promise nothing changed -- it cannot know", v.nothingChanged === false);
  check("it says so honestly", all(v).includes("couldn't confirm"));
  check("it surfaces the backend's own message", all(v).includes("internal server error"));
}

console.log("\n-- the vendor gate is integration presence, not an auth mode --");
{
  const src = readFileSync(SOURCE_PATH, "utf8");
  // The module must not branch on the auth mode at all: that is exactly the
  // mistake CR-006 asks for, and a grep is the only way to keep it out.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  check("no authMode branch in the shipped code", !/authMode/.test(code), "authMode referenced");
  check("no 'openapi' literal in the shipped code", !/openapi/i.test(code));

  const omada = (id, locationId) => ({ id, locationId, provider: "omada", name: id });

  check(
    "a MikroTik venue (no integration) yields null -- the whole gate",
    pickIntegrationForLocation([], "loc-1") === null,
  );
  check(
    "a venue's own controller is picked",
    pickIntegrationForLocation([omada("a", "loc-1"), omada("b", "loc-2")], "loc-1")?.id === "a",
  );
  check(
    "an org-wide controller covers a venue with none of its own",
    pickIntegrationForLocation([omada("org", null)], "loc-9")?.id === "org",
  );
  check(
    "a venue-specific controller beats an org-wide one",
    pickIntegrationForLocation([omada("org", null), omada("mine", "loc-1")], "loc-1")?.id ===
      "mine",
  );
  check(
    "two candidates for one venue is null -- guessing is worse than no button",
    pickIntegrationForLocation([omada("a", "loc-1"), omada("b", "loc-1")], "loc-1") === null,
  );
  check(
    "two org-wide candidates is null too",
    pickIntegrationForLocation([omada("a", null), omada("b", null)], "loc-1") === null,
  );
  check(
    "a non-omada provider is never picked",
    pickIntegrationForLocation(
      [{ id: "r", locationId: "loc-1", provider: "mikrotik", name: "r" }],
      "loc-1",
    ) === null,
  );
}

console.log();
if (failures > 0) {
  console.error(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("omada disconnect verdicts: all checks passed");
