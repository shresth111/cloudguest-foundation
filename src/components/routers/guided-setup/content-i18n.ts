/**
 * Translating the CONTENT (`phases.content.ts`, `diagnostics.content.ts`)
 * without touching either file, and without ever being able to translate
 * the things that must not be translated.
 *
 * THE PROBLEM THIS SOLVES.
 *
 * A mistranslated `expect` string is worse than no translation at all: it
 * sends the operator looking in RouterOS output for a token that will
 * never appear there. The same goes for `command`, `probe`, `fix`,
 * `script`, interface names, IPs, ports and config values. The usual way
 * to protect those is a rule in a header comment plus reviewer attention,
 * which is exactly the mechanism that fails at 2am on the twentieth file.
 *
 * THE SHAPE IS THE RULE.
 *
 * So the override types below simply have no key for any of them.
 * `PhaseOverride` cannot express a translated `command`. `CauseOverride`
 * cannot express a translated `fix`. A translator working in the JSON has
 * nowhere to put the wrong thing, and `tsc` says so if anyone tries to add
 * the key later. The never-translate list is enforced structurally, not
 * remembered.
 *
 * WHY OVERRIDES INSTEAD OF MOVING CONTENT INTO LOCALE FILES.
 *
 * Two reasons, and the first is the important one:
 *
 *  1. The Hinglish register in `phases.content.ts` is the field-tested
 *     one. It stays exactly where its author maintains it, as the single
 *     source of truth, and is never copied. English and Devanagari are
 *     sparse override maps layered on top. Nothing can drift, because
 *     there is only one copy of the tested text.
 *
 *  2. It requires zero edits to the two content files -- no extraction,
 *     no key-ification, no restructuring. New fields added there (the
 *     `assert` field currently being added for the output analyser, for
 *     instance) flow through `localizePhase` untouched, because it spreads
 *     the source object and replaces only named prose fields.
 *
 * Absence of an override falls back to the source object, i.e. to
 * Hinglish. That is the correct partial-coverage behaviour for all three
 * registers: a Devanagari reader who hits an untranslated check sees
 * Hinglish (same language, readable) rather than a raw key or an English
 * fragment, and an English reader sees the text the device was actually
 * tested against.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import masterI18n from "@/lib/master-i18n";
import type { Phase, Symptom } from "./types";

/** Per-check overrides. No `command`, no `expect`, no `assert`. */
export type CheckOverride = {
  label?: string;
  /** Keyed by the fix's index in `failFix`, as a string.
   *
   * No `command`, and deliberately no `when` either: `Fix.when` is the
   * key `analyse.ts` matches a `VerdictRule.fix` against to decide WHICH
   * repair to highlight, so a translated one silently breaks the
   * analyser's fix selection. `whenLabel` is the display-only override
   * that `CheckRow` renders in its place. */
  failFix?: Record<string, { whenLabel?: string; note?: string }>;
};

/** Per-phase overrides. No `paste[].script`. */
export type PhaseOverride = {
  title?: string;
  why?: string;
  stopGate?: string;
  /** Keyed by index in `paste`, as a string. Only the human label. */
  paste?: Record<string, { label?: string }>;
  /** Keyed by `Check.id`, never by index -- ids are stable across a
   * reorder in the content file, positions are not. */
  checks?: Record<string, CheckOverride>;
};

/** Per-cause overrides. No `fix` -- that field is a paste-able command. */
export type CauseOverride = {
  /** Prose, but it quotes literal output tokens in backticks. Those spans
   * are checked byte-for-byte by `scripts/check-guided-i18n.mjs`. */
  tell?: string;
  cause?: string;
  note?: string;
};

/** Per-symptom overrides. No `probe` -- that field is a command. */
export type SymptomOverride = {
  seen?: string;
  /** Keyed by the cause's index in `causes`, as a string. `Symptom.causes`
   * entries carry no id of their own. */
  causes?: Record<string, CauseOverride>;
};

/**
 * Prose the OUTPUT ANALYSER speaks, from `assertions.ts`.
 *
 * `analyse.ts` builds `AnalysisResult.reason` from exactly two static
 * sources: the matching `VerdictRule.why`, or `OutputAssertion.fallback`
 * when nothing matched. Both are authored Hinglish, keyed by check id, so
 * they localize the same way everything else here does.
 *
 * What has no key, and why each one matters more than usual:
 *
 *  - `when` (the condition tree) -- it is code, not copy, and its
 *    `textIncludes` values are literal tokens matched against the router's
 *    own output (including Hinglish ones the paste blocks themselves
 *    print, like "purana hotspot").
 *  - `verdict` -- translating a verdict is translating a decision.
 *  - `fix` -- character-identical to a `failFix[].when` by contract;
 *    `scripts/test-output-analyser.mjs` asserts it.
 *  - `identify` / `requires` -- banners and menu keys the device emits.
 *
 * NOT localized here, deliberately: `AnalysisResult.evidence`. Its
 * `label`s are RouterOS field names read straight off the paste
 * (`collectEvidence` uses the parsed key, plus the literal `RESULT`), and
 * its `value`s are device data. Neither is copy. Translating an evidence
 * label would rename a field the operator is looking at in his own
 * terminal.
 */
