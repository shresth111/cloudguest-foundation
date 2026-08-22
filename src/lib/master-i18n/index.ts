/**
 * The Master console's i18n instance.
 *
 * WHY A SECOND i18next INSTANCE, AND NOT `@/lib/i18n`.
 *
 * Same library, same conventions, same locale-folder layout -- this is
 * deliberately not a third translation system. What it is not able to
 * share is the *instance*, for three independent reasons:
 *
 *  1. THREE REGISTERS, NOT TWO. The Master console's field-tested copy is
 *     Hinglish -- Hindi in Roman script (`hi-Latn`). `@/lib/i18n` is
 *     `en`/`hi` and its current language is driven by `user.language`,
 *     a backend column whose vocabulary is the dashboard's. There is no
 *     `hi-Latn` in that vocabulary, and inventing one there would change
 *     what a customer's saved preference means.
 *
 *  2. TWO AUDIENCES, TWO PREFERENCES. `@/lib/i18n`'s cache key
 *     (`cg.dashboard.lang`) is overwritten from `user.language` by
 *     `useSyncDashboardLanguage` on every authenticated dashboard mount.
 *     A platform operator choosing Hinglish for a rack visit must not
 *     thereby change the language of the customer dashboard they open
 *     next, and must not have that choice silently reverted by a screen
 *     they visited in between.
 *
 *  3. BUNDLE SHAPE. `__root.tsx` documents at length why i18next and its
 *     locale JSON must not reach the entry chunk: the guest captive
 *     portal is the majority of real traffic and uses none of it. Adding
 *     the guided-setup namespaces to `@/lib/i18n` would pull them into
 *     the dashboard chunk (`AppSidebar` imports that instance), which is
 *     the wrong chunk for Master-console-only strings. This module is
 *     imported only by `/master` route modules, so its bytes land in the
 *     Master chunk.
 *
 * Call sites pass the instance explicitly -- `useTranslation(ns, { i18n })`
 * -- exactly as the dashboard's call sites do, and for the same reason:
 * no `<I18nextProvider>` anywhere. A provider is the one thing that could
 * remount the guided-setup tree on a language change, and remounting is
 * precisely what must never happen here (see LanguageSwitch).
 */
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import enGuided from "./locales/en/guided.json";
import hiGuided from "./locales/hi/guided.json";
import hiLatnGuided from "./locales/hi-Latn/guided.json";
import enGuidedContent from "./locales/en/guided-content.json";
import hiGuidedContent from "./locales/hi/guided-content.json";

/**
 * The three registers, in the order the switcher shows them.
 *
 * `hi-Latn` is a real BCP-47 tag (language `hi`, script `Latn`), not a
 * private-use invention: Hinglish here is genuinely Hindi written in the
 * Latin script, and tagging it that way is what makes it possible to also
 * ship `hi` (Devanagari) without either one pretending to be the other.
 *
 * The autonyms are NOT translated and never should be -- a language
 * picker that renames the languages when you switch is a picker you
 * cannot use to get back.
 */
export const MASTER_LANGUAGES = [
  { code: "hi-Latn", autonym: "Hinglish", short: "HL" },
  { code: "en", autonym: "English", short: "EN" },
  { code: "hi", autonym: "हिंदी", short: "हिं" },
] as const;

export type MasterLanguage = (typeof MASTER_LANGUAGES)[number]["code"];

const CODES = MASTER_LANGUAGES.map((l) => l.code) as readonly string[];

export function isMasterLanguage(v: unknown): v is MasterLanguage {
  return typeof v === "string" && CODES.includes(v);
}

/**
 * Hinglish is the default, and that is a product decision rather than an
 * alphabetical accident: it is the only one of the three registers that
 * has been read by a real installer standing at a real rack. English and
 * Devanagari Hindi are, on the day they ship, untested translations of
 * tested content. Defaulting to one of them would quietly downgrade the
 * experience of the only user this module currently has.
 */
export const DEFAULT_MASTER_LANGUAGE: MasterLanguage = "hi-Latn";

