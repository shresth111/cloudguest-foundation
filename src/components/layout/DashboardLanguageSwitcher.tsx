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
import { setDashboardLanguage } from "@/lib/i18n";
import { authService } from "@/services/auth.service";
import type { AppError } from "@/services/api";

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
  const current = user?.language ?? "en";

  async function switchTo(lang: string) {
    if (lang === current) return;
    // Optimistic: flip the rendered language immediately, persist in the
    // background. Matches AccountSection's save() -- same two calls, same
    // order (persist, then updateUser, then setDashboardLanguage) so the
    // two entry points can't drift out of sync.
    setDashboardLanguage(lang);
    try {
      const updated = await authService.updateMyProfile({ language: lang });
      updateUser(updated);
    } catch (err) {
      // Revert the visual change if the save didn't actually stick --
      // otherwise the UI silently claims a preference the backend never got.
      setDashboardLanguage(current);
      toast.error((err as AppError).message || "Failed to save language preference");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? "h-9 w-9"}
          aria-label="Language"
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
