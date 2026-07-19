import { Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePortalRuntime } from "@/context/PortalRuntimeContext";

export function A11yMenu() {
  const { t, highContrast, largeText, toggleHighContrast, toggleLargeText } = usePortalRuntime();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("a11y")}
          className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        >
          <Accessibility className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>{t("a11y")}</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={highContrast} onCheckedChange={toggleHighContrast}>
          {t("highContrast")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={largeText} onCheckedChange={toggleLargeText}>
          {t("largeText")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
