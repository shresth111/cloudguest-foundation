# Hindi Language Rollout — Implementation Spec

Status: ready to implement. Owner: PM/design (this doc). Implementers: 2 FE
engineers (captive portal, dashboard), 2 BE engineers.

## Top-line scope decision

| Surface | Verdict | Why |
|---|---|---|
| **Captive portal** (`/portal/*`) | **Full Hindi coverage, this rollout.** | i18n infrastructure already exists (`portal-i18n.ts`, `LanguageSwitcher`, per-config `supportedLanguages`). Hindi is only ~9% translated today (6 of 65 dictionary keys have real Hindi; the rest silently fall back to English) and several components/routes bypass the dictionary entirely with hardcoded English. This is a translation-and-cleanup job, not new infrastructure. |
| **Admin dashboard** (Master Console + Customer Dashboard) | **Bounded first slice, not full coverage.** | Zero i18n infrastructure exists anywhere in the dashboard today (confirmed — no `react-i18next`/`react-intl`/custom `t()` hook, no translation files; every hit for "locale"/"language" in dashboard code is `Date.toLocaleString()`, unrelated). The dashboard is ~154 route files and ~279 components. Introducing i18n from scratch **and** translating full coverage across that surface is not a 2-engineer/one-rollout job. Promising full coverage here would be dishonest. Below is a real, standard i18n system (`react-i18next`) plus a genuinely useful bounded slice: global nav, the Guests table, and the Account/Language settings screen — chosen because the mechanism to persist a user's language choice **already exists in the backend and is already wired in the UI** (see finding below), it's just not connected to anything that changes rendered text yet. |
| Transactional emails (backend) | **Out of scope, follow-up item.** | See "Emails" section — 10 separate backend services compose plain-Python f-string HTML inline, no template layer, no language threading. Real but separate project. |
| `wyfy-guest-website` (marketing site) | **Out of scope.** | Separate Astro repo, no i18n, not part of "admin dashboard + captive portal" as scoped. |

---

## Key findings from investigation

1. **Captive portal i18n infra is real but shallow.** `src/lib/portal-i18n.ts` defines an
   `EN` dictionary of 65 keys and `HI`/`AR`/`FR`/`ES` dictionaries that each spread `...EN`
   and override only 5–6 keys. Every unoverridden key silently renders in English — there is
   no visual indicator that Hindi is "incomplete," it just quietly isn't there.
2. **Not every guest-facing string goes through `translate()`.** `CampaignOverlay.tsx`,
   `PortalShell.tsx`'s brand fallback, and the routes `portal.closed.tsx` and `portal.team.tsx`
   have zero `t()` calls and hardcode English strings directly in JSX.
3. **Portal language choice isn't persisted at all.** `PortalRuntimeContext.tsx`'s `language`
   state is a bare `useState` seeded from `config.defaultLanguage` — it resets on every
   remount (reload, OS captive-portal re-probe, etc.). This is a real, pre-existing bug,
   independent of Hindi, worth fixing as part of this work.
4. **The dashboard has a working language *persistence* mechanism already** — it's just not
   connected to any rendering. `User.language` is a real column (`app/domains/auth/models.py`,
   default `"en"`), already returned by `/auth/me`, and `PUT /users/me` (`update_my_profile`)
   already accepts `language` as an updatable field
   (`app/domains/user/service.py`, `_MUTABLE_SELF_FIELDS`). On the frontend,
   `src/routes/_authenticated/account.tsx`'s `AccountSection` **already has a working "Language"
   `<select>`** (with English/Hindi/French/Spanish/Arabic options) that calls
   `authService.updateMyProfile({ language: lang })` and saves successfully today. Selecting
   "Hindi" there currently does nothing visible, because nothing in the app reads `user.language`
   to change any displayed text. **This means: no new BE endpoint or DB column is needed for
   the dashboard's locale preference — it already exists end-to-end. The gap is purely
   frontend rendering.**
5. **Dashboard nav labels are frontend-only static data, not backend-driven.** Master Console
   nav comes from `src/services/permissions.service.ts`'s `GROUP_META`/`LABEL_BY_MODULE` tables
   (~11 groups, ~70 module labels); Customer Dashboard nav comes from `src/lib/customerNav.ts`
   (7 groups, 28 items). Both are keyed by a stable `id` per item. This means nav translation
   can be done as a pure frontend lookup keyed by `id`, with zero backend involvement and zero
   risk to the permission logic itself.
