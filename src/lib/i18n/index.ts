import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enGuests from "./locales/en/guests.json";
import enAccount from "./locales/en/account.json";
import enHelp from "./locales/en/help.json";
import enMarketing from "./locales/en/marketing.json";
import enWhitelist from "./locales/en/whitelist.json";
import enTrustedDevices from "./locales/en/trustedDevices.json";
import enOpenHours from "./locales/en/openHours.json";
import enGuestGroups from "./locales/en/guestGroups.json";
import enFixProblem from "./locales/en/fixProblem.json";
import enAccessRules from "./locales/en/accessRules.json";
import hiCommon from "./locales/hi/common.json";
import hiNav from "./locales/hi/nav.json";
import hiGuests from "./locales/hi/guests.json";
import hiAccount from "./locales/hi/account.json";
import hiHelp from "./locales/hi/help.json";
import hiMarketing from "./locales/hi/marketing.json";
import hiWhitelist from "./locales/hi/whitelist.json";
import hiTrustedDevices from "./locales/hi/trustedDevices.json";
import hiOpenHours from "./locales/hi/openHours.json";
import hiGuestGroups from "./locales/hi/guestGroups.json";
import hiFixProblem from "./locales/hi/fixProblem.json";
import hiAccessRules from "./locales/hi/accessRules.json";

const LANG_CACHE_KEY = "cg.dashboard.lang";

/** Runs at MODULE SCOPE (`i18n.init({ lng: readCachedLang() })` below), and
 * this module is a side-effect import from `__root.tsx` -- so anything that
 * throws in here throws while the client entry bundle is being *evaluated*,
 * before React ever hydrates. On Apple's Captive Network Assistant (the
 * websheet iOS opens for WiFi login) Web Storage behaves like private
 * browsing and `localStorage` access raises a SecurityError, so the
 * unguarded read this used to do took down hydration for the whole app.
 * The visible symptom was not an error screen: `__root.tsx`'s
 * `InitialLoader` is a `position:fixed; inset:0; z-index:9999` overlay
 * whose only remover is a mount effect, so a guest got a permanent
 * full-screen spinner on top of a perfectly good server-rendered portal.
 * The `typeof window` check above is an SSR guard and does not help here --
 * a window that exists can still have storage that throws. */
function readCachedLang(): string {
  if (typeof window === "undefined") return "en";
  try {
    return window.localStorage.getItem(LANG_CACHE_KEY) ?? "en";
  } catch {
    return "en";
  }
}

// Bounded first slice (see docs/hindi-language-rollout-spec.md): only `en`
// and `hi` resource bundles ship here. `fallbackLng: "en"` means every
// dashboard screen outside this rollout's namespaces just renders in
// English with zero extra work -- the intended, honest "partial coverage"
// behavior rather than a raw i18next key falling through to the screen.
//
// `help` is the How It Works reference page (HowItWorksPage.tsx). Its `hi`
// bundle deliberately carries only the page chrome and the seven group
// lines; the 25 per-screen sentences are English-only for now and reach a
// Hindi reader through `fallbackLng` above -- the same bounded, honest
// partial coverage this file already documents, rather than shipping
// machine-quality Hindi to paying venues. They need a native review pass
// before they are added to `hi/help.json`.
// One namespace per translated customer screen (whitelist, trustedDevices,
// openHours, guestGroups, fixProblem, accessRules) rather than piling every
// screen body into nav.json: each file stays reviewable on its own, and a
// native-speaker pass can be done one screen at a time.
i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      guests: enGuests,
      account: enAccount,
      help: enHelp,
      marketing: enMarketing,
      whitelist: enWhitelist,
      trustedDevices: enTrustedDevices,
      openHours: enOpenHours,
      guestGroups: enGuestGroups,
      fixProblem: enFixProblem,
      accessRules: enAccessRules,
    },
    hi: {
      common: hiCommon,
      nav: hiNav,
      guests: hiGuests,
      account: hiAccount,
      help: hiHelp,
      marketing: hiMarketing,
      whitelist: hiWhitelist,
      trustedDevices: hiTrustedDevices,
      openHours: hiOpenHours,
      guestGroups: hiGuestGroups,
      fixProblem: hiFixProblem,
      accessRules: hiAccessRules,
    },
  },
  lng: readCachedLang(),
  fallbackLng: "en",
  ns: [
    "common",
    "nav",
    "guests",
    "account",
    "help",
    "marketing",
    "whitelist",
    "trustedDevices",
    "openHours",
    "guestGroups",
    "fixProblem",
    "accessRules",
  ],
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
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANG_CACHE_KEY, lang);
  } catch {
    // Same storage-can-throw case as `readCachedLang`. The language switch
    // itself already happened above; only the cache-across-reloads part is
    // lost, which is never worth throwing out of a click handler for.
  }
}

export default i18n;
