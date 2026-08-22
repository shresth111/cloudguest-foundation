/**
 * Guided Setup i18n invariants.
 *
 * The Guided Setup module now renders in three registers -- Hinglish
 * (`hi-Latn`, the field-tested reference), English and Devanagari Hindi.
 * Almost every string in it is prose an operator reads, but a small
 * minority are things he MATCHES BY EYE against something outside this
 * app: a RouterOS command, a token in the device's output, an IP, an
 * interface name, or a button label on the Master console's (English-only)
 * generator screen. Translating one of those does not degrade the
 * experience, it sends him looking for something that does not exist. It
 * is strictly worse than shipping no translation at all.
 *
 * Two mechanisms keep that from happening, and this script is the second:
 *
 *  1. SHAPE. `content-i18n.ts`'s override types simply have no key for
 *     `command`, `expect`, `assert`, `script`, `probe` or `fix`. A
 *     translator cannot express the wrong thing. That covers whole fields.
 *
 *  2. THIS SCRIPT. It covers what shape cannot: literals embedded INSIDE
 *     prose that is legitimately translatable -- a backticked
 *     `gateway=0.0.0.0` inside a diagnostics `tell`, the words
 *     "Download .rsc" inside a paragraph, an IP inside a note -- plus the
 *     structural parity (placeholders, markup tags, key coverage) that a
 *     hand-edited JSON file quietly loses.
 *
 * Run: node scripts/check-guided-i18n.mjs   (npm run test:guided-i18n)
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { transformSync } from "esbuild";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (rel) => resolve(ROOT, rel);

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks += 1;
  if (ok) {
    // Printed one per assertion, not summarised: `scripts/ci-gated-test.sh`
    // counts these lines and fails the build if the count drops below its
    // floor. That gate exists because the failure mode this repo has
    // actually suffered is not a red test, it is a suite that quietly
    // stopped asserting things. A group-level summary would defeat it.
    console.log(`  ok  ${name}`);
    return;
  }
  failures += 1;
  console.error(`FAIL  ${name}\n      ${detail}`);
}

// ---------------------------------------------------------------------------
// Loading the content files.
//
// They are pure data -- no imports, no React, no runtime logic -- so they
// can be type-stripped and imported directly. That is deliberately NOT a
// regex: the whole point of this script is to compare the real strings the
// UI will render, and a regex that half-parses a template literal would
// give false confidence about exactly the fields that matter most.
// ---------------------------------------------------------------------------
async function loadContentModule(rel) {
  const src = readFileSync(P(rel), "utf8");
  const { code } = transformSync(src, { loader: "ts", format: "esm", target: "esnext" });
  const url = `data:text/javascript;base64,${Buffer.from(code, "utf8").toString("base64")}`;
  return import(url);
}

const { PHASES } = await loadContentModule("src/components/routers/guided-setup/phases.content.ts");
const { SYMPTOMS } = await loadContentModule(
  "src/components/routers/guided-setup/diagnostics.content.ts",
);
// `assertions.ts` is the analyser's prose: one `fallback` per check plus a
// `why` per verdict rule. It imports only types from `analyse.ts`, which
// esbuild erases, so it loads the same way the content files do.
const { ASSERTIONS } = await loadContentModule("src/components/routers/guided-setup/assertions.ts");

const LOCALE_DIR = "src/lib/master-i18n/locales";
const LANGS = ["hi-Latn", "en", "hi"];
const REFERENCE = "hi-Latn"; // the field-tested register everything is measured against

const readJson = (rel) => JSON.parse(readFileSync(P(rel), "utf8"));

// ---------------------------------------------------------------------------
// 1. Chrome bundles: identical key coverage.
//
//    A key present in one bundle and missing from another is not a
//    cosmetic gap here. `fallbackLng` would render it in a different
//    script mid-sentence, on a screen whose entire job is careful reading.
// ---------------------------------------------------------------------------
const chrome = Object.fromEntries(
  LANGS.map((l) => [l, readJson(`${LOCALE_DIR}/${l}/guided.json`)]),
);
const keysOf = (o) => Object.keys(o).filter((k) => k !== "_comment");
const refKeys = keysOf(chrome[REFERENCE]);

for (const lang of LANGS) {
  if (lang === REFERENCE) continue;
  const mine = new Set(keysOf(chrome[lang]));
  const missing = refKeys.filter((k) => !mine.has(k));
  const extra = [...mine].filter((k) => !refKeys.includes(k));
  check(
    `chrome-keys-complete:${lang}`,
    missing.length === 0,
    `${lang}/guided.json is missing ${missing.length} key(s) present in ${REFERENCE}: ${missing.join(", ")}`,
  );
  check(
    `chrome-keys-no-strays:${lang}`,
    extra.length === 0,
    `${lang}/guided.json has ${extra.length} key(s) that do not exist in ${REFERENCE}: ${extra.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
// 2. Chrome bundles: interpolation and markup parity, per key.
//
//    A dropped `{{router}}` silently renders a sentence with a hole in it.
//    A dropped `<b>` in a `Trans` key renders the literal characters
//    "<b>" on screen. Both are the kind of thing that survives review and
//    only shows up in front of the operator.
// ---------------------------------------------------------------------------
const placeholders = (s) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
const tags = (s) => [...s.matchAll(/<(\/?[a-z]+)>/g)].map((m) => m[1]).sort();

for (const key of refKeys) {
  const ref = chrome[REFERENCE][key];
  for (const lang of LANGS) {
    if (lang === REFERENCE) continue;
    const val = chrome[lang][key];
    if (typeof val !== "string") continue;
    check(
      `chrome-placeholders:${lang}:${key}`,
      placeholders(val).join("|") === placeholders(ref).join("|"),
      `interpolation mismatch. ${REFERENCE}: {{${placeholders(ref).join("}} {{")}}} vs ${lang}: {{${placeholders(val).join("}} {{")}}}`,
    );
    check(
      `chrome-markup:${lang}:${key}`,
      tags(val).join("|") === tags(ref).join("|"),
      `<Trans> tag mismatch. ${REFERENCE}: [${tags(ref).join(", ")}] vs ${lang}: [${tags(val).join(", ")}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. Chrome bundles: cross-screen literals must survive translation.
//
//    Every entry below names something OUTSIDE this module that the
//    operator has to find by its exact spelling -- a button on the Master
//    console's generator (which is English-only and is not being
//    translated), a RouterOS username, a file extension, a protocol. If a
//    sentence mentions one in Hinglish it has to mention the same one, the
//    same number of times, in English and in Devanagari.
// ---------------------------------------------------------------------------
const CROSS_SCREEN_LITERALS = [
  // The two verdict chips the ROUTER itself prints. Thirteen paste blocks
  // in phases.content.ts emit `RESULT: PASS` / `RESULT: FAIL`, and the
  // chip is what the operator compares that line against -- so these two
  // stay identical in every register. The four softer verdicts
  // (WARNING/UNKNOWN/INCOMPLETE/WRONG_OUTPUT) are the app describing
  // itself, and do translate; PhaseView interpolates them into the
  // stop-gate hint rather than naming them again, so there is no second
  // copy to keep in step.
  "PASS",
  "FAIL",
  "Router Fleet",
  "Guided Setup",
  "Download .rsc",
  "Rotate the RouterOS API password",
  "API Access",
  "Generate",
  "WinBox Terminal",
  "cloudguest-api",
  ".rsc",
  "WireGuard",
  "RADIUS",
];

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

for (const key of refKeys) {
  const ref = chrome[REFERENCE][key];
  if (typeof ref !== "string") continue;
  for (const lit of CROSS_SCREEN_LITERALS) {
    const want = countOf(ref, lit);
    if (want === 0) continue;
    for (const lang of LANGS) {
      if (lang === REFERENCE) continue;
      const got = countOf(chrome[lang][key] ?? "", lit);
      check(
        `chrome-literal:${lang}:${key}:${lit}`,
        got === want,
        `"${lit}" appears ${want}x in ${REFERENCE} but ${got}x in ${lang}. ` +
          `It names a control on an English-only screen -- it must survive translation byte-for-byte.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Content overrides: no key may exist for a never-translate field.
//
//    `content-i18n.ts` already makes these impossible to type. This is the
//    same rule stated where a JSON-only contributor will actually hit it,
//    since a hand-written locale file never goes through `tsc`.
// ---------------------------------------------------------------------------
// `when` is on this list for a subtler reason than the rest. It is
// displayed to the operator, so it LOOKS translatable -- but `analyse.ts`
// picks which repair to highlight with
// `failFix.findIndex(f => f.when === rule.fix)`, an exact comparison
// against a static Hinglish string in `assertions.ts`. Translating `when`
// returns `fixIndex: null`, which silently downgrades the analyser's
// pinpointed "this is what happened" to a generic list, in English and
// Hindi only, with nothing reporting it. `whenLabel` is the display-only
// override that exists instead.
const FORBIDDEN_KEYS = ["command", "expect", "assert", "script", "probe", "fix", "when"];

function walkKeys(node, path, fn) {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    fn(k, `${path}.${k}`, v);
    walkKeys(v, `${path}.${k}`, fn);
  }
}

const phaseById = new Map(PHASES.map((p) => [p.id, p]));
const symptomById = new Map(SYMPTOMS.map((s) => [s.id, s]));

for (const lang of LANGS) {
  const rel = `${LOCALE_DIR}/${lang}/guided-content.json`;
  if (!existsSync(P(rel))) continue; // hi-Latn has none by design: the content files ARE hi-Latn
  const bundle = readJson(rel);

  walkKeys(bundle, lang, (k, path) => {
    check(
      `content-forbidden-key:${lang}`,
      !FORBIDDEN_KEYS.includes(k),
      `${path} -- "${k}" is a never-translate field (a command, a literal the operator matches ` +
        `against device output, or a paste-able script). It must not have a translation key at all.`,
    );
  });

  // ---------------------------------------------------------------------
  // 5. Content overrides: every id must still exist in the content files.
  //
  //    Ids are the join between the two. A phase renamed or a check
  //    removed in `phases.content.ts` leaves a dead override that silently
  //    stops applying -- the screen quietly reverts to Hinglish for one
  //    entry, in the middle of an otherwise-translated page, and nothing
  //    anywhere says so.
  // ---------------------------------------------------------------------
  for (const [phaseId, po] of Object.entries(bundle.phases ?? {})) {
    const phase = phaseById.get(phaseId);
    check(
      `content-phase-exists:${lang}:${phaseId}`,
      !!phase,
      `no phase with id "${phaseId}" in phases.content.ts`,
    );
    if (!phase) continue;
    for (const idx of Object.keys(po.paste ?? {})) {
      check(
        `content-paste-index:${lang}:${phaseId}:${idx}`,
        phase.paste[Number(idx)] !== undefined,
        `phase "${phaseId}" has ${phase.paste.length} paste block(s); override targets index ${idx}`,
      );
    }
    for (const [checkId, co] of Object.entries(po.checks ?? {})) {
      const c = phase.checks.find((x) => x.id === checkId);
      check(
        `content-check-exists:${lang}:${phaseId}:${checkId}`,
        !!c,
        `phase "${phaseId}" has no check with id "${checkId}"`,
      );
      if (!c) continue;
      // `commandLabel` / `expectLabel` exist ONLY for checks whose
      // "command" is an instruction to a human. `CheckRow.isRouterCommand`
      // is the same test: every real RouterOS command starts with `/` or
      // `:`. Setting either on a pasteable check would translate the text
      // the operator is comparing against his own terminal output.
      const pasteable = /^\s*[/:]/.test(c.command);
      if (pasteable) {
        check(
          `content-no-command-label-on-pasteable:${lang}:${phaseId}:${checkId}`,
          co.commandLabel === undefined && co.expectLabel === undefined,
          `check "${checkId}" is pasteable (its command runs on the router), so its command and ` +
            `expect are matched character-for-character against the device. Neither may carry a ` +
            `translated display label.`,
        );
      }
      for (const idx of Object.keys(co.failFix ?? {})) {
        check(
          `content-fix-index:${lang}:${phaseId}:${checkId}:${idx}`,
          (c.failFix ?? [])[Number(idx)] !== undefined,
          `check "${checkId}" has ${(c.failFix ?? []).length} fix(es); override targets index ${idx}`,
        );
      }
    }
  }

  for (const [checkId, ao] of Object.entries(bundle.assertions ?? {})) {
    const assertion = ASSERTIONS[checkId];
    check(
      `content-assertion-exists:${lang}:${checkId}`,
      !!assertion,
      `no assertion with check id "${checkId}" in assertions.ts`,
    );
    if (!assertion) continue;
    for (const idx of Object.keys(ao.rules ?? {})) {
      check(
        `content-rule-index:${lang}:${checkId}:${idx}`,
        assertion.rules[Number(idx)] !== undefined,
        `assertion "${checkId}" has ${assertion.rules.length} rule(s); override targets index ${idx}`,
      );
    }
  }

  for (const [symptomId, so] of Object.entries(bundle.symptoms ?? {})) {
    const sym = symptomById.get(symptomId);
    check(
      `content-symptom-exists:${lang}:${symptomId}`,
      !!sym,
      `no symptom with id "${symptomId}" in diagnostics.content.ts`,
    );
    if (!sym) continue;
    for (const idx of Object.keys(so.causes ?? {})) {
      check(
        `content-cause-index:${lang}:${symptomId}:${idx}`,
        sym.causes[Number(idx)] !== undefined,
        `symptom "${symptomId}" has ${sym.causes.length} cause(s); override targets index ${idx}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // 6. Content overrides: literals embedded in translatable prose.
  //
  //    THIS IS THE ONE THAT ACTUALLY BITES. `diagnostics.content.ts` says
  //    it in its own header: every `tell` is a LITERAL token the operator
  //    matches in RouterOS output -- `Is` vs `As`, `bound` vs `searching`,
  //    `gateway=0.0.0.0`, `last-handshake=`. But `tell` is not a pure
  //    token, it is a Hinglish sentence WRAPPED AROUND one:
  //
  //      "Flags me `Is` (I = inactive) aur line me `gateway=0.0.0.0`."
  //
  //    The sentence must be translated. The backticked spans must not,
  //    and must stay in the same order -- swapping `Is` and `As` in a
  //    translation would be a silent, confident lie about what a healthy
  //    device prints. Same rule for the unquoted things that carry no
  //    backticks: IPs, CIDRs, interface names, config values, hostnames.
  // ---------------------------------------------------------------------
  const backticks = (s) => [...s.matchAll(/`[^`]*`/g)].map((m) => m[0]);
  // Anything the operator matches by eye against his own terminal. The
  // `key=value` / `key : value` / `RESULT: WORD` arms matter most for the
  // observe-only `expectLabel` strings, which are sentences with RouterOS
  // fragments embedded in them (`idle-timeout=00:05:00`, `shared-users :
  // 5`, `RESULT: CLEAN`) rather than pure prose.
  const HARD_TOKENS = new RegExp(
    [
      "\\b\\d{1,3}(?:\\.\\d{1,3}){3}(?:/\\d{1,2})?\\b", // IPv4 / CIDR
      "\\bether\\d+\\b",
      "\\bsfp\\d*\\b",
      "\\bwg-cloudguest\\b",
      "\\bhsprof\\d+\\b",
      "\\bbridge\\d*\\b",
      "\\b\\d{2}:\\d{2}:\\d{2}\\b", // durations, e.g. 00:05:00
      "\\bhttp-pap\\b",
      "\\bcloudguest-[\\w-]+\\b",
      "\\b[a-z0-9-]+\\.wyfyguest\\.com\\b",
      "RESULT:\\s*[A-Z][A-Z ]*", // the router's own verdict lines
      "\\b[a-z][a-z0-9-]*\\s*=\\s*[^\\s,;\"'`]+", // key=value (stops at a backtick: the value never contains one, and including it dragged trailing punctuation into the token)
      "\\b(?:shared-users|login-by|idle-timeout|keepalive-timeout|last-handshake|status)\\s*:\\s*[\\w.]+",
    ].join("|"),
    "g",
  );
  const hardTokens = (s) => (s.match(HARD_TOKENS) ?? []).sort();

  // RouterOS route flags get their own comparison rather than an arm in
  // HARD_TOKENS, for two reasons. They must be compared as bare flags --
  // the words AROUND them legitimately change under translation
  // ("route As ho jayega" -> "the route becomes As") -- and a bare
  // /\b(As|Is)\b/ would fire on ordinary English at the start of a
  // sentence. So: only look at strings that actually talk about routes,
  // and then compare just the flags. `\brouter\b` deliberately does not
  // arm it; `\broute\b` does.
  // Proximity, not just presence. `Is` is also the Hinglish word for
  // "this" ("Is router pe DHCP client hai hi nahi"), and `As`/`Is` both
  // start English sentences -- so a whole-string context test fired on
  // perfectly good prose. A RouterOS flag is always written right next to
  // the thing it flags, so require an anchor within a short window.
  const FLAG_WINDOW = 25;
  const ANCHOR = /\b(?:flags?|route|gateway)\b/gi;
  const routeFlags = (s) => {
    const anchors = [...s.matchAll(ANCHOR)].map((m) => m.index);
    if (anchors.length === 0) return [];
    return [...s.matchAll(/\b(As|Is)\b/g)]
      .filter((m) => anchors.some((a) => Math.abs(a - m.index) <= FLAG_WINDOW))
      .map((m) => m[1])
      .sort();
  };

  const pairs = [];
  for (const [phaseId, po] of Object.entries(bundle.phases ?? {})) {
    const phase = phaseById.get(phaseId);
    if (!phase) continue;
    if (po.title) pairs.push([`${phaseId}.title`, phase.title, po.title]);
    if (po.why && phase.why) pairs.push([`${phaseId}.why`, phase.why, po.why]);
    if (po.stopGate && phase.stopGate)
      pairs.push([`${phaseId}.stopGate`, phase.stopGate, po.stopGate]);
    for (const [i, pv] of Object.entries(po.paste ?? {})) {
      const block = phase.paste[Number(i)];
      // Out-of-range indexes are already reported by check 5; skip them
      // here so one dead override cannot crash the whole run and hide
      // every finding after it.
      if (block && pv.label) pairs.push([`${phaseId}.paste[${i}].label`, block.label, pv.label]);
    }
    for (const [checkId, co] of Object.entries(po.checks ?? {})) {
      const c = phase.checks.find((x) => x.id === checkId);
      if (!c) continue;
      if (co.label) pairs.push([`${phaseId}.${checkId}.label`, c.label, co.label]);
      if (co.commandLabel)
        pairs.push([`${phaseId}.${checkId}.commandLabel`, c.command, co.commandLabel]);
      if (co.expectLabel)
        pairs.push([`${phaseId}.${checkId}.expectLabel`, c.expect, co.expectLabel]);
      for (const [i, fo] of Object.entries(co.failFix ?? {})) {
        const f = (c.failFix ?? [])[Number(i)];
        if (!f) continue;
        if (fo.whenLabel)
          pairs.push([`${phaseId}.${checkId}.fix[${i}].whenLabel`, f.when, fo.whenLabel]);
        if (fo.note) pairs.push([`${phaseId}.${checkId}.fix[${i}].note`, f.note, fo.note]);
      }
    }
  }
  for (const [checkId, ao] of Object.entries(bundle.assertions ?? {})) {
    const assertion = ASSERTIONS[checkId];
    if (!assertion) continue;
    if (ao.fallback) pairs.push([`assert:${checkId}.fallback`, assertion.fallback, ao.fallback]);
    for (const [i, ro] of Object.entries(ao.rules ?? {})) {
      const rule = assertion.rules[Number(i)];
      if (rule && ro.why) pairs.push([`assert:${checkId}.rules[${i}].why`, rule.why, ro.why]);
    }
  }
  for (const [symptomId, so] of Object.entries(bundle.symptoms ?? {})) {
    const sym = symptomById.get(symptomId);
    if (!sym) continue;
    if (so.seen) pairs.push([`${symptomId}.seen`, sym.seen, so.seen]);
    for (const [i, co] of Object.entries(so.causes ?? {})) {
      const c = sym.causes[Number(i)];
      if (!c) continue;
      if (co.tell) pairs.push([`${symptomId}.causes[${i}].tell`, c.tell, co.tell]);
      if (co.cause) pairs.push([`${symptomId}.causes[${i}].cause`, c.cause, co.cause]);
      if (co.note) pairs.push([`${symptomId}.causes[${i}].note`, c.note, co.note]);
    }
  }

  for (const [where, source, translated] of pairs) {
    check(
      `content-backticks:${lang}:${where}`,
      backticks(translated).join(" | ") === backticks(source).join(" | "),
      `backticked literals changed.\n      source     : ${backticks(source).join(" | ") || "(none)"}\n      ${lang.padEnd(11)}: ${backticks(translated).join(" | ") || "(none)"}\n      These are matched character-for-character against RouterOS output.`,
    );
    check(
      `content-route-flags:${lang}:${where}`,
      routeFlags(translated).join(" | ") === routeFlags(source).join(" | "),
      `RouterOS route flags changed.\n      source     : ${routeFlags(source).join(" | ") || "(none)"}\n      ${lang.padEnd(11)}: ${routeFlags(translated).join(" | ") || "(none)"}\n      \`As\` (active) and \`Is\` (inactive) are the exact two-character tokens the operator hunts for in \`/ip route print\`. Swapping them is a confident lie about what a healthy device shows.`,
    );
    check(
      `content-hard-tokens:${lang}:${where}`,
      hardTokens(translated).join(" | ") === hardTokens(source).join(" | "),
      `IP / interface / config literals changed.\n      source     : ${hardTokens(source).join(" | ") || "(none)"}\n      ${lang.padEnd(11)}: ${hardTokens(translated).join(" | ") || "(none)"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6b. COVERAGE. Both registers are declared complete, so keep them that way.
//
//     Consistency is not the same as completeness: every check above would
//     still pass on a bundle that translated three phases and skipped six.
//     English and Devanagari were signed off as full coverage of the
//     guided-setup content, so a field added later without a translation
//     is a regression, not a to-do -- it would render one Hinglish
//     paragraph in the middle of an otherwise English screen, which is
//     exactly the "quietly flattened" outcome this content cannot afford.
//
//     If you are adding content and do not want to translate it in the
//     same change, that is a conversation to have deliberately -- not a
//     silent gap.
// ---------------------------------------------------------------------------
const isPasteable = (command) => /^\s*[/:]/.test(command);

for (const lang of LANGS) {
  if (lang === REFERENCE) continue; // the content files ARE this register
  const bundle = readJson(`${LOCALE_DIR}/${lang}/guided-content.json`);
  const missing = [];

  for (const p of PHASES) {
    const po = bundle.phases?.[p.id];
    if (!po) {
      missing.push(`phase "${p.id}" (entirely)`);
      continue;
    }
    if (!po.title) missing.push(`${p.id}.title`);
    if (p.why && !po.why) missing.push(`${p.id}.why`);
    if (p.stopGate && !po.stopGate) missing.push(`${p.id}.stopGate`);
    p.paste.forEach((_, i) => {
      if (!po.paste?.[i]?.label) missing.push(`${p.id}.paste[${i}].label`);
    });
    for (const c of p.checks) {
      const co = po.checks?.[c.id];
      if (!co) {
        missing.push(`${p.id}.${c.id} (entirely)`);
        continue;
      }
      if (!co.label) missing.push(`${p.id}.${c.id}.label`);
      // Observe-only checks carry their instruction in command/expect.
      if (!isPasteable(c.command)) {
        if (!co.commandLabel) missing.push(`${p.id}.${c.id}.commandLabel`);
        if (!co.expectLabel) missing.push(`${p.id}.${c.id}.expectLabel`);
      }
      (c.failFix ?? []).forEach((_, i) => {
        if (!co.failFix?.[i]?.whenLabel) missing.push(`${p.id}.${c.id}.failFix[${i}].whenLabel`);
        if (!co.failFix?.[i]?.note) missing.push(`${p.id}.${c.id}.failFix[${i}].note`);
      });
    }
  }

  for (const s of SYMPTOMS) {
    const so = bundle.symptoms?.[s.id];
    if (!so) {
      missing.push(`symptom "${s.id}" (entirely)`);
      continue;
    }
    if (!so.seen) missing.push(`${s.id}.seen`);
    s.causes.forEach((_, i) => {
      const co = so.causes?.[i];
      if (!co) {
        missing.push(`${s.id}.causes[${i}] (entirely)`);
        return;
      }
      for (const k of ["tell", "cause", "note"]) {
        if (!co[k]) missing.push(`${s.id}.causes[${i}].${k}`);
      }
    });
  }

  for (const [id, a] of Object.entries(ASSERTIONS)) {
    const ao = bundle.assertions?.[id];
    if (!ao) {
      missing.push(`assertion "${id}" (entirely)`);
      continue;
    }
    if (!ao.fallback) missing.push(`${id}.fallback`);
    a.rules.forEach((_, i) => {
      if (!ao.rules?.[i]?.why) missing.push(`${id}.rules[${i}].why`);
    });
  }

  check(
    `content-coverage-complete:${lang}`,
    missing.length === 0,
    `${missing.length} translatable field(s) have no ${lang} translation. ` +
      `Both registers are declared complete, so this leaves Hinglish showing mid-screen.\n` +
      `      ${missing.slice(0, 12).join("\n      ")}` +
      (missing.length > 12 ? `\n      ... and ${missing.length - 12} more` : ""),
  );
}

// ---------------------------------------------------------------------------
// 7. The switch must not be able to reset anything.
//
//    The behavioural proof is `scripts/test-guided-i18n-switch.mjs`, which
//    drives a real browser. These two are the cheap structural guards that
//    catch the two edits most likely to break it silently.
// ---------------------------------------------------------------------------
const guidedSrc = [
  "GuidedSetup.tsx",
  "PhaseView.tsx",
  "CheckRow.tsx",
  "CopyBlock.tsx",
  "DiagnosticsLookup.tsx",
  "GeneratedChunkCallout.tsx",
  "RegenerateGuard.tsx",
  "LanguageSwitch.tsx",
]
  .map((f) => readFileSync(P(`src/components/routers/guided-setup/${f}`), "utf8"))
  .join("\n");

// ---------------------------------------------------------------------------
// 7b. Every chrome key is either WIRED or PINNED TO A REAL STRING.
//
//     This module is being worked on by more than one person at once, and
//     the output-analyser rewrite of `CheckRow.tsx` has already deleted
//     strings that this bundle had translations for (the old "Haan, aisa
//     hi aaya" / "Nahi" buttons). A translation that outlives its string
//     is not harmless: it sits in the bundle looking maintained, gets
//     re-reviewed, and eventually gets wired to something it no longer
//     describes.
//
//     So each key must satisfy one of two conditions:
//       WIRED  -- the key name appears in a module source file, i.e. some
//                 component actually calls t() with it; or
//       PINNED -- it is not wired yet, but its Hinglish value appears
//                 verbatim in a module source file, i.e. it is a
//                 translation of a string that is really on screen today
//                 and is waiting to be wired.
//
//     Keys carrying interpolation or markup cannot be matched literally,
//     so for those only the WIRED test applies.
// ---------------------------------------------------------------------------
const MODULE_SOURCES = readdirSync(P("src/components/routers/guided-setup"))
  .filter((f) => /\.(tsx|ts)$/.test(f))
  .map((f) => readFileSync(P(`src/components/routers/guided-setup/${f}`), "utf8"))
  .concat(readFileSync(P("src/routes/master.routers.guided.$routerId.tsx"), "utf8"))
  .join("\n");

for (const key of refKeys) {
  const value = chrome[REFERENCE][key];
  const wired = MODULE_SOURCES.includes(`"${key}"`) || MODULE_SOURCES.includes(`\`${key}\``);
  // `diag.surface.*` and friends are built by template literal
  // (t(`diag.surface.${s}`)), so the full key never appears as text.
  const wiredByPrefix = /^[a-z]+\.[a-z]+\./i.test(key)
    ? MODULE_SOURCES.includes(key.slice(0, key.lastIndexOf(".") + 1))
    : false;
  const dynamic = /\{\{|<[a-z]+>/.test(value);
  const pinned = !dynamic && MODULE_SOURCES.includes(value);
  check(
    `chrome-key-live:${key}`,
    wired || wiredByPrefix || pinned,
    `neither wired nor pinned. No component calls t("${key}"), and its Hinglish value is not ` +
      `present in any Guided Setup source file either -- so it translates a string that no ` +
      `longer exists on screen. Delete it, or wire it.\n       value: ${JSON.stringify(value)}`,
  );
}

check(
  "no-i18n-provider",
  !/I18nextProvider/.test(guidedSrc),
  "Guided Setup must not mount an <I18nextProvider>. A provider re-render on languageChanged is " +
    "the one thing that can remount this subtree and take the operator's typed input, pasted " +
    "output and in-progress answers with it. Pass the instance explicitly instead: " +
    "useTranslation(ns, { i18n: masterI18n }).",
);

check(
  "no-translated-react-keys",
  !/key=\{`?\$?\{?[^}]*\bt\(/.test(guidedSrc),
  "a React key= is derived from a translated string. Keys must be stable across a language " +
    "switch or the element remounts and loses its state (see PhaseView's CopyBlock key).",
);

console.log(
  failures === 0
    ? `\nguided-i18n: all checks passed (${checks} checks; ${LANGS.join(", ")}).`
    : `\nguided-i18n: ${failures} of ${checks} checks FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