6. **No Devanagari-capable font is loaded.** The dashboard's font stack
   (`src/styles.css`, `--font-sans`) is `Inter, ui-sans-serif, system-ui, ...` — none of
   which cover Devanagari. Hindi text will fall through to whatever Devanagari font the OS
   happens to have, with visibly inconsistent weight/line-height versus the rest of the UI.
   Needs a fallback added (see Dashboard section).
7. **Transactional emails have no template/i18n layer at all.** `app/core/email_layout.py` is
   a shared HTML *shell* (buttons, headings, layout), but the actual email copy is composed as
   inline Python f-strings across 10 separate domain services (`auth`, `user`,
   `location.provisioning_service`, `voucher`, `billing.renewal_service`, `billing.router`,
   `quotation`, `otp`, `monitoring`, `analytics.report_tasks`). None of them currently accept
   or use a language parameter. Threading `user.language`/`guest` locale through all 10 and
   writing/reviewing Hindi copy for each is a real, separate-sized project — flagged as
   follow-up, not folded into this rollout.

---

## 1. Captive portal — full Hindi rollout

### 1a. Fix the persistence gap first (small, independent bug fix)

`PortalRuntimeContext.tsx` never persists the guest's language choice — add
`localStorage` persistence (portal has no authenticated guest identity to key a backend
preference off reliably, so client-side storage is the right layer here, not a new backend
field):

```ts
// src/lib/portal-i18n.ts — add
const LANG_STORAGE_KEY = "cg_portal_lang";
export function loadPersistedLanguage(): RuntimeLanguage | undefined {
  if (typeof window === "undefined") return undefined;
  const v = window.localStorage.getItem(LANG_STORAGE_KEY);
  return (["en", "hi", "ar", "fr", "es"] as const).includes(v as RuntimeLanguage)
    ? (v as RuntimeLanguage)
    : undefined;
}
export function persistLanguage(lang: RuntimeLanguage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
}
```

