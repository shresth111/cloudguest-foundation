/**
 * Regression test for CSV export escaping, shared by the Reports screen
 * and the Users screen's guest-list export.
 *
 * WHY THIS IS SECURITY-RELEVANT, not cosmetic: guest-supplied free text
 * reaches these files. A guest can register or redeem a voucher with an
 * identifier set to a spreadsheet formula -- the backend's own
 * `normalize_redeemed_identifier` only strips whitespace, deliberately --
 * so a venue owner opening the export in Excel or Sheets would execute it.
 * `=HYPERLINK(...)` exfiltrating the sheet is the standard demonstration.
 * The mitigation is one character and it is easy to lose in a refactor,
 * which is exactly why it is pinned here.
 *
 * The helpers were extracted from `UserReports.tsx` when the Users screen
 * gained its own export, specifically so the second surface could not ship
 * a slightly-less-careful reimplementation. This test guards the shared
 * copy.
 *
 * Load-bearing assertions, worst-first:
 *
 *   1. FORMULA TRIGGERS ARE NEUTRALISED. Any cell starting = + - @ must be
 *      prefixed so the spreadsheet treats it as text.
 *   2. QUOTING IS RFC 4180. Commas, quotes and newlines must not break the
 *      row structure -- a guest name containing a comma silently shifting
 *      every later column is a data-integrity bug that looks like nothing.
 *   3. NEUTRALISING MUST NOT CORRUPT ORDINARY VALUES. A negative number or
 *      an email must survive readable.
 *
 * Run: node scripts/test-csv-export.mjs
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

const outdir = mkdtempSync(join(tmpdir(), "csv-export-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { csvField, toCsv, csvDateStamp } from "${join(ROOT, "src/lib/csv-export.ts").replace(/\\/g, "/")}";`,
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
const { csvField, toCsv, csvDateStamp } = await import(`file://${outfile}`);

// ---------------------------------------------------------------------------
// 1. Formula injection.
// ---------------------------------------------------------------------------

console.log("\nformula triggers are neutralised");

for (const payload of [
  "=1+1",
  '=HYPERLINK("http://evil","click")',
  "+1+1",
  "-1+1",
  "@SUM(A1:A9)",
]) {
  const out = csvField(payload);
  check(
    `${payload.slice(0, 24)} is defused`,
    out.startsWith("'") || out.startsWith("\"'"),
    `got ${JSON.stringify(out)}`,
  );
}

check(
  "a defused value still contains the original text for a human to read",
  csvField("=1+1").includes("=1+1"),
);

console.log("\nordinary values are not mangled");
eq("a plain name is untouched", csvField("Priya Sharma"), "Priya Sharma");
eq("an email is untouched", csvField("a@b.com"), "a@b.com");
// A phone number legitimately starts with "+", which is also a formula
// trigger, so it IS defused -- correctly. Excel/Sheets treat the leading
// apostrophe as a text marker and do not display it, so the cell still
// reads "+91 ...", while a raw text editor shows the marker. Pinning the
// defused form deliberately: a future "fix" that exempted "+" to make raw
// CSVs prettier would reopen the injection hole for every payload starting
// with "+".
eq(
  "a phone number is defused, since + is a trigger",
  csvField("+91 9•••• ••210"),
  "'+91 9•••• ••210",
);
eq("an empty cell stays empty", csvField(""), "");

// ---------------------------------------------------------------------------
// 2. RFC 4180 quoting.
// ---------------------------------------------------------------------------

console.log("\nquoting keeps the row structure intact");

eq("a comma forces quoting", csvField("Doe, John"), '"Doe, John"');
eq("an embedded quote is doubled", csvField('He said "hi"'), '"He said ""hi"""');
eq("a newline forces quoting", csvField("line1\nline2"), '"line1\nline2"');
check(
  "a value needing both defusing and quoting gets both",
  (() => {
    const out = csvField("=cmd,payload");
    return out.startsWith('"') && out.includes("'=cmd") && out.endsWith('"');
  })(),
  `got ${JSON.stringify(csvField("=cmd,payload"))}`,
);

// ---------------------------------------------------------------------------
// 3. Whole-document assembly.
// ---------------------------------------------------------------------------

console.log("\ntoCsv assembles a well-formed document");

const doc = toCsv(
  ["Name", "Note"],
  [
    ["Priya", "fine"],
    ["Doe, John", "=1+1"],
  ],
);
const lines = doc.split("\n");
eq("header plus one line per row", lines.length, 3);
eq("header is first", lines[0], "Name,Note");
eq("a comma-bearing name stays one field", lines[2].startsWith('"Doe, John"'), true);
check("the formula in the body is defused", lines[2].includes("'=1+1"));

console.log("\nthe date stamp is filename-safe");
eq("stamps as YYYY-MM-DD", csvDateStamp(new Date(2026, 8, 5)), "2026-09-05");
eq("pads single digits", csvDateStamp(new Date(2026, 0, 2)), "2026-01-02");

// ---------------------------------------------------------------------------
// 4. Wiring: both export surfaces use the shared helper.
// ---------------------------------------------------------------------------

console.log("\nboth export surfaces use the shared helper");

const reports = readFileSync(join(ROOT, "src/components/features/UserReports.tsx"), "utf8");
const users = readFileSync(join(ROOT, "src/routes/users.tsx"), "utf8");

check("Reports imports the shared helper", reports.includes("@/lib/csv-export"));
check(
  "Reports no longer defines its own csvField",
  !/const csvField\s*=\s*\(/.test(reports),
  "a second copy will drift from the hardened one",
);
check("Users imports the shared helper", users.includes("@/lib/csv-export"));
check("Users builds its CSV through toCsv", /toCsv\(/.test(users));
check(
  "the guest export pages past the visible table page",
  /EXPORT_PAGE_SIZE/.test(users) && /chunk\.total/.test(users),
  "exporting only the 8 rows on screen would look complete and not be",
);
check(
  "the guest export respects masking",
  /masked \? maskPhone\(/.test(users) && /masked \? maskEmail\(/.test(users),
);
check(
  "a truncated export says so in the file",
  /truncated/.test(users) && /NOTE: this export stopped/.test(users),
);

console.log(
  failures === 0
    ? `\nall CSV export checks passed\n`
    : `\n${failures} CSV export check(s) FAILED\n`,
);
process.exit(failures === 0 ? 0 : 1);
