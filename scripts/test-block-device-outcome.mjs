/**
 * Regression test for what Blocked Guests tells a venue admin about the
 * DEVICES a block reached (`src/lib/block-outcome.ts`'s second half) and
 * for the screen that renders it (`BlockUsers.tsx`).
 *
 * WHY THESE ARE THE ASSERTIONS
 * ----------------------------
 * cloud-guest #277 added `controller_blocks` to the rule response: one row
 * per device this platform asked a venue's controller to keep off the
 * network. It is a SIBLING of `enforcement_status`, never folded into it --
 * that field answers "what happened to the sessions this guest was in" and
 * this answers "and what about their devices". Four per-device states, and
 * only ONE of them is a failure:
 *
 *   enforced        the controller is holding the device off.
 *   not_applicable  the controller has no record of the device, so there
 *                   was nothing to keep off. NOT a failure.
 *   failed          refused, or unreachable. The only actionable one.
 *   unenforced      this venue cannot block a device at all.
 *
 * Partial success is the NORMAL case: a guest with three devices, one of
 * which the controller has never seen. So, in order of how much damage the
 * failure does:
 *
 *   1. NOTHING IS ROUNDED UP. "2 of 3" must survive as "2 of 3"; a screen
 *      that summarises these to a tick loses the only distinction an admin
 *      can act on, and PR #279 on the backend shipped exactly that once.
 *   2. NOTHING IS ROUNDED DOWN EITHER. `not_applicable` must never be
 *      drawn as a failure, and a venue that cannot block must say so in
 *      the provider's own words.
 *   3. A MIKROTIK VENUE IS UNCHANGED, asserted positively. Its
 *      `controller_blocks` is always `[]`, so every function here must
 *      return nothing and the screen must render no panel and no column.
 *   4. NO SENTENCE CLAIMS MORE THAN WAS MEASURED. Nothing about a guest
 *      holding a live authorization (unmeasured), and a device block is a
 *      deterrent, not a lock.
 *   5. UNBLOCK SAYS WHETHER THE HOLD WAS LIFTED. The controller publishes
 *      no readable list of blocked clients, so our row is the only trace;
 *      if the screen does not say it, nothing does.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-connection-verdicts.mjs`). The pure module is bundled with
 * esbuild and executed for real; the wiring is checked against the real
 * component source.
 *
 * Run: node scripts/test-block-device-outcome.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "block-device-outcome-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from ${JSON.stringify(join(ROOT, "src/lib/block-outcome.ts"))};\n`);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
  alias: { "@": join(ROOT, "src") },
});
const {
  BLOCK_DEVICE_GUARANTEE,
  blockDeviceTally,
  blockDeviceSentences,
  blockDeviceReasons,
  blockOutcome,
  blockOutcomeMessage,
  unblockDeviceMessage,
} = await import(bundle);

/** One controller block row, as the backend returns it (camelCased). */
const dev = (status, over = {}) => ({
  id: `cb-${Math.random().toString(36).slice(2, 8)}`,
  locationId: "loc-1",
  macAddress: "AA:BB:CC:DD:EE:FF",
  status,
  errorCode: null,
  errorMessage: null,
  blockedAt: "2026-09-18T10:00:00.000Z",
  clearedAt: null,
  releaseError: null,
  ...over,
});
/** One created rule. `controllerBlocks: []` is the MikroTik shape. */
const rule = (blocks = [], over = {}) => ({
  kind: "identifier",
  enforcementStatus: "enforced",
  sessionsEnded: 0,
  controllerBlocks: blocks,
  ...over,
});
const noun = (n) => (n === 1 ? "number" : "numbers");

console.log("\n1. a MikroTik venue is untouched -- asserted positively");
// `controller_blocks` is empty at every venue reached over the router API.
// Every function must produce nothing, so the screen renders nothing.
{
  const mikrotik = [rule([]), rule([])];
  eq("no device sentences", blockDeviceSentences(mikrotik).length, 0);
  eq("no device reasons", blockDeviceReasons(mikrotik).length, 0);
  eq("the tally is empty", blockDeviceTally(mikrotik).total, 0);
  eq(
    "unblock says only the plain thing",
    unblockDeviceMessage([]),
    "Unblocked — they can sign in again.",
  );
  // And the session ladder is bit-identical: this change may not move it.
  eq(
    "the session outcome is unchanged",
    blockOutcome([rule([], { enforcementStatus: "enforced", sessionsEnded: 1 })]).outcome,
    "sessions-ended",
  );
  eq(
    "the session toast is the sentence it always was",
    blockOutcomeMessage([rule([], { enforcementStatus: "enforced", sessionsEnded: 1 })], noun),
    "1 number blocked. 1 active session ended.",
  );
}