In `PortalRuntimeContext.tsx`:
- Seed `language` state from `loadPersistedLanguage() ?? config.defaultLanguage` (persisted
  choice wins over the location's default once a guest has picked one).
- Wrap `setLanguage` so it also calls `persistLanguage(l)`.

### 1b. Complete the Hindi dictionary

Replace the `HI` dictionary in `src/lib/portal-i18n.ts` with full coverage of every existing
`EN` key, plus the new keys needed to close the "bypasses `translate()` entirely" gaps found
in `CampaignOverlay.tsx`, `portal.closed.tsx`, `portal.team.tsx`, and `PortalShell.tsx`'s
brand fallback.

```ts
const HI: Dict = {
  loading: "आपका कनेक्शन तैयार किया जा रहा है…",
  connect: "कनेक्ट करें",
  learnMore: "और जानें",
  chooseMethod: "साइन इन करने का तरीका चुनें",
  mobileOtp: "मोबाइल OTP",
  emailOtp: "ईमेल OTP",
  whatsappOtp: "व्हाट्सऐप OTP",
  passwordLogin: "पासवर्ड",
  passwordLoginDesc: "अपने सेव किए गए पासवर्ड से साइन इन करें",
  voucher: "वाउचर कोड",
  pms: "रूम लॉगिन",
  social: "सोशल लॉगिन",
  qr: "QR साइन-इन",
  clickThrough: "एक-टैप एक्सेस",
  mobileNumber: "मोबाइल नंबर",
  emailAddress: "ईमेल पता",
  password: "पासवर्ड",
  signIn: "साइन इन करें",
  sendOtp: "कोड भेजें",
  verifyOtp: "सत्यापित करें",
  resend: "कोड फिर से भेजें",
  changeNumber: "गंतव्य बदलें",
  voucherCode: "वाउचर कोड",
  submit: "सबमिट करें",
  roomNumber: "कमरा नंबर",
  lastName: "उपनाम",
  scanInstructions: "कनेक्ट करने के लिए अपना कैमरा खोलें और QR कोड स्कैन करें।",
  agreeTerms: "मैं सेवा की शर्तों और गोपनीयता नीति से सहमत हूं",
  connectedTitle: "आप कनेक्ट हो गए हैं",
  connectedSubtitle: "इस डिवाइस पर अब हाई-स्पीड इंटरनेट चालू है।",
  logout: "डिस्कनेक्ट करें",
  continue: "ब्राउज़िंग जारी रखें",
  authFailed: "हम आपको साइन इन नहीं कर सके",
  retry: "फिर कोशिश करें",
  contactSupport: "सहायता से संपर्क करें",
  sessionRemaining: "शेष समय",
  dataUsage: "डेटा उपयोग",
  device: "डिवाइस",
  sessionExpired: "आपका सत्र समाप्त हो गया है",
  reconnect: "फिर से कनेक्ट करें",
  extend: "सत्र बढ़ाएं",
  redirecting: "आपको शीघ्र ही रीडायरेक्ट किया जा रहा है…",
  offlineTitle: "आप ऑफ़लाइन हैं",
  offlineSubtitle: "अपना वाई-फाई कनेक्शन जांचें और फिर से प्रयास करें।",
  skipAd: "छोड़ें",
  termsTitle: "शर्तें और गोपनीयता",
  welcomeCta: "शुरू करें",
  language: "भाषा",
  a11y: "सुगमता",
  highContrast: "उच्च कंट्रास्ट",
  largeText: "बड़ा टेक्स्ट",
  wifi: "वाई-फाई",
  setPasswordTitle: "अगली बार कोड छोड़ना चाहेंगे?",
  setPasswordSubtitle: "अभी एक पासवर्ड सेव करें और अगली बार सिर्फ़ अपने नंबर से साइन इन करें।",
  newPassword: "नया पासवर्ड",
  confirmPassword: "पासवर्ड की पुष्टि करें",
  savePassword: "पासवर्ड सेव करें",
  skipForNow: "अभी के लिए छोड़ें",
  passwordSaved: "पासवर्ड सेव हो गया -- अगली बार आप इससे साइन इन कर सकते हैं।",

  // New keys — close CampaignOverlay.tsx's gap
  surveyQuestion: "त्वरित प्रश्न",
  sponsored: "प्रायोजित",
  submitting: "सबमिट हो रहा है…",

  // New keys — close portal.closed.tsx's gap
  closedTitleDefault: "फ़िलहाल बंद है",
  closedSubtitle: "हम फ़िलहाल बंद हैं। कृपया कनेक्ट करने के लिए व्यावसायिक घंटों के दौरान फिर से देखें।",

  // New keys — close portal.team.tsx's gap
  teamAlreadyJoined: "आप पहले से ही इस टीम का हिस्सा हैं।",
  teamJoined: "आप टीम में शामिल हो गए हैं!",
  joinTeam: "टीम में शामिल हों",

  // New key — PortalShell.tsx's brand-fallback default
  guestWifiFallback: "गेस्ट वाई-फाई",
};
```

Do the same completeness pass for `AR`/`FR`/`ES` if/when those are prioritized — out of scope
for *this* rollout (Hindi-only), but don't let the new keys above regress them: add the new
keys to those dictionaries too, in English, so they don't silently show `key` (the raw
dictionary key string) as fallback text. `translate()`'s fallback chain is
`DICTS[lang]?.[key] ?? DICTS.en[key] ?? key` — a key missing from *both* `lang` and `EN` renders
literally, so any new key must be added to `EN` at minimum, which the snippet above already
does implicitly (`EN` needs the same 8 new keys added — see file-structure note below).

### 1c. Fix the components/routes that bypass `translate()`

| File | Change |
|---|---|
| `src/components/portal-runtime/CampaignOverlay.tsx` | Line ~217: `campaign.campaignType === "survey" ? "Quick question" : "Sponsored"` → `t("surveyQuestion")` / `t("sponsored")`. Line ~256: `submitSurvey.isPending ? "Submitting…" : "Submit"` → `t("submitting")` / `t("submit")`. Needs `const { t } = usePortalRuntime();` added to the component. |
| `src/routes/portal.closed.tsx` | Line ~30: `config?.name ? \`${config.name} is currently closed\` : "Currently closed"` → `config?.name ? \`${config.name} ${t("closedTitleDefault")}\` : t("closedTitleDefault")` (Hindi word order works fine appended after a proper noun here — verify visually once translated copy is in). Line ~35: static fallback string → `t("closedSubtitle")`. |
| `src/routes/portal.team.tsx` | Lines ~116–117, ~156: literal strings → `t("teamAlreadyJoined")`, `t("teamJoined")`, `t("joinTeam")`. |
| `src/components/portal-runtime/PortalShell.tsx` | Line ~353: `config?.splashHeadline ?? "Guest WiFi"` → `config?.splashHeadline ?? t("guestWifiFallback")`. |

