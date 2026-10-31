import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatHour,
  formatInteger,
  formatNumber,
  formatPercent,
  formatRelative,
  formatRupees,
  formatTime,
  formatWhen,
  intlLocale,
} from "@/lib/format";

/** All of the above bound to the dashboard's current language; re-renders on
 * a language switch because it reads `i18n.language` through the hook. */
export function useFormat() {
  const { i18n: inst } = useTranslation(undefined, { i18n });
  const lang = inst.language;
  return {
    lang,
    locale: intlLocale(lang),
    number: (v: number | null | undefined, o?: Intl.NumberFormatOptions) =>
      formatNumber(v, lang, o),
    integer: (v: number | null | undefined) => formatInteger(v, lang),
    percent: (v: number | null | undefined, digits?: number) => formatPercent(v, lang, digits),
    rupees: (v: number | null | undefined, digits?: number) => formatRupees(v, lang, digits),
    date: (v: Date | string | number | null | undefined, o?: { withYear?: boolean }) =>
      formatDate(v, lang, o),
    time: (v: Date | string | number | null | undefined) => formatTime(v, lang),
    dateTime: (v: Date | string | number | null | undefined, o?: { withYear?: boolean }) =>
      formatDateTime(v, lang, o),
    hour: (v: Date | string | number | null | undefined) => formatHour(v, lang),
    when: (v: Date | string | number | null | undefined, now?: number) => formatWhen(v, lang, now),
    relative: (
      v: Date | string | number | null | undefined,
      o?: { now?: number; style?: "long" | "short" },
    ) => formatRelative(v, lang, o),
    duration: (ms: number | null | undefined) => formatDuration(ms, lang),
  };
}