export type AssertionOverride = {
  fallback?: string;
  /** Keyed by the rule's index in `rules`, as a string. Only `why`. */
  rules?: Record<string, { why?: string }>;
};

export type GuidedContentBundle = {
  phases?: Record<string, PhaseOverride>;
  symptoms?: Record<string, SymptomOverride>;
  assertions?: Record<string, AssertionOverride>;
};

/** Picks the override only when it is a non-empty string, so `""` in a
 * locale file reads as "not translated yet" rather than as "render an
 * empty title". */
const pick = (override: string | undefined, source: string): string =>
  typeof override === "string" && override.trim() !== "" ? override : source;

const pickOpt = (override: string | undefined, source?: string): string | undefined =>
  typeof override === "string" && override.trim() !== "" ? override : source;

export function localizePhase(phase: Phase, o: PhaseOverride | undefined): Phase {
  if (!o) return phase;
  return {
    // Spread first: anything the content author adds later (`assert`,
    // a new flag) survives untouched, because only the prose fields
    // named below are ever replaced.
    ...phase,
    title: pick(o.title, phase.title),
    why: pickOpt(o.why, phase.why),
    stopGate: pickOpt(o.stopGate, phase.stopGate),
    paste: phase.paste.map((p, i) => ({ ...p, label: pick(o.paste?.[String(i)]?.label, p.label) })),
    checks: phase.checks.map((c) => {
      const co = o.checks?.[c.id];
      if (!co) return c;
      return {
        ...c,
        label: pick(co.label, c.label),
        failFix: c.failFix?.map((f, i) => {
          const fo = co.failFix?.[String(i)];
          if (!fo) return f;
          // `when` is passed through untouched -- see the type comment
          // above and `Fix` in types.ts. Only the display label and the
          // explanatory note are localized.
          return {
            ...f,
            whenLabel: pickOpt(fo.whenLabel, f.whenLabel),
            note: pick(fo.note, f.note),
          };
        }),
      };
    }),
  };
}

export function localizeSymptom(symptom: Symptom, o: SymptomOverride | undefined): Symptom {
  if (!o) return symptom;
  return {
    ...symptom,
    seen: pick(o.seen, symptom.seen),
    causes: symptom.causes.map((c, i) => {
      const co = o.causes?.[String(i)];
      if (!co) return c;
      return {
        ...c,
        tell: pick(co.tell, c.tell),
        cause: pick(co.cause, c.cause),
        note: pick(co.note, c.note),
      };
    }),
  };
}

/** Swaps only the two prose fields; every rule's condition, verdict and
 * `fix` join key passes through by reference. */
export function localizeAssertion<T extends { fallback: string; rules: { why: string }[] }>(
  assertion: T,
  o: AssertionOverride | undefined,
): T {
  if (!o) return assertion;
  return {
    ...assertion,
    fallback: pick(o.fallback, assertion.fallback),
    rules: assertion.rules.map((r, i) => {
      const ro = o.rules?.[String(i)];
      return ro ? { ...r, why: pick(ro.why, r.why) } : r;
    }),
  };
}

/**
 * The active locale's override bundle. Absent = the content files' own
 * Hinglish, which is the source of truth for that register.
 */
export function useGuidedContentBundle(): GuidedContentBundle {
  const { i18n } = useTranslation("guidedContent", { i18n: masterI18n });
  const lng = i18n.resolvedLanguage ?? "hi-Latn";
  return useMemo(
    () => (masterI18n.getResourceBundle(lng, "guidedContent") ?? {}) as GuidedContentBundle,
    [lng],
  );
}

/**
 * The localized `OutputAssertion` for one check, or undefined when the
 * check has none (those are human-confirmed only -- see `CheckRow`).
 */
export function useGuidedAssertion<T extends { fallback: string; rules: { why: string }[] }>(
  checkId: string,
  assertion: T | undefined,
): T | undefined {
  const bundle = useGuidedContentBundle();
  return useMemo(
    () => (assertion ? localizeAssertion(assertion, bundle.assertions?.[checkId]) : undefined),
    [assertion, bundle, checkId],
  );
}

/**
 * The localized content for the language currently on screen.
 *
 * `useTranslation` here is not for its `t` -- it is the subscription. It
 * re-renders this hook's consumer on `languageChanged`, which is what
 * makes the memo below recompute, which is what swaps the register
 * without anything unmounting.
 */
export function useGuidedContent(phases: Phase[], symptoms: Symptom[]) {
  const { i18n } = useTranslation("guidedContent", { i18n: masterI18n });
  const lng = i18n.resolvedLanguage ?? "hi-Latn";

  return useMemo(() => {
    // No bundle for a language means "this register is the source" --
    // true by construction for hi-Latn, and true for any locale whose
    // content translation has not landed yet.
    const bundle = (masterI18n.getResourceBundle(lng, "guidedContent") ??
      {}) as GuidedContentBundle;
    return {
      phases: phases.map((p) => localizePhase(p, bundle.phases?.[p.id])),
      symptoms: symptoms.map((s) => localizeSymptom(s, bundle.symptoms?.[s.id])),
    };
  }, [phases, symptoms, lng]);
}
