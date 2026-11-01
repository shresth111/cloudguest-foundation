import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import i18n, { setDashboardLanguage } from "@/lib/i18n";
import { authService } from "@/services/auth.service";
import { isHonouredDemoToken } from "@/lib/demo-host";

/** Same dropdown shape as the captive portal's own
 * `src/components/portal-runtime/LanguageSwitcher.tsx` -- a lightweight
 * second entry point next to `ThemeToggle` so switching language doesn't
 * require a trip to Account settings. Bounded to the two languages this
 * rollout actually ships (`en`/`hi`) -- see
 * docs/hindi-language-rollout-spec.md. */
const DASHBOARD_LANGUAGES: { code: "en" | "hi"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
];

export function DashboardLanguageSwitcher({ className }: { className?: string }) {
  const { user, updateUser } = useAuth();
  const { i18n: inst } = useTranslation("nav", { i18n });
  // What is on screen, not what the server last stored: after a save that
  // failed, the screen is still in the language the owner picked.
  const current = (inst.resolvedLanguage ?? inst.language ?? user?.language ?? "en").slice(0, 2);

  async function switchTo(lang: string) {
    if (lang === current) return;
    // The language changes on screen FIRST and stays changed: it is this
    // person's display choice, and a backend that cannot store it right now
    // (the 502 a PM hit) is no reason to snap the UI back to English.
    setDashboardLanguage(lang);
    // The demo has no account to save to -- and calling the backend from the
    // sales demo is how a raw "Request failed with status code 502" reached
    // a prospect. Keep the choice in the local session only.
    // (Read the same way `customer.service`'s `isDemo()` does, without pulling
    // that service into the master console, which also renders this.)
    let demo = false;
    try {
      demo = isHonouredDemoToken(window.localStorage.getItem("cloudguest_token"));
    } catch {
      demo = false;
    }
    if (demo) {
      if (user) updateUser({ ...user, language: lang });
      return;
    }
    const save = () => authService.updateMyProfile({ language: lang });
    try {
      updateUser(await save());
    } catch {
      // One quiet retry for a blip, then a plain-language note. Never the
      // raw HTTP error, and never a revert of what the owner just chose.
      try {
        await new Promise((r) => setTimeout(r, 1500));
        updateUser(await save());
      } catch {
        if (user) updateUser({ ...user, language: lang });
        toast.message(
          i18n.t(
            "consoleShell.language.notSaved",
            "Language changed on this device. We couldn't save it to your account just now — we'll use it here anyway.",
            { ns: "nav", lng: lang },
          ),
        );
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? "h-9 w-9"}
          aria-label={i18n.t("consoleShell.language.label", "Language", { ns: "nav" })}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {DASHBOARD_LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => switchTo(l.code)}
            className={current === l.code ? "font-semibold" : undefined}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
