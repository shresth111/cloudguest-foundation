/**
 * All Locations: a row you can identify, and a delete you cannot fire blind.
 *
 * THE TWO DEFECTS (observed live on master.wyfyguest.com, 2026-09-12)
 * ------------------------------------------------------------------
 * 1. NO NAME COLUMN. The table rendered SITE CODE · CLIENT · TYPE · CITY ·
 *    STATUS. The venue's own name appeared nowhere, so a row was identifiable
 *    only by its site code or by the accessible name on its delete button --
 *    which is genuinely how an earlier QA pass had to find a location it had
 *    just created. CLIENT + CITY does not disambiguate: two live rows are
 *    "sector 37 d" and "huda city center", different tenants, same city.
 *
 * 2. THE DELETE GUARD WAS `window.confirm`. Reported as unguarded, and that
 *    report was not wrong to make: Playwright auto-dismisses a native dialog
 *    unless the run handles `dialog` explicitly, and a browser told to
 *    "prevent this page from creating additional dialogs" suppresses it
 *    outright. A guard a driver silently dismisses and a browser can switch
 *    off is not a guard on the one irreversible action on the page. It also
 *    could not say what it needed to: a location is a venue with guest
 *    sessions, vouchers, portal config, routers and possibly an integration
 *    hanging off it, and `window.confirm` takes one line of unstyled text.
 *
 * THE ASSERTIONS THAT MATTER, in order of how badly a regression would hurt:
 *
 *   1. NO NATIVE CONFIRM ANYWHERE ON THIS SCREEN. It is the mechanism of the
 *      defect, not a fallback to keep around.
 *   2. DELETE IS GATED ON TYPING THE NAME. The failure mode here is not
 *      "meant to cancel and confirmed" -- it is "deleted the right-looking
 *      wrong row", with identical adjacent buttons and (until now) no name on
 *      screen. Typing the name is the only confirmation that catches it.
 *   3. THE DIALOG NAMES WHAT GOES WITH IT, in categories rather than invented
 *      counts -- it has fetched nothing, and a confident "3 routers" it never
 *      looked up would be the defect class this console keeps being fixed for.
 *   4. THE NAME COLUMN EXISTS AND THE COLUMN COUNTS STILL LINE UP. A header
 *      added without its matching placeholder cell silently skews the loading
 *      row.
 *   5. NO CALLER CAN ASK `/organizations` FOR MORE THAN IT ACCEPTS.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note). The clamp is
 * bundled and executed; the screen is asserted against its real source.
 *
 * Run: node scripts/test-master-locations-safety.mjs
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

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

/**
 * The file with its comments removed.
 *
 * Needed because the comments in this screen QUOTE the defect they replaced --
 * "This read `window.confirm(...)`" and an example of a count we deliberately
 * do not invent. A naive substring search finds those and reports the defect
 * as still present, which is the test failing for the exact opposite of the
 * real reason. Assertions about what the code DOES must read code.
 */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const page = read("src/routes/master.locations.tsx");
const pageCode = stripComments(page);

/* ── 1. The native confirm is gone ─────────────────────────────────────── */

console.log("\n1. No native confirm survives on this screen");

