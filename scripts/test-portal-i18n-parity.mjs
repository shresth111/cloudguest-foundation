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
 * TWO FAILURES, NOT ONE. The first is a key that is *absent*: that is what
 * produces the language-switching paragraph. The second is a key that is
 * present and holds English -- which reads identically to the guest and is
 * invisible to a parity-of-keys check, so "add the key everywhere, translate
 * the three languages I can read, paste EN into the rest" passes a
 * keys-only guard while shipping exactly the defect it was written to stop.
 * Every one of these nine dictionaries is written in its own Indic script,
 * so the second check is simply: a value must contain at least one character
 * of that dictionary's script. That is a low bar on purpose -- it cannot
 * grade a translation, and it does not pretend to -- but it is the bar EN
 * text cannot clear.
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

/**
 * key -> the literal text of its value, with the surrounding quotes and any
 * line-continuation whitespace stripped. Deliberately naive: this is not a
 * TypeScript parser and does not need to be. A value runs from the colon to
 * the line before the next two-space key (or the end of the block), which is
 * exactly how this file is formatted by prettier -- including the wrapped
 * two-line values, whose second line is indented four spaces.
 */
const valuesOf = (body) => {
  const out = new Map();
  const lines = body.split("\n");
  let key = null;
  let buf = [];
  const flush = () => {
    if (key) out.set(key, buf.join(" ").replace(/,\s*$/, ""));
    key = null;
    buf = [];
  };
  for (const line of lines) {
    const m = /^ {2}([A-Za-z][A-Za-z0-9_]*):(.*)$/.exec(line);
    if (m) {
      flush();
      key = m[1];
      buf = [m[2].trim()];
    } else if (key && /^ {4}\S/.test(line) && !line.trimStart().startsWith("//")) {
      buf.push(line.trim());
    } else if (key) {
      flush();
    }
  }
  flush();
  return out;
};

/**
 * The script each dictionary is written in. `translate()` has no notion of
 * script; this table is only here so the check below can say "this value is
 * not in the language it claims to be".
 *
 * MR shares Devanagari with HI and that is correct, not a copy-paste: they
 * are different languages in the same script, and the values differ.
 */
const SCRIPT_OF = {
  HI: { name: "Devanagari", re: /[\u0900-\u097F]/ },
  MR: { name: "Devanagari", re: /[\u0900-\u097F]/ },
  BN: { name: "Bengali", re: /[\u0980-\u09FF]/ },
  TE: { name: "Telugu", re: /[\u0C00-\u0C7F]/ },
  TA: { name: "Tamil", re: /[\u0B80-\u0BFF]/ },
  GU: { name: "Gujarati", re: /[\u0A80-\u0AFF]/ },
  KN: { name: "Kannada", re: /[\u0C80-\u0CFF]/ },
  ML: { name: "Malayalam", re: /[\u0D00-\u0D7F]/ },
  PA: { name: "Gurmukhi", re: /[\u0A00-\u0A7F]/ },
};

/**
 * Keys whose value is a brand or protocol name that is spelled in Latin in
 * every one of these languages, and is *correct* that way. Kept as an
 * explicit list rather than a heuristic so that adding to it is a decision
 * somebody made on purpose, in a diff, rather than a threshold quietly
 * absorbing a real regression.
 */
const LATIN_BY_DESIGN = new Set(["wifi", "whatsappOtp"]);

// Each block ends at its own closing `};` on column 0 -- not at the next
// block's start. The last dictionary is followed by other top-level
// declarations (the RuntimeLanguage->Dict map, for one), and slicing to
// EOF would scoop their keys up as if they belonged to PA.
const dicts = starts.map((start) => {
  const closing = source.indexOf("\n};", start.from);
  const end = closing === -1 ? source.length : closing;
  const body = source.slice(start.from, end);
  return { lang: start.lang, keys: keysOf(body), values: valuesOf(body) };
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

  // The second failure: present, but not actually translated.
  const script = SCRIPT_OF[dict.lang];
  if (script) {
    const untranslated = [...en.keys]
      .filter((k) => !LATIN_BY_DESIGN.has(k))
      .filter((k) => dict.keys.has(k))
      .filter((k) => {
        const v = dict.values.get(k);
        // A value this crude parser could not read is not evidence of a
        // fault -- it reports what it can see and stays silent otherwise.
        if (v === undefined || v === "") return false;
        return !script.re.test(v);
      });
    if (untranslated.length) {
      failed = true;
      console.error(
        `FAIL: ${dict.lang} has ${untranslated.length} key(s) with no ${script.name} ` +
          `character in the value. A guest who picked this language reads English there, ` +
          `and no keys-only check can see it:\n  ` +
          untranslated.sort().join("\n  "),
      );
    }
  }

  // The third failure, and the only one with a mechanical consequence:
  // `{host}` is not decoration. `portal.session.tsx` renders
  // `t("openingSiteTemplate").split("{host}")[0]` and `[1]`, so a
  // translation that drops the placeholder renders the hostname nowhere and
  // `[1]` as `undefined`. Every `{name}` in an EN value must survive into
  // every translation of it.
  const droppedPlaceholders = [...en.keys]
    .filter((k) => dict.keys.has(k))
    .map((k) => {
      const source_ = en.values.get(k) ?? "";
      const target = dict.values.get(k);
      if (target === undefined) return null;
      const wanted = [...source_.matchAll(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g)].map((m) => m[0]);
      const missing = wanted.filter((ph) => !target.includes(ph));
      return missing.length ? `${k} (missing ${missing.join(", ")})` : null;
    })
    .filter(Boolean);
  if (droppedPlaceholders.length) {
    failed = true;
    console.error(
      `FAIL: ${dict.lang} drops a substitution placeholder EN carries. The value it ` +
        `stands in for renders nowhere:\n  ` +
        droppedPlaceholders.sort().join("\n  "),
    );
  }
}

if (failed) process.exit(1);

console.log(
  `PASS: ${dicts.length} portal languages (${dicts.map((d) => d.lang).join(", ")}) ` +
    `all carry the same ${en.keys.size} keys, each written in its own script, ` +
    `with every EN placeholder preserved.`,
);
