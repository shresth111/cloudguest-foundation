/**
 * "A language switch must not reset anything."
 *
 * That is the one requirement in the Guided Setup i18n work that is a
 * BEHAVIOUR rather than a shape, so it gets a behavioural test, run
 * against the real modules -- `src/lib/master-i18n/index.ts`,
 * `src/components/routers/guided-setup/content-i18n.ts` and the real
 * `progress.ts`, bundled with esbuild the same way
 * `test-portal-cna-storage-safety.mjs` and `test-portal-signin-fields.mjs`
 * bundle real application source. Stubs exist only at the framework edge
 * (a fake `window.localStorage`), never in place of the code under test.
 *
 * WHY IT MATTERS. The operator is standing at a rack, halfway through a
 * nine-phase provision, with verdicts recorded against pasted router
 * output. If a language button drops that, the button is worse than no
 * button. And the second half is sharper still: the whole module exists to
 * make him compare a literal token in RouterOS output against a literal
 * token on screen. A register that quietly rewrites one of those is not a
 * translation, it is a wrong answer delivered confidently.
 *
 * WHAT THIS COVERS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * Covered here, for real:
 *   - the persisted progress blob is byte-identical across every switch
 *   - `cg.master.lang` is a separate key from the dashboard's
 *     `cg.dashboard.lang`, so the two surfaces cannot clobber each other
 *   - the fallback chain resolves hi -> hi-Latn -> en, and `hi-Latn` never
 *     silently widens to Devanagari `hi`
 *   - a PROPERTY test over all nine phases, every check and every
 *     diagnostics symptom: given a maximally hostile override bundle that
 *     sets every translatable field it is allowed to touch, no command, no
 *     `expect`, no `assert`, no paste script, no probe and no fix changes
 *     in any register
 *
 * NOT covered here: React remounting. Proving that needs a real DOM, and
 * this repo has no browser-test infrastructure -- adding one for a single
 * assertion would mean a Playwright browser download in CI for this test
 * alone. The remount hazard is instead pinned structurally by
 * `check-guided-i18n.mjs` ("no-i18n-provider", "no-translated-react-keys"),
 * which catch the two edits that actually cause it. That is a weaker
 * guarantee and is written down as one rather than papered over.
 *
 * Run: node scripts/test-guided-i18n-state.mjs
 */
import { build } from "esbuild";
import { rmSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, join } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (rel) => resolve(ROOT, rel);

