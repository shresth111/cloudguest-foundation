import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketingCredits } from "@/hooks/useMarketing";
import { creditTone, formatCredits } from "@/lib/marketing-credits";

/**
 * The balance, on every Marketing tab (spec §13.10): amber when the server
 * says it is low, red at 0. Clicking opens the Credits tab. Renders nothing
 * until the server has answered -- never a placeholder number.
 */
export function CreditsChip({ onOpen }: { onOpen: () => void }) {
  const q = useMarketingCredits();
  if (!q.data) return null;
  const tone = creditTone(q.data.available_minor, q.data.is_low);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="credits-chip"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition-colors",
        tone === "ok" && "border-border bg-card text-foreground hover:bg-muted",
        tone === "low" &&
          "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200",
        tone === "empty" &&
          "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
      )}
      title={q.data.reserved_minor > 0 ? `${formatCredits(q.data.reserved_minor)} held for scheduled or sending campaigns` : undefined}
    >
      <Coins className="h-3.5 w-3.5" aria-hidden />
      {formatCredits(q.data.available_minor)} credits
    </button>
  );
}