### 1d. QA checklist for the FE engineer
- Every route under `src/routes/portal.*.tsx` and every component in
  `src/components/portal-runtime/` — grep for quoted English strings in JSX that aren't
  passed through `t(...)`; confirm zero remain (the four locations above were confirmed by
  grep during this investigation, but do a fresh pass since portal routes get frequent edits).
- Switch language to Hindi via `LanguageSwitcher`, walk the full guest flow end to end
  (method chooser → OTP/password/voucher → connected → session → set-password prompt →
  logout), confirm no English leaks through anywhere in that path.
- Reload mid-flow (simulates the OS captive-portal re-probe) — confirm the Hindi choice
  survives via the new `localStorage` persistence (1a).
- Confirm `RTL_LANGS` is untouched — Hindi is LTR, this should be a no-op, but verify
  `document.documentElement.dir` stays `"ltr"` when `lang === "hi"`.

---

## 2. Admin dashboard — bounded first slice

### 2a. Introduce `react-i18next` (standard library, not a bespoke system)

```
bun add react-i18next i18next
```

New files:
```
src/lib/i18n/
  index.ts                 # i18next.init(), exports `i18n` instance
  locales/
    en/
      common.json           # shared atoms: Save, Cancel, Search, ...
      nav.json               # sidebar group + item labels, keyed by stable `id`
      guests.json           # Guests table strings
      account.json           # Account/Language settings screen strings
    hi/
      common.json
      nav.json
      guests.json
      account.json
  useSyncDashboardLanguage.ts   # see 2c
```

`src/lib/i18n/index.ts`:
```ts
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
});

export function setDashboardLanguage(lang: string) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") window.localStorage.setItem(LANG_CACHE_KEY, lang);
}

export default i18n;
```

Only `en` and `hi` resource bundles ship in this rollout — `fallbackLng: "en"` means any
uncovered dashboard screen (i.e. everything outside the first slice below) automatically
renders in English with zero extra work, exactly the honest "bounded slice" behavior we want.

### 2b. Wire the provider

`src/routes/__root.tsx` — import `"@/lib/i18n"` once at module scope (side-effect import,
runs `i18n.init()` before first render); no `I18nextProvider` JSX wrapper is strictly needed
since `react-i18next`'s `useTranslation()` reads the global singleton by default, but wrapping
explicitly is more conventional and testable:

```tsx
import "@/lib/i18n";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";
// ...
<I18nextProvider i18n={i18n}>
  <QueryClientProvider client={queryClient}>
    {/* existing tree unchanged */}
  </QueryClientProvider>
</I18nextProvider>
```

### 2c. Sync the authenticated user's saved language on login

New hook, called once from `src/routes/_authenticated.tsx` (the layout route that guarantees
`user` is loaded):

```ts
// src/lib/i18n/useSyncDashboardLanguage.ts
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { setDashboardLanguage } from "@/lib/i18n";

export function useSyncDashboardLanguage() {
  const { user } = useAuth();
  useEffect(() => {
    if (user?.language) setDashboardLanguage(user.language);
  }, [user?.language]);
}
```

This makes the *already-working* `PUT /users/me` language save actually take effect: today
`AccountSection` saves `language` successfully but nothing reacts to it. No backend change
needed — `user.language` is already returned by `/auth/me` today.

### 2d. Make the existing Account "Language" selector actually switch the UI

`src/routes/_authenticated/account.tsx`, `AccountSection`'s `save()`:

```ts
const save = async () => {
  setSaving(true);
  try {
    const updated = await authService.updateMyProfile({ language: lang, timezone: tz });
    updateUser(updated);
    setDashboardLanguage(lang); // NEW — makes the change take effect immediately, no reload
    toast.success(t("account:saved"));
  } catch (err) {
    toast.error((err as AppError).message || t("account:saveFailed"));
  } finally {
    setSaving(false);
  }
};
```

Also give it a lightweight second entry point next to `ThemeToggle` in
`src/components/layout/TopNavbar.tsx` (highest-visibility spot, mirrors the portal's own
dropdown pattern for consistency) — a small dropdown with `English` / `हिन्दी` that calls
`authService.updateMyProfile({ language })` + `setDashboardLanguage(language)` directly,
without navigating to the full Account page. Same component shape as
`src/components/portal-runtime/LanguageSwitcher.tsx`; new file
`src/components/layout/DashboardLanguageSwitcher.tsx`.

