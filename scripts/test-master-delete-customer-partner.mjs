/**
 * Regression test for the Master console's "Delete customer" and "Delete
 * Partner" actions.
 *
 * WHY IT EXISTS: both remove a whole tenant / partner from the console, and
 * the ways they can be wrong all still render:
 *
 *   1. NO PERMISSION GATE, or a gate on a key the backend does not seed --
 *      a button that 403s for everyone, or one that silently never appears
 *      (the incident `generate-backend-permission-keys.mjs` was written for).
 *   2. NO REAL CONFIRMATION. These are type-the-name confirmations: the
 *      confirm button must stay disabled until the operator types the
 *      record's exact name, and the delete must only be reachable from it.
 *   3. THE WRONG ID. The delete is fired from inside a drawer; it must send
 *      the id of the row the dialog names.
 *   4. THE LIST NOT INVALIDATED / THE DRAWER LEFT OPEN on a deleted row.
 *   5. COPY THAT OVERSTATES. `DELETE /organizations/{id}` archives (status
 *      archived + soft delete); it does not erase data and does not touch the
 *      venue's routers. The dialog must say so.
 *
 * WHY IT LOOKS LIKE THIS: this repo has no component test runner (see
 * `scripts/test-quotation-delete.mjs`), so the wiring is checked against the
 * real sources, and the one pure function -- the name match -- is executed.
 *
 * Run: node scripts/test-master-delete-customer-partner.mjs
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
function note(text) {
  console.log(`  note ${text}`);
}

const read = (p) => readFileSync(join(ROOT, p), "utf8");

const dialog = read("src/components/master/TypeToConfirmDialog.tsx");
const shell = read("src/components/master/MasterShell.tsx");
const customers = read("src/routes/master.customers.tsx");
const partners = read("src/routes/master.channel-partners.tsx");
const orgService = read("src/services/organization.service.ts");
const cpService = read("src/services/channel-partner.service.ts");
const keys = read("src/lib/backendPermissionKeys.generated.ts");

// ---------------------------------------------------------------------------
console.log("\ntype-to-confirm dialog");

// Execute the real match function rather than pattern-match it.
const matchSrc = dialog.match(/function typedNameMatches\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
check("typedNameMatches exists", !!matchSrc);
if (matchSrc) {
  const fn = new Function("typed", "name", matchSrc[1]);
  check("empty input does not match", fn("", "Acme Corp") === false);
  check("a partial name does not match", fn("Acme", "Acme Corp") === false);
  check("a different case does not match", fn("acme corp", "Acme Corp") === false);
  check("the exact name matches", fn("Acme Corp", "Acme Corp") === true);
  check("surrounding whitespace is forgiven", fn("  Acme Corp ", "Acme Corp") === true);
  check("an empty name never matches (no confirm-by-default)", fn("", "") === false);
}

check(
  "the confirm button is disabled until the name matches",
  /AlertDialogAction[\s\S]{0,200}disabled=\{busy \|\| !matches\}/.test(dialog),
);
check(
  "the click handler re-checks the match (disabled is not the only guard)",
  /if \(matches && !busy\) onConfirm\(\)/.test(dialog),
);
check("cancel is disabled while in flight", /AlertDialogCancel disabled=\{busy\}/.test(dialog));
check(
  "the typed text is cleared each time the dialog opens",
  /if \(open\) setTyped\(""\)/.test(dialog),
);
check("the dialog cannot be dismissed mid-flight", /if \(!o && !busy\) onCancel\(\)/.test(dialog));

// ---------------------------------------------------------------------------
console.log("\ncustomer delete -- service");

check(
  "organizationService.remove calls DELETE /organizations/{id}",
  /api\.delete\(`\/organizations\/\$\{id\}`/.test(orgService),
);
check(
  "it is sent with crossOrganizationHeaders(), like list()",
  /api\.delete\(`\/organizations\/\$\{id\}`,\s*\{\s*headers:\s*crossOrganizationHeaders\(\)\s*\}\)/.test(
    orgService,
  ),
  "without it, an operator scoped to another org in the picker is refused by the tenant check",
);

console.log("\ncustomer delete -- permission gate");

const capMatch = shell.match(/"customer\.delete":\s*\[([^\]]*)\]/);
check("MasterShell defines a customer.delete capability", !!capMatch);
if (capMatch) {
  const capKeys = [...capMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  check(
    "it maps to exactly organizations.delete",
    capKeys.length === 1 && capKeys[0] === "organizations.delete",
    `got ${capKeys.join(", ")}`,
  );
}
check(
  "organizations.delete is a key the backend actually seeds",
  keys.includes('"organizations.delete"'),
);
check(
  "the Delete customer button is rendered behind the cap (hidden without permission)",
  /caps\.has\("customer\.delete"\)\s*&&[\s\S]{0,400}?Delete customer/.test(customers),
);

console.log("\ncustomer delete -- confirmation and id");

check(
  "the button opens the confirmation instead of deleting directly",
  /onClick=\{\(\) => setConfirmDelete\(selected\)\}[\s\S]{0,80}Delete customer/.test(customers),
);
const custCalls =
  (customers.match(/handleDelete\(/g) || []).length -
  (customers.match(/function handleDelete\(/g) || []).length;
check(
  "handleDelete is only reachable from the dialog",
  custCalls === 1,
  `called from ${custCalls} place(s)`,
);
check(
  "the dialog confirms against the customer's own name",
  /confirmName=\{confirmDelete\?\.name \?\? ""\}/.test(customers),
);
check(
  "the dialog deletes the row it names (confirmDelete, not some other state)",
  /if \(confirmDelete\) handleDelete\(confirmDelete\)/.test(customers),
);
check(
  "delete is called with that row's id",
  /organizationService\.remove\(\[c\.id\]\)/.test(customers),
);

console.log("\ncustomer delete -- copy");

check("copy says users lose access", /users will lose\s+access/.test(customers));
check("copy says data is retained / archived", /retained[\s\S]{0,80}archived/.test(customers));
check(
  "copy says routers are not reconfigured or disconnected",
  /Routers at its venues[\s\S]{0,120}not[\s\S]{0,40}reconfigured or\s+disconnected/.test(customers),
);

console.log("\ncustomer delete -- after success");

check(
  "the deleted row is dropped and the list refetched",
  /setRows\(\(prev\) => prev\.filter\(\(row\) => row\.id !== c\.id\)\);\s*refetch\(\);/.test(
    customers,
  ),
);
check(
  "the drawer showing it is closed",
  /setSelected\(\(prev\) => \(prev && prev\.id === c\.id \? null : prev\)\)/.test(customers),
);
check("success is toasted", /toast\.success\(`\$\{c\.name\} deleted`\)/.test(customers));
check(
  "failure surfaces the backend message",
  /toast\.error\(\(err as AppError\)\.message \|\| "Could not delete this customer\."\)/.test(
    customers,
  ),
);
check(
  "archived orgs are filtered out of the list",
  /\.filter\(\(o\) => o\.status !== "archived"\)/.test(customers),
);
check("deleting resets in finally", /finally\s*\{\s*setDeleting\(false\)/.test(customers));

// ---------------------------------------------------------------------------
console.log("\nchannel partner delete -- service");

check(
  "channelPartnerService.delete calls DELETE /channel-partners/{id}",
  /async delete\(partnerId: string\)[\s\S]{0,200}api\.delete<[^>]*>\(`\/channel-partners\/\$\{partnerId\}`\)/.test(
    cpService,
  ),
);
check(
  "it uses the same base path as the service's other calls",
  /api\.post<BackendChannelPartner>\("\/channel-partners"/.test(cpService),
);

console.log("\nchannel partner delete -- permission gate");

check(
  "the screen gates on channel_partners.delete",
  /const canDelete = can\("channel_partners\.delete"\)/.test(partners),
);
check(
  "the Delete Partner button is rendered behind that gate",
  /\{canDelete && \([\s\S]{0,400}?Delete Partner/.test(partners),
);
if (keys.includes('"channel_partners.delete"')) {
  check("channel_partners.delete is a key the backend seeds", true);
} else {
  // Not a failure while the backend PR that adds the action is unmerged:
  // the button simply stays hidden for everyone until it lands and
  // `npm run gen:permission-keys` is re-run. Turn this into a hard check then.
  note(
    "channel_partners.delete is not in backendPermissionKeys.generated.ts yet -- " +
      "button stays hidden until the backend seeds it (regenerate after it lands)",
  );
}

console.log("\nchannel partner delete -- confirmation and id");

check(
  "the button opens the confirmation instead of deleting directly",
  /onClick=\{\(\) => setConfirmDelete\(selected\)\}[\s\S]{0,80}Delete Partner/.test(partners),
);
const cpCalls =
  (partners.match(/handleDelete\(/g) || []).length -
  (partners.match(/function handleDelete\(/g) || []).length;
check(
  "handleDelete is only reachable from the dialog",
  cpCalls === 1,
  `called from ${cpCalls} place(s)`,
);
check(
  "the dialog confirms against the partner's own name",
  /confirmName=\{confirmDelete\?\.name \?\? ""\}/.test(partners),
);
check(
  "the dialog deletes the row it names",
  /if \(confirmDelete\) handleDelete\(confirmDelete\)/.test(partners),
);
check(
  "delete is called with that row's id",
  /channelPartnerService\.delete\(partner\.id\)/.test(partners),
);

console.log("\nchannel partner delete -- after success");

check(
  "the deleted row is dropped from the list state",
  /setPartners\(\(prev\) => prev\.filter\(\(p\) => p\.id !== partner\.id\)\)/.test(partners),
);
check(
  "the drawer showing it is closed",
  /setSelected\(\(prev\) => \(prev && prev\.id === partner\.id \? null : prev\)\)/.test(partners),
);
check(
  "failure surfaces the backend message",
  /toast\.error\(\(err as AppError\)\.message \|\| "Could not delete this channel partner\."\)/.test(
    partners,
  ),
);

console.log(
  failures === 0 ? "\nAll master delete checks passed.\n" : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
