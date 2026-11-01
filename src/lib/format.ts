/**
 * Dates, times and numbers for the customer (venue-owner) console, in the
 * dashboard's active language.
 *
 * WHY ONE MODULE
 * --------------
 * The console rendered dates with `toLocaleString()` and no locale, which
 * means "whatever the viewer's browser is set to": a venue owner on a laptop
 * bought with a US profile saw `10/31/2026, 4:05:00 PM` beside a Hindi label,
 * and the same field rendered `31/10/2026` on the next screen. Each screen
 * also grew its own "x min ago" in English only ("Checked 2 minutes ago" in
 * the shell never switched to Hindi). Everything here takes the dashboard
 * language (`i18n.language`, "en" | "hi") and maps it to an Indian locale.
 *
 * DECISIONS (see docs/design/i18n-style.md)
 *   - Locale: `en` -> `en-IN`, `hi` -> `hi-IN`. Both group digits the Indian
 *     way (1,23,456) and keep Latin digits (0-9): every owner reads them, the
 *     router, the bill and the phone all show them, and Devanagari digits
 *     (१२३) would be the only place in their day they meet them.
 *   - Clock: 12-hour, everywhere ("4:05 pm"). It is how a cafe or hotel owner
 *     reads and says time in both languages; 24-hour reads as railway/
 *     technical. One choice for every screen, so a chart axis and the row
 *     beside it never disagree. Seconds are never shown.
 *   - Dates: day before month, month as a short word ("31 Oct 2026",
 *     "31 अक्टू॰ 2026") -- never all-numeric, so 03/04 can never be read as
 *     March vs April. The year is dropped when it is the current year.
 *   - Relative time: Intl.RelativeTimeFormat, LONG style in Hindi ("2 मिनट
 *     पहले") because the short Hindi abbreviations ("2 मि॰ पहले", "बीता कल")
 *     read as machine output; short style is available in English ("2 min
 *     ago") for tight chips. Under a minute is "just now" / "अभी".
 *   - Missing values render as an em dash, never a fabricated 0.
 *
 * React components use `useFormat()` (`@/lib/useFormat`), which re-renders on
 * a language switch.
 */
// The bare i18next instance, not `@/lib/i18n`: this module is imported by
// pure libraries (dashboard-range) that tests bundle on their own, and it
// must not drag the resource bundles or React in with it. `@/lib/i18n`
// initialises this same default instance, so `.language` is the dashboard's.
import i18n from "i18next";

export type DashboardLang = "en" | "hi" | string;
const DASH = "—";

/** The Intl locale for a dashboard language. Unknown languages read as
 * Indian English rather than the browser's own locale. */
export function intlLocale(lang?: DashboardLang): string {
  const l = (lang ?? i18n.language ?? "en").toLowerCase();
  return l.startsWith("hi") ? "hi-IN" : "en-IN";
}

const isHindi = (lang?: DashboardLang) => intlLocale(lang) === "hi-IN";

function toDate(v: Date | string | number | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Intl formatters are expensive to build; a chart formats hundreds of ticks.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function cached<T>(key: string, make: () => T): T {
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = make();
    cache.set(key, f as never);
  }
  return f;
}
const nf = (locale: string, o: Intl.NumberFormatOptions = {}) =>
  cached(`n|${locale}|${JSON.stringify(o)}`, () => new Intl.NumberFormat(locale, o));
const df = (locale: string, o: Intl.DateTimeFormatOptions) =>
  cached(
    `d|${locale}|${JSON.stringify(o)}`,
    () => new Intl.DateTimeFormat(locale, { hourCycle: "h12", ...o }),
  );

// ---------------------------------------------------------------------------
// Numbers

/** 123456 -> "1,23,456". `null`/NaN -> em dash. */
export function formatNumber(
  value: number | null | undefined,
  lang?: DashboardLang,
  opts: Intl.NumberFormatOptions = { maximumFractionDigits: 1 },
): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return nf(intlLocale(lang), opts).format(value);
}