### 2e. Translate the first slice

**Scope, explicitly:**
- Master Console sidebar (`AppSidebar.tsx` via `permissions.service.ts`'s `GROUP_META` +
  `LABEL_BY_MODULE`)
- Customer Dashboard sidebar (`CustomerSidebar.tsx` via `customerNav.ts`)
- Connected Guests table (`GuestListTable.tsx`)
- Account → Account preferences screen (where the language switcher itself lives)
- A `common` namespace of ~30 shared UI atoms (Save/Cancel/Search/etc.) reused across all of
  the above and available for the *next* slice to build on

**Explicitly NOT in this rollout** (stays English, will read that way to a Hindi-speaking
user until a follow-up slice covers it): router/network configuration screens, policy editors,
billing/plans/quotations, RBAC/user-management forms, analytics dashboards, marketplace,
audit logs, campaigns editor, voucher generation, NAS provisioning, feature management, and
every settings sub-tab beyond "Account preferences" (Company, Security, Two-factor, Sessions,
Notifications, API tokens). That's the bulk of the ~154 routes/279 components — say so
plainly to stakeholders rather than let silent partial coverage surprise a Hindi-speaking
admin who wanders past the first slice.

**Nav translation mechanism — zero backend/data-model changes.** Both sidebars key items by a
stable `id`. Add translation lookup *at render time*, falling back to the existing English
`label` when no `hi` entry exists for that `id` — this makes the rollout purely additive and
safe to ship incrementally (adding more `id`s to `nav.json` later needs no code change):

`src/components/layout/AppSidebar.tsx`, `SidebarGroup`/`SidebarNodeRow`:
```tsx
const { t } = useTranslation("nav");
// group label:
{t(`group.${g.id}`, g.label)}
// item label:
{t(`item.${item.id}`, item.label)}
```
(react-i18next's `t(key, fallback)` form returns the fallback verbatim when the key is
missing — this is the "additive, safe to ship partial" property described above.)

Same pattern in `src/components/customer/CustomerSidebar.tsx` against `CUSTOMER_NAV_GROUPS`.

