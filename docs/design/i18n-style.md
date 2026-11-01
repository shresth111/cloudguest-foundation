# Customer console language style (English + Hindi)

The venue-owner dashboard ships two languages, `en` and `hi`
(`src/lib/i18n/locales/{en,hi}/<namespace>.json`). The reader is a cafe,
hotel or co-working owner: not a network engineer, often on a phone, often
switching between the two languages in the same sentence when they speak.
Write the Hindi they would say to a staff member, not the Hindi of a
government form.

## Hindi conventions

**Script.** Devanagari throughout. English words that a venue owner says in
English stay English _words_ — never translated into Sanskritised coinages —
and are written:

| Kind                                             | Script       | Examples                                                                                                                                  |
| ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Everyday loanwords with a settled Hindi spelling | Devanagari   | राउटर, इंटरनेट, ऑनलाइन, ऑफ़लाइन, डिवाइस, डैशबोर्ड, सेशन, पासवर्ड, ईमेल, प्लान, स्पीड, पोर्ट, लोकेशन, अलर्ट, कंट्रोलर, एक्सेस पॉइंट, लॉगिन |
| Acronyms, units, product and brand names         | Latin, as-is | WiFi, ISP, OTP, MAC, IP, DNS, DHCP, VLAN, NAT, SMS, CSV, PDF, Mbps, GB, Airtel, Jio, MikroTik, Omada, Wyfy                                |

Why the split: an acronym is read letter by letter and has no stable
Devanagari spelling (आईएसपी is harder to read than ISP), while a Latin word
dropped into a Devanagari sentence breaks the reading line. Before this pass
the files mixed both for _router_ (158 × राउटर, 57 × "router"); it is now
राउटर everywhere. Never translate a `{{variable}}` name.

**One word per concept.**

| English             | Hindi                                    | Not                 |
| ------------------- | ---------------------------------------- | ------------------- |
| guest               | मेहमान                                   | अतिथि, गेस्ट, यूज़र |
| venue / location    | लोकेशन (feminine: "यह लोकेशन … करती है") | वेन्यू, स्थान       |
| router              | राउटर                                    | router              |
| device              | डिवाइस                                   | उपकरण               |
| alert               | अलर्ट                                    | —                   |
| warning (severity)  | चेतावनी                                  | —                   |
| online / offline    | ऑनलाइन / ऑफ़लाइन                         | —                   |
| degraded (line)     | कमज़ोर                                   | धीमा                |
| unstable (hardware) | अस्थिर                                   | —                   |
| down                | बंद                                      | —                   |
| login / sign in     | लॉगिन (करें)                             | साइन इन, साइन-इन    |
| sign out            | लॉग आउट                                  | साइन आउट            |
| save                | सेव करें                                 | सहेजें              |
| failed              | नाकाम / … नहीं हो पाया                   | विफल, असफल          |
| use                 | इस्तेमाल                                 | उपयोग               |
| status (column)     | स्थिति                                   | —                   |
| uptime              | अपटाइम                                   | चालू समय            |
| floor               | मंज़िल                                   | फ़्लोर              |
| optional            | ज़रूरी नहीं                              | वैकल्पिक            |

**Spelling.** Nukta forms always: ज़्यादा, ज़रूरी, ख़त्म, ख़ुद, आख़िरी,
फ़ाइबर, फ़िल्टर, ऑफ़लाइन, रीफ़्रेश. Files are kept NFC. Hindi sentences end
with । ; an English sentence-final "." inside a fragment key (e.g.
`bandwidth.fullStop`) has its own key so the Hindi can use ।.

**Tone.** Short, spoken, second person plural (आप). Prefer "… नहीं हो
पाया" to "… विफल रहा"; "दिक्कत" to "समस्या" in casual copy; "ख़ुद लिखें" to
"मैन्युअल रूप से दर्ज करें". Keep the English copy's honesty: if the English
says "we did not measure this", the Hindi must not sound more certain.

**Plurals and variables.** Hindi uses the same CLDR categories as English
(`_one`, `_other`). Every `{{variable}}`, `<tag>` and plural pair in a Hindi
string must match its English twin; `scripts/check-i18n-literals.mjs` checks
all three for every key.

## Dates and numbers

One formatter: `src/lib/format.ts` (pure) and `useFormat()` in
`src/lib/useFormat.ts` (React; re-renders on a language switch).

- Locale: `en` → `en-IN`, `hi` → `hi-IN`. Indian digit grouping (1,23,456),
  Latin digits in both languages.
- Clock: **12-hour everywhere** ("4:05 pm"), no seconds. It is how owners
  read and say time in both languages; one choice for every screen so a chart
  axis and the row beside it never disagree.
- Dates: day before month, month as a word ("31 Oct", "31 अक्टू॰ 2026"); the
  year only when it is not this year. Never all-numeric on screen.
- Relative: "2 min ago" / "2 मिनट पहले"; under a minute "just now" / "अभी".
  Hindi always uses the long form — the short Hindi abbreviations ("2 मि॰
  पहले", "बीता कल") read as machine output.
- Exception: report tables and their CSV export keep `DD-MM-YYYY HH:mm`
  (the CSV is exported byte-for-byte as displayed, and spreadsheets need a
  stable numeric format).

## Keeping English out of the Hindi screens

`scripts/check-i18n-literals.mjs` (CI: "customer console i18n literals +
parity") lists every user-visible English literal in the customer trees and
fails on a new one. Remaining literals live in
`scripts/i18n-literals-allowlist.json`, which only shrinks. Genuine
non-copy tokens (MAC, IP, units, brand names) are recognised automatically;
English fallbacks rendered through `t()` elsewhere go between
`// i18n-ignore-start` and `// i18n-ignore-end` with a reason.

Known English that is outside these files: sentences composed by shared
libraries (`src/lib/location-liveness.ts` router summaries and next steps,
`src/lib/device-liveness.ts` / `src/lib/hardware-health.ts` detail lines such
as "up since 14:33 · port ether2 dropped 3× in 24h"), alert titles that come
from the backend, and demo fixture data. The status _words_ from those
libraries are translated at render (`useRowWords()` in
`src/components/customer/devices/ui.tsx`, `routerLabel()` in
`ConsoleHealth.tsx`).