check(
  "window.confirm is not used",
  !/window\.confirm/.test(pageCode),
  "a driver dismisses it and a browser can switch it off",
);
check("window.alert is not used either", !/window\.alert\(/.test(pageCode));

/* ── 2. Delete is gated on typing the name ─────────────────────────────── */

console.log("\n2. Delete requires the venue's name to be typed");

check(
  "the row's delete button opens a confirmation rather than deleting",
  /onClick=\{\(\) => \{[\s\S]{0,160}setConfirmDelete\(l\)/.test(page),
);
check(
  "handleDelete no longer guards itself with a dialog",
  !/async function handleDelete[\s\S]{0,300}confirm\(/.test(page),
);
check("the typed value is compared to the name", /deleteConfirmed/.test(page));
check(
  "the comparison is trimmed and case-insensitive",
  /deleteTyped\.trim\(\)\.toLowerCase\(\) ===[\s\S]{0,80}name\.trim\(\)\.toLowerCase\(\)/.test(
    page,
  ),
  "the point is to make them read the name, not to test their typing",
);
check(
  "the destructive button is disabled until it matches",
  /disabled=\{!deleteConfirmed/.test(page),
);
check(
  "and says why it is disabled",
  /Type the location's name to confirm/.test(page),
  "a disabled control with no reason is this codebase's characteristic bug",
);

/* ── 3. The dialog says what else goes ─────────────────────────────────── */

console.log("\n3. The confirmation names the venue and what goes with it");

check("it names the venue", /\{confirmDelete\.name\}/.test(page));
check(
  "it shows the site code and tenant to tell near-identical rows apart",
  /confirmDelete\.locationCode/.test(page) && /confirmDelete\.organizationName/.test(page),
);
check("it says the act is irreversible", /cannot be undone/.test(page));
check(
  "it names the categories that go with the venue",
  /guest sessions/.test(page) &&
    /vouchers/.test(page) &&
    /portal/.test(page) &&
    /routers or controllers/.test(page),
);
check(
  "it says what it means for guests",
  /stop being able to sign in/.test(page),
  "the consequence an operator is actually weighing",
);
// Counts would have to be fetched, and this dialog fetches nothing.
check(
  "it does NOT invent a count it never looked up",
  !/\{\s*\w+Count\s*\}|\d+ routers\b/.test(pageCode),
);

/* ── 4. The Name column, and the column counts ─────────────────────────── */

console.log("\n4. The table shows the name, and stays aligned");

check("there is a Name header", /<MTh>Name<\/MTh>/.test(page));
check(
  "the row renders the location's own name",
  /<MTd className="font-semibold">\{l\.name\}<\/MTd>/.test(page),
);
check(
  "the tenant is still shown, demoted rather than dropped",
  /\{l\.organizationName\}/.test(page),
);

// A header added without its placeholder cell skews the loading row silently.
const headBlock = page.slice(page.indexOf("head={"), page.indexOf("</MTable>"));
const headerCount = (headBlock.match(/<MTh[\s>]/g) ?? []).length;
const placeholderBlock = page.slice(page.indexOf("rows.length === 0 ? ("), page.indexOf("</MTr>"));
const placeholderCount = (placeholderBlock.match(/<MTd[\s/]/g) ?? []).length;
check(
  "the empty/loading row has one cell per header",
  headerCount === placeholderCount,
  `${headerCount} headers vs ${placeholderCount} placeholder cells`,
);

/* ── 5. Nothing may ask /organizations for more than it accepts ────────── */

console.log("\n5. The organizations page size cannot exceed the backend cap");

const outdir = mkdtempSync(join(tmpdir(), "org-page-size-"));
const entry = join(outdir, "entry.mjs");
writeFileSync(
  entry,
  `export { ORGANIZATIONS_MAX_PAGE_SIZE } from "${join(ROOT, "src/services/organization.service.ts").replace(/\\/g, "/")}";`,
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
const { ORGANIZATIONS_MAX_PAGE_SIZE } = await import(`file://${outfile}`);

// The backend declares `page_size: int = Query(default=25, ge=1, le=100)` on
// GET /organizations. Over it, FastAPI 422s before the handler runs -- a
// validation bound, not a soft limit, so "ask for more, get what there is"
// does not apply.
check("the cap mirrors the backend's le=100", ORGANIZATIONS_MAX_PAGE_SIZE === 100);

const service = read("src/services/organization.service.ts");
check(
  "the service clamps rather than trusting its callers",
  /page_size: Math\.min\(q\.pageSize, ORGANIZATIONS_MAX_PAGE_SIZE\)/.test(service),
  "a cap enforced at one of five call sites is one the sixth will breach",
);

const picker = read("src/components/master/OrganizationScopePicker.tsx");
check(
  "the scope picker no longer asks for 200",
  !/pageSize: 200/.test(picker),
  "it is in the Master shell header, so it 422'd on every page load",
);

// Nothing else anywhere may ask for more than the cap.
const offenders = [];
for (const rel of [
  "src/components/master/OrganizationScopePicker.tsx",
  "src/components/master/MasterSearch.tsx",
  "src/components/vouchers/VoucherManagement.tsx",
  "src/hooks/useGuestTeam.ts",
  "src/hooks/useGuestAccess.ts",
  "src/routes/master.locations.tsx",
]) {
  const src = read(rel);
  for (const m of src.matchAll(/organizationService\.list\(\{[^}]*pageSize:\s*(\d+)/g)) {
    if (Number(m[1]) > ORGANIZATIONS_MAX_PAGE_SIZE) offenders.push(`${rel} (${m[1]})`);
  }
}
check("no caller requests more than the cap", offenders.length === 0, offenders.join(", "));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
