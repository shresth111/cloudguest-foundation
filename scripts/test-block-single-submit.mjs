/**
 * Regression test for the Blocked Guests confirm button at Aruba venues:
 * the dialog stayed open during the slow block call, and each extra click
 * wrote another rule for the same number.
 *
 * The single-flight guard is bundled with esbuild and executed for real. The
 * wiring is checked against the component source, because this repo has no
 * component test runner. That includes the pin that every other vendor
 * (MikroTik, Omada) still goes straight to the original handler.
 *
 * Run: node scripts/test-block-single-submit.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, ok) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
  if (!ok) failures += 1;
}

const outdir = mkdtempSync(join(tmpdir(), "block-single-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(entry, `export * from ${JSON.stringify(join(ROOT, "src/lib/single-flight.ts"))};\n`);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
});
const { createSingleFlight } = await import(pathToFileURL(bundle).href);

console.log("single flight");
{
  const flight = createSingleFlight();
  let writes = 0;
  let finish;
  const job = () =>
    new Promise((res) => {
      writes += 1;
      finish = res;
    });
  const first = flight.run(job);
  const dropped = await Promise.all([flight.run(job), flight.run(job), flight.run(job)]);
  check("repeat clicks during the call write nothing", writes === 1);
  check(
    "repeat clicks report that they were dropped",
    dropped.every((r) => r === false),
  );
  finish();
  check("the first click reports that it ran", (await first) === true);

  const again = flight.run(job);
  check("a later, separate block still runs", writes === 2);
  finish();
  await again;

  const failing = createSingleFlight();
  await failing.run(() => Promise.reject(new Error("network"))).catch(() => {});
  let retried = false;
  await failing.run(async () => {
    retried = true;
  });
  check("a failed block does not lock the button forever", retried);
}

console.log("BlockUsers wiring");
{
  const src = readFileSync(join(ROOT, "src/components/features/BlockUsers.tsx"), "utf8");
  const start = src.indexOf("const confirmBlock = () =>");
  const body = src.slice(start, src.indexOf("const handlePrimaryClick", start));
  check("the dialog button uses confirmBlock", src.includes("onClick={confirmBlock}"));
  check(
    "the dialog button no longer calls handleBlock directly",
    !src.includes("onClick={handleBlock}"),
  );
  check(
    "non-NAS-only vendors go straight to handleBlock (MikroTik pin)",
    body.includes("if (!isNasOnlyVendor(clientControls.vendor)) return handleBlock();"),
  );
  check(
    "the guarded path runs through the single flight",
    body.includes("blockFlight.current.run("),
  );
  check(
    "the dialog closes before the block call",
    body.indexOf("setShowModal(false)") !== -1 &&
      body.indexOf("setShowModal(false)") < body.indexOf("await handleBlock()"),
  );
  check("the busy state is always cleared", /finally\s*{\s*setBlocking\(false\);/.test(body));
  check(
    "the primary button is disabled while blocking",
    src.includes('disabled={textarea.trim() === "" || blocking}'),
  );
  check("the list is read-only while blocking", src.includes("readOnly={blocking}"));
  check(
    "numbers already on the list are still left out of a new list",
    src.includes("alreadyBlocked.push(canonical)") && src.includes("valid.push(canonical)"),
  );
}

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
