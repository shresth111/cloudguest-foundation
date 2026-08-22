/**
 * Manual wizard engine — is this the output of the command we asked for?
 *
 * ---------------------------------------------------------------------
 * THREE SIGNALS, NONE OF WHICH IS ALLOWED TO SPEAK FOR THE OTHERS
 * ---------------------------------------------------------------------
 *  1. BANNER      `==== TITLE ====` / `====================`.
 *                 Carries TRUNCATION (an opening with no closing means the
 *                 paste was cut short) and names what was actually run.
 *                 Shared contract with the legacy 9-phase blocks, so it is
 *                 the one signal a `guided-setup` paste also carries.
 *  2. SENTINEL    `WYFY-BEGIN <stepId>` / `WYFY-END <stepId>`.
 *                 The only signal that catches the RIGHT command pasted at
 *                 the WRONG step, because it is the only one carrying the
 *                 step id. The banner cannot do this: two steps can print
 *                 the same title.
 *  3. FINGERPRINT required / forbidden keys, table headers, and the
 *                 per-menu registry in `parsing.rules.ts`, which is what
 *                 lets the app say "this looks like `/interface print`"
 *                 rather than "try again".
 *
 * A fourth, weaker signal — the ECHOED PROMPT — is collected too, because
 * many installers copy the prompt line and it names the menu directly.
 *
 * WHEN THEY DISAGREE, THE DISAGREEMENT IS THE FINDING. This module never
 * picks a winner and hides the rest. `disagreements` is populated and
 * surfaced; the caller shows it. Silently choosing the most convenient
 * signal is how "the system reported success while doing nothing" happens.
 *
 * ---------------------------------------------------------------------
 * NOTHING HERE JOINS ON A HUMAN-READABLE STRING
 * ---------------------------------------------------------------------
 * Every comparison below is against a value that `types.ts` lists under
 * `NEVER_TRANSLATE_FIELD_PATHS`: `fingerprint.sentinelId`,
 * `fingerprint.requireAllKeys`, `commonWrongPastes[].tell`, and the banner
 * title, which is parsed out of `probe.command` — itself a `Lit`. No
 * comparison touches `title`, `discriminator`, `meaning` or any other `T`.
 * A translated bundle must classify byte-identically, and
 * `scripts/test-manual-wizard-engine.mjs` asserts exactly that.
 */

import type { Lit, ManualStep, OutputFingerprint, Verdict } from "../types";
import { MENU_FINGERPRINTS, RE_BANNER_CLOSE, RE_BANNER_OPEN } from "../parsing.rules";
import type { NormalisedPaste } from "./normalise";

// ---------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------

export type SignalSource = "banner" | "sentinel" | "fingerprint" | "echoed-prompt";

/**
 * What one signal concluded on its own, ignoring the others.
 *
 *  agree    — this signal says the paste is the asked-for output.
 *  wrong    — this signal says a DIFFERENT command was run.
 *  truncated— this signal says the right command, cut short.
 *  silent   — this signal is not present in the paste and says nothing.
 *             Silence is never agreement.
 */
export type SignalVerdict = "agree" | "wrong" | "truncated" | "silent";

export type Signal = {
  source: SignalSource;
  verdict: SignalVerdict;
  /** Stable, non-translatable reason id. Never a sentence. */
  reason: Lit;
  /** Device literals only — safe to render verbatim in any locale. */
  detail: Lit[];
};

export type Classification = {
  /** null when the signals do not force a verdict and scoring may proceed. */
  verdict: Extract<Verdict, "WRONG_OUTPUT" | "INCOMPLETE_OUTPUT"> | null;
  /** Stable id of the rule that produced `verdict`, matching the
   * `condition` strings in `EMPTINESS_RULES`. */
  gate: Lit | null;
  signals: Signal[];
  /** Pairs of signal sources that reached incompatible conclusions. */
  disagreements: { a: SignalSource; b: SignalSource; note: Lit }[];
  /** The menu the paste most resembles, when it is not the asked-for one. */
  looksLikeMenu: Lit | null;
  /** `commonWrongPastes` entries whose `tell` was found. Keyed by menu so
   * the caller can look up the (translatable) `sayInstead` itself. */
  matchedWrongPasteMenus: Lit[];
};

// ---------------------------------------------------------------------
// The expected banner title comes out of the probe command, not the title
// ---------------------------------------------------------------------

/**
 * `probe.command` is a `Lit` under `NEVER_TRANSLATE_FIELD_PATHS`, and the
 * banner it emits is a byte-for-byte constant. `step.title` is a `T` and
 * MUST NOT be used here — that is the defect family that turned a
 * pinpointed repair into a generic list in `guided-setup/analyse.ts` when
 * `failFix.findIndex(f => f.when === fixWhen)` was fed a translated string.
 */
