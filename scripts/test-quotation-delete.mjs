/**
 * Regression test for the Quotations screen's delete action.
 *
 * WHY IT EXISTS: a delete button is the one control on this screen that
 * cannot be undone from the console, and it has four separate ways to be
 * wrong that all render perfectly:
 *
 *   1. NO CONFIRMATION. One stray click on a row's drawer and a quotation
 *      is gone. Every other destructive action in the Master console
 *      (`master.channel-partners.tsx`'s Revoke) goes through `AlertDialog`
 *      first; this one must too.
 *   2. NO PERMISSION GATE. The backend gates `DELETE /quotations/{id}` on
 *      `quotations.delete` at GLOBAL scope. A button rendered for an
 *      operator who does not hold it is a button that 403s -- and this
 *      repo has a documented incident (see
 *      `scripts/generate-backend-permission-keys.mjs`) of a permission key
 *      that was simply asked for by a name that does not exist, whose only
 *      symptom was a control silently never appearing. So the key the
 *      screen asks for is asserted to be one the backend really seeds.
 *   3. THE LIST NOT INVALIDATED. This screen keeps its rows in local
 *      `useState` -- there is no react-query key for quotations, so that
 *      array IS the cache, and everything derived from it (the four MStat
 *      tiles including "Total Quoted", the status filter, the table) is
 *      recomputed from it on every render. A delete that does not drop the
 *      row leaves a deleted quotation on screen and in the totals.
 *   4. THE DRAWER LEFT OPEN ON A DELETED ROW. The delete is triggered from
 *      inside the detail drawer, so the drawer is showing the row being
 *      deleted. Not clearing `selected` leaves the operator reading the
 *      line items of a quotation that no longer exists.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no test runner (see
 * `scripts/test-location-liveness.mjs` for the same note), so the wiring is
 * checked against the real component and service sources.
 *
 * Run: node scripts/test-quotation-delete.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

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

const read = (p) => readFileSync(join(ROOT, p), "utf8");

const screen = read("src/routes/master.quotations.tsx");
const service = read("src/services/quotation.service.ts");
const keys = read("src/lib/backendPermissionKeys.generated.ts");

console.log("\nquotation delete -- service");

check(
  "the service calls DELETE on the real endpoint",
  /api\.delete<[^>]*>\(`\/quotations\/\$\{quotationId\}`\)/.test(service),
  "expected api.delete(`/quotations/${quotationId}`)",
);

check(
  "the service does not invent a second delete path (no POST /void, no ?delete=)",
  !/\/quotations\/[^`"']*\/(void|archive|cancel)/.test(service),
);

console.log("\nquotation delete -- permission gate");

// The exact string the screen asks for, extracted rather than assumed.
const canCall = screen.match(/can\(\s*["']([^"']*quotations[^"']*)["']\s*\)/);
check(
  "the screen gates the button on a quotations permission",
  !!canCall,
  screen.includes("can(") ? "found can() but not for quotations" : "no can() call at all",
);

if (canCall) {
  const key = canCall[1];
  check(
    `the key it asks for (${key}) is one the backend actually seeds`,
    keys.includes(`"${key}"`),
    "not present in backendPermissionKeys.generated.ts -- regenerate with " +
      "`npm run gen:permission-keys` after the backend seed lands, or the " +
      "button never renders for anyone",
  );
  check("it is the delete key, not read/create/manage", key === "quotations.delete", `got ${key}`);
}

check(
  "the delete button is rendered behind that gate",
  /canDelete\s*&&[\s\S]{0,400}?Delete Quotation/.test(screen),
);

console.log("\nquotation delete -- confirmation");

check(
  "an AlertDialog is imported (the console's destructive-action idiom)",
  /from\s+["']@\/components\/ui\/alert-dialog["']/.test(screen),
);

check(
  "the button opens the confirmation instead of deleting directly",
  /onClick=\{\(\)\s*=>\s*setConfirmDelete\(selected\)\}/.test(screen),
);

// Call sites only -- the `async function handleDelete(` declaration is not
// one, and counting it would make this assertion pass for the wrong reason.
const deleteCallSites =
  (screen.match(/handleDelete\(/g) || []).length -
  (screen.match(/function handleDelete\(/g) || []).length;
check(
  "handleDelete is only reachable from the dialog's action",
  deleteCallSites === 1,
  `called from ${deleteCallSites} place(s) -- anything above one is a path ` +
    "that skips the confirmation",
);

check(
  "the confirmation names the quotation being deleted",
  /AlertDialogTitle>[\s\S]{0,120}confirmDelete\?\.quotationNumber/.test(screen),
);

check(
  "a sent quotation's confirmation says the email is not recalled",
  /confirmDelete\?\.status === "sent"[\s\S]{0,300}does not recall/.test(screen),
);

console.log("\nquotation delete -- loading and error");

check(
  "the confirm action is disabled while the request is in flight",
  /AlertDialogAction[\s\S]{0,120}disabled=\{deleting\}/.test(screen),
);

check(
  "the cancel is disabled too, so the dialog cannot be dismissed mid-flight",
  /AlertDialogCancel disabled=\{deleting\}/.test(screen),
);

check(
  "the in-flight state is shown, not just disabled",
  /deleting \?[\s\S]{0,200}animate-spin/.test(screen),
);

check(
  "deleting is reset in a finally block, so a failure re-enables the button",
  /finally\s*\{\s*setDeleting\(false\)/.test(screen),
);

check(
  "a failure surfaces the backend's own message",
  /toast\.error\(\(err as AppError\)\.message \|\| "Could not delete this quotation\."\)/.test(
    screen,
  ),
);

console.log("\nquotation delete -- cache invalidation");

check(
  "the deleted row is dropped from the list state",
  /setQuotations\(\(prev\) => prev\.filter\(\(row\) => row\.id !== q\.id\)\)/.test(screen),
);

check(
  "the drawer showing the deleted row is closed",
  /setSelected\(\(prev\) => \(prev && prev\.id === q\.id \? null : prev\)\)/.test(screen),
);

check("the confirmation dialog is closed on success", /setConfirmDelete\(null\);/.test(screen));

check(
  "the stat tiles are derived from the same array, so they cannot go stale",
  /const sentCount = quotations\.filter/.test(screen) &&
    /const totalQuoted = quotations\.reduce/.test(screen),
  "the tiles no longer derive from `quotations` -- a delete would leave " +
    "them showing the removed quotation",
);

check(
  "success is reported to the operator",
  /toast\.success\(`Quotation \$\{q\.quotationNumber\} deleted`\)/.test(screen),
);

console.log(
  failures === 0 ? "\nAll quotation delete checks passed.\n" : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