let failures = 0;
let checks = 0;
function check(name, ok, detail) {
  checks += 1;
  if (ok) {
    console.log(`  ok  ${name}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${name}\n       ${detail}`);
}

// ---------------------------------------------------------------------------
// Bundle the real modules for node.
//
// The entry installs a fake `window.localStorage` BEFORE anything else
// evaluates -- `master-i18n/index.ts` reads the stored language at module
// scope, so a bare import would read from a window that does not exist and
// the test would be measuring the SSR fallback path instead of the real
// one. Hence the dynamic import inside the entry rather than a top-level
// one, which ESM would hoist above the setup.
// ---------------------------------------------------------------------------
const ENTRY = `
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.window = { localStorage };
globalThis.localStorage = localStorage;

const i18nMod   = await import("@/lib/master-i18n");
const contentMod= await import("@/components/routers/guided-setup/content-i18n");
const progress  = await import("@/components/routers/guided-setup/progress");
const phases    = await import("@/components/routers/guided-setup/phases.content");
const symptoms  = await import("@/components/routers/guided-setup/diagnostics.content");
const assertions= await import("@/components/routers/guided-setup/assertions");

export const api = { i18nMod, contentMod, progress, phases, symptoms, assertions, store };
`;

// Inside the repo, not the OS temp dir: `external` packages are resolved
// by node from the BUNDLE's location, so a bundle in /tmp cannot find
// `i18next` in this project's node_modules.
const tmp = P("node_modules/.cache/guided-i18n");
mkdirSync(tmp, { recursive: true });
const outfile = join(tmp, "bundle.mjs");

try {
  await build({
    stdin: { contents: ENTRY, resolveDir: ROOT, loader: "ts", sourcefile: "entry.ts" },
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    logLevel: "silent",
    // React and react-i18next are pulled in transitively by content-i18n's
    // hook export. They are never rendered here; leaving them external
    // keeps the bundle small and keeps any of their own resolution quirks
    // out of this test's failure modes.
    external: ["react", "react-dom", "react-i18next", "i18next"],
    alias: { "@": P("src") },
  });
} catch (e) {
  console.error(`FAIL bundle step: ${e.message}`);
  console.error(
    "     A module under test grew an import the bundler could not resolve. " +
      "The assertions below never ran.",
  );
  process.exit(1);
}

const { api } = await import(pathToFileURL(outfile).href);
const { i18nMod, contentMod, progress, phases, symptoms, assertions, store } = api;
const masterI18n = i18nMod.default;

console.log("\nguided-setup i18n: state preservation and never-translate fields\n");

// ---------------------------------------------------------------------------
// 1. The default register is the field-tested one.
// ---------------------------------------------------------------------------
check(
  "default-register-is-hinglish",
  i18nMod.DEFAULT_MASTER_LANGUAGE === "hi-Latn" && masterI18n.resolvedLanguage === "hi-Latn",
  `Hinglish is the only register a real installer has read at a rack; English and Devanagari are ` +
    `untested on day one. Got default="${i18nMod.DEFAULT_MASTER_LANGUAGE}", ` +
    `resolved="${masterI18n.resolvedLanguage}".`,
);

// ---------------------------------------------------------------------------
// 2. Switching language must not touch guided progress.
//
//    The real `saveProgress`/`loadProgress` against the real storage key.
// ---------------------------------------------------------------------------
const ROUTER_ID = "test-router-1";
const seeded = {
  ...progress.emptyProgress(),
  currentPhaseId: "tunnel",
  answers: { "audit:identity": "PASS", "wan:route": "FAIL" },
  donePhaseIds: ["audit"],
  secretsSafePhaseIds: ["tunnel"],
};
progress.saveProgress(ROUTER_ID, seeded);

const progressKey = [...store.keys()].find((k) => k.startsWith("cg_guided_setup_"));
check(
  "progress-key-found",
  progressKey === `cg_guided_setup_${ROUTER_ID}`,
  `expected the per-router progress key, found ${JSON.stringify([...store.keys()])}`,
);

const stripStamp = (raw) => {
  const o = JSON.parse(raw);
  // `updatedAt` is a wall-clock stamp written on every save. It is not
  // state the operator can lose; comparing it would only measure how long
  // the test took.
  delete o.updatedAt;
  return JSON.stringify(o);
};

const beforeSwitch = stripStamp(store.get(progressKey));
for (const lang of ["hi", "en", "hi-Latn", "hi"]) {
  i18nMod.setMasterLanguage(lang);
  check(
    `switch-${lang}-progress-untouched`,
    stripStamp(store.get(progressKey)) === beforeSwitch,
    `setMasterLanguage("${lang}") mutated ${progressKey}.\n` +
      `       before: ${beforeSwitch}\n       after : ${stripStamp(store.get(progressKey))}`,
  );
  check(
    `switch-${lang}-took-effect`,
    masterI18n.resolvedLanguage === lang,
    `language did not actually change to "${lang}" (resolved "${masterI18n.resolvedLanguage}"), ` +
      `so the assertion above proved nothing`,
  );
}

const reloaded = progress.loadProgress(ROUTER_ID);
check(
  "progress-reloads-identically-after-switches",
  reloaded.currentPhaseId === "tunnel" &&
    reloaded.answers["audit:identity"] === "PASS" &&
    reloaded.answers["wan:route"] === "FAIL" &&
    reloaded.donePhaseIds.join() === "audit" &&
    reloaded.secretsSafePhaseIds.join() === "tunnel",
  `progress read back wrong after four language switches: ${JSON.stringify(reloaded)}`,
);

// ---------------------------------------------------------------------------
// 3. The Master console's language preference is its own.
//
//    `cg.dashboard.lang` is overwritten from the backend's `user.language`
//    by `useSyncDashboardLanguage` on every authenticated dashboard mount.
//    If this surface wrote there, an operator's rack-language choice would
//    silently change their customer dashboard, and be reverted by any
//    screen they visited in between.
// ---------------------------------------------------------------------------
check(
  "master-language-key-is-separate",
  store.has("cg.master.lang") && !store.has("cg.dashboard.lang"),
  `expected cg.master.lang and NOT cg.dashboard.lang; stored keys: ${JSON.stringify([...store.keys()])}`,
);

// ---------------------------------------------------------------------------
// 4. Fallback chain.
//
//    A gap in Devanagari falls back to Hinglish (same language, a script
//    the reader certainly reads) before English. And `hi-Latn` must NOT
//    widen to `hi`: i18next does that by default, which would render a
//    missing Hinglish key in Devanagari to someone who asked for Roman
//    script -- mixed-script UI, mid-sentence, on a screen whose whole job
//    is careful reading.
// ---------------------------------------------------------------------------
masterI18n.addResource("hi-Latn", "guided", "__probe.only_hinglish", "HINGLISH_VALUE");
masterI18n.addResource("en", "guided", "__probe.only_english", "ENGLISH_VALUE");

masterI18n.changeLanguage("hi");
check(
  "hi-falls-back-to-hinglish-first",
  masterI18n.t("guided:__probe.only_hinglish") === "HINGLISH_VALUE",
  `a key missing from Devanagari must resolve to Hinglish before English; got ` +
    `"${masterI18n.t("guided:__probe.only_hinglish")}"`,
);
check(
  "hi-falls-back-to-english-last",
  masterI18n.t("guided:__probe.only_english") === "ENGLISH_VALUE",
  `a key missing from both Devanagari and Hinglish must resolve to English; got ` +
    `"${masterI18n.t("guided:__probe.only_english")}"`,
);

masterI18n.addResource("hi", "guided", "__probe.devanagari_only", "देवनागरी");
masterI18n.changeLanguage("hi-Latn");
check(
  "hi-Latn-does-not-widen-to-devanagari",
  masterI18n.t("guided:__probe.devanagari_only") !== "देवनागरी",
  `"hi-Latn" resolved a Devanagari-only key. i18next widens hi-Latn -> hi unless ` +
    `load:"currentOnly" is set -- an operator who asked for Roman script would get ` +
    `Devanagari mid-sentence.`,
);
masterI18n.changeLanguage("hi-Latn");

// ---------------------------------------------------------------------------
// 5. THE PROPERTY TEST.
//
//    Build the most hostile override bundle the type allows: for every
//    phase, every paste label, every check, every fix, every symptom and
//    every cause, replace each translatable field with a poison marker.
//    Then assert that nothing an operator matches against RouterOS output
//    changed -- across all nine phases and every symptom, not a sampled
//    few. This is the invariant that has to survive future content edits,
//    so it is stated over the real content rather than over a fixture.
// ---------------------------------------------------------------------------
const POISON = "☠TRANSLATED☠";
const hostilePhase = (p) => ({
  title: POISON,
  why: POISON,
  stopGate: POISON,
  paste: Object.fromEntries(p.paste.map((_, i) => [String(i), { label: POISON }])),
  checks: Object.fromEntries(
    p.checks.map((c) => [
      c.id,
      {
        label: POISON,
        failFix: Object.fromEntries(
          (c.failFix ?? []).map((_, i) => [String(i), { whenLabel: POISON, note: POISON }]),
        ),
      },
    ]),
  ),
});
const hostileSymptom = (s) => ({
  seen: POISON,
  causes: Object.fromEntries(
    s.causes.map((_, i) => [String(i), { tell: POISON, cause: POISON, note: POISON }]),
  ),
});

const PHASES = phases.PHASES;
const SYMPTOMS = symptoms.SYMPTOMS;

check(
  "content-has-nine-phases",
  PHASES.length === 9,
  `expected the nine-phase flow the founder signed off (VLAN cut); found ${PHASES.length}`,
);

let phaseFieldsChecked = 0;
for (const p of PHASES) {
  const localized = contentMod.localizePhase(p, hostilePhase(p));

  check(
    `never-translate:phase:${p.id}:paste-scripts`,
    localized.paste.every((b, i) => b.script === p.paste[i].script),
    `a paste block's script changed under translation. These are pasted verbatim into a ` +
      `RouterOS terminal.`,
  );
  // The label IS translatable -- prove the override actually applied, or
  // every assertion in this block would pass vacuously on a no-op.
  check(
    `override-applied:phase:${p.id}`,
    localized.title === POISON &&
      localized.paste.every((b) => b.label === POISON) &&
      localized.checks.every((c) => c.label === POISON),
    `the hostile override did not apply, so the never-translate assertions are vacuous`,
  );

  for (const [i, c] of localized.checks.entries()) {
    const src = p.checks[i];
    check(
      `never-translate:check:${p.id}:${src.id}`,
      c.command === src.command && c.expect === src.expect && c.assert === src.assert,
      `command / expect / assert changed under translation for check "${src.id}". ` +
        `\`expect\` is what the operator matches character-for-character against what the ` +
        `device printed; a translated one sends him looking for a token that will never appear.`,
    );
    phaseFieldsChecked += 1;
    const srcFixes = src.failFix ?? [];
    if (srcFixes.length) {
      check(
        `never-translate:fix-commands:${p.id}:${src.id}`,
        (c.failFix ?? []).every((f, j) => f.command === srcFixes[j].command),
        `a fix's command changed under translation`,
      );
      // The one that is displayed but must still not move: `analyse.ts`
      // matches `rule.fix` against `when` character-for-character to pick
      // which repair to highlight. A translated `when` silently yields
      // fixIndex: null in every non-Hinglish register.
      check(
        `never-translate:fix-when:${p.id}:${src.id}`,
        (c.failFix ?? []).every((f, j) => f.when === srcFixes[j].when),
        `a fix's \`when\` changed under translation -- that is the join key analyse.ts uses to ` +
          `select the matching repair, so the analyser would stop pinpointing a fix in EN/HI`,
      );
      check(
        `override-applied:fix-label:${p.id}:${src.id}`,
        (c.failFix ?? []).every((f) => f.whenLabel === POISON),
        `whenLabel did not apply, so the assertion above is vacuous`,
      );
    }
  }
}

check(
  "property-test-covered-every-check",
  phaseFieldsChecked >= 20,
  `only ${phaseFieldsChecked} checks were exercised; the flow is supposed to have ~23`,
);

for (const s of SYMPTOMS) {
  const localized = contentMod.localizeSymptom(s, hostileSymptom(s));
  check(
    `never-translate:symptom:${s.id}`,
    localized.probe === s.probe && localized.causes.every((c, i) => c.fix === s.causes[i].fix),
    `a diagnostics probe or fix command changed under translation. Both are pasted into a ` +
      `terminal verbatim.`,
  );
  check(
    `override-applied:symptom:${s.id}`,
    localized.seen === POISON && localized.causes.every((c) => c.tell === POISON),
    `the hostile override did not apply to symptom "${s.id}", so its assertion is vacuous`,
  );
}

// ---------------------------------------------------------------------------
// 5b. The analyser's own prose.
//
//     `AnalysisResult.reason` is built from `VerdictRule.why` or
//     `OutputAssertion.fallback`. Both translate. Nothing else in an
//     assertion may move -- and `fix` least of all: it is compared
//     character-for-character against a `failFix[].when` to decide WHICH
//     repair to show, so a translated one silently stops selecting.
// ---------------------------------------------------------------------------
const ASSERTIONS = assertions.ASSERTIONS;
const assertionIds = Object.keys(ASSERTIONS);
check(
  "assertions-present",
  assertionIds.length >= 15,
  `expected the analyser's assertion table; found ${assertionIds.length} entries`,
);

for (const id of assertionIds) {
  const src = ASSERTIONS[id];
  const hostile = {
    fallback: POISON,
    rules: Object.fromEntries(src.rules.map((_, i) => [String(i), { why: POISON }])),
  };
  const localized = contentMod.localizeAssertion(src, hostile);

  check(
    `override-applied:assertion:${id}`,
    localized.fallback === POISON && localized.rules.every((r) => r.why === POISON),
    `the hostile assertion override did not apply, so the assertions below are vacuous`,
  );
  check(
    `never-translate:assertion-decisions:${id}`,
    localized.rules.every(
      (r, i) => r.verdict === src.rules[i].verdict && r.fix === src.rules[i].fix,
    ),
    `a rule's verdict or its \`fix\` join key changed under translation. \`fix\` must stay ` +
      `character-identical to a failFix[].when or the analyser stops selecting a repair.`,
  );
  check(
    `never-translate:assertion-matching:${id}`,
    JSON.stringify(localized.identify) === JSON.stringify(src.identify) &&
      JSON.stringify(localized.requires) === JSON.stringify(src.requires) &&
      localized.rules.every((r, i) => JSON.stringify(r.when) === JSON.stringify(src.rules[i].when)),
    `an assertion's identify / requires / when condition changed under translation. Those are ` +
      `literal tokens matched against the router's own output, not copy.`,
  );
}

check(
  "no-assertion-override-returns-identity",
  assertionIds.every(
    (id) => contentMod.localizeAssertion(ASSERTIONS[id], undefined) === ASSERTIONS[id],
  ),
  `with no override the assertion must pass through by identity`,
);

// ---------------------------------------------------------------------------
// 6. No override bundle at all == the source content, untouched.
//
//    This is how `hi-Latn` renders: the content files ARE the Hinglish
//    register, so there is deliberately no Hinglish content bundle to
//    drift away from them.
// ---------------------------------------------------------------------------
check(
  "no-override-returns-source-identity",
  PHASES.every((p) => contentMod.localizePhase(p, undefined) === p) &&
    SYMPTOMS.every((s) => contentMod.localizeSymptom(s, undefined) === s),
  `with no override bundle the content must pass through by identity -- that is what makes the ` +
    `field-tested Hinglish impossible to drift.`,
);

rmSync(tmp, { recursive: true, force: true });

console.log(
  failures === 0
    ? `\nguided-i18n-state: all checks passed (${checks} checks).`
    : `\nguided-i18n-state: ${failures} of ${checks} checks FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
