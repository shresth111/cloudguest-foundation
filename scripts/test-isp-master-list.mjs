/**
 * Master "ISP partners" list loads every page (QA 2026-10-24: past the first
 * 100, new ISPs -- the list is sorted by name -- were invisible with no pager).
 * Run: node scripts/test-isp-master-list.mjs
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const src = readFileSync(
  join(ROOT, "src/components/master/isp-partners/IspPartnersPage.tsx"),
  "utf8",
);
let failures = 0;
const check = (name, ok) => {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}`);
};
check("pages through the list", /for \(let page = 1; page <= MAX_PAGES; page \+= 1\)/.test(src));
check("stops when everything is loaded", /all\.length >= res\.total/.test(src));
check("never asks only for page 1", !/page: 1,\s*pageSize: 100/.test(src));
check("says when the list is capped", /Showing \{items\.length\} of \{total\}/.test(src));
console.log(failures ? `\nFAIL: ${failures}` : "\nPASS: all 4 checks passed");
process.exit(failures ? 1 : 0);