/**
 * Deliberately NOT `cg.dashboard.lang`. See reason 2 in the file header:
 * that key is owned by `useSyncDashboardLanguage`, which overwrites it
 * from the backend's `user.language` on every authenticated dashboard
 * mount, so anything stored there is not durable and is not this
 * surface's to set.
 */
const LANG_STORAGE_KEY = "cg.master.lang";

/**
 * Storage access is wrapped rather than merely `typeof window`-guarded,
 * the same discipline as `progress.ts` and `@/lib/i18n`: a window that
 * exists can still have a `localStorage` that throws (private browsing, a
 * locked-down profile, a full quota). This runs at module scope, so a
 * throw here would take out the whole Master chunk's evaluation, not just
 * the language preference.
 */
function readStoredLanguage(): MasterLanguage {
  if (typeof window === "undefined") return DEFAULT_MASTER_LANGUAGE;
  try {
    const raw = window.localStorage.getItem(LANG_STORAGE_KEY);
    return isMasterLanguage(raw) ? raw : DEFAULT_MASTER_LANGUAGE;
  } catch {
    return DEFAULT_MASTER_LANGUAGE;
  }
}

const masterI18n = createInstance();

void masterI18n.use(initReactI18next).init({
  resources: {
    en: { guided: enGuided, guidedContent: enGuidedContent },
    hi: { guided: hiGuided, guidedContent: hiGuidedContent },
    // No `guidedContent` for hi-Latn ON PURPOSE. The content files
    // (`phases.content.ts`, `diagnostics.content.ts`) ARE the Hinglish
    // register, and they stay the single source of truth for it. A
    // hi-Latn content bundle would be a byte-for-byte second copy of
    // strings a MikroTik engineer maintains by hand, i.e. a guaranteed
    // future drift between what the operator reads and what was tested.
    // `localizeContent` returns the content object untouched when there
    // is no override bundle, which is exactly right for hi-Latn.
    "hi-Latn": { guided: hiLatnGuided },
  },
  lng: readStoredLanguage(),
  supportedLngs: CODES as string[],
  // Without this, i18next widens `hi-Latn` to `hi` before consulting
  // `fallbackLng` -- so a key missing from the Hinglish bundle would
  // render in Devanagari to an operator who asked for Roman script.
  // Mixed-script UI is worse than a fallback he can read.
  load: "currentOnly",
  nonExplicitSupportedLngs: false,
  // A gap in the Devanagari bundle falls back to Hinglish before English:
  // same language, different script, so the reader definitely understands
  // it. A gap anywhere else falls back to English.
  fallbackLng: { hi: ["hi-Latn", "en"], default: ["en"] },
  ns: ["guided", "guidedContent"],
  defaultNS: "guided",
  interpolation: { escapeValue: false },
  returnNull: false,
  // Every bundle is inlined above, so there is nothing to await and
  // nothing to suspend on. Left on, React would still install a Suspense
  // boundary contract around every `useTranslation` call in this module;
  // a boundary that ever actually suspended would unmount the guided-setup
  // subtree and take the operator's typed input with it.
  react: { useSuspense: false },
});

/**
 * Switches the Master console's language in place and remembers it.
 *
 * "In place" is the whole contract: this calls `changeLanguage`, which
 * makes every `useTranslation` subscriber re-render. It does not navigate,
 * does not reload, does not change any React `key`, and does not touch
 * `cg_guided_setup_<routerId>` -- so the current phase, the answers, the
 * text typed into the regenerate guard, the diagnostics query and the
 * scroll position all survive, because none of them are ever unmounted.
 */
export function setMasterLanguage(lang: MasterLanguage): void {
  void masterI18n.changeLanguage(lang);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // The switch itself already happened; only remembering it across a
    // reload is lost. Never worth throwing out of a click handler.
  }
}

export function currentMasterLanguage(): MasterLanguage {
  return isMasterLanguage(masterI18n.resolvedLanguage)
    ? masterI18n.resolvedLanguage
    : DEFAULT_MASTER_LANGUAGE;
}

export default masterI18n;