console.log("\n2. THE NORMAL CASE: 2 of 3 devices, and it stays 2 of 3");
{
  const created = [
    rule([
      dev("enforced"),
      dev("enforced"),
      dev("not_applicable", { errorCode: "OMADA_CLIENT_NOT_FOUND" }),
    ]),
  ];
  const tally = blockDeviceTally(created);
  eq("2 enforced", tally.enforced, 2);
  eq("1 unknown to the controller", tally.unknownToController, 1);
  eq("nothing refused", tally.refused, 0);
  eq("3 in total", tally.total, 3);

  const lines = blockDeviceSentences(created);
  eq("two sentences, one per true thing", lines.length, 2);
  check(
    "the blocked count is qualified as 2 of 3",
    /2 of 3 devices/.test(lines[0]),
    JSON.stringify(lines[0]),
  );
  check(
    "a device the controller does not know is not called a failure",
    /no record of 1 device/.test(lines[1]) && !/fail|error|refus|could not/i.test(lines[1]),
    JSON.stringify(lines[1]),
  );
  // The specific over-claim this panel exists to prevent.
  for (const line of lines) {
    check(
      `no sentence claims all devices: ${JSON.stringify(line)}`,
      !/^3 devices are now blocked/.test(line),
    );
  }
}

console.log("\n3. every device blocked -- says so without a count it does not need");
{
  const lines = blockDeviceSentences([rule([dev("enforced"), dev("enforced")])]);
  eq("one sentence", lines.length, 1);
  check("no 'of' qualifier when it really is all of them", !/ of /.test(lines[0]), lines[0]);
  check("plural agrees", /2 devices are now blocked/.test(lines[0]), lines[0]);
}
{
  const lines = blockDeviceSentences([rule([dev("enforced")])]);
  check("singular agrees", /1 device is now blocked/.test(lines[0]), lines[0]);
}

console.log("\n4. a refusal is the only one drawn as actionable, and carries its reason");
{
  const created = [
    rule([
      dev("enforced"),
      dev("failed", { errorMessage: "The controller refused the request.", errorCode: "X" }),
    ]),
  ];
  const lines = blockDeviceSentences(created);
  eq("the refusal is reported", blockDeviceTally(created).refused, 1);
  check(
    "the refusal sentence is last, so it is what they are left looking at",
    /did not keep 1 device off/.test(lines[lines.length - 1]),
    JSON.stringify(lines),
  );
  check(
    "it says nothing changed for that device",
    /Nothing changed for it/.test(lines[lines.length - 1]),
    JSON.stringify(lines[lines.length - 1]),
  );
  eq(
    "the provider's own sentence is carried verbatim",
    blockDeviceReasons(created)[0],
    "The controller refused the request.",
  );
}

console.log("\n5. a legacy venue that cannot block says so, in the provider's words");
{
  const reason =
    "This venue's controller is connected with hotspot operator credentials, which cannot block a device.";
  const created = [rule([dev("unenforced", { errorMessage: reason })])];
  eq("counted as cannot-block, not as refused", blockDeviceTally(created).cannotBlockHere, 1);
  eq("not counted as a refusal", blockDeviceTally(created).refused, 0);
  const lines = blockDeviceSentences(created);
  check(
    "the sentence names the venue's limit rather than blaming the device",
    /cannot block a device at all/.test(lines[0]),
    JSON.stringify(lines[0]),
  );
  eq("the reason is verbatim", blockDeviceReasons(created)[0], reason);
}
{
  // One venue's reason repeats once per device; an admin reads it once.
  const reason = "Add Open API credentials to this venue's controller.";
  const created = [
    rule([
      dev("unenforced", { errorMessage: reason }),
      dev("unenforced", { errorMessage: reason }),
    ]),
  ];
  eq("a repeated reason is shown once", blockDeviceReasons(created).length, 1);
}

console.log("\n6. an unrecognised status claims nothing");
{
  // `pending`, a null, and a value from a backend newer than this bundle.
  const created = [rule([dev("pending"), dev(null), dev("something_new")])];
  const tally = blockDeviceTally(created);
  eq("all three are unrecognised", tally.unrecognised, 3);
  eq("none is counted as blocked", tally.enforced, 0);
  eq("none is counted as refused", tally.refused, 0);
  eq("and nothing is said about them", blockDeviceSentences(created).length, 0);
}