/** Whole numbers (counts of guests, sessions, devices). */
export function formatInteger(value: number | null | undefined, lang?: DashboardLang): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return nf(intlLocale(lang), { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** Percent from an already-percent value (98.4 -> "98.4%"). */
export function formatPercent(
  value: number | null | undefined,
  lang?: DashboardLang,
  fractionDigits = 1,
): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return `${nf(intlLocale(lang), { maximumFractionDigits: fractionDigits }).format(value)}%`;
}

/** Rupees, no paise unless asked: 12345 -> "₹12,345". */
export function formatRupees(
  value: number | null | undefined,
  lang?: DashboardLang,
  fractionDigits = 0,
): string {
  if (value == null || !Number.isFinite(value)) return DASH;
  return nf(intlLocale(lang), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Dates and times (12-hour clock, day-before-month, no seconds)

const sameYear = (d: Date, now: Date) => d.getFullYear() === now.getFullYear();

/** "31 Oct 2026"; "31 Oct" in the current year unless `withYear`. */
export function formatDate(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
  opts: { withYear?: boolean; now?: Date } = {},
): string {
  const d = toDate(v);
  if (!d) return DASH;
  const year = opts.withYear ?? !sameYear(d, opts.now ?? new Date());
  return df(intlLocale(lang), {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  }).format(d);
}

/** "4:05 pm". */
export function formatTime(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
): string {
  const d = toDate(v);
  if (!d) return DASH;
  return df(intlLocale(lang), { hour: "numeric", minute: "2-digit" }).format(d);
}

/** "31 Oct, 4:05 pm" ("31 Oct 2025, 4:05 pm" for another year). */
export function formatDateTime(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
  opts: { withYear?: boolean; now?: Date } = {},
): string {
  const d = toDate(v);
  if (!d) return DASH;
  const year = opts.withYear ?? !sameYear(d, opts.now ?? new Date());
  return df(intlLocale(lang), {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "4:05 pm" today, "yesterday, 4:05 pm" / "कल, 4:05 pm", else
 * "29 Oct, 4:05 pm". For "when did this happen" cells. */
export function formatWhen(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
  now: number = Date.now(),
): string {
  const d = toDate(v);
  if (!d) return DASH;
  const n = new Date(now);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, n)) return formatTime(d, lang);
  if (sameDay(d, new Date(now - 86_400_000)))
    return `${isHindi(lang) ? "कल" : "yesterday"}, ${formatTime(d, lang)}`;
  return formatDateTime(d, lang, { now: n });
}

/** A chart's hour tick: "4 pm". */
export function formatHour(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
): string {
  const d = toDate(v);
  if (!d) return DASH;
  return df(intlLocale(lang), { hour: "numeric" }).format(d);
}

/** "2 minutes ago" / "2 मिनट पहले"; "just now" / "अभी" under a minute.
 * Future instants read "in 2 minutes" / "2 मिनट में". `style: "short"` gives
 * "2 min ago" in English; Hindi always uses the long form (see header). */
export function formatRelative(
  v: Date | string | number | null | undefined,
  lang?: DashboardLang,
  opts: { now?: number; style?: "long" | "short" } = {},
): string {
  const d = toDate(v);
  if (!d) return DASH;
  const hi = isHindi(lang);
  const sec = Math.round((d.getTime() - (opts.now ?? Date.now())) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return hi ? "अभी" : "just now";
  const style = hi ? "long" : (opts.style ?? "long");
  const rtf = cached(
    `r|${intlLocale(lang)}|${style}`,
    () => new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: "always", style }),
  );
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(sec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(sec / (86400 * 30)), "month");
  return rtf.format(Math.round(sec / (86400 * 365)), "year");
}

/** A span of time without "ago": "4 min", "2 hr 5 min", "3 days" /
 * "4 मिनट", "2 घंटे 5 मिनट", "3 दिन". For "down for …", "online for …". */
export function formatDuration(ms: number | null | undefined, lang?: DashboardLang): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return DASH;
  const hi = isHindi(lang);
  const n = (x: number) => formatInteger(x, lang);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return hi ? "1 मिनट से कम" : "under a minute";
  if (min < 60) return hi ? `${n(min)} मिनट` : `${n(min)} min`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  if (hr < 24) {
    const h = hi ? `${n(hr)} ${hr === 1 ? "घंटा" : "घंटे"}` : `${n(hr)} hr`;
    return rem ? `${h} ${hi ? `${n(rem)} मिनट` : `${n(rem)} min`}` : h;
  }
  const days = Math.floor(hr / 24);
  return hi ? `${n(days)} दिन` : `${n(days)} ${days === 1 ? "day" : "days"}`;
}
