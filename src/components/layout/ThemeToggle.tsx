import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";

/**
 * The one theme switcher -- do not reimplement it per surface.
 *
 * `className` exists because the surfaces that mount this do not share a
 * background. The operator console's top bar follows the theme, so the
 * default ghost styling is right there; the customer console's header is a
 * permanent dark-indigo gradient (`CustomerHeader.tsx`, matching the product
 * screenshots), where the default styling is not legible -- the same reason
 * the language switcher beside it takes a className.
 *
 * Renders **nothing** when there is no `ThemeProvider` above it, rather than
 * letting a missing provider tear the page down. That is not hypothetical:
 * `CustomerHeader` is mounted bare by the render harnesses in `scripts/`
 * (`test-controller-venue-nav.mjs` mounts `CustomerFeaturePage` inside a bare
 * `QueryClientProvider`), and a cosmetic control crashing an entire console
 * is a worse failure than a missing button. See `useTheme`.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  if (!theme) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={theme.toggle}
      aria-label="Toggle theme"
      className={cn(className)}
    >
      {theme.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