`src/lib/i18n/locales/hi/nav.json`:
```json
{
  "group": {
    "dashboard": "डैशबोर्ड",
    "network": "नेटवर्क",
    "guests": "अतिथि प्रबंधन",
    "policies": "नीतियां",
    "analytics": "एनालिटिक्स",
    "operations": "संचालन",
    "administration": "प्रशासन",
    "support": "सहायता",
    "system": "सिस्टम",
    "workspace": "कार्यक्षेत्र",
    "overview": "अवलोकन",
    "engagement": "एंगेजमेंट",
    "access-policy": "एक्सेस और नीति",
    "devices-team": "डिवाइस और टीम",
    "support-logs": "सहायता और लॉग"
  },
  "item": {
    "dashboard": "डैशबोर्ड",
    "location-master": "लोकेशन मास्टर",
    "infrastructure": "इन्फ्रास्ट्रक्चर",
    "voucher-master": "वाउचर मास्टर",
    "nas-management": "NAS प्रबंधन",
    "feature-catalog": "फीचर कैटलॉग",
    "plans-billing": "प्लान और बिलिंग",
    "routers": "राउटर",
    "network-aps": "एक्सेस पॉइंट",
    "vlan": "VLAN",
    "isp-routing": "ISP",
    "network-wan": "WAN",
    "network-lan": "LAN",
    "dscp": "DSCP",
    "firewall": "फ़ायरवॉल",
    "network-dhcp": "DHCP",
    "network-dns": "DNS",
    "mac-auth": "MAC प्राधिकरण",
    "queue-management": "क्यू प्रबंधन",
    "port-forwarding": "पोर्ट फॉरवर्डिंग",
    "hotspot": "हॉटस्पॉट प्रोफ़ाइल",
    "guests-live": "लाइव अतिथि",
    "guests": "अतिथि",
    "campaigns": "अभियान",
    "guest-access": "अतिथि एक्सेस नियम",
    "guest-teams": "अतिथि टीमें",
    "policy-location": "लोकेशन नीतियां",
    "policy-user": "उपयोगकर्ता नीतियां",
    "policy-group": "समूह नीतियां",
    "policy-auth": "प्रमाणीकरण नीतियां",
    "policy-bandwidth": "बैंडविड्थ नीतियां",
    "policy-network": "नेटवर्क नीतियां",
    "analytics-executive": "एग्जीक्यूटिव डैशबोर्ड",
    "analytics-network": "नेटवर्क एनालिटिक्स",
    "analytics-guest": "अतिथि एनालिटिक्स",
    "analytics-device": "डिवाइस एनालिटिक्स",
    "analytics-isp": "ISP एनालिटिक्स",
    "analytics": "एनालिटिक्स",
    "monitoring": "डिवाइस मॉनिटरिंग",
    "audit": "ऑडिट लॉग",
    "organizations": "संगठन",
    "business-units": "बिज़नेस यूनिट",
    "locations": "लोकेशन",
    "customers": "ग्राहक",
    "rbac": "उपयोगकर्ता और भूमिकाएं",
    "feature-management": "फीचर असाइनमेंट",
    "billing": "बिलिंग",
    "subscription": "सब्सक्रिप्शन",
    "plans": "प्लान",
    "help": "सहायता केंद्र",
    "documentation": "दस्तावेज़ीकरण",
    "support-contact": "सहायता से संपर्क करें",
    "settings": "प्लेटफ़ॉर्म सेटिंग्स",
    "integrations": "इंटीग्रेशन",
    "api-keys": "API कीज़",
    "notifications": "सूचनाएं",
    "exports": "निर्यात",
    "branding": "व्हाइट लेबल",
    "marketplace": "मार्केटप्लेस",
    "portals": "पोर्टल",
    "workspace": "डैशबोर्ड",
    "workspace-locations": "लोकेशन",
    "workspace-routers": "राउटर",
    "workspace-guests": "अतिथि",
    "workspace-analytics": "एनालिटिक्स",
    "workspace-reports": "रिपोर्ट",
    "workspace-billing": "बिलिंग",
    "workspace-notifications": "सूचनाएं",
    "workspace-company": "कंपनी सेटिंग्स",
    "workspace-help": "सहायता केंद्र",

    "users": "उपयोगकर्ता",
    "reports": "रिपोर्ट",
    "alerts": "अलर्ट",
    "portal": "पोर्टल",
    "vouchers": "वाउचर",
    "policies": "एक्सेस नियम",
    "whitelist": "हमेशा अनुमत",
    "business-hours": "खुलने का समय",
    "background-image": "बैकग्राउंड इमेज",
    "devices": "डिवाइस",
    "teams": "अतिथि समूह",
    "agents": "स्टाफ एक्सेस",
    "dhcp": "IP पते",
    "vlans": "नेटवर्क ज़ोन",
    "voip": "कॉल प्राथमिकता",
    "website-blocking": "वेबसाइट ब्लॉकिंग",
    "isp-details": "इंटरनेट कनेक्शन",
    "notification": "सूचनाएं",
    "debugging": "कनेक्शन टूल्स",
    "tickets": "सहायता टिकट",
    "admin-logs": "लॉग",
    "how-it-works": "यह कैसे काम करता है"
  }
}
```

