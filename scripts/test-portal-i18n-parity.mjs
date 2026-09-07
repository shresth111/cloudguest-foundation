#!/usr/bin/env node
/**
 * Every portal language dictionary must carry every key EN carries.
 *
 * `translate()` in src/lib/portal-i18n.ts falls back to EN per *key*, and
 * it does so silently. That is the right runtime behaviour -- a missing
 * string should never render as `undefined` or as a raw key -- but it
 * means a half-translated screen looks completely fine in review and in
 * every automated check, and only shows itself to the guest it fails: one
 * reading a paragraph that switches from Tamil to English mid-sentence and
 * back again.
 *
 * There was no check for this. Ten dictionaries of ~250 keys each are
 * maintained by hand, so "I added the key to EN and to the three languages
 * I can read" is the natural failure, not an unlikely one.
 *
 * Deliberately structural rather than linguistic: it cannot tell a real
 * translation from EN text pasted into a Hindi block, and it does not try.
 * What it does guarantee is that no key is *absent*, which is the failure
 * that produces a language-switching paragraph.
 *
 * Run: node scripts/test-portal-i18n-parity.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "src/lib/portal-i18n.ts"), "utf8");

// The file is a set of `const XX: Dict = { ... };` blocks. Parsing them
// with a regex rather than importing the module keeps this script free of
// a TypeScript toolchain, matching every other scripts/*.mjs guard here.
const blockRe = /^const ([A-Z]{2}): Dict = \{$/gm;
const starts = [];
let match;
while ((match = blockRe.exec(source)) !== null) {
  starts.push({ lang: match[1], from: match.index });
}

if (starts.length === 0) {
  console.error("FAIL: found no `const XX: Dict = {` blocks -- has the file's shape changed?");
  process.exit(1);
}

const keysOf = (body) => {
  const found = new Set();
  // Keys are always at exactly two spaces of indentation; nested object
  // literals and comment bodies are deeper or differently shaped.
  const keyRe = /^ {2}([A-Za-z][A-Za-z0-9_]*):/gm;
  let m;
  while ((m = keyRe.exec(body)) !== null) found.add(m[1]);
  return found;
};

// Each block ends at its own closing `};` on column 0 -- not at the next
// block's start. The last dictionary is followed by other top-level
// declarations (the RuntimeLanguage->Dict map, for one), and slicing to
// EOF would scoop their keys up as if they belonged to PA.
const dicts = starts.map((start) => {
  const closing = source.indexOf("\n};", start.from);
  const end = closing === -1 ? source.length : closing;
  return { lang: start.lang, keys: keysOf(source.slice(start.from, end)) };
});

const en = dicts.find((d) => d.lang === "EN");
if (!en) {
  console.error("FAIL: no EN dictionary found.");
  process.exit(1);
}

let failed = false;
for (const dict of dicts) {
  if (dict.lang === "EN") continue;
  const missing = [...en.keys].filter((k) => !dict.keys.has(k));
  const extra = [...dict.keys].filter((k) => !en.keys.has(k));
  if (missing.length) {
    failed = true;
    console.error(
      `FAIL: ${dict.lang} is missing ${missing.length} key(s) EN has. ` +
        `translate() will silently serve English for these, mid-screen:\n  ` +
        missing.sort().join("\n  "),
    );
  }
  if (extra.length) {
    failed = true;
    console.error(
      `FAIL: ${dict.lang} has ${extra.length} key(s) EN does not. ` +
        `Nothing reads these -- either EN is missing the key or this is a typo:\n  ` +
        extra.sort().join("\n  "),
    );
  }
}

if (failed) process.exit(1);

console.log(
  `PASS: ${dicts.length} portal languages (${dicts.map((d) => d.lang).join(", ")}) ` +
    `all carry the same ${en.keys.size} keys.`,
);
