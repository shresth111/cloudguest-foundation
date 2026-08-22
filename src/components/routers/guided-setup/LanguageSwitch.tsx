import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import masterI18n, { MASTER_LANGUAGES, setMasterLanguage } from "@/lib/master-i18n";

/**
 * Three registers, one row of buttons.
 *
 * THE REGISTERS ARE NOT TWO LANGUAGES PLUS AN ODD ONE OUT.
 *
 * `hi-Latn` (Hinglish) is the default and is listed first because it is
 * the only one that has been read by a real installer at a real rack.
 * `en` and `hi` are, on the day they ship, untested translations of tested
 * content. See `@/lib/master-i18n` for the full argument.
 *
 * NOTHING HERE MAY RESET ANYTHING.
 *
 * `setMasterLanguage` calls `i18n.changeLanguage`, which re-renders every
 * `useTranslation` subscriber in place. This component holds no state of
 * its own, is not a provider, does not navigate, and nothing in the module
 * is keyed on the language -- so the current phase, the answers already
 * given, the router name typed into the regenerate guard, the diagnostics
 * query and the scroll position all survive a switch, because not one
 * component unmounts. `cg_guided_setup_<routerId>` is not touched at all.
 * `scripts/check-guided-i18n.mjs` and the Playwright check in
 * `scripts/test-guided-i18n-switch.mjs` both exist to keep that true.
 *
 * The button labels are autonyms and are deliberately identical in all
 * three registers. A language picker that renames the languages when you
 * switch is a picker you cannot use to get back.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation("guided", { i18n: masterI18n });
  const current = i18n.resolvedLanguage;

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background p-0.5",
        className,
      )}
    >
      <Languages className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {MASTER_LANGUAGES.map((l) => {
        const active = current === l.code;
        return (
          <button
            key={l.code}
            type="button"
            // `lang` so the browser applies the right font and text
            // shaping to the label itself -- "हिंदी" inside an English
            // document otherwise inherits the Latin stack.
            lang={l.code}
            aria-pressed={active}
            onClick={() => setMasterLanguage(l.code)}
            className={cn(
              "min-h-8 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {l.autonym}
          </button>
        );
      })}
    </div>
  );
}