export function expectedBannerTitle(step: ManualStep): Lit | null {
  for (const rawLine of step.probe.command.split("\n")) {
    const quoted = /:put\s+"([^"]*)"/.exec(rawLine);
    if (!quoted) continue;
    const inner = quoted[1];
    if (RE_BANNER_CLOSE.test(inner)) continue;
    const opened = RE_BANNER_OPEN.exec(inner);
    if (opened) return opened[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------------
// Fingerprint helpers
// ---------------------------------------------------------------------

function keysPresent(paste: NormalisedPaste): Set<string> {
  const keys = new Set<string>();
  for (const k of Object.keys(paste.kv)) keys.add(k.toLowerCase());
  for (const record of paste.records) for (const k of Object.keys(record.kv)) keys.add(k);
  // Sub-fields of a `;`-separated multi row are keys too: a paste of
  // `/interface print` has no `running=` on its own line, but a probe row
  // `eth=ether1;running=true` does.
  for (const values of Object.values(paste.kv)) {
    for (const value of values) {
      for (const part of value.split(";").slice(1)) {
        const eq = part.indexOf("=");
        if (eq > 0) keys.add(part.slice(0, eq).trim().toLowerCase());
      }
    }
  }
  return keys;
}

function bodyText(paste: NormalisedPaste): string {
  return paste.body.join("\n");
}

/** Best-matching menu from the registry, or null. Mirrors `identifyMenu`
 * in `guided-setup/analyse.ts`. */
export function identifyMenu(paste: NormalisedPaste): { menu: Lit; score: number } | null {
  const keys = keysPresent(paste);
  const upper = bodyText(paste).toUpperCase();
  let best: { menu: Lit; score: number } | null = null;
  for (const fp of MENU_FINGERPRINTS) {
    if (fp.neverKeys.some((k) => keys.has(k.toLowerCase()))) continue;
    let score = 0;
    for (const k of fp.uniqueKeys) if (keys.has(k.toLowerCase())) score += 2;
    for (const h of fp.headerTokens) if (upper.includes(h.toUpperCase())) score += 1;
    if (score > 0 && (best === null || score > best.score)) best = { menu: fp.menu, score };
  }
  return best;
}

// ---------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------

export function classify(step: ManualStep, paste: NormalisedPaste): Classification {
  const fingerprint: OutputFingerprint = step.fingerprint;
  const signals: Signal[] = [];
  const disagreements: Classification["disagreements"] = [];
  const matchedWrongPasteMenus: Lit[] = [];

  // --- signal 1: the banner ------------------------------------------
  const wantTitle = expectedBannerTitle(step);
  let bannerSignal: Signal;
  if (!paste.banner.open) {
    bannerSignal = { source: "banner", verdict: "silent", reason: "no-banner", detail: [] };
  } else if (!paste.banner.close) {
    bannerSignal = {
      source: "banner",
      verdict: "truncated",
      reason: "banner-open-without-close",
      detail: paste.banner.title ? [paste.banner.title] : [],
    };
  } else if (
    wantTitle !== null &&
    paste.banner.title !== null &&
    paste.banner.title !== wantTitle
  ) {
    bannerSignal = {
      source: "banner",
      verdict: "wrong",
      reason: "banner-title-mismatch",
      detail: [paste.banner.title, wantTitle],
    };
  } else {
    bannerSignal = {
      source: "banner",
      verdict: "agree",
      reason: "banner-title-matches",
      detail: paste.banner.title ? [paste.banner.title] : [],
    };
  }
  signals.push(bannerSignal);

  // --- signal 2: the sentinel ----------------------------------------
  let sentinelSignal: Signal;
  if (paste.sentinel.begin === null) {
    sentinelSignal = { source: "sentinel", verdict: "silent", reason: "no-sentinel", detail: [] };
  } else if (paste.sentinel.begin !== fingerprint.sentinelId) {
    // Checked BEFORE the missing-END test: a paste from another step is
    // wrong however complete it is, and re-pasting it will not help.
    sentinelSignal = {
      source: "sentinel",
      verdict: "wrong",
      reason: "sentinel-id-mismatch",
      detail: [paste.sentinel.begin, fingerprint.sentinelId],
    };
  } else if (paste.sentinel.end === null) {
    sentinelSignal = {
      source: "sentinel",
      verdict: "truncated",
      reason: "sentinel-begin-without-end",
      detail: [paste.sentinel.begin],
    };
  } else if (paste.sentinel.end !== fingerprint.sentinelId) {
    sentinelSignal = {
      source: "sentinel",
      verdict: "wrong",
      reason: "sentinel-end-id-mismatch",
      detail: [paste.sentinel.end, fingerprint.sentinelId],
    };
  } else {
    sentinelSignal = {
      source: "sentinel",
      verdict: "agree",
      reason: "sentinel-matches",
      detail: [fingerprint.sentinelId],
    };
  }
  signals.push(sentinelSignal);

  // --- signal 3: the fingerprint -------------------------------------
  const keys = keysPresent(paste);
  const text = bodyText(paste);
  const upper = text.toUpperCase();

  const missingRequired = fingerprint.requireAllKeys.filter((k) => !keys.has(k.toLowerCase()));
  const forbiddenSeen = (fingerprint.forbidKeys ?? []).filter((k) => keys.has(k.toLowerCase()));
  const anySatisfied =
    !fingerprint.requireAnyKeys ||
    fingerprint.requireAnyKeys.length === 0 ||
    fingerprint.requireAnyKeys.some((k) => keys.has(k.toLowerCase()));
  const headersSeen = (fingerprint.tableHeaderTokens ?? []).filter((h) =>
    upper.includes(h.toUpperCase()),
  );

  for (const wrong of fingerprint.commonWrongPastes) {
    if (text.includes(wrong.tell) || upper.includes(wrong.tell.toUpperCase())) {
      matchedWrongPasteMenus.push(wrong.menu);
    }
  }

  const identified = identifyMenu(paste);
  const looksLikeMenu =
    identified !== null && identified.menu !== fingerprint.expectedMenu ? identified.menu : null;

  let fingerprintSignal: Signal;
  if (forbiddenSeen.length > 0) {
    fingerprintSignal = {
      source: "fingerprint",
      verdict: "wrong",
      reason: "forbidden-key-present",
      detail: forbiddenSeen,
    };
  } else if (matchedWrongPasteMenus.length > 0 && missingRequired.length > 0) {
    fingerprintSignal = {
      source: "fingerprint",
      verdict: "wrong",
      reason: "known-wrong-paste",
      detail: matchedWrongPasteMenus,
    };
  } else if (
    fingerprint.requireAllKeys.length > 0 &&
    missingRequired.length === fingerprint.requireAllKeys.length &&
    paste.nonBlankLines > 0
  ) {
    // Not one required key of the asked-for command is here. This is a
    // different command's output, not a short copy of the right one.
    fingerprintSignal = {
      source: "fingerprint",
      verdict: "wrong",
      reason: "no-required-key-present",
      detail: fingerprint.requireAllKeys,
    };
  } else if (missingRequired.length > 0 || !anySatisfied) {
    fingerprintSignal = {
      source: "fingerprint",
      verdict: "truncated",
      reason: "required-key-missing",
      detail: missingRequired,
    };
  } else {
    fingerprintSignal = {
      source: "fingerprint",
      verdict: "agree",
      reason: "required-keys-present",
      detail: headersSeen,
    };
  }
  signals.push(fingerprintSignal);

  // --- signal 4: the echoed prompt -----------------------------------
  //
  // Only MENU commands are evidence. A probe is pasted as a script, so a
  // terminal that echoes the paste produces prompt lines carrying `:put`,
  // `:local` and `:foreach` — those say nothing about which menu was
  // read, and treating them as evidence would mark every correct paste
  // WRONG_OUTPUT. Anything not starting with `/` is discarded here.
  const menuEchoes = paste.echoedCommands
    .map((c) => `${c.menu} ${c.command}`.trim())
    .filter((m) => m.startsWith("/"));
  let echoSignal: Signal;
  if (menuEchoes.length === 0) {
    echoSignal = {
      source: "echoed-prompt",
      verdict: "silent",
      reason: "no-menu-prompt-echo",
      detail: [],
    };
  } else if (menuEchoes.some((m) => m.includes(fingerprint.expectedMenu))) {
    echoSignal = {
      source: "echoed-prompt",
      verdict: "agree",
      reason: "prompt-names-expected-menu",
      detail: [fingerprint.expectedMenu],
    };
  } else {
    echoSignal = {
      source: "echoed-prompt",
      verdict: "wrong",
      reason: "prompt-names-other-menu",
      detail: menuEchoes,
    };
  }
  signals.push(echoSignal);

  // --- disagreement bookkeeping --------------------------------------
  const speaking = signals.filter((s) => s.verdict !== "silent");
  for (let i = 0; i < speaking.length; i += 1) {
    for (let j = i + 1; j < speaking.length; j += 1) {
      if (speaking[i].verdict !== speaking[j].verdict) {
        disagreements.push({
          a: speaking[i].source,
          b: speaking[j].source,
          note: `${speaking[i].reason}-vs-${speaking[j].reason}`,
        });
      }
    }
  }

  // --- gates, in the order `EMPTINESS_RULES` lists them ---------------
  //
  // The `condition` strings below are copied verbatim from
  // `parsing.rules.ts` -> EMPTINESS_RULES so a test can assert the two
  // lists still correspond one to one. If you add a gate there, add it
  // here; the test fails until you do.
  let verdict: Classification["verdict"] = null;
  let gate: Lit | null = null;

  const set = (v: Classification["verdict"], g: Lit) => {
    if (verdict === null) {
      verdict = v;
      gate = g;
    }
  };

  if (paste.guard === "too-large" || paste.guard === "binary") {
    set("INCOMPLETE_OUTPUT", "guard");
  }
  if (paste.paged) {
    // parsing.rules.ts stage 2: a pager marker means the terminal cut the
    // output, whatever else is present.
    set("INCOMPLETE_OUTPUT", "pagingPrompt");
  }
  if (paste.banner.open && !paste.banner.close) {
    set("INCOMPLETE_OUTPUT", "bannerOpen && !bannerClose");
  }
  if (
    paste.banner.open &&
    wantTitle !== null &&
    paste.banner.title !== null &&
    paste.banner.title !== wantTitle
  ) {
    set("WRONG_OUTPUT", "bannerOpen && bannerTitle !== expectedBannerTitle");
  }
  if (paste.nonBlankLines === 0) {
    set("INCOMPLETE_OUTPUT", "nonBlankLines === 0");
  }
  if (paste.sentinel.begin !== null && paste.sentinel.end === null) {
    set("INCOMPLETE_OUTPUT", "sentinelBegin && !sentinelEnd");
  }
  if (paste.sentinel.begin !== null && paste.sentinel.begin !== fingerprint.sentinelId) {
    set("WRONG_OUTPUT", "sentinelBegin && sentinelId !== expectedSentinelId");
  }
  // EMPTINESS_RULES rule 8 — `!sentinelBegin && (flagsLegend || headerLine)
  // && records === 0` — resolves to UNKNOWN, which is not a classification
  // outcome. It is handled in `verdict.ts` via `isRawPrintWithNoRecords`
  // below, deliberately NOT gated here.
  if (
    paste.sentinel.begin === null &&
    paste.legend === null &&
    !paste.hasHeaderLine &&
    paste.nonBlankLines > 0 &&
    fingerprintSignal.verdict === "wrong"
  ) {
    set("WRONG_OUTPUT", "!sentinelBegin && !flagsLegend && !headerLine && nonBlankLines > 0");
  }

  // Escalation. `types.ts`: WRONG_OUTPUT "never scores as anything else,
  // and specifically never as PASS".
  //
  // The three strong signals force it on their own. The echoed prompt does
  // NOT: an installer whose scrollback still holds an earlier command
  // would otherwise have a perfectly good paste rejected because of
  // something they ran two minutes ago. It forces WRONG_OUTPUT only when
  // the sentinel is silent and the fingerprint has not positively agreed —
  // that is, when it is the only evidence there is. Either way the
  // disagreement is already recorded above and is surfaced to the caller.
  const strongWrong = signals.find((s) => s.verdict === "wrong" && s.source !== "echoed-prompt");
  if (verdict === null && strongWrong) set("WRONG_OUTPUT", strongWrong.reason);
  if (
    verdict === null &&
    echoSignal.verdict === "wrong" &&
    sentinelSignal.verdict === "silent" &&
    fingerprintSignal.verdict !== "agree"
  ) {
    set("WRONG_OUTPUT", echoSignal.reason);
  }
  const anyTruncated = signals.find((s) => s.verdict === "truncated");
  if (verdict === null && anyTruncated) set("INCOMPLETE_OUTPUT", anyTruncated.reason);

  return {
    verdict,
    gate,
    signals,
    disagreements,
    looksLikeMenu,
    matchedWrongPasteMenus,
  };
}

/** True for the EMPTINESS_RULES case that lands on UNKNOWN rather than on
 * a classification verdict: a hand-typed raw print that matched nothing. */
export function isRawPrintWithNoRecords(paste: NormalisedPaste): boolean {
  return (
    paste.sentinel.begin === null &&
    (paste.legend !== null || paste.hasHeaderLine) &&
    paste.records.length === 0
  );
}
