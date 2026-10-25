import { useTranslation } from "react-i18next";
import { Check, Lock, X } from "lucide-react";
import i18n from "@/lib/i18n";
import { AskWyfy } from "@/components/traffic-lens/TrafficLensParts";
import { FIREWALL_ENABLE_SUBJECT } from "@/lib/firewall-section";

/** What the add-on adds, and the one plain thing it does not. */
const LOCKED_POINTS: readonly { key: string; text: string; included: boolean }[] = [
  {
    key: "rules",
    text: "Firewall rules for your guest network, applied to your router",
    included: true,
  },
  {
    key: "websites",
    text: "Block websites by name, by app or by category, and block internet addresses",
    included: true,
  },
  {
    key: "protection",
    text: "Limit connection floods and keep guests from seeing each other",
    included: true,
  },
  {
    key: "free",
    text: "Your Security Check and blocked guests stay available without it",
    included: false,
  },
];

/**
 * The locked state: the add-on exists and this organisation does not have
 * it. No sample rules and no preview: it says what Firewall does and how to
 * get it, and the one action files a real support ticket through the same
 * call Marketing and Traffic Lens use (`AskWyfy`), never twice.
 */
export function FirewallAddonLocked() {
  const { t } = useTranslation("nav", { i18n });
  return (
    <section
      aria-label={t("firewallAddon.title", "Firewall is an add-on")}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div className="space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">
            <Lock className="h-3 w-3" aria-hidden />
            {t("customerItemBadge.addon", "Add-on")}
          </span>
          <h2 className="text-xl font-semibold tracking-tight">
            {t("firewallAddon.title", "Firewall is an add-on")}
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {t("firewallAddon.body", "It is not enabled for your organisation.")}
          </p>
          <ul className="space-y-2">
            {LOCKED_POINTS.map((p) => (
              <li key={p.key} className="flex items-start gap-2.5 text-sm">
                {p.included ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>{t(`firewallAddon.point.${p.key}`, p.text)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:w-60">
          <AskWyfy
            subject={FIREWALL_ENABLE_SUBJECT}
            description="Please enable the Firewall add-on (firewall rules and Block Websites) for our organisation."
            label={t("firewallAddon.ask", "Ask Wyfy to enable it")}
          />
        </div>
      </div>
    </section>
  );
}