Note: `CloudGuest`/`Wyfy Guest` (the `platform` group's label) is a brand name and stays
untranslated by convention — not included above.

`src/lib/i18n/locales/hi/guests.json` (for `GuestListTable.tsx`):
```json
{
  "searchPlaceholder": "पहचानकर्ता या नाम खोजें…",
  "filterAll": "सभी अतिथि",
  "filterNotBlocked": "अनब्लॉक्ड",
  "filterBlocked": "ब्लॉक्ड",
  "filterStatusLabel": "स्थिति",
  "colGuest": "अतिथि",
  "colOrganization": "संगठन",
  "colLocation": "लोकेशन",
  "colVisits": "विज़िट",
  "colFirstSeen": "पहली बार देखा गया",
  "colLastSeen": "अंतिम बार देखा गया",
  "colStatus": "स्थिति",
  "colActions": "कार्रवाइयां",
  "statusBlocked": "ब्लॉक्ड",
  "statusActive": "सक्रिय",
  "unblock": "अनब्लॉक करें",
  "block": "ब्लॉक करें",
  "of": "में से",
  "previous": "पिछला",
  "next": "अगला",
  "page": "पृष्ठ",
  "blockDialogTitle": "अतिथि को ब्लॉक करें?",
  "blockDialogDescription": "जब तक अनब्लॉक न किया जाए, अतिथि को एक्सेस से वंचित किया जाएगा।",
  "blockSuccess": "अतिथि ब्लॉक किया गया",
  "blockError": "अतिथि को ब्लॉक करने में विफल",
  "unblockSuccess": "अतिथि अनब्लॉक किया गया",
  "unblockError": "अतिथि को अनब्लॉक करने में विफल",
  "emptyTitle": "कोई अतिथि नहीं मिला",
  "emptyDescription": "अतिथियों के प्रमाणित होते ही वे यहां दिखाई देंगे।",
  "errorTitle": "अतिथि लोड करने में विफल"
}
```

`src/lib/i18n/locales/hi/account.json` (for `AccountSection` in `account.tsx`):
```json
{
  "title": "खाता प्राथमिकताएं",
  "description": "आपके खाते के लिए स्थानीयकरण और डिस्प्ले सेटिंग्स।",
  "language": "भाषा",
  "timezone": "समय क्षेत्र",
  "compactDensity": "कॉम्पैक्ट डेंसिटी",
  "compactDensityDescription": "टेबल और कार्ड में पैडिंग कम करें।",
  "save": "सेव करें",
  "saved": "प्राथमिकताएं सेव की गईं",
  "saveFailed": "प्राथमिकताएं सेव करने में विफल"
}
```

`src/lib/i18n/locales/hi/common.json`:
```json
{
  "save": "सेव करें",
  "cancel": "रद्द करें",
  "search": "खोजें",
  "filter": "फ़िल्टर",
  "export": "निर्यात करें",
  "edit": "संपादित करें",
  "delete": "हटाएं",
  "add": "जोड़ें",
  "actions": "कार्रवाइयां",
  "status": "स्थिति",
  "active": "सक्रिय",
  "inactive": "निष्क्रिय",
  "block": "ब्लॉक करें",
  "unblock": "अनब्लॉक करें",
  "loading": "लोड हो रहा है…",
  "noResults": "कोई परिणाम नहीं मिला",
  "yes": "हां",
  "no": "नहीं",
  "confirm": "पुष्टि करें",
  "close": "बंद करें",
  "back": "वापस",
  "next": "अगला",
  "previous": "पिछला",
  "page": "पृष्ठ",
  "of": "में से",
  "total": "कुल",
  "view": "देखें",
  "details": "विवरण",
  "refresh": "रीफ्रेश करें",
  "success": "सफलता",
  "error": "त्रुटि",
  "warning": "चेतावनी"
}
```

Corresponding `en/*.json` files: identical key structure with the current English copy
(pull literally from the source files quoted in section 2e/table above — no translation
work needed for `en`, since that's what the app already renders; the point of the `en/`
bundle existing is only so the same keys resolve through `t()` in both languages).

### 2f. Devanagari font fallback

`src/styles.css`, extend the font stack so Hindi text renders with a visually consistent,
intentionally-chosen font rather than whatever the OS defaults to:

```css
--font-sans: "Inter", "Noto Sans Devanagari", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

Load `Noto Sans Devanagari` (Google Fonts, OFL-licensed, pairs cleanly with Inter's
x-height/weight) — either self-host the woff2 files under `public/fonts/` (preferred, avoids
a third-party network request from the dashboard) or a `<link>` to Google Fonts if self-hosting
isn't practical this sprint. Verify at 400/500/600 weights (the weights actually used in the UI
per `styles.css`).

### 2g. QA checklist for the FE engineer
- Toggle language via both the Account page selector and the new `TopNavbar` switcher; verify
  sidebar labels, Guests table, and Account page switch instantly with no reload.
- Reload the page after switching — confirm it stays Hindi (via `localStorage` cache +
  `useSyncDashboardLanguage` resolving `user.language` once auth loads).
- Log out and back in as a different user with `language: "en"` saved — confirm it doesn't
  inherit the previous user's Hindi choice (the `localStorage` cache should be overwritten by
  `useSyncDashboardLanguage` once that user's real `user.language` loads — verify the effect
  actually fires before any Hindi-only screen renders, to avoid a one-frame flash of the wrong
  language).
- Confirm every screen *outside* the stated slice still renders in English (this is expected
  and correct — not a bug to fix in this rollout).
- Visual check on Guests table and sidebar with Hindi text at the dashboard's default zoom —
  confirm no truncation/overflow now that some Hindi labels are longer than their English
  source (e.g. "अतिथि एक्सेस नियम" vs "Guest Access Rules" — check the collapsed-icon sidebar
  state too, `group-data-[collapsible=icon]`).

---

## 3. Backend engineer tasks

### 3a. Dashboard locale (already done — verify only)
No new work. Confirm as a sanity check:
- `GET /auth/me` returns `language` on the `User` object (it does — `auth/router.py` line 81).
- `PUT /users/me` accepts and persists `language` (it does — `user/service.py`
  `_MUTABLE_SELF_FIELDS` includes `"language"`).
- Optional hardening (nice-to-have, not blocking): validate `language` against an allowed-locale
  enum (`en`, `hi` for now) server-side in `user/schemas.py` rather than accepting any
  free-text string — currently `language: str | None = Field(default=None, max_length=10)` with
  no format constraint. Low risk either way since the frontend only ever sends values from its
  own dropdown, but worth tightening before opening this up further.

### 3b. Captive portal guest locale (no backend change needed)
Guest language choice is intentionally client-side only (`localStorage`, section 1a) — the
persistent `Guest` model has no `preferred_language` field today, and guests aren't
authenticated the way dashboard users are, so there's no reliable account to key a backend
preference off. If a future rollout wants a guest's language to follow them across devices,
that would need a `Guest.preferred_language` column + a captive-portal endpoint to set it —
explicitly not needed for this rollout's scope (localStorage already fixes the "resets on
every reload" bug from finding #3).

### 3c. Transactional emails — follow-up project, not this rollout
Flagged, not built here. If/when prioritized: thread a `language` parameter (source: either
`User.language` for staff-facing emails, or a to-be-added `Guest.preferred_language` for
guest-facing ones) through all 10 email-composing call sites listed in finding #7, and add a
Hindi copy variant alongside each English f-string. Rough sizing for planning purposes: 10
services × (1 language param + 1 Hindi string set each) — bigger than either FE slice in this
doc, size it as its own ticket once someone's actually asked for Hindi emails.

---

## 4. File/component summary (for engineers to work from directly)

**Captive portal engineer:**
- Edit: `src/lib/portal-i18n.ts` (complete `HI` dict + new keys, mirror new keys into `EN`
  and `AR`/`FR`/`ES` in English)
- Edit: `src/context/PortalRuntimeContext.tsx` (localStorage persistence, section 1a)
- Edit: `src/components/portal-runtime/CampaignOverlay.tsx`,
  `src/components/portal-runtime/PortalShell.tsx`,
  `src/routes/portal.closed.tsx`, `src/routes/portal.team.tsx` (wire hardcoded strings to `t()`)
- No new files needed.

**Dashboard engineer:**
- New: `src/lib/i18n/index.ts`, `src/lib/i18n/useSyncDashboardLanguage.ts`,
  `src/lib/i18n/locales/{en,hi}/{common,nav,guests,account}.json`
- New: `src/components/layout/DashboardLanguageSwitcher.tsx`
- Edit: `src/routes/__root.tsx` (provider wiring), `src/routes/_authenticated.tsx`
  (call `useSyncDashboardLanguage()`), `src/routes/_authenticated/account.tsx`
  (`AccountSection.save`), `src/components/layout/TopNavbar.tsx` (mount the new switcher),
  `src/components/layout/AppSidebar.tsx`, `src/components/customer/CustomerSidebar.tsx`
  (`t()` lookups by `id`), `src/components/guests/GuestListTable.tsx` (`t()` throughout),
  `src/styles.css` (font fallback)
- Add dependency: `react-i18next`, `i18next`

**Backend engineers:**
- No mandatory schema/endpoint work — verify section 3a, optionally tighten `language`
  validation in `app/domains/user/schemas.py`.
- File a separate, explicitly-scoped follow-up ticket for transactional-email Hindi content
  (section 3c) rather than pulling it into this rollout.

---

## 5. Explicitly out of scope for this rollout
- Full dashboard i18n coverage (router config, policies, billing, RBAC, analytics,
  marketplace, audit logs, campaigns, vouchers, NAS provisioning, feature management, and all
  Account sub-tabs besides "Account preferences").
- Transactional email Hindi content.
- `wyfy-guest-website` (separate repo, marketing site).
- Arabic/French/Spanish completeness passes on the portal (only their new-key gaps are
  patched, in English, so they don't regress — no new AR/FR/ES translation work).
- A backend `Guest.preferred_language` column / cross-device guest locale sync.
