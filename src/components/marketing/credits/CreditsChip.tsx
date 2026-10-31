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
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wy-accent)] motion-reduce:transition-none",
        tone === "ok" &&
          "border-[var(--wy-border)] bg-[var(--wy-surface)] text-[var(--wy-text)] hover:bg-[var(--wy-surface-2)]",
        tone === "low" &&
          "border-[color-mix(in_srgb,var(--wy-warn)_32%,transparent)] bg-[var(--wy-warn-soft)] text-[var(--wy-text)]",
        tone === "empty" &&
          "border-[color-mix(in_srgb,var(--wy-crit)_28%,transparent)] bg-[var(--wy-crit-soft)] text-[var(--wy-crit)]",
      )}
      title={
        q.data.reserved_minor > 0
          ? `${formatCredits(q.data.reserved_minor)} held for scheduled or sending campaigns`
          : undefined
      }
    >
      <Coins className="h-3.5 w-3.5" aria-hidden />
      {formatCredits(q.data.available_minor)} credits
    </button>
  );
}
