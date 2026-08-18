import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enGuests from "./locales/en/guests.json";
import enAccount from "./locales/en/account.json";
import hiCommon from "./locales/hi/common.json";
import hiNav from "./locales/hi/nav.json";
import hiGuests from "./locales/hi/guests.json";
import hiAccount from "./locales/hi/account.json";

const LANG_CACHE_KEY = "cg.dashboard.lang";

function readCachedLang(): string {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANG_CACHE_KEY) ?? "en";
}

// Bounded first slice (see docs/hindi-language-rollout-spec.md): only `en`
// and `hi` resource bundles ship here. `fallbackLng: "en"` means every
// dashboard screen outside this rollout's four namespaces just renders in
// English with zero extra work -- the intended, honest "partial coverage"
// behavior rather than a raw i18next key falling through to the screen.
i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, nav: enNav, guests: enGuests, account: enAccount },
    hi: { common: hiCommon, nav: hiNav, guests: hiGuests, account: hiAccount },
  },
  lng: readCachedLang(),
  fallbackLng: "en",
  ns: ["common", "nav", "guests", "account"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches the dashboard's rendered language immediately (no reload) and
 * caches the choice so a hard refresh doesn't flash back to English before
 * `useSyncDashboardLanguage` resolves the authenticated user's saved
 * `language` again. */
export function setDashboardLanguage(lang: string) {
  void i18n.changeLanguage(lang);
  if (typeof window !== "undefined") window.localStorage.setItem(LANG_CACHE_KEY, lang);
}

export default i18n;
