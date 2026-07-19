import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";
import { LANGUAGE_LABEL } from "@/lib/portal-i18n";
import type { RuntimeLanguage } from "@/types/portal-runtime";

export function LanguageSwitcher() {
  const { config, language, setLanguage, t } = usePortalRuntime();
  const langs = (config?.languages ?? ["en"]) as RuntimeLanguage[];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("language")}
          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {langs.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLanguage(l)}
            className={language === l ? "font-semibold" : undefined}
          >
            {LANGUAGE_LABEL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