console.log("\n7. no sentence claims more than was measured");
{
  const created = [rule([dev("enforced"), dev("failed", { errorMessage: "nope" })])];
  const all = [...blockDeviceSentences(created), BLOCK_DEVICE_GUARANTEE];
  for (const line of all) {
    check(
      `says nothing about a live session: ${JSON.stringify(line.slice(0, 40))}...`,
      !/(disconnect|kicked|cut off|already online|currently connected)/i.test(line),
      JSON.stringify(line),
    );
    check(
      `does not promise enforcement: ${JSON.stringify(line.slice(0, 40))}...`,
      !/\b(guarantee[ds]?|permanently|for good|cannot return)\b/i.test(line),
      JSON.stringify(line),
    );
  }
  check(
    "the guarantee says deterrent, not lock",
    /deterrent/.test(BLOCK_DEVICE_GUARANTEE) && /random/.test(BLOCK_DEVICE_GUARANTEE),
    BLOCK_DEVICE_GUARANTEE,
  );
  check(
    "and names the blocklist as the thing that actually refuses the person",
    /refuses the person/.test(BLOCK_DEVICE_GUARANTEE),
    BLOCK_DEVICE_GUARANTEE,
  );
}

console.log("\n8. unblock says whether the hold was actually lifted");
{
  eq(
    "nothing was held -- the plain sentence, unchanged",
    unblockDeviceMessage([]),
    "Unblocked — they can sign in again.",
  );
  const released = unblockDeviceMessage([
    dev("enforced", { clearedAt: "2026-09-18T11:00:00.000Z" }),
    dev("enforced", { clearedAt: "2026-09-18T11:00:00.000Z" }),
  ]);
  check(
    "a confirmed release says the devices were let back on",
    /2 devices were let back onto the network/.test(released),
    JSON.stringify(released),
  );
  const stuck = unblockDeviceMessage([
    dev("enforced", { clearedAt: "2026-09-18T11:00:00.000Z" }),
    dev("enforced", { releaseError: "controller unreachable" }),
  ]);
  check(
    "a partial release reports both halves",
    /1 device was let back/.test(stuck) && /1 device is still being held off/.test(stuck),
    JSON.stringify(stuck),
  );
  check(
    "a failed release is a pending retry, not a dead end",
    /We keep retrying/.test(stuck) && !/try again|contact/i.test(stuck),
    JSON.stringify(stuck),
  );
  const neverHeld = unblockDeviceMessage([
    dev("not_applicable", { errorCode: "OMADA_CLIENT_NOT_FOUND" }),
  ]);
  eq(
    "a device that was never held invents no release",
    neverHeld,
    "Unblocked — they can sign in again.",
  );
}

console.log("\n9. the screen renders it, and keeps it off a MikroTik venue's table");
const src = readFileSync(join(ROOT, "src/components/features/BlockUsers.tsx"), "utf8");
check(
  "BlockUsers uses the shared device ladder",
  /blockDeviceSentences/.test(src) && /@\/lib\/block-outcome/.test(src),
);
check(
  "BlockUsers does not define a second device ladder",
  !/function\s+blockDeviceSentences\b/.test(src) && !/function\s+unblockDeviceMessage\b/.test(src),
  "a local copy would drift from the one this test executes",
);
check(
  "the device outcome is a persistent panel, not a toast",
  /data-testid="block-device-result"/.test(src) && /role="status"/.test(src),
  "a 6.5s toast is the wrong lifetime for the only record of a device hold",
);
check("the panel is dismissible", /setDeviceResult\(null\)/.test(src));
check(
  "the device column is conditional on there being holds to show",
  /\{anyDeviceHolds && \(/.test(src),
  "an unconditional column changes a MikroTik venue's table",
);
check(
  "anyDeviceHolds is derived from the rules' own device rows",
  /anyDeviceHolds[\s\S]{0,200}controllerBlocks\.length > 0/.test(src),
  "a venue-wide capability flag would show the column where there is nothing in it",
);
check(
  "unblock reports what happened to the devices",
  /unblockDeviceMessage\(/.test(src),
  "the release outcome is discarded again",
);
check(
  "the deactivate response is no longer thrown away",
  /const updated = await guestService\.deactivateAccessRule/.test(src),
);
// The service must actually return it, or the line above reads undefined.
const svc = readFileSync(join(ROOT, "src/services/guest.service.ts"), "utf8");
check(
  "the service maps controller_blocks onto the rule",
  /controller_blocks/.test(svc) && /controllerBlocks:/.test(svc),
);
check(
  "deactivateAccessRule returns the updated rule",
  /deactivateAccessRule\([\s\S]{0,200}Promise<GuestAccessRule \| null>/.test(svc),
  "the only record of the release is discarded at the service boundary",
);

console.log(
  failures === 0 ? "\nall block-device-outcome checks passed" : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
