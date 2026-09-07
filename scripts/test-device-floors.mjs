/**
 * Regression test for the Network Hardware screens' floor list.
 *
 * WHAT WENT WRONG: `stores/deviceStore.ts` held
 * `export const FLOORS = ["5F","4F","3F","2F","1F","GF"]` -- six strings,
 * hardcoded, shown to every venue on the platform as its floors. A hotel
 * with twelve floors, a mall with two basements and a single-storey cafe
 * all got the same six.
 *
 * That is the shape of the `TEAMS` literal fixed in FE #246, with one
 * extra sting: `FLOORS` was not only offered as *input*, it was the
 * *output* filter too --
 *
 *     FLOORS.filter((f) => devices.some((d) => d.floor === f))
 *
 * -- in two places on the location screen. `MonitoredHardware.floor` has
 * always been free text on the backend (`String(50)`, nullable, with an
 * explicit comment that venue floor naming varies too much to constrain
 * server-side), so a device registered on "B1" or "7F" was accepted,
 * stored, and then silently dropped from the floor tiles and filter chips.
 * Not mislabelled -- absent.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. NO FLOOR IS EVER DROPPED FROM GROUPING. This is the assertion that
 *      fails against the old implementation. A device on any label the
 *      backend accepted must appear under that label.
 *   2. THE LIST IS THE VENUE'S OWN. Grouping is derived from this venue's
 *      hardware rows, never from a constant. Nothing may reintroduce a
 *      hardcoded floor list.
 *   3. "NO FLOOR" IS A REAL ANSWER, NOT A GAP. Floor is optional; a
 *      single-storey venue leaves it blank, and those rows must stay
 *      reachable rather than falling out of every filter.
 *   4. FLOORS SORT LIKE A BUILDING. Basements below ground, then ascending
 *      -- and an unparseable label still sorts somewhere rather than
 *      being discarded.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The pure
 * derivation is bundled with esbuild and executed for real; the wiring is
 * checked against the real component sources.
 *
 * Run: node scripts/test-device-floors.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "device-floors-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { floorsInUse, floorSuggestions, sortFloors, unplacedCount, normalizeFloor,
            FLOOR_SUGGESTION_LADDER }
     from ${JSON.stringify(join(ROOT, "src/lib/device-floors.ts"))};`,
);
const bundle = join(outdir, "bundle.mjs");
await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  logLevel: "silent",
});
const {
  floorsInUse,
  floorSuggestions,
  sortFloors,
  unplacedCount,
  normalizeFloor,
  FLOOR_SUGGESTION_LADDER,
} = await import(bundle);

const dev = (floor) => ({ floor });

// ---------------------------------------------------------------------------
// 1. The floors the old constant could not express.
// ---------------------------------------------------------------------------

console.log("\nfloors outside the old six-item list are grouped, not dropped");

// Every one of these was accepted and stored by the backend, and every one
// of them vanished from the floor tiles under `FLOORS.filter(...)`.
const beyondTheOldList = ["B2", "B1", "7F", "8F", "12F", "Roof"];
const grouped = floorsInUse(beyondTheOldList.map(dev));
for (const floor of beyondTheOldList) {
  check(`a device on "${floor}" is grouped under "${floor}"`, grouped.includes(floor));
}
eq("every floor survives", grouped.length, beyondTheOldList.length);

// The specific shape of the old bug, stated directly.
const OLD_FLOORS = ["5F", "4F", "3F", "2F", "1F", "GF"];
const oldBehaviour = OLD_FLOORS.filter((f) => beyondTheOldList.some((d) => d === f));
eq("the old implementation would have shown none of them", oldBehaviour.length, 0);
check("the new one shows all of them", grouped.length > 0);

// ---------------------------------------------------------------------------
// 2. The list is the venue's own.
// ---------------------------------------------------------------------------

console.log("\nthe floor list is derived from this venue's hardware");

const cafe = floorsInUse([dev("GF"), dev("GF")]);
eq("a single-storey venue has exactly one floor", cafe.join("|"), "GF");
check("and is not shown five it does not have", !cafe.includes("5F"));

const hotel = floorsInUse(
  Array.from({ length: 12 }, (_, i) => dev(`${i + 1}F`)).concat([dev("GF")]),
);
eq("a 12-storey hotel gets 13 floors", hotel.length, 13);
eq("ordered top-down like an elevator panel", hotel[0], "12F");
eq("with ground at the bottom", hotel[hotel.length - 1], "GF");

// Duplicates collapse; whitespace does not create a second floor.
eq("duplicate floors collapse", floorsInUse([dev("3F"), dev("3F"), dev(" 3F ")]).length, 1);

// ---------------------------------------------------------------------------
// 3. "No floor" is a real answer.
// ---------------------------------------------------------------------------

console.log("\na device with no floor recorded is not lost");

const mixed = [dev("GF"), dev(""), dev("  "), dev("1F")];
eq("blank floors never become a floor", floorsInUse(mixed).join("|"), "1F|GF");
eq("but they are counted", unplacedCount(mixed), 2);
eq("a fully unplaced venue has no floors at all", floorsInUse([dev(""), dev("")]).length, 0);
eq("and all of its devices counted as unplaced", unplacedCount([dev(""), dev("")]), 2);

// ---------------------------------------------------------------------------
// 4. Building order.
// ---------------------------------------------------------------------------

console.log("\nfloors sort the way a building is stacked");

eq("basements sit below ground", sortFloors(["B1", "GF", "B2", "1F"]).join("|"), "1F|GF|B1|B2");
eq("numbers sort numerically, not lexically", sortFloors(["2F", "10F", "1F"])[0], "10F");
eq("ground-floor synonyms rank together", sortFloors(["Ground", "1F"])[1], "Ground");
check("an unparseable label is kept, not discarded", sortFloors(["Roof", "1F"]).includes("Roof"));
eq("and sorts after the numbered floors", sortFloors(["Roof", "1F"])[1], "Roof");

// ---------------------------------------------------------------------------
// 5. Suggestions are hints, never a constraint.
// ---------------------------------------------------------------------------

console.log("\nsuggestions lead with the venue's own floors");

const suggestions = floorSuggestions([dev("B1"), dev("7F")]);
eq("the venue's own floors come first", suggestions.slice(0, 2).join("|"), "7F|B1");
check("without duplicating them lower down", suggestions.filter((f) => f === "B1").length === 1);
check("and a generous ladder follows", suggestions.length > 15);
check("covering basements", FLOOR_SUGGESTION_LADDER.includes("B2"));
check("and floors well past the old six", FLOOR_SUGGESTION_LADDER.includes("20F"));

// A brand-new venue still gets something to pick from.
check("a venue with no hardware still gets suggestions", floorSuggestions([]).length > 15);

// ---------------------------------------------------------------------------
// 6. Input normalisation matches the backend column.
// ---------------------------------------------------------------------------

console.log("\ntyped input is normalised to what the column accepts");

eq("whitespace is trimmed", normalizeFloor("  3F  "), "3F");
eq("empty stays empty", normalizeFloor("   "), "");
eq("and nothing exceeds the String(50) column", normalizeFloor("x".repeat(80)).length, 50);

// ---------------------------------------------------------------------------
// 7. No component holds a floor list of its own.
// ---------------------------------------------------------------------------

console.log("\nno screen carries a hardcoded floor list any more");

const store = readFileSync(join(ROOT, "src/stores/deviceStore.ts"), "utf8");
check("deviceStore no longer exports FLOORS", !/export const FLOORS\s*=/.test(store));

const CALL_SITES = [
  "src/routes/switch-location.tsx",
  "src/components/customer/BasicFeatureViews.tsx",
  "src/components/customer/AddDeviceDialog.tsx",
];
for (const rel of CALL_SITES) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  check(`${rel} does not import FLOORS`, !/\bFLOORS\b/.test(src));
  // The literal ladder itself must not reappear inline.
  check(`${rel} contains no inline floor array`, !/\[\s*"5F"\s*,\s*"4F"/.test(src));
}

const switchLocation = readFileSync(join(ROOT, "src/routes/switch-location.tsx"), "utf8");
check("the location screen groups by floorsInUse", /floorsInUse\(devices\)/.test(switchLocation));
check("and offers a filter for unplaced devices", /unplacedCount\(devices\)/.test(switchLocation));
check(
  "the floor filter distinguishes 'no filter' from 'no floor'",
  /floorFilter === null/.test(switchLocation),
);

for (const rel of CALL_SITES.slice(1)) {
  const src = readFileSync(join(ROOT, rel), "utf8");
  check(`${rel} offers floors as suggestions, not fixed options`, /floorSuggestions/.test(src));
  check(`${rel} normalises what was typed`, /normalizeFloor/.test(src));
}

console.log(
  failures === 0
    ? `\nall device floor checks passed\n`
    : `\n${failures} device floor check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
